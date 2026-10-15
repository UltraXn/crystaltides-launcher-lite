import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptPayload,
  decryptPayload,
  saveSecureItem,
  loadSecureItem,
  removeSecureItem,
  getOrCreateVaultKey,
  _resetVaultKeyCacheForTesting,
} from '../secureVault';

function createMockIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  return {
    open(_dbName: string, _version: number) {
      const listeners: Record<string, ((ev: unknown) => void)[]> = {};
      const addEventListener = (event: string, cb: (ev: unknown) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      };

      const mockDb = {
        close: () => {},
        objectStoreNames: {
          contains(name: string) {
            return stores.has(name);
          },
        },
        createObjectStore(name: string) {
          if (!stores.has(name)) {
            stores.set(name, new Map());
          }
          return {};
        },
        transaction(storeNames: string | string[], _mode: string) {
          const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
          if (!stores.has(storeName)) {
            stores.set(storeName, new Map());
          }
          const storeMap = stores.get(storeName)!;
          const txListeners: Record<string, ((ev: unknown) => void)[]> = {};

          const tx = {
            error: null,
            addEventListener(evt: string, fn: (ev: unknown) => void) {
              txListeners[evt] = txListeners[evt] || [];
              txListeners[evt].push(fn);
            },
            objectStore(_name: string) {
              return {
                get(key: string) {
                  const reqListeners: Record<string, ((ev: unknown) => void)[]> = {};
                  const req = {
                    result: storeMap.get(key) || null,
                    error: null,
                    addEventListener(evt: string, fn: (ev: unknown) => void) {
                      reqListeners[evt] = reqListeners[evt] || [];
                      reqListeners[evt].push(fn);
                    },
                  };
                  queueMicrotask(() => {
                    reqListeners['success']?.forEach((fn) => fn({ target: req }));
                    txListeners['complete']?.forEach((fn) => fn({ target: tx }));
                  });
                  return req;
                },
                put(val: unknown, key: string) {
                  storeMap.set(key, val);
                  const reqListeners: Record<string, ((ev: unknown) => void)[]> = {};
                  const req = {
                    result: key,
                    error: null,
                    addEventListener(evt: string, fn: (ev: unknown) => void) {
                      reqListeners[evt] = reqListeners[evt] || [];
                      reqListeners[evt].push(fn);
                    },
                  };
                  queueMicrotask(() => {
                    reqListeners['success']?.forEach((fn) => fn({ target: req }));
                    txListeners['complete']?.forEach((fn) => fn({ target: tx }));
                  });
                  return req;
                },
              };
            },
          };
          return tx;
        },
      };

      const request = {
        result: mockDb,
        error: null,
        addEventListener,
      };

      queueMicrotask(() => {
        listeners['upgradeneeded']?.forEach((fn) => fn({ target: request }));
        listeners['success']?.forEach((fn) => fn({ target: request }));
      });

      return request;
    },
  };
}

describe('secureVault', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.indexedDB = createMockIndexedDB() as unknown as IDBFactory;
    _resetVaultKeyCacheForTesting();
  });

  it('encrypts and decrypts payloads accurately with persistent key', async () => {
    const secretData = {
      username: 'Nero',
      token: 'mock-session-vault-token-12345',
      roles: ['admin', 'pilot'],
    };

    const encrypted = await encryptPayload(secretData);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('Nero');

    const decrypted = await decryptPayload<typeof secretData>(encrypted);
    expect(decrypted).toEqual(secretData);
  });

  it('maintains stable session even after simulating navigator.userAgent changes', async () => {
    const originalUserAgent = navigator.userAgent;
    const testData = {
      id: 'acc-123',
      refreshToken: 'persistent-refresh-token-xyz',
    };

    // Save with original UA
    await saveSecureItem('user_session', testData);

    // Simulate WebView2 / Edge update changing userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86',
      configurable: true,
    });

    const loaded = await loadSecureItem<typeof testData>('user_session');
    expect(loaded).toEqual(testData);
    expect(loaded?.refreshToken).toBe('persistent-refresh-token-xyz');

    // Restore original UA
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('migrates legacy containers encrypted with previous UA/screen PBKDF2 key', async () => {
    const VAULT_PEPPER = 'crystaltides_abyssal_vault_v1_secure_anchor_entropy_seed';
    const legacyRawKeyMaterial = `${VAULT_PEPPER}_${navigator.userAgent}_${screen.width}x${screen.height}`;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(legacyRawKeyMaterial),
      'PBKDF2',
      false,
      ['deriveKey'],
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
      ['encrypt', 'decrypt'],
    );

    const secretPayload = { account: 'legacy_saved_account', uuid: '1234-5678', refreshToken: 'legacy-token-999' };
    const encodedData = enc.encode(JSON.stringify(secretPayload));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      legacyKey,
      encodedData,
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

    localStorage.setItem('legacy_account_vault', legacyContainer);

    // loadSecureItem should decrypt legacy format AND re-encrypt with the new persistent v2 key
    const loaded = await loadSecureItem<typeof secretPayload>('legacy_account_vault');
    expect(loaded).toEqual(secretPayload);

    // Check that stored container was upgraded to v2
    const updatedRaw = localStorage.getItem('legacy_account_vault');
    expect(updatedRaw).not.toBeNull();
    const parsedContainer = JSON.parse(updatedRaw!);
    expect(parsedContainer.v).toBe(2);
  });

  it('returns null for corrupted or invalid encrypted containers without crashing', async () => {
    expect(await decryptPayload('')).toBeNull();
    expect(await decryptPayload('not-json')).toBeNull();
    expect(await decryptPayload('{}')).toBeNull();
    expect(await decryptPayload(JSON.stringify({ iv: 'abc', ciphertext: 'def' }))).toBeNull();
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

  it('caches in-flight promise of getOrCreateVaultKey when called concurrently', async () => {
    _resetVaultKeyCacheForTesting();

    const [key1, key2, key3] = await Promise.all([
      getOrCreateVaultKey(),
      getOrCreateVaultKey(),
      getOrCreateVaultKey(),
    ]);

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key3).toBeDefined();
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it('rejects without ephemeral key fallback when IndexedDB is unavailable', async () => {
    _resetVaultKeyCacheForTesting();

    const originalIndexedDB = globalThis.indexedDB;
    try {
      // @ts-expect-error simulating missing indexedDB
      delete globalThis.indexedDB;

      await expect(getOrCreateVaultKey()).rejects.toThrowError(
        /IndexedDB not supported/,
      );
    } finally {
      globalThis.indexedDB = originalIndexedDB;
    }
  });
});

