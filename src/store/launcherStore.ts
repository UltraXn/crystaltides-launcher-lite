import { useSyncExternalStore } from 'react';
import { loadSecureItem, saveSecureItem } from '../services/secureVault';
import {
  GameInstance,
  getSavedInstances,
  getActiveInstanceId,
  setActiveInstanceId,
  resolveInstanceGameDir,
  createNewInstance,
  removeInstance,
  DEFAULT_OFFICIAL_INSTANCE,
} from '../services/instanceService';
import { syncOfficialModsForInstance } from '../services/modService';
import { fetchLiveServerStatus } from '../services/serverStatusService';
import { sanitizeAllPositions } from '../utils/collisionSystem';
import { isVideoSource } from '../utils/wallpaperStorage';
import { Language, getTranslation, TranslationDictionary } from '../i18n';

export type { Language };

export interface UserAccount {
  id: string;
  username: string;
  uuid: string;
  type: 'microsoft' | 'guest';
  skinUrl?: string;
  capeUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  lastUsed: number;
}

export type LoaderType = 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';

export interface LauncherSettings {
  minRamGb: number;
  maxRamGb: number;
  javaPath: string;
  resolution: string;
  autoCloseLauncher: boolean;
  discordRpc: boolean;
  fullscreen: boolean;
  mcVersion: string;
  loaderType: LoaderType;
  loaderVersion?: string;
}

export type ModalType = 'none' | 'settings' | 'accounts' | 'about' | 'instances';
export type ViewType = 'login' | 'home';
export type LaunchStatus = 'IDLE' | 'VERIFYING' | 'DOWNLOADING' | 'LAUNCHING' | 'RUNNING';

export interface LaunchProgress {
  status: LaunchStatus;
  progress: number;
  message: string;
}

export interface WallpaperOption {
  id: string;
  name: string;
  url: string;
  accent: string;
}

export const WALLPAPERS: WallpaperOption[] = [
  {
    id: 'ct_night',
    name: 'Santuario Nocturno',
    url: '/wallpapers/crystaltides_night.png',
    accent: '#00e5ff',
  },
  {
    id: 'ct_day',
    name: 'Costa de Cerezos (Día)',
    url: '/wallpapers/crystaltides_day.png',
    accent: '#22c55e',
  },
  {
    id: 'ct_shrine',
    name: 'Templo Sumergido',
    url: '/wallpapers/crystaltides_shrine.png',
    accent: '#38bdf8',
  },
];

export interface AccentColorPreset {
  id: string;
  name: string;
  hex: string;
}

export const ACCENT_PRESETS: AccentColorPreset[] = [
  { id: 'cyan', name: 'Cian Cristalino', hex: '#00e5ff' },
  { id: 'emerald', name: 'Verde Esmeralda', hex: '#22c55e' },
  { id: 'sapphire', name: 'Zafiro Océano', hex: '#38bdf8' },
  { id: 'amethyst', name: 'Amatista Neón', hex: '#a855f7' },
  { id: 'amber', name: 'Oro Solar', hex: '#f59e0b' },
  { id: 'ruby', name: 'Rubí Carmesí', hex: '#ef4444' },
  { id: 'sakura', name: 'Sakura Floral', hex: '#ec4899' },
];

export const applyAccentColorToDom = (hex: string) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent-primary', hex);

  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
    root.style.setProperty('--accent-subtle', `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, 0.3)`);
  }
};

export type GuiFontFamily = 'jost' | 'inter' | 'outfit' | 'fira-code' | 'pixel';
export type GuiBgPreset = 'obsidian' | 'midnight' | 'amethyst' | 'emerald' | 'crimson' | 'custom';
export type GuiBorderPreset = 'subtle' | 'accent' | 'cyan' | 'amber' | 'custom';

export interface GuiThemeConfig {
  fontFamily: GuiFontFamily;
  bgMode: GuiBgPreset;
  customBgColor?: string;
  borderMode: GuiBorderPreset;
  customBorderColor?: string;
  borderRadius: number;
}

export const DEFAULT_GUI_THEME: GuiThemeConfig = {
  fontFamily: 'jost',
  bgMode: 'obsidian',
  customBgColor: '#0a0f18',
  borderMode: 'subtle',
  customBorderColor: '#00e5ff',
  borderRadius: 16,
};

export const applyGuiThemeToDom = (theme: GuiThemeConfig, accentHex: string) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const fontMap: Record<GuiFontFamily, string> = {
    jost: 'var(--font-jost)',
    inter: 'var(--font-inter)',
    outfit: 'var(--font-outfit)',
    'fira-code': 'var(--font-fira)',
    pixel: 'var(--font-pixel)',
  };
  root.style.setProperty('--app-font-family', fontMap[theme.fontFamily] || fontMap.jost);

  const bgMap: Record<GuiBgPreset, string> = {
    obsidian: 'rgba(10, 15, 24, 0.94)',
    midnight: 'rgba(8, 18, 36, 0.95)',
    amethyst: 'rgba(22, 10, 36, 0.95)',
    emerald: 'rgba(6, 26, 18, 0.95)',
    crimson: 'rgba(32, 8, 14, 0.95)',
    custom: theme.customBgColor || 'rgba(10, 15, 24, 0.94)',
  };
  root.style.setProperty('--gui-bg', bgMap[theme.bgMode] || bgMap.obsidian);

  let borderColor = 'rgba(255, 255, 255, 0.1)';
  if (theme.borderMode === 'accent') {
    borderColor = `var(--border-accent, ${accentHex}66)`;
  } else if (theme.borderMode === 'cyan') {
    borderColor = 'rgba(0, 229, 255, 0.45)';
  } else if (theme.borderMode === 'amber') {
    borderColor = 'rgba(245, 158, 11, 0.45)';
  } else if (theme.borderMode === 'custom') {
    borderColor = theme.customBorderColor || 'rgba(255, 255, 255, 0.1)';
  }
  root.style.setProperty('--gui-border', borderColor);
  root.style.setProperty('--gui-radius', `${theme.borderRadius || 16}px`);
};

export type DockPositionPreset = 'center' | 'bottom' | 'top' | 'free';
export type DockButtonId = 'instances' | 'about' | 'accounts' | 'settings' | 'launch';
export type DockLayoutMode = 'dock' | 'free_buttons';

export interface WidgetPositions {
  userPill: { x: number; y: number };
  socials: { x: number; y: number };
  serverStatus: { x: number; y: number };
}

export interface DockConfig {
  layoutMode: DockLayoutMode;
  positionPreset: DockPositionPreset;
  customCoordinates?: { x: number; y: number };
  buttonPositions: Record<DockButtonId, { x: number; y: number }>;
  widgetPositions: WidgetPositions;
  scale: 'normal' | 'compact';
  showLabels: boolean;
  bgOpacity: number;
  borderRadius: number;
  startBtnColorMode: 'accent' | 'emerald' | 'custom';
  customStartBtnColor?: string;
  dockBorderColorMode: 'subtle' | 'accent';
  visibleButtons: DockButtonId[];
  buttonOrder: DockButtonId[];
  customButtonColors?: Partial<Record<DockButtonId, string>>;
}

export const DEFAULT_DOCK_CONFIG: DockConfig = {
  layoutMode: 'dock',
  positionPreset: 'center',
  customCoordinates: { x: 50, y: 50 },
  buttonPositions: {
    instances: { x: 26, y: 50 },
    about: { x: 38, y: 50 },
    accounts: { x: 50, y: 50 },
    settings: { x: 62, y: 50 },
    launch: { x: 74, y: 50 },
  },
  widgetPositions: {
    userPill: { x: 8, y: 93 },
    socials: { x: 50, y: 93 },
    serverStatus: { x: 92, y: 93 },
  },
  scale: 'normal',
  showLabels: true,
  bgOpacity: 0.92,
  borderRadius: 14,
  startBtnColorMode: 'accent',
  customStartBtnColor: '#22c55e',
  dockBorderColorMode: 'subtle',
  visibleButtons: ['instances', 'about', 'accounts', 'settings', 'launch'],
  buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
  customButtonColors: {},
};

export interface LauncherState {
  currentView: ViewType;
  accounts: UserAccount[];
  activeAccountId: string | null;
  isLoadingAccounts: boolean;
  settings: LauncherSettings;
  activeWallpaperId: string;
  customWallpaperUrl: string | null;
  isVideoWallpaper: boolean;
  wallpaperMuted: boolean;
  wallpaperVolume: number;
  language: Language;
  accentColor: string;
  guiTheme: GuiThemeConfig;
  dockConfig: DockConfig;
  isEditingHud: boolean;
  hudManualSide: 'auto' | 'left' | 'center' | 'right';
  activeModal: ModalType;
  instances: GameInstance[];
  activeInstanceId: string;
  launch: LaunchProgress;
  serverStatus: {
    online: boolean;
    playersCount: number;
    maxPlayers: number;
    ping: number;
  };
}

const SETTINGS_STORAGE_KEY = 'crystaltides_lite_settings_v1';
const WALLPAPER_STORAGE_KEY = 'crystaltides_lite_wallpaper_v1';
const CUSTOM_WALLPAPER_STORAGE_KEY = 'crystaltides_lite_custom_wallpaper_v1';
const IS_VIDEO_WALLPAPER_STORAGE_KEY = 'crystaltides_lite_is_video_wallpaper_v1';
const WALLPAPER_MUTED_STORAGE_KEY = 'crystaltides_lite_wallpaper_muted_v1';
const WALLPAPER_VOLUME_STORAGE_KEY = 'crystaltides_lite_wallpaper_volume_v1';
const LANGUAGE_STORAGE_KEY = 'crystaltides_lite_language_v1';
const ACCENT_STORAGE_KEY = 'crystaltides_lite_accent_v1';
const DOCK_CONFIG_STORAGE_KEY = 'crystaltides_lite_dock_config_v1';
const GUI_THEME_STORAGE_KEY = 'crystaltides_lite_gui_theme_v1';
const ACCOUNTS_VAULT_KEY = 'crystaltides_lite_vault_accounts';

export const loadInitialDockConfig = (): DockConfig => {
  if (typeof localStorage === 'undefined') return DEFAULT_DOCK_CONFIG;
  try {
    const raw = localStorage.getItem(DOCK_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_DOCK_CONFIG,
        ...parsed,
        buttonPositions: {
          ...DEFAULT_DOCK_CONFIG.buttonPositions,
          ...parsed.buttonPositions,
        },
        widgetPositions: {
          ...DEFAULT_DOCK_CONFIG.widgetPositions,
          ...parsed.widgetPositions,
        },
        visibleButtons: Array.isArray(parsed.visibleButtons)
          ? parsed.visibleButtons
          : DEFAULT_DOCK_CONFIG.visibleButtons,
        buttonOrder: Array.isArray(parsed.buttonOrder)
          ? parsed.buttonOrder
          : DEFAULT_DOCK_CONFIG.buttonOrder,
        customButtonColors: parsed.customButtonColors || {},
      };
    }
  } catch (e) {
    console.warn('Failed to parse dock config:', e);
  }
  return DEFAULT_DOCK_CONFIG;
};

export const DEFAULT_FALLBACK_ACCOUNT: UserAccount = {
  id: 'default-guest',
  username: 'Haume',
  uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
  type: 'guest',
  lastUsed: Date.now(),
};

const defaultSettings: LauncherSettings = {
  minRamGb: 4,
  maxRamGb: 8,
  javaPath: 'Auto (Java 21 OpenJDK)',
  resolution: '1280x720',
  autoCloseLauncher: true,
  discordRpc: true,
  fullscreen: false,
  mcVersion: '1.21.1',
  loaderType: 'neoforge',
  loaderVersion: '21.1.252',
};

export const isUserAccount = (obj: unknown): obj is UserAccount => {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.username === 'string' &&
    typeof a.uuid === 'string' &&
    (a.type === 'microsoft' || a.type === 'guest') &&
    typeof a.lastUsed === 'number'
  );
};

export const sanitizeLauncherSettings = (raw: unknown): LauncherSettings => {
  if (!raw || typeof raw !== 'object') return defaultSettings;
  const s = raw as Record<string, unknown>;
  const rawMc =
    typeof s.mcVersion === 'string' && s.mcVersion.length > 0
      ? s.mcVersion
      : defaultSettings.mcVersion;
  const mcVersion = rawMc;

  let loaderType =
    s.loaderType === 'vanilla' ||
    s.loaderType === 'neoforge' ||
    s.loaderType === 'forge' ||
    s.loaderType === 'fabric' ||
    s.loaderType === 'quilt'
      ? s.loaderType
      : defaultSettings.loaderType;
  let loaderVersion =
    typeof s.loaderVersion === 'string' ? s.loaderVersion : defaultSettings.loaderVersion;

  if (loaderType === 'neoforge' && (loaderVersion === '21.1.65' || !loaderVersion)) {
    loaderVersion = '21.1.252';
  }

  return {
    minRamGb:
      typeof s.minRamGb === 'number' && s.minRamGb >= 1 && s.minRamGb <= 64
        ? s.minRamGb
        : defaultSettings.minRamGb,
    maxRamGb:
      typeof s.maxRamGb === 'number' && s.maxRamGb >= 1 && s.maxRamGb <= 64
        ? s.maxRamGb
        : defaultSettings.maxRamGb,
    javaPath:
      typeof s.javaPath === 'string' && s.javaPath.length > 0
        ? s.javaPath
        : defaultSettings.javaPath,
    resolution:
      typeof s.resolution === 'string' && /^\d+x\d+$/.test(s.resolution)
        ? s.resolution
        : defaultSettings.resolution,
    autoCloseLauncher:
      typeof s.autoCloseLauncher === 'boolean'
        ? s.autoCloseLauncher
        : defaultSettings.autoCloseLauncher,
    discordRpc: typeof s.discordRpc === 'boolean' ? s.discordRpc : defaultSettings.discordRpc,
    fullscreen: typeof s.fullscreen === 'boolean' ? s.fullscreen : defaultSettings.fullscreen,
    mcVersion,
    loaderType,
    loaderVersion,
  };
};

let state: LauncherState = {
  currentView: 'login', // Default to login view
  accounts: [],
  activeAccountId: null,
  isLoadingAccounts: false,
  settings: (() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      return saved ? sanitizeLauncherSettings(JSON.parse(saved)) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  })(),
  activeWallpaperId: localStorage.getItem(WALLPAPER_STORAGE_KEY) || 'ct_night',
  customWallpaperUrl: localStorage.getItem(CUSTOM_WALLPAPER_STORAGE_KEY) || null,
  isVideoWallpaper: localStorage.getItem(IS_VIDEO_WALLPAPER_STORAGE_KEY) === 'true',
  wallpaperMuted: localStorage.getItem(WALLPAPER_MUTED_STORAGE_KEY) === 'true',
  wallpaperVolume: (() => {
    const v = localStorage.getItem(WALLPAPER_VOLUME_STORAGE_KEY);
    return v !== null ? parseFloat(v) : 0.8;
  })(),
  language: (localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language) || 'es',
  accentColor: (() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY) || '#00e5ff';
    applyAccentColorToDom(saved);
    return saved;
  })(),
  guiTheme: (() => {
    let theme = DEFAULT_GUI_THEME;
    try {
      const raw = localStorage.getItem(GUI_THEME_STORAGE_KEY);
      if (raw) theme = { ...DEFAULT_GUI_THEME, ...JSON.parse(raw) };
    } catch {
      // fallback
    }
    const accent = localStorage.getItem(ACCENT_STORAGE_KEY) || '#00e5ff';
    applyGuiThemeToDom(theme, accent);
    return theme;
  })(),
  dockConfig: loadInitialDockConfig(),
  isEditingHud: false,
  hudManualSide: 'auto',
  activeModal: 'none',
  instances: getSavedInstances(),
  activeInstanceId: getActiveInstanceId(),
  launch: {
    status: 'IDLE',
    progress: 0,
    message: 'Listo para jugar',
  },
  serverStatus: {
    online: true,
    playersCount: 42,
    maxPlayers: 150,
    ping: 28,
  },
};

const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const setStoreState = (updater: (prev: LauncherState) => Partial<LauncherState>) => {
  const next = updater(state);
  state = { ...state, ...next };
  emitChange();
};

export const launcherActions = {
  setView: (view: ViewType) => {
    setStoreState(() => ({ currentView: view }));
  },

  setEditingHud: (editing: boolean) => {
    setStoreState((prev) => {
      let nextDockConfig = prev.dockConfig;
      if (editing) {
        nextDockConfig = sanitizeAllPositions(prev.dockConfig);
        try {
          localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
        } catch {}
      }
      return { isEditingHud: editing, activeModal: 'none', dockConfig: nextDockConfig };
    });
  },

  setLayoutMode: (mode: DockLayoutMode) => {
    setStoreState((prev) => {
      const nextConfig = sanitizeAllPositions({ ...prev.dockConfig, layoutMode: mode });
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  setButtonPosition: (id: DockButtonId, pos: { x: number; y: number }) => {
    setStoreState((prev) => {
      const nextConfig = {
        ...prev.dockConfig,
        buttonPositions: {
          ...prev.dockConfig.buttonPositions,
          [id]: pos,
        },
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  setWidgetPosition: (widgetId: keyof WidgetPositions, pos: { x: number; y: number }) => {
    setStoreState((prev) => {
      const nextConfig = {
        ...prev.dockConfig,
        widgetPositions: {
          ...prev.dockConfig.widgetPositions,
          [widgetId]: pos,
        },
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  setHudManualSide: (side: 'auto' | 'left' | 'center' | 'right') => {
    setStoreState(() => ({ hudManualSide: side }));
  },

  resetAllPositions: () => {
    setStoreState((prev) => {
      const nextConfig: DockConfig = {
        ...prev.dockConfig,
        positionPreset: 'center',
        customCoordinates: { x: 50, y: 50 },
        buttonPositions: { ...DEFAULT_DOCK_CONFIG.buttonPositions },
        widgetPositions: { ...DEFAULT_DOCK_CONFIG.widgetPositions },
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig, hudManualSide: 'auto' };
    });
  },

  setDockConfig: (partial: Partial<DockConfig>) => {
    setStoreState((prev) => {
      const nextConfig = { ...prev.dockConfig, ...partial };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {
        // quota
      }
      return { dockConfig: nextConfig };
    });
  },

  resetDockConfig: () => {
    try {
      localStorage.removeItem(DOCK_CONFIG_STORAGE_KEY);
    } catch {}
    setStoreState(() => ({ dockConfig: DEFAULT_DOCK_CONFIG }));
  },

  toggleDockButton: (id: DockButtonId) => {
    setStoreState((prev) => {
      const current = prev.dockConfig.visibleButtons;
      const next = current.includes(id)
        ? current.length > 1
          ? current.filter((b) => b !== id)
          : current
        : [...current, id];
      const nextConfig = { ...prev.dockConfig, visibleButtons: next };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  moveDockButton: (id: DockButtonId, direction: 'left' | 'right') => {
    setStoreState((prev) => {
      const order = [...prev.dockConfig.buttonOrder];
      const idx = order.indexOf(id);
      if (idx === -1) return {};
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= order.length) return {};
      const temp = order[idx];
      order[idx] = order[targetIdx];
      order[targetIdx] = temp;
      const nextConfig = { ...prev.dockConfig, buttonOrder: order };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  setCustomWallpaper: (url: string | null, isVideo?: boolean) => {
    const isVid = isVideo !== undefined ? isVideo : url ? isVideoSource(url) : false;
    if (url) {
      try {
        if (!url.startsWith('blob:')) {
          localStorage.setItem(CUSTOM_WALLPAPER_STORAGE_KEY, url);
        }
        localStorage.setItem(IS_VIDEO_WALLPAPER_STORAGE_KEY, String(isVid));
      } catch (e) {
        console.warn('LocalStorage failed to save wallpaper:', e);
      }
    } else {
      localStorage.removeItem(CUSTOM_WALLPAPER_STORAGE_KEY);
      localStorage.removeItem(IS_VIDEO_WALLPAPER_STORAGE_KEY);
    }
    setStoreState(() => ({ customWallpaperUrl: url, isVideoWallpaper: isVid }));
  },

  setWallpaperMuted: (muted: boolean) => {
    try {
      localStorage.setItem(WALLPAPER_MUTED_STORAGE_KEY, String(muted));
    } catch {}
    setStoreState(() => ({ wallpaperMuted: muted }));
  },

  setWallpaperVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem(WALLPAPER_VOLUME_STORAGE_KEY, String(clamped));
    } catch {}
    setStoreState(() => ({ wallpaperVolume: clamped }));
  },

  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
    setStoreState(() => ({ language: lang }));
  },

  setAccentColor: (hex: string) => {
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, hex);
    } catch {
      // ignore quota
    }
    applyAccentColorToDom(hex);
    setStoreState((prev) => {
      applyGuiThemeToDom(prev.guiTheme, hex);
      return { accentColor: hex };
    });
  },

  setButtonColor: (id: DockButtonId, color: string | null) => {
    setStoreState((prev) => {
      const nextColors = { ...prev.dockConfig.customButtonColors };
      if (!color) {
        delete nextColors[id];
      } else {
        nextColors[id] = color;
      }
      const nextDockConfig = {
        ...prev.dockConfig,
        customButtonColors: nextColors,
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  setGuiTheme: (updates: Partial<GuiThemeConfig>) => {
    setStoreState((prev) => {
      const nextTheme: GuiThemeConfig = { ...prev.guiTheme, ...updates };
      try {
        localStorage.setItem(GUI_THEME_STORAGE_KEY, JSON.stringify(nextTheme));
      } catch (e) {
        console.warn('Failed to persist GUI theme:', e);
      }
      applyGuiThemeToDom(nextTheme, prev.accentColor);
      return { guiTheme: nextTheme };
    });
  },

  resetGuiTheme: () => {
    try {
      localStorage.removeItem(GUI_THEME_STORAGE_KEY);
    } catch {}
    setStoreState((prev) => {
      applyGuiThemeToDom(DEFAULT_GUI_THEME, prev.accentColor);
      return { guiTheme: DEFAULT_GUI_THEME };
    });
  },

  selectInstance: (id: string) => {
    setActiveInstanceId(id);
    setStoreState(() => ({ activeInstanceId: id }));
  },

  createInstance: (data: Parameters<typeof createNewInstance>[0]) => {
    const newInst = createNewInstance(data);
    setStoreState(() => ({
      instances: getSavedInstances(),
      activeInstanceId: newInst.id,
    }));
    return newInst;
  },

  deleteInstance: (id: string) => {
    removeInstance(id);
    setStoreState(() => ({
      instances: getSavedInstances(),
      activeInstanceId: getActiveInstanceId(),
    }));
  },

  refreshInstances: () => {
    setStoreState(() => ({
      instances: getSavedInstances(),
      activeInstanceId: getActiveInstanceId(),
    }));
  },

  updateLiveServerStatus: async () => {
    const data = await fetchLiveServerStatus();
    setStoreState(() => ({
      serverStatus: {
        online: data.online,
        playersCount: data.playersCount,
        maxPlayers: data.maxPlayers,
        ping: data.ping,
      },
    }));
  },

  loadAccountsFromVault: async () => {
    try {
      const decrypted = await loadSecureItem<UserAccount[]>(ACCOUNTS_VAULT_KEY);
      if (decrypted && Array.isArray(decrypted) && decrypted.length > 0) {
        const validAccounts = decrypted.filter(isUserAccount);
        if (validAccounts.length > 0) {
          const sorted = validAccounts.toSorted(
            (a: UserAccount, b: UserAccount) => b.lastUsed - a.lastUsed,
          );
          setStoreState(() => ({
            accounts: sorted,
            activeAccountId: sorted[0].id,
            // Stay on currentView (login by default unless user has interacted)
          }));
        }
      }
    } catch {
      setStoreState(() => ({ accounts: [], activeAccountId: null }));
    }
  },

  addAccount: async (account: UserAccount) => {
    const current = state.accounts.filter((a: UserAccount) => a.id !== account.id);
    const updated = [account, ...current];
    setStoreState(() => ({
      accounts: updated,
      activeAccountId: account.id,
      currentView: 'home',
    }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  updateAccount: async (id: string, updates: Partial<UserAccount>) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, ...updates } : acc,
    );
    setStoreState(() => ({ accounts: updated }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  setActiveAccount: async (id: string) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, lastUsed: Date.now() } : acc,
    );
    setStoreState(() => ({ accounts: updated, activeAccountId: id, currentView: 'home' }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  removeAccount: async (id: string) => {
    const updated = state.accounts.filter((a: UserAccount) => a.id !== id);
    const nextActive = updated.length > 0 ? updated[0].id : null;
    const nextView = updated.length > 0 ? state.currentView : 'login';
    setStoreState(() => ({
      accounts: updated,
      activeAccountId: nextActive,
      currentView: nextView,
    }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  logout: async () => {
    localStorage.removeItem(ACCOUNTS_VAULT_KEY);
    setStoreState(() => ({
      accounts: [],
      activeAccountId: null,
      currentView: 'login',
      activeModal: 'none',
    }));
  },

  updateSettings: (newSettings: Partial<LauncherSettings>) => {
    const updated = { ...state.settings, ...newSettings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    setStoreState(() => ({ settings: updated }));
  },

  setWallpaper: (id: string) => {
    localStorage.setItem(WALLPAPER_STORAGE_KEY, id);
    setStoreState(() => ({ activeWallpaperId: id }));
  },

  openModal: (modal: ModalType) => {
    setStoreState(() => ({ activeModal: modal }));
  },

  closeModal: () => {
    setStoreState(() => ({ activeModal: 'none' }));
  },

  setupTauriListeners: async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const { invoke } = await import('@tauri-apps/api/core');

      launcherActions.updateLiveServerStatus();
      setInterval(() => {
        launcherActions.updateLiveServerStatus();
      }, 45000);

      listen<number>('game-started', (event) => {
        console.log('[Launcher Store] Minecraft PID started:', event.payload);
        setStoreState(() => ({
          launch: {
            status: 'RUNNING',
            progress: 100,
            message: `Minecraft en ejecución (PID: ${event.payload})`,
          },
        }));
      });

      listen<{ exit_code: number | null; success: boolean }>('game-stopped', (event) => {
        console.log('[Launcher Store] Minecraft process stopped:', event.payload);
        try {
          invoke('clear_discord_presence');
        } catch {
          // ignored
        }
        setStoreState(() => ({
          launch: {
            status: 'IDLE',
            progress: 0,
            message: event.payload.success
              ? 'Juego finalizado.'
              : `Juego cerrado (Código: ${event.payload.exit_code ?? 'desconocido'})`,
          },
        }));
      });

      listen<number>('java-install-progress', (event) => {
        setStoreState(() => ({
          launch: {
            status: 'DOWNLOADING',
            progress: Math.min(90, Math.max(10, Math.round(event.payload * 100))),
            message: `Instalando entorno Java... (${Math.round(event.payload * 100)}%)`,
          },
        }));
      });
    } catch {
      // Browser preview mode fallback
    }
  },

  startLaunchFlow: async () => {
    if (state.launch.status !== 'IDLE') return;

    let activeAcc = state.accounts.find((a: UserAccount) => a.id === state.activeAccountId);
    if (!activeAcc) {
      if (state.accounts.length > 0) {
        activeAcc = state.accounts[0];
        setStoreState(() => ({ activeAccountId: activeAcc!.id }));
      } else {
        activeAcc = DEFAULT_FALLBACK_ACCOUNT;
        setStoreState(() => ({
          accounts: [DEFAULT_FALLBACK_ACCOUNT],
          activeAccountId: DEFAULT_FALLBACK_ACCOUNT.id,
        }));
      }
    }

    setStoreState(() => ({
      launch: { status: 'VERIFYING', progress: 10, message: 'Iniciando motor de juego...' },
    }));

    try {
      const { launchGame } = await import('../services/launcherService');
      const { invoke } = await import('@tauri-apps/api/core');

      const instances = state.instances;
      const activeInst =
        instances.find((i) => i.id === state.activeInstanceId) ||
        instances[0] ||
        DEFAULT_OFFICIAL_INSTANCE;

      const effectiveGameDir = await resolveInstanceGameDir(activeInst);

      // 1. Asegurar servers.dat para que play.crystaltides.net esté presente
      try {
        await invoke('ensure_servers_dat', { gameDir: effectiveGameDir });
      } catch (e) {
        console.warn('Could not ensure servers.dat:', e);
      }

      // 2. Si la instancia es la oficial de CrystalTides, sincronizar mods
      if (activeInst.isOfficial) {
        try {
          await syncOfficialModsForInstance(effectiveGameDir, (message, progress) => {
            setStoreState(() => ({
              launch: {
                status: 'DOWNLOADING',
                progress: Math.min(40, Math.round(progress * 0.4)),
                message,
              },
            }));
          });
        } catch (modErr) {
          console.warn('Official mod sync error, proceeding with local files:', modErr);
        }
      }

      // 3. Activar Discord Rich Presence si está habilitado
      if (state.settings.discordRpc) {
        try {
          await invoke('set_discord_presence', {
            state: `Jugando en ${activeInst.name}`,
            details: `${activeInst.mcVersion} (${activeInst.loaderType})`,
            isPlaying: true,
          });
        } catch (rpcErr) {
          console.warn('Discord RPC error:', rpcErr);
        }
      }

      const mcVersion = activeInst.mcVersion;
      const isSnapshot =
        mcVersion.startsWith('26.') || mcVersion.startsWith('25w') || mcVersion.startsWith('26w');
      const loaderType = isSnapshot ? 'vanilla' : activeInst.loaderType || 'neoforge';
      let loaderVersion = isSnapshot ? '' : activeInst.loaderVersion || '';
      if (loaderType === 'neoforge' && (loaderVersion === '21.1.65' || !loaderVersion)) {
        loaderVersion = '21.1.252';
      }

      await launchGame(
        {
          username: activeAcc.username,
          uuid: activeAcc.uuid || '00000000-0000-0000-0000-000000000000',
          accessToken: activeAcc.accessToken || '00000000-0000-0000-0000-000000000000',
          mcVersion,
          loaderType: loaderType !== 'vanilla' ? loaderType : undefined,
          loaderVersion: loaderType !== 'vanilla' && loaderVersion ? loaderVersion : undefined,
          maxRam: (activeInst.maxRamGb || state.settings.maxRamGb) * 1024,
          minRam: (activeInst.minRamGb || state.settings.minRamGb) * 1024,
          gameDir: effectiveGameDir,
          javaPath: state.settings.javaPath,
          resolution: state.settings.resolution || '1280x720',
          fullscreen: state.settings.fullscreen === true,
        },
        (message, progress) => {
          setStoreState(() => ({
            launch: {
              status: progress >= 90 ? 'LAUNCHING' : progress >= 20 ? 'DOWNLOADING' : 'VERIFYING',
              progress,
              message,
            },
          }));
        },
      );

      setStoreState(() => ({
        launch: { status: 'RUNNING', progress: 100, message: '¡Minecraft en ejecución!' },
      }));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Launcher Store] Launch failed:', errorMsg);
      setStoreState(() => ({
        launch: { status: 'IDLE', progress: 0, message: `Error: ${errorMsg}` },
      }));
    }
  },

  killGameFlow: async () => {
    try {
      const { killGame } = await import('../services/launcherService');
      await killGame();
    } catch (err) {
      console.error('[Launcher Store] Kill game failed:', err);
    }
    setStoreState(() => ({
      launch: { status: 'IDLE', progress: 0, message: 'Juego detenido.' },
    }));
  },

  cancelLaunchFlow: () => {
    setStoreState(() => ({
      launch: { status: 'IDLE', progress: 0, message: 'Listo para jugar' },
    }));
  },
};

// React hook to subscribe to full state or selector
export function useLauncherStore<T>(selector: (state: LauncherState) => T): T {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => selector(state),
  );
}

// React hook to access current active translations
export function useT(): TranslationDictionary {
  const lang = useLauncherStore((s: LauncherState) => s.language);
  return getTranslation(lang);
}
