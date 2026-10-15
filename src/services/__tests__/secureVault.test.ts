import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptPayload,
  decryptPayload,
  saveSecureItem,
  loadSecureItem,
  removeSecureItem,
} from '../secureVault';

describe('secureVault', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('encrypts and decrypts payloads accurately with stable key', async () => {
    const secretData = {
      username: 'Nero',
      token: 'MOCK_TOKEN_PAYLOAD_ABC_123.xyz',
      roles: ['admin', 'pilot'],
    };

    const encrypted = await encryptPayload(secretData);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('Nero');

    const decrypted = await decryptPayload<typeof secretData>(encrypted);
    expect(decrypted).toEqual(secretData);
  });

  it('handles fallback decryption when container was encrypted with legacy resolution key', async () => {
    // Encrypt using legacy key material
    const VAULT_PEPPER = 'crystaltides_abyssal_vault_v1_secure_anchor_entropy_seed';
    const legacyRawKeyMaterial = `${VAULT_PEPPER}_${navigator.userAgent}_${screen.width}x${screen.height}`;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(legacyRawKeyMaterial),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const legacyKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const secretPayload = { account: 'legacy_saved_account', uuid: '1234-5678' };
    const encodedData = enc.encode(JSON.stringify(secretPayload));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      legacyKey,
      encodedData
    );

    const toBase64 = (buf: ArrayBuffer | Uint8Array) => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    const legacyContainer = JSON.stringify({
      v: 1,
      iv: toBase64(iv),
      salt: toBase64(salt),
      ciphertext: toBase64(ciphertext),
    });

    // decryptPayload should attempt primary key, fail, and succeed via legacy fallback!
    const decrypted = await decryptPayload<typeof secretPayload>(legacyContainer);
    expect(decrypted).toEqual(secretPayload);
  });

  it('returns null for corrupted or invalid encrypted containers', async () => {
    expect(await decryptPayload('')).toBeNull();
    expect(await decryptPayload('not-json')).toBeNull();
    expect(await decryptPayload('{}')).toBeNull();
    expect(await decryptPayload(JSON.stringify({ iv: 'abc', salt: 'def' }))).toBeNull();
  });

  it('saves, loads, and removes items from localStorage via secure helpers', async () => {
    const key = 'test_vault_item';
    const data = { auth: 'mock_token', pin: 9942 };

    await saveSecureItem(key, data);
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(localStorage.getItem(key)).not.toContain('mock_token');

    const loaded = await loadSecureItem<typeof data>(key);
    expect(loaded).toEqual(data);

    removeSecureItem(key);
    expect(localStorage.getItem(key)).toBeNull();
    expect(await loadSecureItem(key)).toBeNull();
  });
});
