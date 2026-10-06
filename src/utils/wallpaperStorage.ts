// ═══════════════════════════════════════════════════════════════
// CrystalTides Lite - Persistent Wallpaper & Video Storage (IndexedDB)
// Handles large media (videos up to 500MB+, GIFs, 4K/8K images) without localStorage limits
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'crystaltides_lite_db';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';
const ACTIVE_KEY = 'active_wallpaper';

let currentCreatedBlobUrl: string | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (currentCreatedBlobUrl) {
      try {
        URL.revokeObjectURL(currentCreatedBlobUrl);
      } catch {}
      currentCreatedBlobUrl = null;
    }
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener('upgradeneeded', (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    });

    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
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
  revoke?: () => void;
}

export async function loadActiveWallpaper(): Promise<StoredWallpaperMeta | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(ACTIVE_KEY);

      request.addEventListener('success', () => {
        const record = request.result;
        if (record && record.blob) {
          if (currentCreatedBlobUrl) {
            try {
              URL.revokeObjectURL(currentCreatedBlobUrl);
            } catch {}
          }
          currentCreatedBlobUrl = URL.createObjectURL(record.blob);
          const activeUrl = currentCreatedBlobUrl;
          resolve({
            url: activeUrl,
            isVideo: !!record.isVideo,
            name: record.name || 'custom_wallpaper',
            revoke: () => {
              try {
                URL.revokeObjectURL(activeUrl);
              } catch {}
            },
          });
        } else {
          resolve(null);
        }
      });

      request.addEventListener('error', () => resolve(null));
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

    request.addEventListener('success', () => {
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
    });

    request.addEventListener('error', () => reject(request.error));
  });
}

export function revokeCurrentWallpaperUrl(): void {
  if (currentCreatedBlobUrl) {
    try {
      URL.revokeObjectURL(currentCreatedBlobUrl);
    } catch {}
    currentCreatedBlobUrl = null;
  }
}

export async function clearCustomWallpaper(): Promise<void> {
  revokeCurrentWallpaperUrl();

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(ACTIVE_KEY);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => resolve());
    });
  } catch (err) {
    console.warn('Failed to clear wallpaper from IndexedDB:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// BUTTON MEDIA STORAGE (VIDEOS, GIFS, IMAGES, ICONS)
// ═══════════════════════════════════════════════════════════════

const BUTTON_MEDIA_PREFIX = 'btn_media_';
const BUTTON_ICON_PREFIX = 'btn_icon_';
const buttonBlobUrls = new Map<string, string>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    buttonBlobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    buttonBlobUrls.clear();
  });
}

export async function saveButtonMediaFile(
  btnId: string,
  file: File,
  isIcon: boolean = false
): Promise<{ url: string; isVideo: boolean; name: string }> {
  const isVideo = !isIcon && (file.type.startsWith('video/') || isVideoSource(file.name));
  const db = await openDB();
  const id = `${isIcon ? BUTTON_ICON_PREFIX : BUTTON_MEDIA_PREFIX}${btnId}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record = {
      id,
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      isVideo,
      updatedAt: Date.now(),
    };

    const request = store.put(record);

    request.addEventListener('success', () => {
      const prevUrl = buttonBlobUrls.get(id);
      if (prevUrl) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {}
      }
      const newUrl = URL.createObjectURL(file);
      buttonBlobUrls.set(id, newUrl);
      resolve({
        url: newUrl,
        isVideo,
        name: file.name,
      });
    });

    request.addEventListener('error', () => reject(request.error));
  });
}

export async function loadAllButtonMedia(): Promise<{
  backgrounds: Record<string, { url: string; isVideo: boolean }>;
  icons: Record<string, string>;
}> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.addEventListener('success', () => {
        const records = request.result || [];
        const backgrounds: Record<string, { url: string; isVideo: boolean }> = {};
        const icons: Record<string, string> = {};

        for (const record of records) {
          if (!record.id || !record.blob) continue;
          if (record.id.startsWith(BUTTON_MEDIA_PREFIX)) {
            const btnId = record.id.slice(BUTTON_MEDIA_PREFIX.length);
            const url = URL.createObjectURL(record.blob);
            buttonBlobUrls.set(record.id, url);
            backgrounds[btnId] = {
              url,
              isVideo: Boolean(record.isVideo),
            };
          } else if (record.id.startsWith(BUTTON_ICON_PREFIX)) {
            const btnId = record.id.slice(BUTTON_ICON_PREFIX.length);
            const url = URL.createObjectURL(record.blob);
            buttonBlobUrls.set(record.id, url);
            icons[btnId] = url;
          }
        }

        resolve({ backgrounds, icons });
      });

      request.addEventListener('error', () => resolve({ backgrounds: {}, icons: {} }));
    });
  } catch (err) {
    console.warn('Error loading button media from IndexedDB:', err);
    return { backgrounds: {}, icons: {} };
  }
}

export async function clearButtonMedia(btnId: string, isIcon: boolean = false): Promise<void> {
  const id = `${isIcon ? BUTTON_ICON_PREFIX : BUTTON_MEDIA_PREFIX}${btnId}`;
  const prevUrl = buttonBlobUrls.get(id);
  if (prevUrl) {
    try {
      URL.revokeObjectURL(prevUrl);
    } catch {}
    buttonBlobUrls.delete(id);
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.addEventListener('success', () => resolve());
      request.addEventListener('error', () => resolve());
    });
  } catch (err) {
    console.warn('Failed to clear button media from IndexedDB:', err);
  }
}
