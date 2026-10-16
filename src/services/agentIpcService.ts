import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export interface GameHandshakePayload {
  minecraft_version?: string;
  client_version?: string;
  mods_count?: number;
  gl_renderer?: string;
  gl_vendor?: string;
  gl_version?: string;
}

export interface LiveBenchmarkMetrics {
  /** null sin fuente de frames (instancia sin crystaltides-boost); 0 es un dato real (minimizado). */
  average_fps: number | null;
  frametime_p99_ms: number | null;
  gc_pause_time_ms: number;
  swapchain_backend: string;
  integrity_status: string;
  memory_used_mb?: number | null;
  memory_total_mb?: number | null;
}

/**
 * Inicia el servidor GameIPC local en el proceso backend de Rust (Tauri).
 */
export const initGameIpcServer = async (): Promise<number> => {
  try {
    return await invoke<number>('start_game_ipc_server');
  } catch (err) {
    console.warn('[GameIPC] Failed to start IPC server:', err);
    return 28195;
  }
};

/**
 * Consulta las últimas métricas de telemetría reportadas por el juego.
 */
export const fetchLiveBenchmarkMetrics = async (): Promise<LiveBenchmarkMetrics | null> => {
  try {
    return await invoke<LiveBenchmarkMetrics>('get_agent_benchmark_status');
  } catch (err) {
    console.warn('[GameIPC] Error fetching benchmark status:', err);
    return null;
  }
};

/**
 * Suscribe listeners para eventos en vivo reportados desde el proceso de Minecraft.
 * 
 * @returns {Promise<() => void>} Función de desuscripción sincrónica que invoca y vacía
 * todas las referencias de `UnlistenFn` para evitar fugas de eventos y listeners duplicados.
 */
export const subscribeGameIpcEvents = async (callbacks: {
  onHandshake?: (payload: GameHandshakePayload) => void;
  onMetrics?: (metrics: LiveBenchmarkMetrics) => void;
  onReady?: (loadDurationMs?: number) => void;
}): Promise<() => void> => {
  const unlisteners: UnlistenFn[] = [];

  if (callbacks.onHandshake) {
    const un = await listen<GameHandshakePayload>('game-ipc-handshake', (event) => {
      callbacks.onHandshake?.(event.payload);
    });
    unlisteners.push(un);
  }

  if (callbacks.onMetrics) {
    const un = await listen<LiveBenchmarkMetrics>('game-ipc-metrics', (event) => {
      callbacks.onMetrics?.(event.payload);
    });
    unlisteners.push(un);
  }

  if (callbacks.onReady) {
    const un = await listen<number | undefined>('game-ipc-ready', (event) => {
      callbacks.onReady?.(event.payload);
    });
    unlisteners.push(un);
  }

  return () => {
    while (unlisteners.length > 0) {
      const fn = unlisteners.pop();
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (e) {
          console.warn('[GameIPC] Error executing unlisten callback:', e);
        }
      }
    }
  };
};

/**
 * Obtiene los argumentos JVM recomendados para el agente CrystalTides desde Rust.
 */
export const getAgentJvmArgs = async (gameDir: string): Promise<string[]> => {
  try {
    await initGameIpcServer();
    return await invoke<string[]>('get_agent_jvm_args', { gameDir });
  } catch (err) {
    console.warn('[GameIPC] Failed to get agent JVM args:', err);
    return [];
  }
};
