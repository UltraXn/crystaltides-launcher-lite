import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadConfig,
  parseTaskSpec,
  renderTaskSpec,
  validateTaskSpec,
  parseJulesSignature,
  parseSessionMarker,
  sessionMarker,
  matchesGlob,
  checkScope,
  scopesOverlap,
  selectDispatchable,
  isTrustedIssue,
  buildPrompt,
} from './lib.mjs';

const config = loadConfig();

test('parsea el formato de issue forms (incluido "_No response_")', () => {
  const body = [
    '### Problema',
    '',
    'El login no limpia el timer al desmontar.',
    '',
    '### Archivos permitidos',
    '',
    '- `src/components/LoginView.tsx`',
    'src/services/authService.ts',
    '',
    '### Criterio de aceptación',
    '',
    'Sin warnings de setState tras desmontar; test que lo cubra.',
    '',
    '### Tipo',
    '',
    '_No response_',
  ].join('\n');
  const spec = parseTaskSpec(body);
  assert.equal(spec.problem, 'El login no limpia el timer al desmontar.');
  assert.deepEqual(spec.files, ['src/components/LoginView.tsx', 'src/services/authService.ts']);
  assert.match(spec.acceptance, /test que lo cubra/);
  assert.equal(spec.kind, '');
  assert.deepEqual(validateTaskSpec(spec), []);
});

test('render -> parse conserva la especificación y el marcador de alerta', () => {
  const original = {
    problem: 'CVE en tar',
    files: ['package.json', 'pnpm-lock.yaml'],
    acceptance: 'Actualizar a la versión parcheada',
    kind: 'dependencias',
    alertKey: 'dependabot/7',
  };
  assert.deepEqual(parseTaskSpec(renderTaskSpec(original)), original);
});

test('una especificación incompleta no es despachable', () => {
  const errors = validateTaskSpec(parseTaskSpec('### Problema\n\nalgo'));
  assert.equal(errors.length, 2);
});

test('detecta la firma de Jules en el cuerpo del PR y el marcador de sesión', () => {
  const body = '...\n*PR created automatically by Jules for task [2947335571608962819](https://jules.google.com/task/2947335571608962819) started by @UltraXn*';
  assert.equal(parseJulesSignature(body), '2947335571608962819');
  assert.equal(parseJulesSignature('PR normal'), null);
  assert.equal(parseSessionMarker(`hola ${sessionMarker('123')}`), '123');
});

test('glob: ** cruza carpetas, patrones sin "/" con comodín miran el nombre, sin comodín son exactos', () => {
  assert.ok(matchesGlob('src-tauri/assets/game-bridge.jar', 'src-tauri/assets/**'));
  assert.ok(matchesGlob('src/components/a/b.tsx', 'src/components/**'));
  assert.ok(matchesGlob('src/x.ts', 'src/**/*.ts'));
  assert.ok(!matchesGlob('src/a/x.ts', 'src/*.ts'));
  assert.ok(matchesGlob('deep/dir/crystaltides.key', '*.key'));
  assert.ok(matchesGlob('Cargo.lock', 'Cargo.lock'));
  assert.ok(!matchesGlob('src-tauri/Cargo.lock', 'Cargo.lock'));
  assert.ok(matchesGlob('src/utils', 'src/utils')); // carpeta exacta
  assert.ok(matchesGlob('src/utils/redact.ts', 'src/utils'));
});

test('alcance: acepta archivos permitidos y sus tests', () => {
  const spec = parseTaskSpec(renderTaskSpec({ problem: 'p', files: ['src/utils/redact.ts'], acceptance: 'a' }));
  const result = checkScope(
    [
      { filename: 'src/utils/redact.ts', additions: 10, deletions: 2 },
      { filename: 'src/utils/__tests__/redact.test.ts', additions: 30, deletions: 0 },
    ],
    spec,
    config,
  );
  assert.deepEqual(result, { ok: true, violations: [] });
});

test('alcance: rechaza lo que hizo Jules en los PRs reales', () => {
  const spec = parseTaskSpec(renderTaskSpec({ problem: 'p', files: ['src-tauri/src/sys/windows.rs'], acceptance: 'a' }));
  const result = checkScope(
    [
      { filename: 'src-tauri/src/sys/windows.rs', additions: 40, deletions: 10 },
      { filename: 'Cargo.lock', additions: 3000, deletions: 0 }, // PR #24: Cargo.lock nuevo en la raíz
      { filename: 'src-tauri/assets/game-bridge.jar' },
      { filename: 'src-tauri/src/process_manager.rs', additions: 5, deletions: 5 },
      { filename: 'pnpm-lock.yaml', additions: 1, deletions: 1 },
    ],
    spec,
    config,
  );
  assert.equal(result.ok, false);
  const text = result.violations.join('\n');
  assert.match(text, /`Cargo.lock` está en una ruta prohibida/);
  assert.match(text, /`src-tauri\/assets\/game-bridge.jar` está en una ruta prohibida/);
  assert.match(text, /process_manager.rs` está fuera de los archivos permitidos/);
  assert.match(text, /pnpm-lock.yaml` solo puede cambiar en tareas de tipo "dependencias"/);
  assert.match(text, /el diff cambia \d+ líneas/);
});

test('alcance: los lockfiles sí pueden cambiar en tareas de dependencias', () => {
  const spec = parseTaskSpec(
    renderTaskSpec({ problem: 'p', files: ['package.json', 'pnpm-lock.yaml'], acceptance: 'a', kind: 'dependencias' }),
  );
  const result = checkScope([{ filename: 'pnpm-lock.yaml', additions: 20, deletions: 20 }], spec, config);
  assert.equal(result.ok, true);
});

test('una ruta prohibida no se habilita aunque la tarea la liste', () => {
  const spec = parseTaskSpec(renderTaskSpec({ problem: 'p', files: ['.github/workflows/ci.yml'], acceptance: 'a' }));
  assert.equal(checkScope([{ filename: '.github/workflows/ci.yml', additions: 1 }], spec, config).ok, false);
});

test('selección: respeta el cupo, no pisa archivos activos ni entre candidatos, alertas primero', () => {
  const mk = (number, files, createdAt, alertKey = null) => ({ number, createdAt, spec: { files, alertKey } });
  const candidates = [
    mk(1, ['src/a.ts'], '2026-01-01'),
    mk(2, ['src-tauri/src/sys/windows.rs'], '2026-01-02'), // bloqueado: hay un PR activo sobre sys/
    mk(3, ['src/a.ts'], '2026-01-03'), // pisa al #1
    mk(4, ['package.json', 'pnpm-lock.yaml'], '2026-01-04', 'dependabot/1'),
    mk(5, ['src/b.ts'], '2026-01-05'),
  ];
  const { picked, blocked } = selectDispatchable(candidates, [['src-tauri/src/sys/**']], 3);
  assert.deepEqual(picked.map((c) => c.number), [4, 1, 5]); // alerta primero, luego por antigüedad
  assert.deepEqual(blocked.map((c) => c.number), [2, 3]); // #2 pisa un PR activo, #3 pisa al #1
  assert.deepEqual(selectDispatchable(candidates, [], 1).picked.map((c) => c.number), [4]);
  assert.equal(selectDispatchable(candidates, [], 0).picked.length, 0);
  assert.ok(scopesOverlap(['src/a.ts'], ['src/**']));
});

test('solo se despachan issues de dueño/colaboradores o del propio intake', () => {
  assert.ok(isTrustedIssue({ author_association: 'OWNER', user: { login: 'UltraXn' } }, config));
  assert.ok(isTrustedIssue({ author_association: 'NONE', user: { login: 'github-actions[bot]' } }, config));
  assert.ok(!isTrustedIssue({ author_association: 'NONE', user: { login: 'random' } }, config));
  assert.ok(!isTrustedIssue({ author_association: 'CONTRIBUTOR', user: { login: 'random' } }, config));
});

test('el prompt lleva alcance, verificación con pnpm, reglas y Closes #N', () => {
  const spec = { problem: 'P', files: ['src/a.ts'], acceptance: 'A', kind: '' };
  const prompt = buildPrompt({ issueNumber: 42, issueTitle: 'T', spec, rules: 'REGLAS', config });
  assert.match(prompt, /- src\/a.ts/);
  assert.match(prompt, /pnpm install --frozen-lockfile/);
  assert.match(prompt, /Closes #42/);
  assert.match(prompt, /REGLAS$/);
});
