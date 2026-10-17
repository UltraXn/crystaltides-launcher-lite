import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logFrontend } from '../logger';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe('logger service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts tokens before calling invoke log_frontend', () => {
    const rawMessage = 'Auth response: {"access_token":"secret_ms_token_123","token_type":"Bearer"}';
    logFrontend('INFO', rawMessage);

    expect(invoke).toHaveBeenCalledWith('log_frontend', {
      msg: 'Auth response: {"access_token": "[REDACTED]","token_type":"Bearer"}',
      level: 'INFO',
    });
  });

  it('handles empty or non-string messages safely', () => {
    logFrontend('ERROR', '');
    expect(invoke).toHaveBeenCalledWith('log_frontend', {
      msg: '',
      level: 'ERROR',
    });
  });
});
