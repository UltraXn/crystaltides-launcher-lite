import { invoke } from '@tauri-apps/api/core';

/**
 * Aplica un parche binario delta BSDIFF sobre un archivo base de forma nativa en Rust,
 * validando opcionalmente el hash SHA-1 de integridad final.
 */
export const applyBinaryPatch = async (
  sourceFile: string,
  patchFile: string,
  targetFile: string,
  expectedSha1?: string,
): Promise<void> => {
  try {
    await invoke('apply_binary_patch', {
      sourceFile,
      patchFile,
      targetFile,
      expectedSha1: expectedSha1 ?? null,
    });
  } catch (err) {
    console.error('[DeltaPatch] Fallo al aplicar parche binario:', err);
    throw err;
  }
};
