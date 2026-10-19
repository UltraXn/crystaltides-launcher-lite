import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitCrashTelemetry, CrashDiagnosis } from '../crashDoctorService';

describe('crashDoctorService - submitCrashTelemetry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const sampleDiagnosis: CrashDiagnosis = {
    crash_type: 'GENERIC_CRASH',
    title: 'Cierre inesperado de prueba',
    explanation: 'Explicación técnica de la falla',
    offending_mod: 'mod-conflictivo',
    recommendation: 'Desactiva el mod',
    suggested_action: 'DISABLE_MOD',
    log_snippet: 'NullPointerException at net.minecraft',
  };

  it('retorna true cuando el servidor responde HTTP 200 OK', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;

    const result = await submitCrashTelemetry(sampleDiagnosis, 1, '1.21.1');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/launcher/crash-report');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.crashType).toBe('GENERIC_CRASH');
    expect(parsedBody.title).toBe('Cierre inesperado de prueba');
    expect(parsedBody.offendingMod).toBe('mod-conflictivo');
    expect(parsedBody.exitCode).toBe(1);
    expect(parsedBody.mcVersion).toBe('1.21.1');
    expect(parsedBody.logSnippet).toBe('NullPointerException at net.minecraft');
  });

  it('retorna false cuando el servidor responde con error HTTP 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    global.fetch = fetchMock;

    const result = await submitCrashTelemetry(sampleDiagnosis, 1);
    expect(result).toBe(false);
  });

  it('retorna false silenciosamente cuando fetch rechaza por timeout o error de red', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network timeout'));
    global.fetch = fetchMock;

    const result = await submitCrashTelemetry(sampleDiagnosis, 1);
    expect(result).toBe(false);
  });
});
