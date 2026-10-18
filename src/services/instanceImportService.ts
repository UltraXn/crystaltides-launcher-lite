import { invoke } from '@tauri-apps/api/core';
import { GameInstance, getSavedInstances, saveInstances } from './instanceService';
import { saveDatabaseProfile } from './dbService';

export interface ImportableInstance {
  id: string;
  source: 'mojang' | 'curseforge' | 'modrinth' | 'prism' | 'custom';
  source_name: string;
  name: string;
  mc_version: string;
  loader_type: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';
  loader_version?: string;
  game_dir: string;
  mods_count: number;
  icon?: string;
  min_ram_gb?: number;
  max_ram_gb?: number;
  jvm_args?: string;
  resolution_width?: number;
  resolution_height?: number;
  has_omitted_jvm_args?: boolean;
}

export const fetchExternalInstances = async (): Promise<ImportableInstance[]> => {
  try {
    return await invoke<ImportableInstance[]>('scan_external_instances');
  } catch (err) {
    console.warn('[Importer] Error scanning external instances:', err);
    return [];
  }
};

export const inspectCustomDirectory = async (path: string): Promise<ImportableInstance | null> => {
  try {
    return await invoke<ImportableInstance>('inspect_custom_instance_dir', { path });
  } catch (err) {
    console.warn('[Importer] Error inspecting custom directory:', err);
    return null;
  }
};

export const pickInstanceFolder = async (): Promise<string | null> => {
  try {
    return await invoke<string | null>('pick_instance_folder');
  } catch (err) {
    console.warn('[Importer] Error opening folder picker:', err);
    return null;
  }
};

export const importInstanceToLauncher = async (
  item: ImportableInstance,
  options?: {
    customName?: string;
    icon?: 'crystal' | 'cube' | 'sword' | 'feather' | 'flame' | 'shield';
  },
): Promise<GameInstance> => {
  const existing = getSavedInstances();
  const id = `import-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const customName = options?.customName?.trim();
  const name = customName || item.name;

  const resolveIcon = (): GameInstance['icon'] => {
    if (options?.icon) return options.icon;
    if (item.source === 'curseforge') return 'flame';
    if (item.source === 'modrinth') return 'feather';
    if (item.source === 'prism') return 'sword';
    return 'cube';
  };

  const minRamGb = typeof item.min_ram_gb === 'number' && item.min_ram_gb > 0 ? item.min_ram_gb : 4;
  const maxRamGb = typeof item.max_ram_gb === 'number' && item.max_ram_gb > 0 ? item.max_ram_gb : 8;

  const newInst: GameInstance = {
    id,
    name,
    mcVersion: item.mc_version,
    loaderType: item.loader_type,
    loaderVersion: item.loader_version,
    minRamGb,
    maxRamGb,
    jvmArgs: item.jvm_args,
    resolutionWidth: item.resolution_width,
    resolutionHeight: item.resolution_height,
    gameDir: item.game_dir,
    importedSourceId: item.id,
    icon: resolveIcon(),
    isOfficial: false,
    createdAt: Date.now(),
  };

  const updated = [...existing, newInst];
  saveInstances(updated);

  try {
    await saveDatabaseProfile({
      id: newInst.id,
      name: newInst.name,
      mc_version: newInst.mcVersion,
      loader_type: newInst.loaderType,
      loader_version: newInst.loaderVersion,
      min_ram: Math.round(minRamGb * 1024),
      max_ram: Math.round(maxRamGb * 1024),
      jvm_args: newInst.jvmArgs,
      resolution_width: newInst.resolutionWidth,
      resolution_height: newInst.resolutionHeight,
      game_dir: newInst.gameDir,
      created_at: newInst.createdAt,
      updated_at: newInst.createdAt,
    });
  } catch (dbErr) {
    console.warn('[Importer] Error saving imported instance to SQLite:', dbErr);
  }

  // Importar automáticamente configuraciones de Minecraft (teclas, volumen, renderizado, servers.dat)
  if (newInst.gameDir) {
    try {
      await invoke('import_minecraft_options', { targetGameDir: newInst.gameDir });
    } catch (optErr) {
      console.warn('[Importer] Error importando configuraciones de Minecraft:', optErr);
    }
  }

  return newInst;
};
