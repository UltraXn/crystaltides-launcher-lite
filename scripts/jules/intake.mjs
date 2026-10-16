#!/usr/bin/env node
/**
 * Intake: convierte alertas de seguridad abiertas en issues "jules" con especificación.
 *
 *   node scripts/jules/intake.mjs [--dry-run]
 *
 * - Code scanning (CodeQL): GITHUB_TOKEN con security-events: read.
 * - Dependabot: el GITHUB_TOKEN de Actions no puede leerlas; usa JULES_ALERTS_TOKEN (PAT
 *   fine-grained con "Dependabot alerts: read") si existe. Se omiten las alertas que
 *   Dependabot ya está arreglando con su propio PR y las que no tienen versión parcheada.
 * Cada alerta genera como mucho un issue (marcador <!-- jules-alert: ... --> en el cuerpo).
 */
import { ensureLabels, githubClient, listManagedIssues, loadConfig, log, parseTaskSpec, renderTaskSpec } from './lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const config = loadConfig();
const gh = githubClient();

// Ecosistemas tal como los nombra la API de Dependabot (Cargo es "rust")
const MANIFESTS = {
  npm: ['package.json', 'pnpm-lock.yaml'],
  rust: ['src-tauri/Cargo.toml', 'src-tauri/Cargo.lock'],
};

/** Compara versiones x.y.z (suficiente para elegir la versión parcheada más alta). */
function compareVersions(a, b) {
  const pa = String(a).split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(/[.+-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

async function codeScanningTasks() {
  let alerts;
  try {
    alerts = await gh.paginate('/{repo}/code-scanning/alerts?state=open');
  } catch (e) {
    if ([403, 404].includes(e.status)) {
      log('code scanning: sin análisis disponible (¿CodeQL activo?), se omite');
      return [];
    }
    throw e;
  }
  return alerts.map((a) => {
    const loc = a.most_recent_instance?.location || {};
    const file = loc.path;
    return {
      key: `code-scanning/${a.number}`,
      title: `security(code-scanning): ${a.rule?.description || a.rule?.id} en ${file}`,
      spec: {
        problem: [
          `Alerta de code scanning #${a.number} (${a.tool?.name}, severidad ${a.rule?.security_severity_level || a.rule?.severity}).`,
          `Regla: \`${a.rule?.id}\` — ${a.rule?.description}`,
          `Ubicación: \`${file}\` líneas ${loc.start_line}-${loc.end_line}.`,
          `Mensaje: ${a.most_recent_instance?.message?.text || ''}`,
          `Detalle: ${a.html_url}`,
        ].join('\n'),
        files: [file],
        acceptance:
          'La alerta deja de reproducirse con la corrección mínima en el archivo indicado, sin cambiar el comportamiento ' +
          'funcional; hay un test que cubre el caso que la provocaba.',
      },
    };
  });
}

async function dependabotTasks() {
  const token = process.env.JULES_ALERTS_TOKEN;
  if (!token) {
    log('dependabot: sin JULES_ALERTS_TOKEN (el GITHUB_TOKEN de Actions no puede leer estas alertas), se omite');
    return [];
  }
  const alertsGh = githubClient({ token, repo: gh.repo });
  const alerts = await alertsGh.paginate('/{repo}/dependabot/alerts?state=open');
  const openPrs = await gh.paginate('/{repo}/pulls?state=open');
  const dependabotPrTitles = openPrs.filter((p) => p.user?.login === 'dependabot[bot]').map((p) => p.title.toLowerCase());

  // Varias alertas del mismo paquete -> una sola tarea (mismos archivos: se bloquearían entre sí)
  const byPackage = new Map();
  for (const a of alerts) {
    const pkg = a.dependency?.package?.name;
    const ecosystem = a.dependency?.package?.ecosystem;
    const patched = a.security_vulnerability?.first_patched_version?.identifier;
    if (!MANIFESTS[ecosystem]) {
      log(`dependabot #${a.number} (${pkg}): ecosistema "${ecosystem}" no soportado, se omite`);
      continue;
    }
    if (!patched) {
      log(`dependabot #${a.number} (${pkg}): sin versión parcheada, requiere decisión humana`);
      continue;
    }
    if (dependabotPrTitles.some((t) => t.includes(String(pkg).toLowerCase()))) {
      log(`dependabot #${a.number} (${pkg}): Dependabot ya tiene un PR abierto, se omite`);
      continue;
    }
    const id = `${ecosystem}/${pkg}`;
    if (!byPackage.has(id)) byPackage.set(id, { pkg, ecosystem, alerts: [] });
    byPackage.get(id).alerts.push(a);
  }

  const severityRank = { critical: 4, high: 3, medium: 2, moderate: 2, low: 1 };
  const tasks = [];
  for (const [id, { pkg, ecosystem, alerts: group }] of byPackage) {
    const patched = group
      .map((a) => a.security_vulnerability.first_patched_version.identifier)
      .sort(compareVersions)
      .pop();
    const worst = group
      .map((a) => a.security_advisory?.severity)
      .sort((x, y) => (severityRank[y] || 0) - (severityRank[x] || 0))[0];
    tasks.push({
      key: `dependabot/${id}`,
      title: `security(deps): ${pkg} vulnerable (${worst}, ${group.length} alerta${group.length > 1 ? 's' : ''})`,
      spec: {
        problem: [
          `\`${pkg}\` (${ecosystem}) tiene ${group.length} alerta(s) de Dependabot abiertas:`,
          ...group.map(
            (a) =>
              `- #${a.number} [${a.security_advisory?.severity}] ${a.security_advisory?.summary} ` +
              `(vulnerable \`${a.security_vulnerability?.vulnerable_version_range}\`, parcheada en ` +
              `\`${a.security_vulnerability?.first_patched_version?.identifier}\`) — ${a.html_url}`,
          ),
          `Dependencia en \`${group[0].dependency?.manifest_path}\` (${group[0].dependency?.relationship || 'relación desconocida'}).`,
          'Si llegar a la versión parcheada exige subir de versión mayor a otra dependencia (p. ej. Tauri), no lo',
          'hagas: explícalo en el PR y deja el lockfile como está.',
        ].join('\n'),
        files: MANIFESTS[ecosystem],
        acceptance:
          `\`${pkg}\` resuelve a una versión >= ${patched} en el lockfile, sin cambios de versión mayor en otras ` +
          'dependencias, y toda la verificación pasa.',
        kind: 'dependencias',
      },
    });
  }
  return tasks;
}

async function main() {
  const tasks = [...(await codeScanningTasks()), ...(await dependabotTasks())];
  const existingKeys = new Set(
    (await listManagedIssues(gh, config, 'all')).map((i) => parseTaskSpec(i.body).alertKey).filter(Boolean),
  );
  const fresh = tasks.filter((t) => !existingKeys.has(t.key));
  log(`${tasks.length} alertas aptas, ${fresh.length} nuevas`);

  if (!dryRun && fresh.length > 0) await ensureLabels(gh, config);
  for (const t of fresh) {
    if (dryRun) {
      log(`[dry-run] crearía issue: ${t.title}`);
      continue;
    }
    const issue = await gh.post('/{repo}/issues', {
      title: t.title,
      body: renderTaskSpec({ ...t.spec, alertKey: t.key }),
      labels: [config.labels.queued],
    });
    log(`issue #${issue.number} creado para ${t.key}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
