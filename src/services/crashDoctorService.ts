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

/**
 * Envía telemetría de crash sanitizada a la API central de CrystalTides de forma no bloqueante y segura.
 */
export const submitCrashTelemetry = async (
  diagnosis: CrashDiagnosis,
  exitCode?: number | null,
  mcVersion?: string,
): Promise<boolean> => {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://api.crystaltidessmp.net';
    const endpoint = `${baseUrl}/api/launcher/crash-report`;

    const payload = {
      crashType: diagnosis.crash_type,
      exitCode: exitCode ?? null,
      title: diagnosis.title.slice(0, 200),
      offendingMod: diagnosis.offending_mod ?? null,
      mcVersion: mcVersion ?? undefined,
      os: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      logSnippet: (diagnosis.log_snippet ?? diagnosis.explanation ?? '').slice(0, 8000),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    return response.ok;
  } catch (err) {
    console.warn('[CrashDoctor] Telemetría de crash silenciada ante error o timeout:', err);
    return false;
  }
};
