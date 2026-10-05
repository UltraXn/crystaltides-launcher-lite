// ═══════════════════════════════════════════════════════════════
// CrystalTides Lite - Persistent Wallpaper & Video Storage (IndexedDB)
// Handles large media (videos up to 500MB+, GIFs, 4K/8K images) without localStorage limits
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'crystaltides_lite_db';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const ACTIVE_KEY = 'active_wallpaper';

let currentCreatedBlobUrl: string | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isVideoSource(url: string | null, mimeType?: string): boolean {
  if (!url) return false;
  if (mimeType && mimeType.startsWith('video/')) return true;
  if (url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i.test(url);
}

export interface StoredWallpaperMeta {
  url: string;
  isVideo: boolean;
  name: string;
}

export async function loadActiveWallpaper(): Promise<StoredWallpaperMeta | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(ACTIVE_KEY);

      request.onsuccess = () => {
        const record = request.result;
        if (record && record.blob) {
          if (currentCreatedBlobUrl) {
            try {
              URL.revokeObjectURL(currentCreatedBlobUrl);
            } catch {}
          }
          currentCreatedBlobUrl = URL.createObjectURL(record.blob);
          resolve({
            url: currentCreatedBlobUrl,
            isVideo: !!record.isVideo,
            name: record.name || 'custom_wallpaper',
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Error loading custom wallpaper from IndexedDB:', err);
    return null;
  }
}

export async function saveWallpaperFile(file: File): Promise<StoredWallpaperMeta> {
  const isVideo = file.type.startsWith('video/') || isVideoSource(file.name);
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      id: ACTIVE_KEY,
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      isVideo,
      updatedAt: Date.now(),
    };

    const request = store.put(record);

    request.onsuccess = () => {
      if (currentCreatedBlobUrl) {
        try {
          URL.revokeObjectURL(currentCreatedBlobUrl);
        } catch {}
      }
      currentCreatedBlobUrl = URL.createObjectURL(file);
      resolve({
        url: currentCreatedBlobUrl,
        isVideo,
        name: file.name,
      });
    };

    request.onerror = () => reject(request.error);
  });
}

export async function clearCustomWallpaper(): Promise<void> {
  if (currentCreatedBlobUrl) {
    try {
      URL.revokeObjectURL(currentCreatedBlobUrl);
    } catch {}
    currentCreatedBlobUrl = null;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(ACTIVE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('Failed to clear wallpaper from IndexedDB:', err);
  }
}
