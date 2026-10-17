import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  refreshMicrosoftSession,
  MicrosoftAuthError,
} from '../microsoftAuthService';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('microsoftAuthService error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws typed MicrosoftAuthError with code = res.error when refresh response contains error', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockResolvedValueOnce(
      JSON.stringify({
        error: 'invalid_grant',
        error_description: 'The refresh token has expired or is invalid.',
      }),
    );

    await expect(refreshMicrosoftSession('test-refresh-token')).rejects.toThrow(
      MicrosoftAuthError,
    );

    try {
      vi.mocked(invoke).mockResolvedValueOnce(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'The refresh token has expired or is invalid.',
        }),
      );
      await refreshMicrosoftSession('test-refresh-token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MicrosoftAuthError);
      expect((err as MicrosoftAuthError).code).toBe('invalid_grant');
      expect((err as MicrosoftAuthError).message).toContain('invalid_grant');
    }
  });

  it('handles backend structured errors { code, message } with typed error code', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    vi.mocked(invoke).mockRejectedValueOnce({
      code: 'invalid_grant',
      message: 'Token has been revoked by user.',
    });

    try {
      await refreshMicrosoftSession('revoked-refresh-token');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MicrosoftAuthError);
      expect((err as MicrosoftAuthError).code).toBe('invalid_grant');
    }
  });
});
