import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tauri Capabilities Security', () => {
  it('ensures opener permissions in default.json are scoped and not overly permissive', () => {
    const capabilityPath = path.resolve(__dirname, '../../src-tauri/capabilities/default.json');
    const content = fs.readFileSync(capabilityPath, 'utf8');
    const capability = JSON.parse(content);

    expect(capability.permissions).toBeDefined();
    expect(Array.isArray(capability.permissions)).toBe(true);

    // Ensure raw string permissions for allow-open-path and allow-open-url are NOT present
    expect(capability.permissions).not.toContain('opener:allow-open-path');
    expect(capability.permissions).not.toContain('opener:allow-open-url');

    // Find scoped opener permission objects
    const openPathPerm = capability.permissions.find(
      (p: any) => typeof p === 'object' && p.identifier === 'opener:allow-open-path',
    );
    const openUrlPerm = capability.permissions.find(
      (p: any) => typeof p === 'object' && p.identifier === 'opener:allow-open-url',
    );
    const revealItemPerm = capability.permissions.find(
      (p: any) => typeof p === 'object' && p.identifier === 'opener:allow-reveal-item-in-dir',
    );

    // Verify open-path is restricted
    expect(openPathPerm).toBeDefined();
    expect(openPathPerm.allow).toBeDefined();
    expect(Array.isArray(openPathPerm.allow)).toBe(true);
    expect(openPathPerm.allow.length).toBeGreaterThan(0);

    // Verify open-url is restricted
    expect(openUrlPerm).toBeDefined();
    expect(openUrlPerm.allow).toBeDefined();
    expect(Array.isArray(openUrlPerm.allow)).toBe(true);
    expect(openUrlPerm.allow.length).toBeGreaterThan(0);
    // Ensure all allowed URLs start with http or https
    for (const entry of openUrlPerm.allow) {
      expect(entry.url).toMatch(/^https?:\/\//);
    }

    // Verify reveal-item-in-dir is restricted
    expect(revealItemPerm).toBeDefined();
    expect(revealItemPerm.allow).toBeDefined();
    expect(Array.isArray(revealItemPerm.allow)).toBe(true);
    expect(revealItemPerm.allow.length).toBeGreaterThan(0);
  });
});
