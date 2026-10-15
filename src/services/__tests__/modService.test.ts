import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchOfficialServerMods,
  syncOfficialModsForInstance,
  OfficialModsResult,
  SyncOfficialModsResult,
} from '../modService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('modService - Official Server Mods', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchOfficialServerMods', () => {
    it('devuelve { ok: true, mods } cuando Supabase responde 200 con lista de mods', async () => {
      const mockMods = [
        {
          name: 'fabric-api.jar',
          download_url: 'https://example.com/fabric-api.jar',
          sha1: 'abcdef1234567890abcdef1234567890abcdef12',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockMods,
      } as unknown as Response);

      const result: OfficialModsResult = await fetchOfficialServerMods();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mods).toEqual(mockMods);
      }
    });

    it('devuelve { ok: false, error } cuando Supabase devuelve HTTP error (ej. 500)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as unknown as Response);

      const result: OfficialModsResult = await fetchOfficialServerMods();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('500');
      }
    });

    it('devuelve { ok: false, error } cuando fetch lanza un error de red o timeout', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const result: OfficialModsResult = await fetchOfficialServerMods();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Network timeout');
      }
    });

    it('devuelve { ok: false, error } si la respuesta no es un arreglo', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ message: 'Not an array' }),
      } as unknown as Response);

      const result: OfficialModsResult = await fetchOfficialServerMods();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Respuesta inválida');
      }
    });
  });

  describe('syncOfficialModsForInstance', () => {
    it('devuelve { ok: false, error } si fetchOfficialServerMods falla', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as unknown as Response);

      const progressCallback = vi.fn();
      const result: SyncOfficialModsResult = await syncOfficialModsForInstance(
        'C:/fake/gameDir',
        progressCallback,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('503');
      }
      // No debe reportar que los mods fueron verificados sin pendientes
      expect(progressCallback).not.toHaveBeenCalledWith(
        'Mods verificados (sin actualizaciones pendientes).',
        100,
      );
    });

    it('devuelve { ok: true, entries: [] } cuando el servidor tiene lista vacía de mods oficiales', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as unknown as Response);

      const progressCallback = vi.fn();
      const result: SyncOfficialModsResult = await syncOfficialModsForInstance(
        'C:/fake/gameDir',
        progressCallback,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entries).toEqual([]);
      }
      expect(progressCallback).toHaveBeenCalledWith(
        'Mods verificados (sin actualizaciones pendientes).',
        100,
      );
    });

    it('descarga y enlaza mods devolviendo { ok: true, entries } cuando hay mods oficiales', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockImplementation((cmd) => {
        if (cmd === 'get_home_dir') return Promise.resolve('C:/Users/test');
        if (cmd === 'download_mods_parallel') return Promise.resolve();
        if (cmd === 'sync_mods') return Promise.resolve();
        return Promise.resolve();
      });

      const mockMods = [
        {
          name: 'optifine.jar',
          download_url: 'https://example.com/optifine.jar',
          sha1: '1234567890abcdef1234567890abcdef12345678',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockMods,
      } as unknown as Response);

      const progressCallback = vi.fn();
      const result: SyncOfficialModsResult = await syncOfficialModsForInstance(
        'C:/fake/gameDir',
        progressCallback,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].filename).toBe('optifine.jar');
      }
      expect(invoke).toHaveBeenCalledWith('download_mods_parallel', expect.anything());
      expect(invoke).toHaveBeenCalledWith('sync_mods', expect.anything());
      expect(progressCallback).toHaveBeenCalledWith('Mods sincronizados exitosamente.', 100);
    });
  });
});
