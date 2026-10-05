import { invoke } from '@tauri-apps/api/core';

const SUPABASE_URL = 'https://gyoqnqvqhuxlcbrvtfia.supabase.co';
const SUPABASE_KEY_B64 =
  'ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1kNWIzRnVjWFp4YUhWNGJHTmljblowWm1saElpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzTmpVeU9UazBNVEVzSW1WNGNDSTZNakE0TURnM05UUXhNWDAuZUxVXy1JclJmaXh4N2RwUjlqZWlFb09UMXUtZXhRTWhJc3hTWFZJTmJSQQ==';

const getApiKey = (): string => {
  try {
    return atob(SUPABASE_KEY_B64);
  } catch {
    return SUPABASE_KEY_B64;
  }
};

export interface ModItem {
  name: string;
  download_url: string;
  sha1: string;
}

export interface LocalModInfo {
  filename: string;
  size_bytes: number;
  enabled: boolean;
  official: boolean;
}

/**
 * Consulta la lista de mods oficiales del servidor desde Supabase REST API
 */
export const fetchOfficialServerMods = async (): Promise<ModItem[]> => {
  const apiKey = getApiKey();
  const url = `${SUPABASE_URL}/rest/v1/official_mods?select=name,download_url,sha1`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[ModSync] Supabase returned HTTP ${res.status}`);
      return [];
    }

    const data: ModItem[] = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[ModSync] Error fetching official mods:', err);
    return [];
  }
};

/**
 * Sincroniza mods oficiales en una instancia:
 * 1. Descarga a ~/.crystaltides/virtual_library/{sha1}.jar
 * 2. Crea hardlinks en {gameDir}/mods/{name}
 * 3. Limpia mods antiguos del manifiesto
 */
export const syncOfficialModsForInstance = async (
  gameDir: string,
  onProgress?: (msg: string, pct: number) => void,
): Promise<void> => {
  onProgress?.('Verificando mods oficiales del servidor...', 10);
  const remoteMods = await fetchOfficialServerMods();

  if (remoteMods.length === 0) {
    onProgress?.('Mods verificados (sin actualizaciones pendientes).', 100);
    return;
  }

  const homeDir: string = (await invoke('get_home_dir')) || '';
  const normalizedHome = homeDir.replace(/\\/g, '/');
  const virtualLib = `${normalizedHome}/.crystaltides/virtual_library`;
  const targetModsDir = `${gameDir.replace(/\\/g, '/')}/mods`;

  onProgress?.('Analizando caché de mods (Virtual Library)...', 25);

  const downloadItems: Array<{ name: string; url: string; sha1: string }> = [];
  const syncEntries: Array<{ source: string; filename: string }> = [];

  for (const m of remoteMods) {
    if (!m.name || !m.download_url || !m.sha1) continue;
    const sha1Lower = m.sha1.toLowerCase().trim();
    const virtualFileName = `${sha1Lower}.jar`;
    const sourceVirtualPath = `${virtualLib}/${virtualFileName}`;

    downloadItems.push({
      name: virtualFileName,
      url: m.download_url,
      sha1: sha1Lower,
    });

    syncEntries.push({
      source: sourceVirtualPath,
      filename: m.name,
    });
  }

  if (downloadItems.length > 0) {
    onProgress?.(`Descargando ${downloadItems.length} mods optimizados...`, 40);
    await invoke('download_mods_parallel', {
      mods: downloadItems,
      outputDir: virtualLib,
      maxConcurrent: 4,
    });
  }

  onProgress?.('Enlazando mods en la instancia...', 85);
  await invoke('sync_mods', {
    targetDir: targetModsDir,
    modListJson: JSON.stringify(syncEntries),
  });

  onProgress?.('Mods sincronizados exitosamente.', 100);
};

export const listMods = async (gameDir: string): Promise<LocalModInfo[]> => {
  const modsDir = `${gameDir.replace(/\\/g, '/')}/mods`;
  try {
    return await invoke<LocalModInfo[]>('list_instance_mods', { targetDir: modsDir });
  } catch (err) {
    console.warn('[ModSync] Error listing mods:', err);
    return [];
  }
};

export const toggleMod = async (
  gameDir: string,
  filename: string,
  enable: boolean,
): Promise<void> => {
  const modsDir = `${gameDir.replace(/\\/g, '/')}/mods`;
  await invoke('toggle_instance_mod', {
    targetDir: modsDir,
    filename,
    enable,
  });
};

export const deleteMod = async (gameDir: string, filename: string): Promise<void> => {
  const modsDir = `${gameDir.replace(/\\/g, '/')}/mods`;
  await invoke('delete_instance_mod', {
    targetDir: modsDir,
    filename,
  });
};

export const openInstanceDirectory = async (gameDir: string): Promise<void> => {
  await invoke('open_folder', { path: gameDir });
};
