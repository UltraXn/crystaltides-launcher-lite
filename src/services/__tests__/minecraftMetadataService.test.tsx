import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchInstalledLocalVersions,
  fetchVanillaVersions,
  fetchFabricLoaderVersions,
  fetchQuiltLoaderVersions,
  fetchNeoForgeVersions,
  fetchForgeVersions,
  isBetaLoaderVersion,
  matchesNeoForgeMc,
  parseLoaderList,
} from '../minecraftMetadataService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('minecraftMetadataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchInstalledLocalVersions retorna lista de versiones instaladas', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(['1.21.1', '1.20.4']);

    const res = await fetchInstalledLocalVersions();
    expect(res).toEqual(['1.21.1', '1.20.4']);
  });

  it('fetchInstalledLocalVersions maneja errores devolviendo array vacío', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri error'));

    const res = await fetchInstalledLocalVersions();
    expect(res).toEqual([]);
  });

  it('fetchVanillaVersions parsea respuesta de Mojang y filtra releases', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify({
        versions: [
          { id: '1.21.1', type: 'release' },
          { id: '24w35a', type: 'snapshot' },
          { id: '1.20.4', type: 'release' },
        ],
      }),
    );

    const releases = await fetchVanillaVersions(false);
    expect(releases).toEqual(['1.21.1', '1.20.4']);
  });

  it('fetchVanillaVersions incluye snapshots cuando includeSnapshots es true', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify({
        versions: [
          { id: '1.21.1', type: 'release' },
          { id: '24w35a', type: 'snapshot' },
        ],
      }),
    );

    const all = await fetchVanillaVersions(true);
    expect(all).toEqual(['1.21.1', '24w35a']);
  });

  it('fetchVanillaVersions usa fallback en caso de error de red', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Network failure'));

    const res = await fetchVanillaVersions();
    expect(res).toContain('1.21.1');
  });

  describe('isBetaLoaderVersion helper', () => {
    it('detecta versiones beta y experimentales correctamente', () => {
      expect(isBetaLoaderVersion('0.31.0-beta.4')).toBe(true);
      expect(isBetaLoaderVersion('26.3.0.75-beta')).toBe(true);
      expect(isBetaLoaderVersion('0.19.4', false)).toBe(true);
      expect(isBetaLoaderVersion('0.16.0-alpha.1')).toBe(true);
      expect(isBetaLoaderVersion('21.1.0-rc.1')).toBe(true);
      expect(isBetaLoaderVersion('1.21-pre1')).toBe(true);
      expect(isBetaLoaderVersion('24w35a-snapshot')).toBe(true);
    });

    it('identifica versiones estables correctamente', () => {
      expect(isBetaLoaderVersion('0.16.10', true)).toBe(false);
      expect(isBetaLoaderVersion('21.1.252')).toBe(false);
      expect(isBetaLoaderVersion('47.3.0')).toBe(false);
      expect(isBetaLoaderVersion('0.30.2')).toBe(false);
    });
  });

  describe('matchesNeoForgeMc helper', () => {
    it('compara versiones de NeoForge con versiones de Minecraft', () => {
      expect(matchesNeoForgeMc('21.1.252', '1.21.1')).toBe(true);
      expect(matchesNeoForgeMc('20.4.80', '1.20.4')).toBe(true);
      expect(matchesNeoForgeMc('47.1.3', '1.20.1')).toBe(true);
      expect(matchesNeoForgeMc('26.3.0.76', '26.3')).toBe(true);
      expect(matchesNeoForgeMc('26.3.0.76', '1.26.3')).toBe(true);
      expect(matchesNeoForgeMc('21.1.252', '1.20.1')).toBe(false);
    });
  });

  describe('parseLoaderList', () => {
    const mixed = [
      { loader: { version: '0.16.10', stable: true } },
      { loader: { version: '0.19.4', stable: false } },
      { version: '0.31.0-beta.4' },
      { version: '0.30.2' },
    ];

    it('excluye betas cuando includeBetas es false', () => {
      const res = parseLoaderList(mixed, false);
      expect(res).toEqual(['0.16.10', '0.30.2']);
    });

    it('incluye betas cuando includeBetas es true', () => {
      const res = parseLoaderList(mixed, true);
      expect(res).toEqual(['0.16.10', '0.19.4', '0.31.0-beta.4', '0.30.2']);
    });
  });

  it('fetchFabricLoaderVersions parsea versiones de Fabric y filtra betas', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify([
        { loader: { version: '0.19.4', stable: false } },
        { loader: { version: '0.16.10', stable: true } },
        { loader: { version: '0.16.9', stable: true } },
      ]),
    );

    const versionsStable = await fetchFabricLoaderVersions('1.21.1', false);
    expect(versionsStable).toEqual(['0.16.10', '0.16.9']);

    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify([
        { loader: { version: '0.19.4', stable: false } },
        { loader: { version: '0.16.10', stable: true } },
      ]),
    );
    const versionsWithBeta = await fetchFabricLoaderVersions('1.21.1', true);
    expect(versionsWithBeta).toEqual(['0.19.4', '0.16.10']);
  });

  it('fetchQuiltLoaderVersions parsea versiones de Quilt y filtra betas', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify([
        { loader: { version: '0.31.0-beta.4' } },
        { loader: { version: '0.27.1' } },
      ]),
    );

    const versions = await fetchQuiltLoaderVersions('1.20.1', false);
    expect(versions).toEqual(['0.27.1']);

    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify([
        { loader: { version: '0.31.0-beta.4' } },
        { loader: { version: '0.27.1' } },
      ]),
    );
    const versionsAll = await fetchQuiltLoaderVersions('1.20.1', true);
    expect(versionsAll).toEqual(['0.31.0-beta.4', '0.27.1']);
  });

  it('fetchNeoForgeVersions parsea versiones de NeoForge desde maven metadata', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      '<metadata><versioning><versions><version>21.1.252</version><version>21.1.32-beta</version></versions></versioning></metadata>',
    );

    const versionsStable = await fetchNeoForgeVersions('1.21.1', false);
    expect(versionsStable).toContain('21.1.252');
    expect(versionsStable).not.toContain('21.1.32-beta');

    vi.mocked(invoke).mockResolvedValueOnce(
      '<metadata><versioning><versions><version>21.1.252</version><version>21.1.32-beta</version></versions></versioning></metadata>',
    );
    const versionsBetas = await fetchNeoForgeVersions('1.21.1', true);
    expect(versionsBetas).toContain('21.1.32-beta');
  });

  it('fetchForgeVersions parsea versiones de Forge desde maven metadata', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      '<metadata><versioning><versions><version>1.20.1-47.3.0</version></versions></versioning></metadata>',
    );

    const versions = await fetchForgeVersions('1.20.1');
    expect(versions).toContain('47.3.0');
  });
});
