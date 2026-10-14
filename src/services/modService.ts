import { invoke } from '@tauri-apps/api/core';
import { applyBinaryPatch } from './deltaPatchService';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

export interface ModItem {
  name: string;
  download_url: string;
  sha1: string;
  patch_url?: string;
  base_sha1?: string;
}

export interface LocalModInfo {
  filename: string;
  size_bytes: number;
  enabled: boolean;
  official: boolean;
}

export interface SyncModEntry {
  source: string;
  filename: string;
}

/**
 * Consulta la lista de mods oficiales del servidor desde Supabase REST API
 */
export const fetchOfficialServerMods = async (): Promise<ModItem[]> => {
  const url = `${SUPABASE_URL}/rest/v1/official_mods?select=name,download_url,sha1,patch_url,base_sha1`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
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
): Promise<SyncModEntry[]> => {
  onProgress?.('Verificando mods oficiales del servidor...', 10);
  const remoteMods = await fetchOfficialServerMods();

  if (remoteMods.length === 0) {
    onProgress?.('Mods verificados (sin actualizaciones pendientes).', 100);
    return [];
  }

  const homeDir: string = (await invoke('get_home_dir')) || '';
  const normalizedHome = homeDir.replace(/\\/g, '/');
  const virtualLib = `${normalizedHome}/.crystaltides/virtual_library`;
  const targetModsDir = `${gameDir.replace(/\\/g, '/')}/mods`;

  onProgress?.('Analizando caché de mods (Virtual Library)...', 25);

  const downloadItems: Array<{ name: string; url: string; sha1: string }> = [];
  const syncEntries: Array<{ source: string; filename: string }> = [];

  const processedResults = await Promise.all(
    remoteMods.map(async (m) => {
      if (!m.name || !m.download_url || !m.sha1) return null;
      const sha1Lower = m.sha1.toLowerCase().trim();
      const virtualFileName = `${sha1Lower}.jar`;
      const sourceVirtualPath = `${virtualLib}/${virtualFileName}`;

      // Smart Delta Patching: si el servidor provee delta patch y tenemos el JAR base, intentamos parchear
      if (m.patch_url && m.base_sha1) {
        const baseVirtualPath = `${virtualLib}/${m.base_sha1.toLowerCase().trim()}.jar`;
        const patchTempPath = `${virtualLib}/temp_${sha1Lower}.patch`;
        try {
          const baseExists = await invoke<boolean>('file_exists', { path: baseVirtualPath }).catch(
            () => false,
          );
          if (baseExists) {
            onProgress?.(`Descargando parche delta para ${m.name}...`, 35);
            await invoke('download_single_file', {
              url: m.patch_url,
              outputPath: patchTempPath,
            });
            onProgress?.(`Aplicando parche binario delta (bsdiff) en ${m.name}...`, 38);
            await applyBinaryPatch(baseVirtualPath, patchTempPath, sourceVirtualPath, sha1Lower);
            return {
              downloadItem: null,
              syncEntry: { source: sourceVirtualPath, filename: m.name },
            };
          }
        } catch (patchErr) {
          console.warn(
            `[DeltaPatch] Fallo al aplicar delta patch a ${m.name}, usando descarga completa:`,
            patchErr,
          );
        } finally {
          await invoke('delete_file', { path: patchTempPath }).catch(() => {});
        }
      }

      return {
        downloadItem: {
          name: virtualFileName,
          url: m.download_url,
          sha1: sha1Lower,
        },
        syncEntry: {
          source: sourceVirtualPath,
          filename: m.name,
        },
      };
    }),
  );

  for (const item of processedResults) {
    if (!item) continue;
    if (item.downloadItem) {
      downloadItems.push(item.downloadItem);
    }
    syncEntries.push(item.syncEntry);
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
  return syncEntries;
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

export interface PerformanceModProject {
  slug: string;
  name: string;
  requiredLoaders: string[];
}

export const PERFORMANCE_STACK_PROJECTS: PerformanceModProject[] = [
  { slug: 'sodium', name: 'Sodium', requiredLoaders: ['fabric', 'quilt'] },
  { slug: 'embeddium', name: 'Embeddium', requiredLoaders: ['forge', 'neoforge'] },
  { slug: 'lithium', name: 'Lithium', requiredLoaders: ['fabric', 'quilt'] },
  {
    slug: 'ferrite-core',
    name: 'FerriteCore',
    requiredLoaders: ['fabric', 'quilt', 'forge', 'neoforge'],
  },
  {
    slug: 'entityculling',
    name: 'Entity Culling',
    requiredLoaders: ['fabric', 'quilt', 'forge', 'neoforge'],
  },
  {
    slug: 'immediatelyfast',
    name: 'ImmediatelyFast',
    requiredLoaders: ['fabric', 'quilt', 'forge', 'neoforge'],
  },
  {
    slug: 'modernfix',
    name: 'ModernFix',
    requiredLoaders: ['fabric', 'quilt', 'forge', 'neoforge'],
  },
];

/**
 * Consulta y sincroniza el stack esencial de optimización de rendimiento (Sodium/Embeddium, Lithium, etc.)
 * utilizando la API pública de Modrinth hacia la biblioteca virtual (~/.crystaltides/virtual_library)
 */
interface PerformanceStackModItem {
  downloadItem: { name: string; url: string; sha1: string };
  syncEntry: { source: string; filename: string };
}

const resolveModDownloadInfo = async (
  slug: string,
  loader: string,
  mcVersion: string,
  virtualLib: string,
): Promise<PerformanceStackModItem | null> => {
  try {
    const apiUrl = `https://api.modrinth.com/v2/project/${slug}/version?loaders=["${loader}"]&game_versions=["${mcVersion}"]`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'CrystalTides-Launcher-Lite/2.0 (performance-stack)' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const versions = await res.json();
    if (!Array.isArray(versions) || versions.length === 0) return null;

    const latestVersion = versions[0];
    const primaryFile =
      latestVersion.files?.find((f: { primary?: boolean }) => f.primary) ??
      latestVersion.files?.[0];
    if (!primaryFile?.url || !primaryFile?.hashes?.sha1) return null;

    const sha1Lower = primaryFile.hashes.sha1.toLowerCase();
    const virtualFileName = `${sha1Lower}.jar`;

    return {
      downloadItem: {
        name: virtualFileName,
        url: primaryFile.url,
        sha1: sha1Lower,
      },
      syncEntry: {
        source: `${virtualLib}/${virtualFileName}`,
        filename: primaryFile.filename ?? `${slug}.jar`,
      },
    };
  } catch (e) {
    console.warn(`[PerformanceStack] Error querying ${slug}:`, e);
    return null;
  }
};

export const syncPerformanceStackForInstance = async (
  gameDir: string,
  mcVersion: string,
  loaderType: string,
  onProgress?: (msg: string, pct: number) => void,
  existingSyncEntries?: SyncModEntry[],
): Promise<SyncModEntry[]> => {
  const normalizedLoader = loaderType.toLowerCase().trim();
  const applicableMods = PERFORMANCE_STACK_PROJECTS.filter((p) =>
    p.requiredLoaders.includes(normalizedLoader),
  );

  if (applicableMods.length === 0) return existingSyncEntries ?? [];

  // Comprobar mods locales instalados para evitar descargar mods duplicados
  let localMods: LocalModInfo[] = [];
  try {
    localMods = await listMods(gameDir);
  } catch (err) {
    console.warn('[ModSync] Error listando mods locales en syncPerformanceStack:', err);
  }

  const installedJarNames = localMods
    .map((m) => m.filename.toLowerCase())
    .filter((name) => name.endsWith('.jar'));

  const isAlreadyInstalled = (slug: string) => {
    const s = slug.toLowerCase();
    const sClean = s.replace(/[-_]/g, '');
    return installedJarNames.some(
      (name) => name.includes(s) || name.includes(sClean),
    );
  };

  const modsToDownload = applicableMods.filter((mod) => !isAlreadyInstalled(mod.slug));

  if (modsToDownload.length === 0) return existingSyncEntries ?? [];

  onProgress?.('Verificando stack de rendimiento esencial (Sodium/Lithium)...', 10);

  const homeDir: string = (await invoke('get_home_dir')) || '';
  const normalizedHome = homeDir.replace(/\\/g, '/');
  const virtualLib = `${normalizedHome}/.crystaltides/virtual_library`;
  const targetModsDir = `${gameDir.replace(/\\/g, '/')}/mods`;

  const downloadItems: Array<{ name: string; url: string; sha1: string }> = [];
  const syncEntries: SyncModEntry[] = [];

  const resolved = await Promise.all(
    modsToDownload.map((mod) =>
      resolveModDownloadInfo(mod.slug, normalizedLoader, mcVersion, virtualLib),
    ),
  );
  for (const item of resolved) {
    if (item) {
      downloadItems.push(item.downloadItem);
      syncEntries.push(item.syncEntry);
    }
  }

  if (downloadItems.length > 0) {
    onProgress?.(`Descargando stack de rendimiento (${downloadItems.length} mods)...`, 40);
    await invoke('download_mods_parallel', {
      mods: downloadItems,
      outputDir: virtualLib,
      maxConcurrent: 4,
    });
  }

  // Deduplicar fusionando con existingSyncEntries por filename
  const mergedMap = new Map<string, SyncModEntry>();
  if (existingSyncEntries) {
    for (const entry of existingSyncEntries) {
      mergedMap.set(entry.filename.toLowerCase(), entry);
    }
  }
  for (const entry of syncEntries) {
    mergedMap.set(entry.filename.toLowerCase(), entry);
  }
  const mergedEntries = Array.from(mergedMap.values());

  if (mergedEntries.length > 0) {
    onProgress?.('Enlazando mods de rendimiento en la instancia...', 80);
    await invoke('sync_mods', {
      targetDir: targetModsDir,
      modListJson: JSON.stringify(mergedEntries),
    });
  }

  onProgress?.('Stack de rendimiento listo.', 100);
  return mergedEntries;
};
