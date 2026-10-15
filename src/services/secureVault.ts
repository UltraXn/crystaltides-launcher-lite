/**
 * CrystalTides Secure Vault
 * Almacenamiento local con cifrado autenticado AES-GCM (256 bits).
 *
 * NOTA DE SEGURIDAD Y ALCANCE:
 * Proporciona protección local limitada frente a inspección pasiva del almacenamiento
 * local (localStorage). No reemplaza un llavero seguro a nivel de sistema operativo
 * (como Windows Credential Manager / DPAPI / SecretService).
 * La integración definitiva con el llavero del sistema operativo es un pedido al backend Rust.
 *
 * Invariantes:
 * 1. Clave AES-GCM de 256 bits no extraíble guardada en IndexedDB (independiente de navigator.userAgent).
 * 2. Cifrado autenticado (AES-256-GCM) con vector de inicialización (IV) aleatorio de 12 bytes por escritura.
 * 3. Migración transparente desde formatos legacy derivados de User-Agent.
 */

interface EncryptedContainer {
  v: number; // 2 para clave persistente IndexedDB, 1 para legacy
  iv: string; // Base64
  salt?: string; // Base64 (requerido para descifrado legacy PBKDF2)
  ciphertext: string; // Base64
}

export interface DecryptResult<T> {
  data: T;
  migratedCiphertext?: string;
}

const VAULT_PEPPER = 'crystaltides_abyssal_vault_v1_secure_anchor_entropy_seed';
const VAULT_DB_NAME = 'crystaltides_vault_db';
const VAULT_STORE_NAME = 'vault_keys';
const MASTER_KEY_ID = 'aes_gcm_master_key';

let memoryKeyCache: CryptoKey | null = null;
let inFlightKeyPromise: Promise<CryptoKey> | null = null;

// Helper: Convert ArrayBuffer / Uint8Array to Base64
const bufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper: Convert Base64 to Uint8Array
const base64ToBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const openVaultDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in current environment'));
    }
    const request = indexedDB.open(VAULT_DB_NAME, 1);
    request.addEventListener('upgradeneeded', (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(VAULT_STORE_NAME)) {
        db.createObjectStore(VAULT_STORE_NAME);
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Failed to open vault IndexedDB')),
    );
  });
};

/**
 * Obtiene o crea la clave criptográfica persistente AES-GCM (256 bits, no extraíble)
 * almacenada en IndexedDB.
 */
export const getOrCreateVaultKey = async (): Promise<CryptoKey> => {
  if (memoryKeyCache) return memoryKeyCache;
  if (inFlightKeyPromise) return inFlightKeyPromise;

  inFlightKeyPromise = (async () => {
    let db: IDBDatabase | null = null;
    try {
      db = await openVaultDb();
      const storedKey = await new Promise<CryptoKey | null>((resolve, reject) => {
        const tx = db!.transaction(VAULT_STORE_NAME, 'readonly');
        const store = tx.objectStore(VAULT_STORE_NAME);
        const req = store.get(MASTER_KEY_ID);
        req.addEventListener('success', () => resolve((req.result as CryptoKey) || null));
        req.addEventListener('error', () => reject(req.error));
      });

      if (storedKey) {
        memoryKeyCache = storedKey;
        return storedKey;
      }

      const newKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      );

      await new Promise<void>((resolve, reject) => {
        const tx = db!.transaction(VAULT_STORE_NAME, 'readwrite');
        const store = tx.objectStore(VAULT_STORE_NAME);
        tx.addEventListener('complete', () => resolve());
        tx.addEventListener('error', () => reject(tx.error ?? new Error('Failed to save vault key')));
        tx.addEventListener('abort', () => reject(tx.error ?? new Error('Transaction aborted')));
        store.put(newKey, MASTER_KEY_ID);
      });

      memoryKeyCache = newKey;
      return newKey;
    } finally {
      if (db && typeof db.close === 'function') {
        db.close();
      }
      inFlightKeyPromise = null;
    }
  })();

  return inFlightKeyPromise;
};

export const _resetVaultKeyCacheForTesting = (): void => {
  memoryKeyCache = null;
  inFlightKeyPromise = null;
};

// Legacy key derivation con PBKDF2 sobre UserAgent
const deriveLegacyKey = async (salt: Uint8Array, legacyResolution = false): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const screenStr =
    typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '1920x1080';
  const rawKeyMaterial = legacyResolution
    ? `${VAULT_PEPPER}_${navigator.userAgent}_${screenStr}`
    : `${VAULT_PEPPER}_${navigator.userAgent}`;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(rawKeyMaterial),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
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
};

/**
 * Cifra un payload con AES-256-GCM utilizando la CryptoKey persistente no extraíble.
 */
export const encryptPayload = async <T>(data: T): Promise<string> => {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV para GCM
    const key = await getOrCreateVaultKey();

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData,
    );

    const container: EncryptedContainer = {
      v: 2,
      iv: bufferToBase64(iv),
      ciphertext: bufferToBase64(encryptedContent),
    };

    return JSON.stringify(container);
  } catch (error) {
    console.error('[Secure Vault] Encryption failed:', error);
    throw new Error('No se pudo cifrar los datos de forma segura.');
  }
};

/**
 * Descifra un contenedor con cadena de fallback:
 * 1. Clave nueva persistente de IndexedDB.
 * 2. Clave derivada de User-Agent actual.
 * 3. Clave legacy derivada de User-Agent + Resolución de pantalla.
 *
 * Si se descifra mediante una clave anterior, re-cifra el payload con la clave nueva.
 */
export const decryptPayloadWithMetadata = async <T>(
  encryptedString: string,
  validator?: (data: unknown) => boolean,
): Promise<DecryptResult<T> | null> => {
  try {
    if (!encryptedString) return null;
    const container: EncryptedContainer = JSON.parse(encryptedString);

    if (!container.iv || !container.ciphertext) {
      return null;
    }

    const iv = base64ToBuffer(container.iv);
    const ciphertext = base64ToBuffer(container.ciphertext);
    const salt = container.salt ? base64ToBuffer(container.salt) : null;

    let decryptedBuffer: ArrayBuffer | null = null;
    let needsReencrypt = container.v !== 2;

    // 1. Intento primario: clave persistente IndexedDB
    try {
      const primaryKey = await getOrCreateVaultKey();
      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
        },
        primaryKey,
        ciphertext as BufferSource,
      );
    } catch {
      decryptedBuffer = null;
    }

    // 2. Intento secundario: clave derivada de UserAgent actual
    if (!decryptedBuffer && salt) {
      try {
        const uaKey = await deriveLegacyKey(salt, false);
        decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv as BufferSource,
          },
          uaKey,
          ciphertext as BufferSource,
        );
        needsReencrypt = true;
      } catch {
        decryptedBuffer = null;
      }
    }

    // 3. Intento terciario: clave legacy UserAgent + Screen
    if (!decryptedBuffer && salt) {
      try {
        const legacyKey = await deriveLegacyKey(salt, true);
        decryptedBuffer = await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv as BufferSource,
          },
          legacyKey,
          ciphertext as BufferSource,
        );
        needsReencrypt = true;
      } catch {
        decryptedBuffer = null;
      }
    }

    if (!decryptedBuffer) {
      return null;
    }

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedBuffer);
    const parsed = JSON.parse(jsonString);

    if (parsed === null || typeof parsed === 'undefined') {
      return null;
    }

    if (validator && !validator(parsed)) {
      return null;
    }

    let migratedCiphertext: string | undefined;
    if (needsReencrypt) {
      try {
        migratedCiphertext = await encryptPayload(parsed);
      } catch (reencryptErr) {
        console.warn(
          '[Secure Vault] Error al re-cifrar con la nueva clave persistente:',
          reencryptErr,
        );
      }
    }

    return {
      data: parsed as T,
      migratedCiphertext,
    };
  } catch (error) {
    console.warn('[Secure Vault] Decryption failed or invalid container:', error);
    return null;
  }
};

/**
 * Descifra el contenedor y devuelve el payload tipado (compatibilidad directa).
 */
export const decryptPayload = async <T>(
  encryptedString: string,
  validator?: (data: unknown) => boolean,
): Promise<T | null> => {
  const result = await decryptPayloadWithMetadata<T>(encryptedString, validator);
  return result ? result.data : null;
};

/**
 * Guarda un elemento cifrado en localStorage con la clave persistente.
 */
export const saveSecureItem = async <T>(storageKey: string, data: T): Promise<void> => {
  const encrypted = await encryptPayload(data);
  localStorage.setItem(storageKey, encrypted);
};

/**
 * Carga un elemento cifrado de localStorage, aplicando migración y re-cifrado automático si procedía de una clave antigua.
 */
export const loadSecureItem = async <T>(
  storageKey: string,
  validator?: (data: unknown) => boolean,
): Promise<T | null> => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;
  const result = await decryptPayloadWithMetadata<T>(stored, validator);
  if (!result) return null;

  if (result.migratedCiphertext) {
    localStorage.setItem(storageKey, result.migratedCiphertext);
  }

  return result.data;
};

/**
 * Elimina un elemento de localStorage.
 */
export const removeSecureItem = (storageKey: string): void => {
  localStorage.removeItem(storageKey);
};
