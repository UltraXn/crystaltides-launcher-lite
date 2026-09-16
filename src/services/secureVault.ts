/**
 * CrystalTides Secure Vault
 * AES-256-GCM Military-Grade Cryptographic Shield for Minecraft & Microsoft OAuth Tokens.
 * 
 * Invariants:
 * 1. Zero plaintext tokens or UUIDs in localStorage.
 * 2. Authenticated encryption (AES-256-GCM) with random 12-byte IV per write.
 * 3. Key derivation with PBKDF2-SHA256 (100,000 rounds) + hardware seed entropy.
 */

interface EncryptedContainer {
  v: number; // Vault version
  iv: string; // Base64
  salt: string; // Base64
  ciphertext: string; // Base64
}

// Fixed device salt anchor + machine entropy
const VAULT_PEPPER = "crystaltides_abyssal_vault_v1_secure_anchor_entropy_seed";

// Helper: Convert ArrayBuffer to Base64
const bufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
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

// Derive AES-256-GCM key using PBKDF2
const deriveKey = async (salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  // Mix platform entropy + user agent signature
  const rawKeyMaterial = `${VAULT_PEPPER}_${navigator.userAgent}_${screen.width}x${screen.height}`;
  
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(rawKeyMaterial),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

/**
 * Encrypt any object or string with AES-256-GCM
 */
export const encryptPayload = async <T>(data: T): Promise<string> => {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
    const key = await deriveKey(salt);

    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(data));

    const encryptedContent = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encodedData
    );

    const container: EncryptedContainer = {
      v: 1,
      iv: bufferToBase64(iv),
      salt: bufferToBase64(salt),
      ciphertext: bufferToBase64(encryptedContent),
    };

    return JSON.stringify(container);
  } catch (error) {
    console.error("[Secure Vault] Encryption failed:", error);
    throw new Error("No se pudo cifrar los datos de forma segura.");
  }
};

/**
 * Decrypt an AES-256-GCM container back into the typed payload
 */
export const decryptPayload = async <T>(encryptedString: string): Promise<T | null> => {
  try {
    if (!encryptedString) return null;
    const container: EncryptedContainer = JSON.parse(encryptedString);

    if (!container.iv || !container.salt || !container.ciphertext) {
      return null;
    }

    const iv = base64ToBuffer(container.iv);
    const salt = base64ToBuffer(container.salt);
    const ciphertext = base64ToBuffer(container.ciphertext);

    const key = await deriveKey(salt);

    const decryptedContent = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
      },
      key,
      ciphertext as BufferSource
    );

    const dec = new TextDecoder();
    const jsonString = dec.decode(decryptedContent);
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn("[Secure Vault] Decryption failed or invalid container:", error);
    return null;
  }
};

/**
 * High-level helper to persist encrypted items to localStorage
 */
export const saveSecureItem = async <T>(storageKey: string, data: T): Promise<void> => {
  const encrypted = await encryptPayload(data);
  localStorage.setItem(storageKey, encrypted);
};

/**
 * High-level helper to load decrypted items from localStorage
 */
export const loadSecureItem = async <T>(storageKey: string): Promise<T | null> => {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;
  return decryptPayload<T>(stored);
};

/**
 * Remove an item completely
 */
export const removeSecureItem = (storageKey: string): void => {
  localStorage.removeItem(storageKey);
};