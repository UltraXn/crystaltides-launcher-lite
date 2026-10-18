import { invoke } from "@tauri-apps/api/core";

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
    return await invoke<AppUpdateInfo>("check_app_update");
  } catch (err) {
    console.warn("[AutoUpdater] Check skipped or failed (normal in dev/offline):", err);
    return { available: false, currentVersion: "0.1.1" };
  }
};

/**
 * Descarga la actualización e instala en segundo plano, luego reinicia automáticamente la aplicación
 */
export const applyAppUpdate = async (): Promise<void> => {
  try {
    await invoke("apply_app_update");
  } catch (err) {
    console.error("[AutoUpdater] Error applying update:", err);
    throw err;
  }
};

/**
 * Reinicia la aplicación nativa
 */
export const restartApp = async (): Promise<void> => {
  try {
    await invoke("restart_app");
  } catch (err) {
    console.error("[AutoUpdater] Error restarting app:", err);
  }
};
