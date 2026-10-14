import { create } from 'zustand';
import type { LauncherModule, LauncherModuleContext, ModuleStorage } from './types';
import { getLauncherState, launcherActions } from '../store/launcherStore';

const ENABLED_MODULES_KEY = 'crystaltides_lite_enabled_modules_v1';

const createModuleStorage = (moduleId: string): ModuleStorage => ({
  get: <T = unknown>(key: string, defaultValue?: T): T => {
    try {
      const val = localStorage.getItem(`mod_${moduleId}_${key}`);
      return val !== null ? (JSON.parse(val) as T) : (defaultValue as T);
    } catch {
      return defaultValue as T;
    }
  },
  set: <T = unknown>(key: string, value: T) => {
    try {
      localStorage.setItem(`mod_${moduleId}_${key}`, JSON.stringify(value));
    } catch (e) {
      console.warn(`[Module:${moduleId}] Storage write failed:`, e);
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(`mod_${moduleId}_${key}`);
    } catch {}
  },
});

export const getModuleContext = (moduleId: string): LauncherModuleContext => {
  const state = getLauncherState();
  const activeInstance = state.instances.find((i) => i.id === state.activeInstanceId);
  const activeAccount = state.accounts.find((a) => a.id === state.activeAccountId);

  return {
    activeInstance,
    activeAccount,
    serverStatus: state.serverStatus,
    accentColor: state.accentColor,
    openModuleModal: (id: string) => useModuleStore.getState().openModal(id),
    closeModuleModal: () => useModuleStore.getState().closeModal(),
    launchGame: () => launcherActions.startLaunchFlow(),
    storage: createModuleStorage(moduleId),
  };
};

interface ModuleState {
  modules: LauncherModule[];
  enabledModuleIds: string[];
  activeModalModuleId: string | null;

  registerModule: (mod: LauncherModule) => void;
  toggleModule: (id: string) => void;
  isModuleEnabled: (id: string) => boolean;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useModuleStore = create<ModuleState>((set, get) => {
  const initialEnabled: string[] = (() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(ENABLED_MODULES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // By default, enable all built-in modules
    return ['ct.nether-portal-calc', 'ct.community-hub'];
  })();

  return {
    modules: [],
    enabledModuleIds: initialEnabled,
    activeModalModuleId: null,

    registerModule: (mod: LauncherModule) => {
      set((state) => {
        if (state.modules.some((m) => m.id === mod.id)) {
          return state;
        }
        try {
          mod.onInit?.(getModuleContext(mod.id));
        } catch (e) {
          console.error(`[Module:${mod.id}] onInit failed:`, e);
        }
        return { modules: [...state.modules, mod] };
      });
    },

    toggleModule: (id: string) => {
      set((state) => {
        const nextEnabled = state.enabledModuleIds.includes(id)
          ? state.enabledModuleIds.filter((m) => m !== id)
          : [...state.enabledModuleIds, id];

        try {
          localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(nextEnabled));
        } catch {}

        return { enabledModuleIds: nextEnabled };
      });
    },

    isModuleEnabled: (id: string) => get().enabledModuleIds.includes(id),

    openModal: (id: string) => set({ activeModalModuleId: id }),
    closeModal: () => set({ activeModalModuleId: null }),
  };
});
