import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginWithCrystalTides } from '../crystalAuthService';

describe('crystalAuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an error if email is empty or invalid', async () => {
    await expect(loginWithCrystalTides('', 'password123')).rejects.toThrow(
      'Por favor introduce un correo electrónico válido'
    );
    await expect(loginWithCrystalTides('invalid-email', 'password123')).rejects.toThrow(
      'Por favor introduce un correo electrónico válido'
    );
  });

  it('throws an error if password is empty', async () => {
    await expect(loginWithCrystalTides('user@example.com', '')).rejects.toThrow(
      'Por favor introduce tu contraseña'
    );
  });

  it('handles network error during auth token fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network offline')));

    await expect(loginWithCrystalTides('user@example.com', 'secret123')).rejects.toThrow(
      'No se pudo conectar con el servidor de CrystalTidesSMP'
    );
  });

  it('handles invalid credentials response from Supabase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error_description: 'Invalid login credentials' }),
      })
    );

    await expect(loginWithCrystalTides('user@example.com', 'wrongpass')).rejects.toThrow(
      'Correo o contraseña incorrectos'
    );
  });

  it('handles email not confirmed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ msg: 'Email not confirmed' }),
      })
    );

    await expect(loginWithCrystalTides('user@example.com', 'mypass')).rejects.toThrow(
      'Debes confirmar tu correo electrónico'
    );
  });

  it('handles rate limiting (429 status)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too many requests' }),
      })
    );

    await expect(loginWithCrystalTides('user@example.com', 'mypass')).rejects.toThrow(
      'Demasiados intentos fallidos'
    );
  });

  it('successfully logs in and resolves profile with custom username and skin', async () => {
    const authSuccessPayload = {
      user: {
        id: 'supabase-user-123',
        user_metadata: {
          username: 'MetadataUser',
        },
      },
      access_token: 'MOCK_TOKEN_PAYLOAD_ABC_123.xyz',
      refresh_token: 'MOCK_REFRESH_TOKEN_DEF_456.xyz',
    };

    const profileRow = {
      username: 'RealGamer_99',
      minecraft_uuid: '11111111-2222-3333-4444-555555555555',
      avatar_url: 'https://example.com/skin.png',
      role: 'vip',
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => authSuccessPayload,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [profileRow],
        })
    );

    const profile = await loginWithCrystalTides('gamer@crystaltides.net', 'validPassword');

    expect(profile.id).toBe('crystal_supabase-user-123');
    expect(profile.username).toBe('RealGamer_99');
    expect(profile.uuid).toBe('11111111-2222-3333-4444-555555555555');
    expect(profile.skinUrl).toBe('https://example.com/skin.png');
    expect(profile.role).toBe('vip');
    expect(profile.accessToken).toBe('MOCK_TOKEN_PAYLOAD_ABC_123.xyz');
    expect(profile.refreshToken).toBe('MOCK_REFRESH_TOKEN_DEF_456.xyz');
  });

  it('falls back to offline UUID generation when minecraft_uuid is not provided', async () => {
    const authSuccessPayload = {
      user: {
        id: 'no-uuid-user',
        user_metadata: {},
      },
      access_token: 'token-abc',
      refresh_token: 'refresh-abc',
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => authSuccessPayload,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => [],
        })
    );

    const profile = await loginWithCrystalTides('steve@crystaltides.net', 'validPassword');
    expect(profile.username).toBe('steve');
    expect(profile.uuid).toBeTruthy();
    expect(profile.role).toBe('user');
  });

  it('pads short usernames (< 3 chars) to meet Minecraft naming requirement', async () => {
    const authSuccessPayload = {
      user: {
        id: 'short-user-id',
        user_metadata: {
          username: 'al',
        },
      },
      access_token: 'token-short',
      refresh_token: 'refresh-short',
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => authSuccessPayload,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [],
        })
    );

    const profile = await loginWithCrystalTides('al@crystaltides.net', 'validPassword');
    expect(profile.username).toBe('al_');
    expect(profile.username.length).toBe(3);
  });
});
