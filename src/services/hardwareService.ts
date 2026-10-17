import { invoke } from '@tauri-apps/api/core';

export interface CpuInfo {
  brand: string;
  vendor: string;
  physical_cores: number;
  logical_cores: number;
  has_hyperthreading: boolean;
  is_hybrid: boolean;
  is_ryzen_x3d_dual_ccd: boolean;
  is_xeon_or_legacy: boolean;
  recommended_affinity_mask: number;
  jvm_recommended_flags: string[];
}

/**
 * Inspecciona la CPU del sistema mediante el backend de Rust (Tauri)
 * para detectar topología híbrida (P/E cores) o dual CCD X3D y generar
 * los flags de optimización JVM y máscara de afinidad.
 */
export const fetchHardwareProfile = async (javaVersion?: number): Promise<CpuInfo | null> => {
  try {
    return await invoke<CpuInfo>('detect_hardware_profile', {
      javaVersion: javaVersion ?? null,
    });
  } catch (err) {
    console.warn('[Hardware] Error al detectar perfil de CPU:', err);
    return null;
  }
};

export type GpuTier = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INTEGRATED';

export interface GpuProfile {
  vendor: string;
  model: string;
  tier: GpuTier | string;
  vram_mb?: number | null;
}

/**
 * Inspecciona el adaptador gráfico (GPU) principal y VRAM mediante el backend de Rust
 * para clasificar el hardware en un Tier de rendimiento (ULTRA, HIGH, MEDIUM, LOW, INTEGRATED).
 */
export const fetchGpuProfile = async (): Promise<GpuProfile | null> => {
  try {
    return await invoke<GpuProfile>('detect_gpu_profile');
  } catch (err) {
    console.warn('[Hardware/GPU] Error al detectar perfil de GPU:', err);
    return null;
  }
};
