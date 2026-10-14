import React from 'react';
import { create } from 'zustand';
import {
  Globe,
  Compass,
  Code,
  Sparkles,
  Terminal,
  Folder,
  BookOpen,
  Gamepad2,
  MessageSquare,
  ShoppingBag,
  ExternalLink,
  Puzzle,
} from 'lucide-react';
import type {
  LauncherModule,
  LauncherModuleContext,
  ModuleStorage,
  CustomPluginManifest,
} from './types';
import { getLauncherState, launcherActions, onHudEditingChange } from '../store/launcherStore';
import { invoke } from '@tauri-apps/api/core';

export const isSafeExternalUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
};

const ENABLED_MODULES_KEY = 'crystaltides_lite_enabled_modules_v1';
const CUSTOM_PLUGINS_KEY = 'crystaltides_lite_custom_plugins_v1';

const getPluginIcon = (iconName?: string) => {
  const size = 18;
  switch (iconName?.toLowerCase()) {
    case 'globe':
      return <Globe size={size} />;
    case 'compass':
      return <Compass size={size} />;
    case 'code':
      return <Code size={size} />;
    case 'sparkles':
      return <Sparkles size={size} />;
    case 'terminal':
      return <Terminal size={size} />;
    case 'folder':
      return <Folder size={size} />;
    case 'bookopen':
    case 'book':
      return <BookOpen size={size} />;
    case 'gamepad':
    case 'gamepad2':
      return <Gamepad2 size={size} />;
    case 'messagesquare':
    case 'chat':
      return <MessageSquare size={size} />;
    case 'shoppingbag':
    case 'store':
      return <ShoppingBag size={size} />;
    case 'externallink':
    case 'link':
      return <ExternalLink size={size} />;
    default:
      return <Puzzle size={size} />;
  }
};

const CustomPluginModalContent: React.FC<{
  manifest: CustomPluginManifest;
}> = ({ manifest }) => {
  const modalInfo = manifest.slots?.modal;
  if (!modalInfo) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {modalInfo.description && (
        <p
          style={{
            fontSize: '12px',
            color: 'rgba(248, 250, 252, 0.7)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {modalInfo.description}
        </p>
      )}

      {modalInfo.links && modalInfo.links.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {modalInfo.links
            .filter((link) => isSafeExternalUrl(link.url))
            .map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textDecoration: 'none',
                color: '#f8fafc',
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>
                  {link.title}
                </span>
                {link.desc && (
                  <span style={{ fontSize: '10.5px', color: 'rgba(248, 250, 252, 0.5)' }}>
                    {link.desc}
                  </span>
                )}
              </div>
              <ExternalLink size={14} color="#38bdf8" />
            </a>
          ))}
        </div>
      )}

      {modalInfo.externalUrl && isSafeExternalUrl(modalInfo.externalUrl) && (
        <button
          type="button"
          onClick={() => window.open(modalInfo.externalUrl, '_blank', 'noopener,noreferrer')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'var(--accent-primary, #00e5ff)',
            color: '#0b101b',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            border: 'none',
            marginTop: '4px',
          }}
        >
          <span>Abrir Enlace Oficial</span>
          <ExternalLink size={13} />
        </button>
      )}
    </div>
  );
};

export const createModuleFromManifest = (manifest: CustomPluginManifest): LauncherModule => {
  const mod: LauncherModule = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version ?? '1.0.0',
    description: manifest.description ?? 'Plugin personalizado del launcher',
    author: manifest.author ?? 'Usuario',
    category: manifest.category ?? 'tools',
    accentColor: manifest.accentColor ?? '#38bdf8',
    isCustom: true,
    manifest,
    slots: {},
  };

  if (manifest.slots?.dockButton) {
    const dockSlot = manifest.slots.dockButton;
    mod.slots.dockButton = {
      id: `${manifest.id}-btn`,
      icon: getPluginIcon(dockSlot.iconName),
      label: dockSlot.label ?? manifest.name,
      tooltip: dockSlot.tooltip ?? manifest.name,
      defaultColor: dockSlot.defaultColor ?? manifest.accentColor ?? '#38bdf8',
      onClick: (ctx) => {
        if (dockSlot.actionType === 'url' && dockSlot.actionTarget && isSafeExternalUrl(dockSlot.actionTarget)) {
          window.open(dockSlot.actionTarget, '_blank', 'noopener,noreferrer');
        } else if (dockSlot.actionType === 'modal') {
          ctx.openModuleModal(manifest.id);
        } else if (dockSlot.actionType === 'openDir' && dockSlot.actionTarget) {
          invoke('open_folder', { path: dockSlot.actionTarget }).catch((err) =>
            console.warn('[Modules] Error abriendo carpeta:', err),
          );
        } else if (manifest.slots?.modal) {
          ctx.openModuleModal(manifest.id);
        }
      },
    };
  }

  if (manifest.slots?.modal) {
    const modalSlot = manifest.slots.modal;
    mod.slots.modal = {
      id: `${manifest.id}-modal`,
      title: modalSlot.title ?? manifest.name,
      width: '460px',
      component: () => (
        <CustomPluginModalContent manifest={manifest} />
      ),
    };
  }

  return mod;
};

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
    launchGame: () => {
      void launcherActions.startLaunchFlow();
    },
    storage: createModuleStorage(moduleId),
  };
};

interface ModuleState {
  modules: LauncherModule[];
  enabledModuleIds: string[];
  activeModalModuleId: string | null;

  registerModule: (mod: LauncherModule) => void;
  toggleModule: (id: string) => void;
  enableAllModules: () => void;
  resetToDefaults: () => void;
  isModuleEnabled: (id: string) => boolean;
  openModal: (id: string) => void;
  closeModal: () => void;
  installPlugin: (manifest: CustomPluginManifest) => { success: boolean; error?: string };
  uninstallPlugin: (id: string) => void;
  loadSavedCustomPlugins: () => void;
}

export const useModuleStore = create<ModuleState>((set, get) => {
  const initialEnabled: string[] = (() => {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(ENABLED_MODULES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
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

    enableAllModules: () => {
      const allIds = get().modules.map((m) => m.id);
      try {
        localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(allIds));
      } catch {}
      set({ enabledModuleIds: allIds });
    },

    resetToDefaults: () => {
      const defaults = ['ct.nether-portal-calc', 'ct.community-hub'];
      try {
        localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(defaults));
      } catch {}
      set({ enabledModuleIds: defaults });
    },

    isModuleEnabled: (id: string) => get().enabledModuleIds.includes(id),

    openModal: (id: string) => {
      if (getLauncherState().isEditingHud) return;
      set({ activeModalModuleId: id });
    },
    closeModal: () => set({ activeModalModuleId: null }),

    installPlugin: (manifest: CustomPluginManifest) => {
      if (!manifest || !manifest.id || !manifest.name) {
        return { success: false, error: 'El plugin debe tener un id y un nombre válido.' };
      }
      const existing = get().modules.find((m) => m.id === manifest.id);
      if (existing && !existing.isCustom) {
        return { success: false, error: 'No se puede sobreescribir un módulo del sistema.' };
      }

      const mod = createModuleFromManifest(manifest);

      try {
        const raw = localStorage.getItem(CUSTOM_PLUGINS_KEY);
        const list: CustomPluginManifest[] = raw ? JSON.parse(raw) : [];
        const filtered = list.filter((p) => p.id !== manifest.id);
        filtered.push(manifest);
        localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Failed to save custom plugin:', err);
      }

      set((state) => {
        const filteredMods = state.modules.filter((m) => m.id !== manifest.id);
        const nextEnabled = state.enabledModuleIds.includes(manifest.id)
          ? state.enabledModuleIds
          : [...state.enabledModuleIds, manifest.id];

        try {
          localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(nextEnabled));
        } catch {}

        return {
          modules: [...filteredMods, mod],
          enabledModuleIds: nextEnabled,
        };
      });

      return { success: true };
    },

    uninstallPlugin: (id: string) => {
      try {
        const raw = localStorage.getItem(CUSTOM_PLUGINS_KEY);
        if (raw) {
          const list: CustomPluginManifest[] = JSON.parse(raw);
          const filtered = list.filter((p) => p.id !== id);
          localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(filtered));
        }
      } catch {}

      set((state) => {
        const nextMods = state.modules.filter((m) => m.id !== id);
        const nextEnabled = state.enabledModuleIds.filter((mId) => mId !== id);
        try {
          localStorage.setItem(ENABLED_MODULES_KEY, JSON.stringify(nextEnabled));
        } catch {}
        return {
          modules: nextMods,
          enabledModuleIds: nextEnabled,
        };
      });
    },

    loadSavedCustomPlugins: () => {
      try {
        const raw = localStorage.getItem(CUSTOM_PLUGINS_KEY);
        if (!raw) return;
        const list: CustomPluginManifest[] = JSON.parse(raw);
        if (!Array.isArray(list)) return;

        const newMods = list
          .filter((manifest) => Boolean(manifest?.id && manifest?.name))
          .map(createModuleFromManifest);

        if (newMods.length === 0) return;

        set((state) => {
          const existingIds = new Set(state.modules.map((m) => m.id));
          const toAdd = newMods.filter((mod) => !existingIds.has(mod.id));
          if (toAdd.length === 0) return state;
          return { modules: [...state.modules, ...toAdd] };
        });
      } catch (err) {
        console.error('Failed to load custom plugins:', err);
      }
    },
  };
});

// Auto-close any open module modal whenever the launcher enters HUD edit mode
onHudEditingChange((editing) => {
  if (editing) {
    useModuleStore.getState().closeModal();
  }
});

