import { invoke } from '@tauri-apps/api/core';

export interface ServerEntry {
  name: string;
  ip: string;
  icon?: string;
  acceptTextures?: number;
}

export interface SingleplayerSaveInfo {
  folder_name: string;
  level_name: string;
  last_played: number;
  game_type: number;
  hardcore: boolean;
  version_name?: string;
  icon_base64?: string;
}

/**
 * Lee la lista de servidores guardados en .minecraft/servers.dat mediante el motor nativo fastnbt en Rust.
 */
export const readServersDat = async (gameDir: string): Promise<ServerEntry[]> => {
  try {
    return await invoke<ServerEntry[]>('read_servers_dat', { gameDir });
  } catch (err) {
    console.warn('[NbtService] Error leyendo servers.dat:', err);
    return [];
  }
};

/**
 * Guarda y serializa atómicamente la lista de servidores en .minecraft/servers.dat en formato NBT GZipped.
 */
export const saveServersDat = async (gameDir: string, servers: ServerEntry[]): Promise<void> => {
  try {
    await invoke('save_servers_dat', { gameDir, servers });
  } catch (err) {
    console.error('[NbtService] Error guardando servers.dat:', err);
    throw err;
  }
};

/**
 * Escanea y extrae metadatos y miniaturas (icon.png) de todos los mundos locales en .minecraft/saves.
 */
export const listSingleplayerSaves = async (gameDir: string): Promise<SingleplayerSaveInfo[]> => {
  try {
    return await invoke<SingleplayerSaveInfo[]>('list_singleplayer_saves', { gameDir });
  } catch (err) {
    console.warn('[NbtService] Error escaneando mundos singleplayer:', err);
    return [];
  }
};
