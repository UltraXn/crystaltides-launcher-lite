import { invoke } from '@tauri-apps/api/core';

export interface AppUpdateInfo {
  available: boolean;
  currentVersion: string;
  version?: string;
  body?: string;
  date?: string;
}

/**
 * Consulta de forma asíncrona si existe una nueva versión del Launcher Lite en GitHub Releases
 */
export const checkForAppUpdates = async (): Promise<AppUpdateInfo> => {
  try {
    return await invoke<AppUpdateInfo>('check_app_update');
  } catch (err) {
    console.warn('[AutoUpdater] Check skipped or failed (normal in dev/offline):', err);
    return { available: false, currentVersion: '0.1.2' };
  }
};

/**
 * Descarga la actualización e instala en segundo plano, luego reinicia automáticamente la aplicación
 */
export const applyAppUpdate = async (): Promise<void> => {
  try {
    await invoke('apply_app_update');
  } catch (err) {
    console.error('[AutoUpdater] Error applying update:', err);
    throw err;
  }
};

/**
 * Reinicia la aplicación nativa
 */
export const restartApp = async (): Promise<void> => {
  try {
    await invoke('restart_app');
  } catch (err) {
    console.error('[AutoUpdater] Error restarting app:', err);
  }
};

/**
 * Consulta las notas de versión directamente desde la API pública de GitHub Releases
 */
export const fetchRemoteReleaseNotes = async (versionTag: string): Promise<string | null> => {
  try {
    const res = await fetch(
      `https://api.github.com/repos/UltraXn/crystaltides-launcher-lite/releases/tags/${versionTag}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { body?: string };
    return data.body?.trim() ?? null;
  } catch (err) {
    console.warn('[AutoUpdater] No se pudieron cargar notas remotas de GitHub Releases:', err);
    return null;
  }
};
