#!/usr/bin/env node
/**
 * Despacho: lanza sesiones de Jules para issues "jules" en cola, con cupo y bloqueo por archivos.
 *
 *   node scripts/jules/dispatch.mjs [--dry-run]
 *
 * Activo = PR de Jules abierto (firma en el cuerpo) o issue en curso sin PR todavía.
 * Nunca hay más de config.maxActive activos, ni dos tareas sobre los mismos archivos.
 */
import {
  SPEC_ERROR_MARKER,
  buildPrompt,
  ensureLabels,
  findIssueSession,
  githubClient,
  hasLabel,
  isTrustedIssue,
  julesClient,
  listManagedIssues,
  loadConfig,
  loadRules,
  log,
  parseJulesSignature,
  parseTaskSpec,
  selectDispatchable,
  sessionMarker,
  validateTaskSpec,
} from './lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const config = loadConfig();
const gh = githubClient();
const jules = julesClient();
const L = config.labels;

async function main() {
  if (!jules && !dryRun) throw new Error('Falta JULES_API_KEY');

  // 1. Actividad actual
  const openPrs = await gh.paginate('/{repo}/pulls?state=open');
  const julesPrs = openPrs
    .map((pr) => ({ pr, sessionId: parseJulesSignature(pr.body) }))
    .filter((x) => x.sessionId);

  const issues = await listManagedIssues(gh, config);
  const inProgress = issues.filter((i) => hasLabel(i, L.inProgress));

  const active = new Map(); // sessionId -> alcance (archivos)
  for (const issue of inProgress) {
    const sessionId = await findIssueSession(gh, issue.number);
    if (!sessionId) continue;
    // Sesión que terminó sin PR (fallo o abandono): libera el hueco y marca el issue
    if (jules && !julesPrs.some((x) => x.sessionId === sessionId)) {
      const session = await jules.getSession(sessionId).catch(() => null);
      // COMPLETED sin PR: Jules no propuso cambios. Se esperan 30 min por si el PR aún se está creando
      const staleCompleted =
        session?.state === 'COMPLETED' && Date.now() - Date.parse(session.updateTime || 0) > 30 * 60 * 1000;
      if (session && (['FAILED', 'CANCELLED'].includes(session.state) || staleCompleted)) {
        log(`issue #${issue.number}: la sesión ${sessionId} terminó en ${session.state}`);
        if (!dryRun) await markFailed(issue, `La sesión de Jules terminó en \`${session.state}\` sin abrir PR.`);
        continue;
      }
    }
    active.set(sessionId, parseTaskSpec(issue.body).files);
  }
  for (const { pr, sessionId } of julesPrs) {
    if (!active.has(sessionId)) {
      // PR de Jules sin tarea del orquestador (p. ej. anteriores): su alcance son sus archivos
      const files = (await gh.paginate(`/{repo}/pulls/${pr.number}/files`)).map((f) => f.filename);
      active.set(sessionId, files);
    }
  }

  const capacity = Math.max(0, config.maxActive - active.size);
  log(`activos: ${active.size}/${config.maxActive} (PRs de Jules abiertos: ${julesPrs.length}) -> huecos: ${capacity}`);

  // 2. Candidatos
  const candidates = [];
  for (const issue of issues) {
    if ([L.inProgress, L.failed, L.done].some((l) => hasLabel(issue, l))) continue;
    if (!isTrustedIssue(issue, config)) {
      log(`issue #${issue.number}: autor no confiable (${issue.user?.login}, ${issue.author_association}), se ignora`);
      continue;
    }
    const spec = parseTaskSpec(issue.body);
    const errors = validateTaskSpec(spec);
    if (errors.length > 0) {
      log(`issue #${issue.number}: especificación incompleta (${errors.join('; ')})`);
      if (!dryRun) await reportSpecError(issue, errors);
      continue;
    }
    candidates.push({ number: issue.number, title: issue.title, createdAt: issue.created_at, spec });
  }

  const { picked, blocked } = selectDispatchable(candidates, [...active.values()], capacity);
  for (const b of blocked) log(`issue #${b.number}: en espera, sus archivos se pisan con una tarea activa`);
  if (picked.length === 0) {
    log(`nada que despachar (${candidates.length} en cola)`);
    return;
  }

  // 3. Despacho
  if (!dryRun) await ensureLabels(gh, config);
  const rules = loadRules();
  for (const c of picked) {
    const prompt = buildPrompt({ issueNumber: c.number, issueTitle: c.title, spec: c.spec, rules, config });
    if (dryRun) {
      log(`[dry-run] despacharía #${c.number}: ${c.title} (${c.spec.files.join(', ')})`);
      continue;
    }
    const session = await jules.createSession({
      title: `[#${c.number}] ${c.title}`,
      prompt,
      source: config.julesSource,
      startingBranch: config.startingBranch,
    });
    const sessionId = session.id || String(session.name).split('/').pop();
    await gh.post(`/{repo}/issues/${c.number}/labels`, { labels: [L.inProgress] });
    await gh.post(`/{repo}/issues/${c.number}/comments`, {
      body: `🤖 Despachado a Jules: ${session.url || `sesión ${sessionId}`}\n\n${sessionMarker(sessionId)}`,
    });
    log(`issue #${c.number} -> sesión ${sessionId}`);
  }
}

async function markFailed(issue, reason) {
  await gh.del(`/{repo}/issues/${issue.number}/labels/${encodeURIComponent(L.inProgress)}`).catch(() => {});
  await gh.post(`/{repo}/issues/${issue.number}/labels`, { labels: [L.failed] });
  await gh.post(`/{repo}/issues/${issue.number}/comments`, {
    body: `❌ ${reason}\n\nQuita la etiqueta \`${L.failed}\` para volver a ponerla en cola.`,
  });
}

async function reportSpecError(issue, errors) {
  const comments = await gh.paginate(`/{repo}/issues/${issue.number}/comments`);
  if (comments.some((c) => c.body.includes(SPEC_ERROR_MARKER))) return; // ya avisado
  await gh.post(`/{repo}/issues/${issue.number}/comments`, {
    body: `⚠️ No se puede despachar a Jules: ${errors.join('; ')}.\nUsa la plantilla "Tarea para Jules".\n\n${SPEC_ERROR_MARKER}`,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
