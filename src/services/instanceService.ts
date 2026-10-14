import { invoke } from '@tauri-apps/api/core';
import { getDatabaseProfiles, saveDatabaseProfile, deleteDatabaseProfile } from './dbService';

export interface GameInstance {
  id: string;
  name: string;
  mcVersion: string;
  loaderType: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';
  loaderVersion?: string;
  icon: 'crystal' | 'cube' | 'sword' | 'feather' | 'flame' | 'shield';
  isOfficial?: boolean;
  gameDir?: string;
  importedSourceId?: string;
  minRamGb?: number;
  maxRamGb?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  fullscreen?: boolean;
  preLaunchCommand?: string;
  wrapperCommand?: string;
  postExitCommand?: string;
  environmentVariables?: string;
  jvmArgs?: string;
  createdAt: number;
  lastPlayed?: number;
}

const INSTANCES_STORAGE_KEY = 'crystaltides_lite_instances_v1';
const ACTIVE_INSTANCE_ID_KEY = 'crystaltides_lite_active_instance_v1';

export const DEFAULT_OFFICIAL_INSTANCE: GameInstance = {
  id: 'crystaltides-smp',
  name: 'CrystalTides SMP (Oficial)',
  mcVersion: '1.21.1',
  loaderType: 'neoforge',
  loaderVersion: '21.1.252',
  icon: 'crystal',
  isOfficial: true,
  createdAt: 1700000000000,
};

export const DEFAULT_VANILLA_INSTANCE: GameInstance = {
  id: 'vanilla-clean',
  name: 'Minecraft Vanilla (Limpio)',
  mcVersion: '1.21.1',
  loaderType: 'vanilla',
  icon: 'cube',
  isOfficial: false,
  createdAt: 1700000000001,
};

/**
 * Reconcilia y sincroniza las instancias con la base de datos SQLite (crystaltides.db).
 */
export const syncInstancesWithDatabase = async (): Promise<GameInstance[]> => {
  try {
    const dbProfiles = await getDatabaseProfiles();
    if (dbProfiles && dbProfiles.length > 0) {
      const existingLocal = getSavedInstances();
      const mapped: GameInstance[] = dbProfiles.map((p) => {
        const prev = existingLocal.find((e) => e.id === p.id);
        return {
          id: p.id,
          name: p.name,
          mcVersion: p.mc_version,
          loaderType: (p.loader_type as GameInstance['loaderType']) || 'vanilla',
          loaderVersion: p.loader_version,
          icon: prev?.icon ?? (p.id === DEFAULT_OFFICIAL_INSTANCE.id ? 'crystal' : 'cube'),
          isOfficial: p.id === DEFAULT_OFFICIAL_INSTANCE.id,
          gameDir: p.game_dir,
          importedSourceId: prev?.importedSourceId,
          minRamGb: p.min_ram ? Math.round(p.min_ram / 1024) : undefined,
          maxRamGb: p.max_ram ? Math.round(p.max_ram / 1024) : undefined,
          resolutionWidth: p.resolution_width ? Number(p.resolution_width) : undefined,
          resolutionHeight: p.resolution_height ? Number(p.resolution_height) : undefined,
          fullscreen: p.fullscreen === true,
          preLaunchCommand: p.pre_launch_command,
          wrapperCommand: p.wrapper_command,
          postExitCommand: p.post_exit_command,
          environmentVariables: p.environment_variables,
          jvmArgs: p.jvm_args,
          createdAt: p.created_at,
          lastPlayed: p.updated_at,
        };
      });
      localStorage.setItem(INSTANCES_STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    }

    // Si SQLite está vacío, sembramos las instancias iniciales
    const initial = [DEFAULT_OFFICIAL_INSTANCE, DEFAULT_VANILLA_INSTANCE];
    await Promise.all(
      initial.map((inst) =>
        saveDatabaseProfile({
          id: inst.id,
          name: inst.name,
          mc_version: inst.mcVersion,
          loader_type: inst.loaderType,
          loader_version: inst.loaderVersion,
          min_ram: (inst.minRamGb ?? 1) * 1024,
          max_ram: (inst.maxRamGb ?? 4) * 1024,
          game_dir: inst.gameDir,
          resolution_width: inst.resolutionWidth,
          resolution_height: inst.resolutionHeight,
          fullscreen: inst.fullscreen,
          pre_launch_command: inst.preLaunchCommand,
          wrapper_command: inst.wrapperCommand,
          post_exit_command: inst.postExitCommand,
          environment_variables: inst.environmentVariables,
          jvm_args: inst.jvmArgs,
          created_at: inst.createdAt,
          updated_at: inst.lastPlayed ?? inst.createdAt,
        }),
      ),
    );
    return initial;
  } catch (err) {
    console.warn('[InstanceService] Error sincronizando con SQLite, usando fallback:', err);
    return getSavedInstances();
  }
};

export const getSavedInstances = (): GameInstance[] => {
  try {
    const raw = localStorage.getItem(INSTANCES_STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_OFFICIAL_INSTANCE, DEFAULT_VANILLA_INSTANCE];
      localStorage.setItem(INSTANCES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Error reading instances from localStorage:', err);
  }
  return [DEFAULT_OFFICIAL_INSTANCE, DEFAULT_VANILLA_INSTANCE];
};

export const saveInstances = (instances: GameInstance[]): void => {
  localStorage.setItem(INSTANCES_STORAGE_KEY, JSON.stringify(instances));
};

export const getActiveInstanceId = (): string => {
  return localStorage.getItem(ACTIVE_INSTANCE_ID_KEY) ?? DEFAULT_OFFICIAL_INSTANCE.id;
};

export const setActiveInstanceId = (id: string): void => {
  localStorage.setItem(ACTIVE_INSTANCE_ID_KEY, id);
};

export const resolveInstanceGameDir = async (instance: GameInstance): Promise<string> => {
  if (instance.gameDir && instance.gameDir.trim().length > 0) {
    return instance.gameDir;
  }
  const home: string = (await invoke('get_home_dir')) ?? '';
  const isWindows = typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent);

  if (isWindows || home.includes('\\') || /^[a-zA-Z]:/.test(home)) {
    const cleanHome = home.replace(/\//g, '\\');
    if (instance.isOfficial) {
      return `${cleanHome}\\.crystaltides`;
    }
    return `${cleanHome}\\.crystaltides\\instances\\${instance.id}`;
  }

  const normalizedHome = home.replace(/\\/g, '/');
  if (instance.isOfficial) {
    return `${normalizedHome}/.crystaltides`;
  }
  return `${normalizedHome}/.crystaltides/instances/${instance.id}`;
};

export const createNewInstance = (data: {
  name: string;
  mcVersion: string;
  loaderType: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';
  loaderVersion?: string;
  icon?: 'crystal' | 'cube' | 'sword' | 'feather' | 'flame' | 'shield';
  minRamGb?: number;
  maxRamGb?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  fullscreen?: boolean;
  preLaunchCommand?: string;
  wrapperCommand?: string;
  postExitCommand?: string;
  environmentVariables?: string;
  jvmArgs?: string;
}): GameInstance => {
  const instances = getSavedInstances();
  const id = `inst-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const newInst: GameInstance = {
    id,
    name: data.name.trim() || `Instancia ${data.mcVersion}`,
    mcVersion: data.mcVersion,
    loaderType: data.loaderType,
    loaderVersion: data.loaderVersion,
    icon: data.icon ?? 'cube',
    isOfficial: false,
    minRamGb: data.minRamGb,
    maxRamGb: data.maxRamGb,
    resolutionWidth: data.resolutionWidth,
    resolutionHeight: data.resolutionHeight,
    fullscreen: data.fullscreen,
    preLaunchCommand: data.preLaunchCommand,
    wrapperCommand: data.wrapperCommand,
    postExitCommand: data.postExitCommand,
    environmentVariables: data.environmentVariables,
    jvmArgs: data.jvmArgs,
    createdAt: Date.now(),
  };

  instances.push(newInst);
  saveInstances(instances);
  setActiveInstanceId(id);

  saveDatabaseProfile({
    id,
    name: newInst.name,
    mc_version: newInst.mcVersion,
    loader_type: newInst.loaderType,
    loader_version: newInst.loaderVersion,
    min_ram: (newInst.minRamGb ?? 1) * 1024,
    max_ram: (newInst.maxRamGb ?? 4) * 1024,
    resolution_width: newInst.resolutionWidth,
    resolution_height: newInst.resolutionHeight,
    fullscreen: newInst.fullscreen,
    pre_launch_command: newInst.preLaunchCommand,
    wrapper_command: newInst.wrapperCommand,
    post_exit_command: newInst.postExitCommand,
    environment_variables: newInst.environmentVariables,
    jvm_args: newInst.jvmArgs,
    created_at: newInst.createdAt,
    updated_at: newInst.createdAt,
  }).catch((err) => console.warn('[InstanceService] Error async saving to SQLite:', err));

  return newInst;
};

export const updateInstance = (instance: GameInstance): void => {
  const instances = getSavedInstances();
  const idx = instances.findIndex((i) => i.id === instance.id);
  if (idx !== -1) {
    instances[idx] = instance;
  } else {
    instances.push(instance);
  }
  saveInstances(instances);

  saveDatabaseProfile({
    id: instance.id,
    name: instance.name,
    mc_version: instance.mcVersion,
    loader_type: instance.loaderType,
    loader_version: instance.loaderVersion,
    min_ram: (instance.minRamGb ?? 1) * 1024,
    max_ram: (instance.maxRamGb ?? 4) * 1024,
    game_dir: instance.gameDir,
    resolution_width: instance.resolutionWidth,
    resolution_height: instance.resolutionHeight,
    fullscreen: instance.fullscreen,
    pre_launch_command: instance.preLaunchCommand,
    wrapper_command: instance.wrapperCommand,
    post_exit_command: instance.postExitCommand,
    environment_variables: instance.environmentVariables,
    jvm_args: instance.jvmArgs,
    created_at: instance.createdAt,
    updated_at: Date.now(),
  }).catch((err) =>
    console.warn('[InstanceService] Error async saving instance update to SQLite:', err),
  );
};

export const removeInstance = (id: string): void => {
  if (id === DEFAULT_OFFICIAL_INSTANCE.id) {
    throw new Error('No se puede eliminar la instancia oficial de CrystalTides.');
  }
  const allInstances = getSavedInstances();
  const target = allInstances.find((i) => i.id === id);
  const instances = allInstances.filter((i) => i.id !== id);
  saveInstances(instances);
  deleteDatabaseProfile(id).catch((err) =>
    console.warn('[InstanceService] Error async deleting from SQLite:', err),
  );
  if (getActiveInstanceId() === id) {
    setActiveInstanceId(DEFAULT_OFFICIAL_INSTANCE.id);
  }

  const isInternal =
    !target?.gameDir ||
    target.gameDir.replace(/\\/g, '/').toLowerCase().includes('.crystaltides/instances/');

  if (isInternal) {
    invoke('delete_instance_dir', { instanceId: id }).catch((err) =>
      console.warn('[InstanceService] Error async deleting instance directory:', err),
    );
  }
};

export const duplicateInstance = (id: string): GameInstance => {
  const instances = getSavedInstances();
  const original = instances.find((i) => i.id === id);
  if (!original) {
    throw new Error('Instancia no encontrada para duplicar.');
  }
  return createNewInstance({
    name: `${original.name} (Copia)`,
    mcVersion: original.mcVersion,
    loaderType: original.loaderType,
    loaderVersion: original.loaderVersion,
    icon: original.icon,
    resolutionWidth: original.resolutionWidth,
    resolutionHeight: original.resolutionHeight,
    fullscreen: original.fullscreen,
    preLaunchCommand: original.preLaunchCommand,
    wrapperCommand: original.wrapperCommand,
    postExitCommand: original.postExitCommand,
    environmentVariables: original.environmentVariables,
    jvmArgs: original.jvmArgs,
  });
};
