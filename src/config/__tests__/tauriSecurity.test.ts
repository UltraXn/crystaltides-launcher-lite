import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guard against silent regressions of the webview trust boundary.
 *
 * The Rust IPC (launch_minecraft, downloads, file commands) trusts the frontend: whoever runs
 * script in the main webview can effectively run code on the machine. What keeps that safe is
 * that only the local bundle can run script (CSP) and that no remote origin gets IPC access
 * (capabilities). Any change here must be a deliberate, reviewed decision.
 */

const TAURI_DIR = resolve(__dirname, '../../../src-tauri');

interface TauriWindowConfig {
  label?: string;
  url?: string;
}

interface TauriConfig {
  app: {
    windows?: TauriWindowConfig[];
    withGlobalTauri?: boolean;
    security?: {
      csp?: string | null;
      dangerousDisableAssetCspModification?: boolean | string[];
    };
  };
}

type PermissionEntry = string | { identifier: string };

interface Capability {
  identifier: string;
  windows?: string[];
  webviews?: string[];
  remote?: unknown;
  permissions: PermissionEntry[];
}

// Plugins that give the webview generic access to the system; Rust exposes scoped commands instead
const FORBIDDEN_PERMISSION_PREFIXES = ['shell:', 'fs:', 'http:', 'process:'];

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const tauriConfig = readJson<TauriConfig>(join(TAURI_DIR, 'tauri.conf.json'));

const capabilitiesDir = join(TAURI_DIR, 'capabilities');
const capabilities = readdirSync(capabilitiesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => ({ file, capability: readJson<Capability>(join(capabilitiesDir, file)) }));

const parseCsp = (csp: string): Map<string, string[]> =>
  new Map(
    csp
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name.toLowerCase(), sources] as [string, string[]]),
  );

const permissionId = (entry: PermissionEntry): string =>
  typeof entry === 'string' ? entry : entry.identifier;

describe('Tauri security config', () => {
  const csp = tauriConfig.app.security?.csp;

  it('defines a CSP', () => {
    expect(typeof csp).toBe('string');
  });

  const directives = parseCsp(csp ?? '');

  it("only lets the local bundle run script ('self', no inline/eval/remote)", () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    // script-src falls back to default-src when absent
    expect(directives.get('script-src') ?? directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.has('script-src-elem')).toBe(false);
    expect(directives.has('script-src-attr')).toBe(false);
  });

  it("never allows 'unsafe-eval' or a bare wildcard source", () => {
    for (const [name, sources] of directives) {
      expect(sources, `${name} allows 'unsafe-eval'`).not.toContain("'unsafe-eval'");
      expect(sources, `${name} allows '*'`).not.toContain('*');
    }
  });

  it('keeps Tauri CSP hardening enabled', () => {
    expect(tauriConfig.app.security?.dangerousDisableAssetCspModification ?? false).toBe(false);
  });

  it('loads every configured window from the local bundle', () => {
    for (const window of tauriConfig.app.windows ?? []) {
      expect(window.url ?? 'index.html', `window ${window.label}`).not.toMatch(/^[a-z]+:\/\//i);
    }
  });

  it('finds capability files to check', () => {
    expect(capabilities.length).toBeGreaterThan(0);
  });

  it.each(capabilities)('$file grants no IPC access to remote origins', ({ capability }) => {
    expect(capability.remote).toBeUndefined();
  });

  it.each(capabilities)('$file targets explicit windows only', ({ capability }) => {
    const targets = [...(capability.windows ?? []), ...(capability.webviews ?? [])];
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.some((label) => label.includes('*'))).toBe(false);
  });

  it.each(capabilities)('$file grants no generic shell/fs/http/process plugin access', ({ capability }) => {
    const forbidden = capability.permissions
      .map(permissionId)
      .filter((id) => FORBIDDEN_PERMISSION_PREFIXES.some((prefix) => id.startsWith(prefix)));
    expect(forbidden).toEqual([]);
  });
});
