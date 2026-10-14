import { invoke } from '@tauri-apps/api/core';

export interface CrashDiagnosis {
  crash_type:
    | 'OUT_OF_MEMORY'
    | 'MIXIN_CONFLICT'
    | 'GRAPHICS_DRIVER'
    | 'CORRUPTED_CONFIG'
    | 'JAVA_MISMATCH'
    | 'MISSING_DEPENDENCY'
    | 'GENERIC_CRASH';
  title: string;
  explanation: string;
  offending_mod?: string;
  recommendation: string;
  suggested_action?:
    | 'INCREASE_RAM'
    | 'DISABLE_MOD'
    | 'UPDATE_GPU_DRIVER'
    | 'RESET_OPTIONS'
    | 'UPDATE_JAVA'
    | 'VIEW_LOGS';
  log_snippet?: string;
}

/**
 * Analiza de forma forense la última ejecución fallida de Minecraft inspeccionando crash-reports y logs.
 */
export const analyzeLatestCrash = async (
  gameDir: string,
  exitCode?: number | null,
): Promise<CrashDiagnosis> => {
  try {
    return await invoke<CrashDiagnosis>('analyze_latest_crash', {
      gameDir,
      exitCode: exitCode ?? null,
    });
  } catch (err) {
    console.warn('[CrashDoctor] Error analizando crash:', err);
    return {
      crash_type: 'GENERIC_CRASH',
      title: 'Cierre Inesperado de Minecraft',
      explanation: 'No se pudo obtener el diagnóstico forense del proceso.',
      recommendation: 'Revisa logs/latest.log para más información.',
    };
  }
};

/**
 * Desactiva un mod conflictivo renombrando su archivo .jar a .disabled en el directorio mods.
 */
export const fixOffendingMod = async (gameDir: string, modName: string): Promise<string> => {
  try {
    return await invoke<string>('fix_offending_mod', { gameDir, modName });
  } catch (err) {
    console.error('[CrashDoctor] Error desactivando mod:', err);
    throw err;
  }
};

/**
 * Re-habilita un mod previamente desactivado quitando la extensión .disabled.
 */
export const enableOffendingMod = async (gameDir: string, modName: string): Promise<string> => {
  try {
    return await invoke<string>('enable_offending_mod', { gameDir, modName });
  } catch (err) {
    console.error('[CrashDoctor] Error re-habilitando mod:', err);
    throw err;
  }
};

/**
 * Restablece options.txt realizando un respaldo automático a options.txt.bak.
 */
export const resetOptionsTxt = async (gameDir: string): Promise<string> => {
  try {
    return await invoke<string>('reset_options_txt', { gameDir });
  } catch (err) {
    console.error('[CrashDoctor] Error restableciendo options.txt:', err);
    throw err;
  }
};
