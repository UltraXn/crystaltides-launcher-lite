/**
 * Orquestador de Jules: lógica compartida.
 *
 * Flujo: alertas de seguridad e issues -> issues "jules" con una especificación estructurada
 * (problema, archivos permitidos, criterio de aceptación) -> despacho con cupo y bloqueo por
 * archivos -> guardián de alcance + CI en el PR -> code review -> merge humano.
 *
 * La lógica pura (parseo, alcance, selección, prompt) no hace I/O y se testea en lib.test.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, '.github', 'jules', 'config.json'), 'utf8'));
}

export function loadRules() {
  return fs.readFileSync(path.join(repoRoot, '.github', 'jules', 'RULES.md'), 'utf8');
}

// ---------------------------------------------------------------------------
// Especificación de tarea (cuerpo del issue)
// ---------------------------------------------------------------------------

export const SECTION = {
  problem: 'Problema',
  files: 'Archivos permitidos',
  acceptance: 'Criterio de aceptación',
  kind: 'Tipo',
};
export const KIND_DEPENDENCIES = 'dependencias';

const ALERT_MARKER = /<!--\s*jules-alert:\s*([^\s>]+)\s*-->/;
const SESSION_MARKER = /<!--\s*jules-session:\s*(\d+)\s*-->/;
const SPEC_ERROR_MARKER = '<!-- jules-spec-error -->';
export { SPEC_ERROR_MARKER };

/**
 * Quita los comentarios HTML hasta que no quede ninguno: una sola pasada deja `<!--` si vienen
 * anidados (`<!-<!-- x -->-`). Los delimitadores sueltos que queden también se eliminan.
 */
export function stripHtmlComments(input) {
  let previous;
  let text = String(input);
  do {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  } while (text !== previous);
  return text.replace(/<!--|-->/g, '');
}

/** Parsea secciones `### Título` (formato de issue forms y de los issues del intake). */
export function parseTaskSpec(body = '') {
  const sections = {};
  let current = null;
  for (const line of String(body).replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  const text = (name) => stripHtmlComments((sections[name] || []).join('\n')).trim();
  const noResponse = (v) => (v === '_No response_' ? '' : v);

  const files = text(SECTION.files)
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s+/, '').replace(/`/g, '').trim())
    .filter((l) => l && !l.startsWith('```') && l !== '_No response_');

  const alert = String(body).match(ALERT_MARKER);
  return {
    problem: noResponse(text(SECTION.problem)),
    files: [...new Set(files.map(normalizePath))],
    acceptance: noResponse(text(SECTION.acceptance)),
    kind: noResponse(text(SECTION.kind)).toLowerCase(),
    alertKey: alert ? alert[1] : null,
  };
}

export function renderTaskSpec({ problem, files, acceptance, kind = '', alertKey = null }) {
  const parts = [
    `### ${SECTION.problem}\n\n${problem}`,
    `### ${SECTION.files}\n\n${files.map((f) => `- \`${f}\``).join('\n')}`,
    `### ${SECTION.acceptance}\n\n${acceptance}`,
  ];
  if (kind) parts.push(`### ${SECTION.kind}\n\n${kind}`);
  if (alertKey) parts.push(`<!-- jules-alert: ${alertKey} -->`);
  return parts.join('\n\n') + '\n';
}

/** Lista de problemas de una especificación; vacía si es despachable. */
export function validateTaskSpec(spec) {
  const errors = [];
  if (!spec.problem) errors.push(`falta la sección "${SECTION.problem}"`);
  if (spec.files.length === 0) errors.push(`falta al menos un archivo en "${SECTION.files}"`);
  if (!spec.acceptance) errors.push(`falta la sección "${SECTION.acceptance}"`);
  return errors;
}

export function parseSessionMarker(text = '') {
  const m = String(text).match(SESSION_MARKER);
  return m ? m[1] : null;
}

export function sessionMarker(sessionId) {
  return `<!-- jules-session: ${sessionId} -->`;
}

/** Firma que Jules añade al cuerpo de sus PRs (los PRs aparecen con el usuario del dueño). */
export function parseJulesSignature(prBody = '') {
  const m =
    String(prBody).match(/PR created automatically by Jules for task \[(\d+)\]/) ||
    String(prBody).match(/jules\.google\.com\/task\/(\d+)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// Alcance
// ---------------------------------------------------------------------------

export function normalizePath(p) {
  return String(p).trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * Glob mínimo: `**` cruza directorios, `*` y `?` no. Un patrón sin `/` y con comodines
 * se compara contra el nombre del archivo en cualquier carpeta (`*.key`); sin comodines es
 * una ruta exacta desde la raíz (`Cargo.lock` no coincide con `src-tauri/Cargo.lock`).
 */
export function matchesGlob(filePath, pattern) {
  const file = normalizePath(filePath);
  const pat = normalizePath(pattern);
  const hasWildcard = /[*?]/.test(pat);
  if (!hasWildcard) return file === pat || file.startsWith(`${pat}/`);
  const target = pat.includes('/') ? file : file.split('/').pop();
  let re = '';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '*' && pat[i + 1] === '*') {
      re += '.*';
      i++;
      if (pat[i + 1] === '/') i++; // `**/` también coincide con cero carpetas
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(target);
}

const matchesAny = (file, patterns) => patterns.some((p) => matchesGlob(file, p));

export function isTestPath(filePath) {
  const f = normalizePath(filePath);
  return /(^|\/)__tests__\//.test(f) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
}

/** Tests nuevos o editados junto a un archivo permitido (misma carpeta o su __tests__). */
function isCompanionTest(filePath, allowed) {
  if (!isTestPath(filePath)) return false;
  const dir = path.posix.dirname(normalizePath(filePath)).replace(/\/__tests__$/, '');
  return allowed.some((a) => {
    const allowedDir = path.posix.dirname(normalizePath(a).replace(/\/\*\*.*$/, '/x'));
    return dir === allowedDir || dir.startsWith(`${allowedDir}/`);
  });
}

/**
 * @param {{filename:string, additions?:number, deletions?:number}[]} changedFiles
 * @returns {{ok:boolean, violations:string[]}}
 */
export function checkScope(changedFiles, spec, config) {
  const violations = [];
  const isDependencyTask = spec.kind === KIND_DEPENDENCIES;
  let changedLines = 0;

  for (const f of changedFiles) {
    const file = normalizePath(f.filename);
    changedLines += (f.additions || 0) + (f.deletions || 0);

    if (matchesAny(file, config.forbiddenPaths)) {
      violations.push(`\`${file}\` está en una ruta prohibida`);
      continue;
    }
    if (config.lockfilesRequireDependencyTask.includes(file) && !isDependencyTask) {
      violations.push(`\`${file}\` solo puede cambiar en tareas de tipo "${KIND_DEPENDENCIES}"`);
      continue;
    }
    if (!matchesAny(file, spec.files) && !isCompanionTest(file, spec.files)) {
      violations.push(`\`${file}\` está fuera de los archivos permitidos`);
    }
  }
  if (changedLines > config.maxChangedLines) {
    violations.push(`el diff cambia ${changedLines} líneas (máximo ${config.maxChangedLines})`);
  }
  return { ok: violations.length === 0, violations };
}

/** Dos alcances se pisan si algún archivo/patrón de uno coincide con el otro. */
export function scopesOverlap(a, b) {
  return a.some((x) => b.some((y) => matchesGlob(x, y) || matchesGlob(y, x)));
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

export function isTrustedIssue(issue, config) {
  return (
    config.trustedAuthorAssociations.includes(issue.author_association) ||
    config.trustedBots.includes(issue.user?.login)
  );
}

/**
 * Elige qué tareas despachar respetando el cupo y sin pisar archivos de tareas activas
 * ni entre sí. Las alertas de seguridad van primero; luego por antigüedad.
 *
 * @param {{number:number, createdAt:string, spec:object}[]} candidates
 * @param {string[][]} activeScopes alcances (archivos) de sesiones/PRs activos
 */
export function selectDispatchable(candidates, activeScopes, capacity) {
  const ordered = [...candidates].sort((x, y) => {
    const sec = Number(Boolean(y.spec.alertKey)) - Number(Boolean(x.spec.alertKey));
    return sec !== 0 ? sec : String(x.createdAt).localeCompare(String(y.createdAt));
  });
  const scopes = [...activeScopes];
  const picked = [];
  const blocked = [];
  for (const c of ordered) {
    if (picked.length >= capacity) break;
    if (scopes.some((s) => scopesOverlap(c.spec.files, s))) {
      blocked.push(c);
      continue;
    }
    picked.push(c);
    scopes.push(c.spec.files);
  }
  return { picked, blocked };
}

export function buildPrompt({ issueNumber, issueTitle, spec, rules, config }) {
  return [
    `Tarea #${issueNumber}: ${issueTitle}`,
    '',
    '## Problema',
    spec.problem,
    '',
    '## Archivos permitidos',
    ...spec.files.map((f) => `- ${f}`),
    '',
    '## Criterio de aceptación',
    spec.acceptance,
    '',
    '## Verificación (ejecuta todo antes de abrir el PR)',
    ...config.verification.map((c) => `- \`${c}\``),
    '',
    `Incluye "Closes #${issueNumber}" en la descripción del PR.`,
    '',
    rules,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Clientes HTTP (solo se usan desde los scripts, no desde los tests)
// ---------------------------------------------------------------------------

export function githubClient({ token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY } = {}) {
  if (!token) throw new Error('Falta GITHUB_TOKEN');
  if (!repo) throw new Error('Falta GITHUB_REPOSITORY (owner/repo)');
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';

  async function request(method, endpoint, body, { raw = false, withLink = false } = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint.replace('{repo}', `repos/${repo}`)}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(`GitHub ${method} ${endpoint}: ${res.status} ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    if (raw) return res.text();
    const data = res.status === 204 ? null : await res.json();
    if (withLink) {
      const next = (res.headers.get('link') || '').match(/<([^>]+)>;\s*rel="next"/);
      return { data, next: next ? next[1] : null };
    }
    return data;
  }

  /** Sigue la cabecera Link: sirve para paginación por página y por cursor (Dependabot). */
  async function paginate(endpoint) {
    const out = [];
    const sep = endpoint.includes('?') ? '&' : '?';
    let url = `${endpoint}${sep}per_page=100`;
    for (let i = 0; url && i < 50; i++) {
      const { data, next } = await request('GET', url, undefined, { withLink: true });
      out.push(...data);
      url = next;
    }
    return out;
  }

  // JULES_DRY_RUN=1: las lecturas van a la API real, las escrituras solo se registran
  const write = (method) => (e, b) => {
    if (process.env.JULES_DRY_RUN === '1') {
      log(`[dry-run] ${method} ${e}${b ? ` ${JSON.stringify(b).slice(0, 160)}` : ''}`);
      return Promise.resolve({});
    }
    return request(method, e, b);
  };

  return {
    repo,
    get: (e, o) => request('GET', e, undefined, o),
    post: write('POST'),
    patch: write('PATCH'),
    del: write('DELETE'),
    paginate,
  };
}

export function julesClient({ apiKey = process.env.JULES_API_KEY } = {}) {
  if (!apiKey) return null;
  async function request(method, endpoint, body) {
    if (method !== 'GET' && process.env.JULES_DRY_RUN === '1') {
      log(`[dry-run] Jules ${method} ${endpoint}`);
      return { id: 'dry-run', name: 'sessions/dry-run' };
    }
    const res = await fetch(`https://jules.googleapis.com/v1alpha${endpoint}`, {
      method,
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Jules ${method} ${endpoint}: ${res.status} ${await res.text()}`);
    return res.json();
  }
  return {
    getSession: (id) => request('GET', `/sessions/${id}`),
    createSession: ({ title, prompt, source, startingBranch }) =>
      request('POST', '/sessions', {
        title,
        prompt,
        sourceContext: { source, githubRepoContext: { startingBranch } },
        automationMode: 'AUTO_CREATE_PR',
        requirePlanApproval: false,
      }),
    sendMessage: (id, prompt) => request('POST', `/sessions/${id}:sendMessage`, { prompt }),
  };
}

// ---------------------------------------------------------------------------
// Utilidades de GitHub de más alto nivel
// ---------------------------------------------------------------------------

export async function ensureLabels(gh, config) {
  const existing = new Set((await gh.paginate('/{repo}/labels')).map((l) => l.name));
  const colors = { queued: '1d76db', inProgress: 'fbca04', failed: 'b60205', done: '0e8a16', pr: '5319e7', strike: 'd93f0b', readyForReview: '0052cc' };
  for (const [key, name] of Object.entries(config.labels)) {
    if (!existing.has(name)) await gh.post('/{repo}/labels', { name, color: colors[key] || 'ededed' });
  }
}

/** Issues gestionados por el orquestador (la etiqueta base se conserva en todo su ciclo). */
export async function listManagedIssues(gh, config, state = 'open') {
  const items = await gh.paginate(`/{repo}/issues?state=${state}&labels=${encodeURIComponent(config.labels.queued)}`);
  return items.filter((i) => !i.pull_request);
}

export const hasLabel = (item, name) => (item.labels || []).some((l) => (typeof l === 'string' ? l : l.name) === name);

/** Busca el marcador de sesión entre los comentarios del issue. */
export async function findIssueSession(gh, issueNumber) {
  const comments = await gh.paginate(`/{repo}/issues/${issueNumber}/comments`);
  for (const c of comments.reverse()) {
    const id = parseSessionMarker(c.body);
    if (id) return id;
  }
  return null;
}

/** issue en curso cuya sesión coincide con la firma del PR. */
export async function findIssueForSession(gh, config, sessionId) {
  const inProgress = (await listManagedIssues(gh, config)).filter((i) => hasLabel(i, config.labels.inProgress));
  for (const issue of inProgress) {
    if ((await findIssueSession(gh, issue.number)) === sessionId) return issue;
  }
  return null;
}

export function log(...args) {
  console.log('[jules]', ...args);
}
