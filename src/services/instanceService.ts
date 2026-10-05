import { invoke } from '@tauri-apps/api/core';

export interface GameInstance {
  id: string;
  name: string;
  mcVersion: string;
  loaderType: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';
  loaderVersion?: string;
  icon: 'crystal' | 'cube' | 'sword' | 'feather' | 'flame' | 'shield';
  isOfficial?: boolean;
  gameDir?: string;
  minRamGb?: number;
  maxRamGb?: number;
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
  return localStorage.getItem(ACTIVE_INSTANCE_ID_KEY) || DEFAULT_OFFICIAL_INSTANCE.id;
};

export const setActiveInstanceId = (id: string): void => {
  localStorage.setItem(ACTIVE_INSTANCE_ID_KEY, id);
};

export const resolveInstanceGameDir = async (instance: GameInstance): Promise<string> => {
  if (instance.gameDir && instance.gameDir.trim().length > 0) {
    return instance.gameDir;
  }
  const home: string = (await invoke('get_home_dir')) || '';
  const isWindows =
    typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent || navigator.platform);

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
}): GameInstance => {
  const instances = getSavedInstances();
  const id = `inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newInst: GameInstance = {
    id,
    name: data.name.trim() || `Instancia ${data.mcVersion}`,
    mcVersion: data.mcVersion,
    loaderType: data.loaderType,
    loaderVersion: data.loaderVersion,
    icon: data.icon || 'cube',
    isOfficial: false,
    createdAt: Date.now(),
  };

  instances.push(newInst);
  saveInstances(instances);
  setActiveInstanceId(id);
  return newInst;
};

export const removeInstance = (id: string): void => {
  if (id === DEFAULT_OFFICIAL_INSTANCE.id) {
    throw new Error('No se puede eliminar la instancia oficial de CrystalTides.');
  }
  const instances = getSavedInstances().filter((i) => i.id !== id);
  saveInstances(instances);
  if (getActiveInstanceId() === id) {
    setActiveInstanceId(DEFAULT_OFFICIAL_INSTANCE.id);
  }
};
