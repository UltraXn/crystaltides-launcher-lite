#!/usr/bin/env node
/**
 * Guardián de PRs de Jules.
 *
 *   node scripts/jules/guard.mjs pr       (pull_request: opened/synchronize/reopened)
 *   node scripts/jules/guard.mjs ci       (workflow_run del CI: completed)
 *   node scripts/jules/guard.mjs closed   (pull_request: closed)
 *
 * Faltas (alcance o CI rojo): la primera se devuelve a la misma sesión de Jules con el detalle;
 * con config.maxStrikes (2) el PR se cierra y el issue queda en jules:failed.
 * Solo se aplican a PRs ligados a un issue del orquestador; los PRs de Jules anteriores se
 * informan pero no se bloquean.
 */
import fs from 'node:fs';
import {
  checkScope,
  findIssueForSession,
  githubClient,
  hasLabel,
  julesClient,
  loadConfig,
  log,
  parseJulesSignature,
  parseTaskSpec,
} from './lib.mjs';

const mode = process.argv[2];
const config = loadConfig();
const gh = githubClient();
const jules = julesClient();
const L = config.labels;
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const GUARD_MARKER = '<!-- jules-guard -->';

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function addLabel(number, label) {
  await gh.post(`/{repo}/issues/${number}/labels`, { labels: [label] });
}
async function removeLabel(number, label) {
  await gh.del(`/{repo}/issues/${number}/labels/${encodeURIComponent(label)}`).catch(() => {});
}

/** Comentario único del guardián en el PR (se edita en cada ejecución). */
async function upsertGuardComment(prNumber, body) {
  const comments = await gh.paginate(`/{repo}/issues/${prNumber}/comments`);
  const mine = comments.find((c) => c.body.includes(GUARD_MARKER));
  const text = `${GUARD_MARKER}\n${body}`;
  if (mine) await gh.patch(`/{repo}/issues/comments/${mine.id}`, { body: text });
  else await gh.post(`/{repo}/issues/${prNumber}/comments`, { body: text });
}

async function resolveManaged(pr) {
  const sessionId = parseJulesSignature(pr.body);
  if (!sessionId) return null;
  const issue = await findIssueForSession(gh, config, sessionId);
  return { sessionId, issue };
}

async function strike(pr, issue, sessionId, title, detail) {
  if (!hasLabel(pr, L.strike)) {
    await addLabel(pr.number, L.strike);
    const message = [
      `${title} en el PR ${pr.html_url} (tarea #${issue.number}).`,
      '',
      detail,
      '',
      'Corrígelo en este mismo PR, sin ampliar el alcance de la tarea. Es el último intento: si vuelve',
      'a fallar, el PR se cerrará automáticamente.',
    ].join('\n');
    if (jules) await jules.sendMessage(sessionId, message);
    await gh.post(`/{repo}/issues/${pr.number}/comments`, {
      body: `⚠️ **Falta 1/${config.maxStrikes}: ${title}.** Se devolvió a Jules para corregir.\n\n${detail}`,
    });
    log(`PR #${pr.number}: falta 1 -> devuelto a la sesión ${sessionId}`);
    return;
  }
  await gh.post(`/{repo}/issues/${pr.number}/comments`, {
    body: `❌ **Falta ${config.maxStrikes}/${config.maxStrikes}: ${title}.** Se cierra el PR.\n\n${detail}`,
  });
  await gh.patch(`/{repo}/pulls/${pr.number}`, { state: 'closed' });
  await removeLabel(issue.number, L.inProgress);
  await addLabel(issue.number, L.failed);
  await gh.post(`/{repo}/issues/${issue.number}/comments`, {
    body: `❌ Jules no consiguió resolverla en dos intentos (PR #${pr.number} cerrado: ${title}).\nQuita \`${L.failed}\` para reintentar.`,
  });
  log(`PR #${pr.number}: segunda falta -> cerrado, issue #${issue.number} en ${L.failed}`);
}

async function onPullRequest() {
  const pr = event.pull_request;
  const managed = await resolveManaged(pr);
  if (!managed) return log(`PR #${pr.number} no es de Jules`);
  await addLabel(pr.number, L.pr);
  if (!managed.issue) {
    log(`PR #${pr.number}: de Jules pero sin tarea del orquestador; no se valida alcance`);
    return;
  }
  const spec = parseTaskSpec(managed.issue.body);
  const files = await gh.paginate(`/{repo}/pulls/${pr.number}/files`);
  const scope = checkScope(files, spec, config);
  const summary = [
    `**Guardián de Jules** — tarea #${managed.issue.number}`,
    '',
    `Archivos permitidos: ${spec.files.map((f) => `\`${f}\``).join(', ')}`,
    `Archivos cambiados: ${files.length} · líneas: ${files.reduce((n, f) => n + f.additions + f.deletions, 0)}`,
    '',
    scope.ok ? '✅ Alcance correcto.' : `❌ Fuera de alcance:\n${scope.violations.map((v) => `- ${v}`).join('\n')}`,
  ].join('\n');
  await upsertGuardComment(pr.number, summary);
  if (!scope.ok) {
    await removeLabel(pr.number, L.readyForReview);
    await strike(pr, managed.issue, managed.sessionId, 'Cambios fuera del alcance de la tarea', scope.violations.map((v) => `- ${v}`).join('\n'));
    process.exitCode = 1;
  }
}

async function failedJobsDetail(runId) {
  const { jobs } = await gh.get(`/{repo}/actions/runs/${runId}/jobs?per_page=100`);
  const parts = [];
  for (const job of jobs.filter((j) => j.conclusion === 'failure')) {
    const steps = job.steps.filter((s) => s.conclusion === 'failure').map((s) => s.name);
    let tail = '';
    try {
      const logText = await gh.get(`/{repo}/actions/jobs/${job.id}/logs`, { raw: true });
      tail = logText
        .split('\n')
        .map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, ''))
        .filter((l) => l.trim())
        .slice(-60)
        .join('\n');
    } catch {
      // logs no disponibles: basta con el nombre del paso
    }
    parts.push(`### ${job.name}\nPaso fallido: ${steps.join(', ') || '(desconocido)'}\n\n\`\`\`\n${tail}\n\`\`\``);
  }
  return parts.join('\n\n') || 'El CI falló (sin detalle de jobs).';
}

async function onWorkflowRun() {
  const run = event.workflow_run;
  const prNumber = run.pull_requests?.[0]?.number;
  if (!prNumber) return log('el run no pertenece a un PR');
  const pr = await gh.get(`/{repo}/pulls/${prNumber}`);
  if (pr.state !== 'open') return log(`PR #${prNumber} ya no está abierto`);
  if (pr.head.sha !== run.head_sha) return log(`run de un commit anterior (${run.head_sha.slice(0, 7)}), se ignora`);
  const managed = await resolveManaged(pr);
  if (!managed?.issue) return log(`PR #${prNumber}: no es un PR gestionado por el orquestador`);

  if (run.conclusion === 'success') {
    const scope = checkScope(await gh.paginate(`/{repo}/pulls/${prNumber}/files`), parseTaskSpec(managed.issue.body), config);
    if (!scope.ok) return log(`PR #${prNumber}: CI verde pero fuera de alcance; sin review`);
    await addLabel(prNumber, L.readyForReview);
    setOutput('review', 'true');
    setOutput('pr', String(prNumber));
    setOutput('issue', String(managed.issue.number));
    return log(`PR #${prNumber}: CI verde y alcance correcto -> listo para code review`);
  }
  if (run.conclusion === 'failure') {
    await removeLabel(prNumber, L.readyForReview);
    await strike(pr, managed.issue, managed.sessionId, 'El CI falló', await failedJobsDetail(run.id));
  }
}

async function onClosed() {
  const pr = event.pull_request;
  const managed = await resolveManaged(pr);
  if (!managed?.issue) return;
  const { issue } = managed;
  await removeLabel(issue.number, L.inProgress);
  if (pr.merged) {
    await addLabel(issue.number, L.done);
    await gh.post(`/{repo}/issues/${issue.number}/comments`, { body: `✅ Resuelta en #${pr.number}.` });
    await gh.patch(`/{repo}/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    log(`issue #${issue.number}: hecha (PR #${pr.number} mergeado)`);
  } else if (!hasLabel(issue, L.failed)) {
    await addLabel(issue.number, L.failed);
    await gh.post(`/{repo}/issues/${issue.number}/comments`, {
      body: `PR #${pr.number} cerrado sin mergear. Quita \`${L.failed}\` para volver a ponerla en cola.`,
    });
  }
}

const handlers = { pr: onPullRequest, ci: onWorkflowRun, closed: onClosed };
if (!handlers[mode]) {
  console.error(`Modo desconocido: ${mode} (usa pr | ci | closed)`);
  process.exit(2);
}
handlers[mode]().catch((e) => {
  console.error(e);
  process.exit(1);
});
