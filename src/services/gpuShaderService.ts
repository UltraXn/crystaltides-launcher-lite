import { invoke } from "@tauri-apps/api/core";

export interface GpuProfile {
  vendor: string;
  model: string;
  tier: "ULTRA" | "HIGH" | "MEDIUM" | "LOW" | "INTEGRATED";
  recommended_render_distance: number;
  recommended_shader: string;
  recommended_simulation_distance: number;
  max_fps: number;
  recommended_render_scale?: number;
  enable_temporal_upscaling?: boolean;
}

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

export const fetchGpuProfile = async (): Promise<GpuProfile> => {
  try {
    return await invoke<GpuProfile>("detect_gpu_profile");
  } catch (err) {
    console.warn("GPU Profile detection fallback:", err);
    return {
      vendor: "Desconocido",
      model: "Gráficos Estándar",
      tier: "MEDIUM",
      recommended_render_distance: 12,
      recommended_shader: "ComplementaryReimagined_Medium.zip",
      recommended_simulation_distance: 10,
      max_fps: 120,
      recommended_render_scale: 0.75,
      enable_temporal_upscaling: true,
    };
  }
};

export const fetchHardwareProfile = async (): Promise<CpuInfo | null> => {
  try {
    return await invoke<CpuInfo>("detect_hardware_profile");
  } catch (err) {
    console.warn("Hardware profile detection failed:", err);
    return null;
  }
};

export const applyOptimalGpuOptions = async (gameDir: string, profile: GpuProfile): Promise<void> => {
  try {
    await invoke("apply_gpu_options", {
      gameDir,
      renderDistance: profile.recommended_render_distance,
      maxFps: profile.max_fps,
      shaderName: profile.recommended_shader,
      renderScale: profile.recommended_render_scale ?? 1.0,
    });
  } catch (err) {
    console.error("Failed to apply GPU options:", err);
  }
};

export const getAgentJvmArgs = async (gameDir: string): Promise<string[]> => {
  try {
    return await invoke<string[]>("get_agent_jvm_args", { gameDir });
  } catch (err) {
    console.warn("Failed to get agent JVM args:", err);
    return [];
  }
};
