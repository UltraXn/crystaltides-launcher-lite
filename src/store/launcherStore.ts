import { useSyncExternalStore } from 'react';
import { decodeJwt } from 'jose';
import { loadSecureItem, saveSecureItem } from '../services/secureVault';
import { logFrontend } from '../services/logger';
import {
  GameInstance,
  getSavedInstances,
  getActiveInstanceId,
  setActiveInstanceId,
  resolveInstanceGameDir,
  createNewInstance,
  removeInstance,
  DEFAULT_OFFICIAL_INSTANCE,
  syncInstancesWithDatabase,
  updateInstance,
  duplicateInstance,
} from '../services/instanceService';
import {
  getDatabaseAccounts,
  saveDatabaseAccount,
  deleteDatabaseAccount,
  setActiveDatabaseAccount,
} from '../services/dbService';
import {
  SyncModEntry,
  syncOfficialModsForInstance,
  syncPerformanceStackForInstance,
} from '../services/modService';
import { fetchLiveServerStatus } from '../services/serverStatusService';
import {
  sanitizeAllPositions,
  calculateDefaultButtonPositions,
  getEffectiveActiveButtons,
} from '../utils/collisionSystem';
import { isVideoSource, clearDockPanorama, clearButtonMedia } from '../utils/wallpaperStorage';
import {
  extractCleanMinecraftVersion,
  extractLoaderVersionFromCompound,
} from '../utils/settingsUtils';
import { Language, getTranslation, TranslationDictionary } from '../i18n';

export type { Language };

export interface UserAccount {
  id: string;
  username: string;
  uuid: string;
  type: 'microsoft' | 'guest' | 'crystaltides';
  role?: string;
  email?: string;
  skinUrl?: string;
  capeUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  lastUsed: number;
  requiresReauth?: boolean;
}

export type LoaderType = 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';

export interface LauncherSettings {
  minRamGb: number;
  maxRamGb: number;
  javaPath: string;
  javaDistribution?: 'adoptium' | 'graalvm';
  resolution: string;
  autoCloseLauncher: boolean;
  discordRpc: boolean;
  fullscreen: boolean;
  mcVersion: string;
  loaderType: LoaderType;
  loaderVersion?: string;
  useOptimization?: boolean;
  preLaunchCommand?: string;
  wrapperCommand?: string;
  postExitCommand?: string;
  environmentVariables?: string;
  telemetryCapsuleEnabled?: boolean;
  showBetaLoaders?: boolean;
  disableBgAnim?: boolean;
  disableAnimations?: boolean;
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
    url: '/wallpapers/crystaltides_night.webp',
    accent: '#16A085',
  },
  {
    id: 'ct_day',
    name: 'Costa de Cerezos (Día)',
    url: '/wallpapers/crystaltides_day.webp',
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
  { id: 'emerald_tides', name: 'Jade Abisal', hex: '#16A085' },
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
    root.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.18)`);
    root.style.setProperty('--accent-subtle', `rgba(${r}, ${g}, ${b}, 0.08)`);
    root.style.setProperty('--border-accent', `rgba(${r}, ${g}, ${b}, 0.28)`);
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
  customBgColor: '#140C30',
  borderMode: 'subtle',
  customBorderColor: '#16A085',
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
    custom: theme.customBgColor ?? 'rgba(10, 15, 24, 0.94)',
  };
  root.style.setProperty('--gui-bg', bgMap[theme.bgMode] ?? bgMap.obsidian);

  let borderColor = 'rgba(255, 255, 255, 0.1)';
  if (theme.borderMode === 'accent') {
    borderColor = `var(--border-accent, ${accentHex}66)`;
  } else if (theme.borderMode === 'cyan') {
    borderColor = 'rgba(0, 229, 255, 0.45)';
  } else if (theme.borderMode === 'amber') {
    borderColor = 'rgba(245, 158, 11, 0.45)';
  } else if (theme.borderMode === 'custom') {
    borderColor = theme.customBorderColor ?? 'rgba(255, 255, 255, 0.1)';
  }
  root.style.setProperty('--gui-border', borderColor);
  root.style.setProperty('--gui-radius', `${theme.borderRadius ?? 16}px`);
};

export type DockPositionPreset = 'center' | 'bottom' | 'top' | 'free';
export type BuiltinDockButtonId = 'instances' | 'about' | 'accounts' | 'settings' | 'launch';
export type DockButtonId =
  | BuiltinDockButtonId
  | `mod:${string}`
  | (string & { readonly _brand?: never });
export type DockLayoutMode = 'dock' | 'free_buttons';

export type DockButtonEffect =
  | 'none'
  | 'rainbow_rgb'
  | 'neon_pulse'
  | 'glitch'
  | 'hologram'
  | 'fire';

export interface DockButtonCustomization {
  contentColor?: string;
  bgType?: 'default' | 'color' | 'image' | 'video';
  bgColor?: string;
  bgImage?: string;
  bgVideo?: string;
  bgVideoOpacity?: number;
  iconType?: 'default' | 'custom_svg' | 'custom_image' | 'none';
  customSvg?: string;
  customIconUrl?: string;
  iconScale?: number;
  customWidth?: number;
  customHeight?: number;
  scale?: number;
  borderRadius?: number;
  rotation?: number;
  specialEffect?: DockButtonEffect;
  hideLabel?: boolean;
}

export const PROTECTED_DOCK_BUTTONS: readonly DockButtonId[] = [
  'settings',
  'launch',
  'about',
] as const;

export const ORIGINAL_BUTTON_SVGS: Record<BuiltinDockButtonId, string> = {
  instances:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
  about:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  accounts:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  launch:
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
};

export interface WidgetPositions {
  userPill: { x: number; y: number };
  socials: { x: number; y: number };
  serverStatus: { x: number; y: number };
}

export interface DockConfig {
  layoutMode: DockLayoutMode;
  positionPreset: DockPositionPreset;
  customCoordinates?: { x: number; y: number };
  buttonPositions: Record<string, { x: number; y: number }>;
  widgetPositions: WidgetPositions;
  scale: 'normal' | 'compact';
  iconScale?: number;
  customDockHeight?: number;
  customSegmentWidth?: number;
  showLabels: boolean;
  bgOpacity: number;
  borderRadius: number;
  startBtnColorMode: 'accent' | 'emerald' | 'custom';
  customStartBtnColor?: string;
  dockBorderColorMode: 'subtle' | 'accent';
  visibleButtons: DockButtonId[];
  buttonOrder: DockButtonId[];
  customButtonColors?: Partial<Record<string, string>>;
  buttonCustomizations?: Partial<Record<string, DockButtonCustomization>>;
  dockBgType?: 'default' | 'image' | 'video';
  dockBgImage?: string;
  dockBgVideo?: string;
  dockBgVideoOpacity?: number;
  dockBgPosX?: number;
  dockBgPosY?: number;
  dockBgScale?: number;
  dockBgOpacity?: number;
  dockBgBlur?: number;
  dockBgFit?: 'cover' | 'contain' | 'auto';
  panoramaButtons?: DockButtonId[];
}

export const DEFAULT_DOCK_CONFIG: DockConfig = {
  layoutMode: 'dock',
  positionPreset: 'center',
  customCoordinates: { x: 50, y: 50 },
  buttonPositions: {
    instances: { x: 20, y: 50 },
    about: { x: 35, y: 50 },
    accounts: { x: 50, y: 50 },
    settings: { x: 65, y: 50 },
    launch: { x: 80, y: 50 },
  },
  widgetPositions: {
    userPill: { x: 8, y: 93 },
    socials: { x: 50, y: 93 },
    serverStatus: { x: 92, y: 93 },
  },
  scale: 'normal',
  iconScale: 1.0,
  showLabels: true,
  bgOpacity: 0.92,
  borderRadius: 14,
  startBtnColorMode: 'accent',
  customStartBtnColor: '#22c55e',
  dockBorderColorMode: 'subtle',
  visibleButtons: ['instances', 'about', 'accounts', 'settings', 'launch'],
  buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
  customButtonColors: {},
  dockBgType: 'default',
  dockBgVideoOpacity: 0.85,
  dockBgPosX: 50,
  dockBgPosY: 50,
  dockBgScale: 100,
  dockBgOpacity: 1,
  dockBgBlur: 0,
  dockBgFit: 'cover',
  panoramaButtons: ['instances', 'about', 'accounts', 'settings', 'launch'],
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
  customizingButtonId: DockButtonId | null;
  selectedDockButtonId: DockButtonId | null;
  isButtonInspectorOpen: boolean;
  instances: GameInstance[];
  activeInstanceId: string;
  launch: LaunchProgress;
  serverStatus: {
    online: boolean;
    playersCount: number;
    maxPlayers: number;
    ping: number;
  };
  modSyncPrompt: { error: string } | null;
  accountPersistenceError: string | null;
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

const sanitizeDockConfigForStorage = (cfg: DockConfig): DockConfig => {
  const clone: DockConfig = { ...cfg };
  if (clone.dockBgImage?.startsWith('blob:')) {
    clone.dockBgImage = undefined;
  }
  if (clone.dockBgVideo?.startsWith('blob:')) {
    clone.dockBgVideo = undefined;
  }
  if (clone.buttonCustomizations) {
    const sanitizedButtons: Record<string, DockButtonCustomization> = {};
    for (const [btnId, cust] of Object.entries(clone.buttonCustomizations)) {
      if (cust) {
        sanitizedButtons[btnId] = {
          ...cust,
          customIconUrl: cust.customIconUrl?.startsWith('blob:') ? undefined : cust.customIconUrl,
        };
      }
    }
    clone.buttonCustomizations = sanitizedButtons;
  }
  return clone;
};

export const loadInitialDockConfig = (): DockConfig => {
  if (typeof localStorage === 'undefined') return DEFAULT_DOCK_CONFIG;
  try {
    const raw = localStorage.getItem(DOCK_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawVisible = Array.isArray(parsed.visibleButtons)
        ? (parsed.visibleButtons as DockButtonId[])
        : DEFAULT_DOCK_CONFIG.visibleButtons;
      const visibleSet = new Set(rawVisible);
      for (const p of PROTECTED_DOCK_BUTTONS) {
        visibleSet.add(p);
      }

      // Detect legacy overlapping default positions and migrate to non-overlapping spacing
      const isLegacyDefaultSpacing =
        parsed.buttonPositions &&
        parsed.buttonPositions.instances?.x === 26 &&
        parsed.buttonPositions.launch?.x === 74;

      const effectiveButtonPositions = isLegacyDefaultSpacing
        ? { ...DEFAULT_DOCK_CONFIG.buttonPositions }
        : {
            ...DEFAULT_DOCK_CONFIG.buttonPositions,
            ...parsed.buttonPositions,
          };

      // Sanitize widget coordinates: only reset if invalid/NaN/out-of-bounds, preserving intentional user placement
      const sanitizeWidgetCoord = (
        coord: { x: number; y: number } | undefined,
        fallback: { x: number; y: number },
      ) => {
        if (
          !coord ||
          typeof coord.x !== 'number' ||
          typeof coord.y !== 'number' ||
          Number.isNaN(coord.x) ||
          Number.isNaN(coord.y) ||
          coord.x < 0 ||
          coord.x > 100 ||
          coord.y < 0 ||
          coord.y > 100
        ) {
          return fallback;
        }
        return coord;
      };

      const rawWidgets = {
        ...DEFAULT_DOCK_CONFIG.widgetPositions,
        ...parsed.widgetPositions,
      };
      const effectiveWidgetPositions = {
        userPill: sanitizeWidgetCoord(
          rawWidgets.userPill,
          DEFAULT_DOCK_CONFIG.widgetPositions.userPill,
        ),
        socials: sanitizeWidgetCoord(
          rawWidgets.socials,
          DEFAULT_DOCK_CONFIG.widgetPositions.socials,
        ),
        serverStatus: sanitizeWidgetCoord(
          rawWidgets.serverStatus,
          DEFAULT_DOCK_CONFIG.widgetPositions.serverStatus,
        ),
      };

      // Clamp iconScale strictly between 0.6 and 1.8
      const rawScale = typeof parsed.iconScale === 'number' ? parsed.iconScale : 1.0;
      const clampedIconScale = Number.isNaN(rawScale) ? 1.0 : Math.min(1.8, Math.max(0.6, rawScale));

      return {
        ...DEFAULT_DOCK_CONFIG,
        ...parsed,
        iconScale: clampedIconScale,
        buttonPositions: effectiveButtonPositions,
        widgetPositions: effectiveWidgetPositions,
        visibleButtons: Array.from(visibleSet),
        buttonOrder: Array.isArray(parsed.buttonOrder)
          ? parsed.buttonOrder
          : DEFAULT_DOCK_CONFIG.buttonOrder,
        customButtonColors: parsed.customButtonColors || {},
        panoramaButtons: Array.isArray(parsed.panoramaButtons)
          ? (parsed.panoramaButtons as DockButtonId[])
          : DEFAULT_DOCK_CONFIG.panoramaButtons,
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
  javaDistribution: 'adoptium',
  resolution: '1280x720',
  autoCloseLauncher: true,
  discordRpc: true,
  fullscreen: false,
  mcVersion: '1.21.1',
  loaderType: 'neoforge',
  loaderVersion: '21.1.252',
  useOptimization: true,
  preLaunchCommand: '',
  wrapperCommand: '',
  postExitCommand: '',
  environmentVariables: '',
  telemetryCapsuleEnabled: false,
  showBetaLoaders: false,
  disableBgAnim: false,
  disableAnimations: false,
};

export const isUserAccount = (obj: unknown): obj is UserAccount => {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.id === 'string' &&
    typeof a.username === 'string' &&
    typeof a.uuid === 'string' &&
    (a.type === 'microsoft' || a.type === 'guest' || a.type === 'crystaltides') &&
    typeof a.lastUsed === 'number'
  );
};

const sanitizeRamGb = (val: unknown, fallback: number): number => {
  return typeof val === 'number' && val >= 1 && val <= 64 ? val : fallback;
};

const sanitizeLoaderType = (raw: unknown): LoaderType => {
  if (raw === 'neoforge' || raw === 'forge' || raw === 'fabric' || raw === 'quilt') {
    return raw;
  }
  return defaultSettings.loaderType;
};

const sanitizeLoaderVersion = (loaderType: LoaderType, raw: unknown): string => {
  let ver = typeof raw === 'string' ? raw : (defaultSettings.loaderVersion ?? '');
  if (loaderType === 'neoforge' && (ver === '21.1.65' || !ver)) {
    return '21.1.252';
  }
  return ver;
};

const sanitizeBoolean = (val: unknown, fallback?: boolean): boolean | undefined => {
  return typeof val === 'boolean' ? val : fallback;
};

const sanitizeString = (val: unknown, fallback?: string): string | undefined => {
  return typeof val === 'string' ? val : fallback;
};

export const sanitizeLauncherSettings = (raw: unknown): LauncherSettings => {
  if (!raw || typeof raw !== 'object') return defaultSettings;
  const s = raw as Record<string, unknown>;
  const mcVersion =
    typeof s.mcVersion === 'string' && s.mcVersion.length > 0
      ? s.mcVersion
      : defaultSettings.mcVersion;
  const loaderType = sanitizeLoaderType(s.loaderType);
  const loaderVersion = sanitizeLoaderVersion(loaderType, s.loaderVersion);

  return {
    minRamGb: sanitizeRamGb(s.minRamGb, defaultSettings.minRamGb),
    maxRamGb: sanitizeRamGb(s.maxRamGb, defaultSettings.maxRamGb),
    javaPath:
      typeof s.javaPath === 'string' && s.javaPath.length > 0
        ? s.javaPath
        : defaultSettings.javaPath,
    javaDistribution: s.javaDistribution === 'graalvm' ? 'graalvm' : 'adoptium',
    resolution:
      typeof s.resolution === 'string' && /^\d+x\d+$/.test(s.resolution)
        ? s.resolution
        : defaultSettings.resolution,
    autoCloseLauncher:
      sanitizeBoolean(s.autoCloseLauncher, defaultSettings.autoCloseLauncher) ??
      defaultSettings.autoCloseLauncher,
    discordRpc:
      sanitizeBoolean(s.discordRpc, defaultSettings.discordRpc) ?? defaultSettings.discordRpc,
    fullscreen:
      sanitizeBoolean(s.fullscreen, defaultSettings.fullscreen) ?? defaultSettings.fullscreen,
    mcVersion,
    loaderType,
    loaderVersion,
    useOptimization:
      sanitizeBoolean(s.useOptimization, defaultSettings.useOptimization) ??
      defaultSettings.useOptimization,
    preLaunchCommand: sanitizeString(s.preLaunchCommand, defaultSettings.preLaunchCommand),
    wrapperCommand: sanitizeString(s.wrapperCommand, defaultSettings.wrapperCommand),
    postExitCommand: sanitizeString(s.postExitCommand, defaultSettings.postExitCommand),
    environmentVariables: sanitizeString(
      s.environmentVariables,
      defaultSettings.environmentVariables,
    ),
    telemetryCapsuleEnabled: sanitizeBoolean(s.telemetryCapsuleEnabled, false) ?? false,
    showBetaLoaders: sanitizeBoolean(s.showBetaLoaders, false) ?? false,
    disableBgAnim: sanitizeBoolean(s.disableBgAnim, false) ?? false,
    disableAnimations: sanitizeBoolean(s.disableAnimations, false) ?? false,
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
  activeWallpaperId: localStorage.getItem(WALLPAPER_STORAGE_KEY) ?? 'ct_night',
  customWallpaperUrl: localStorage.getItem(CUSTOM_WALLPAPER_STORAGE_KEY) ?? null,
  isVideoWallpaper: localStorage.getItem(IS_VIDEO_WALLPAPER_STORAGE_KEY) === 'true',
  wallpaperMuted: localStorage.getItem(WALLPAPER_MUTED_STORAGE_KEY) === 'true',
  wallpaperVolume: (() => {
    const v = localStorage.getItem(WALLPAPER_VOLUME_STORAGE_KEY);
    return v !== null ? parseFloat(v) : 0.8;
  })(),
  language: (localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language) ?? 'es',
  accentColor: (() => {
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY) ?? '#16A085';
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
    const accent = localStorage.getItem(ACCENT_STORAGE_KEY) ?? '#16A085';
    applyGuiThemeToDom(theme, accent);
    return theme;
  })(),
  dockConfig: loadInitialDockConfig(),
  isEditingHud: false,
  hudManualSide: 'auto',
  activeModal: 'none',
  customizingButtonId: null,
  selectedDockButtonId: null,
  isButtonInspectorOpen: false,
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
  modSyncPrompt: null,
  accountPersistenceError: null,
};

const listeners = new Set<() => void>();
const hudEditingListeners = new Set<(editing: boolean) => void>();

export const onHudEditingChange = (cb: (editing: boolean) => void) => {
  hudEditingListeners.add(cb);
  return () => {
    hudEditingListeners.delete(cb);
  };
};

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const setStoreState = (updater: (prev: LauncherState) => Partial<LauncherState>) => {
  const next = updater(state);
  state = { ...state, ...next };
  emitChange();
};

const resolveActiveAccount = (): UserAccount => {
  const existing = state.accounts.find((a: UserAccount) => a.id === state.activeAccountId);
  if (existing) return existing;

  if (state.accounts.length > 0) {
    const fallback = state.accounts[0];
    setStoreState(() => ({ activeAccountId: fallback.id }));
    return fallback;
  }

  setStoreState(() => ({
    accounts: [DEFAULT_FALLBACK_ACCOUNT],
    activeAccountId: DEFAULT_FALLBACK_ACCOUNT.id,
  }));
  return DEFAULT_FALLBACK_ACCOUNT;
};

const syncInstanceAssets = async (
  activeInst: GameInstance,
  effectiveGameDir: string,
  skipModSync?: boolean,
): Promise<{ halted?: boolean }> => {
  const { invoke } = await import('@tauri-apps/api/core');

  try {
    await invoke('ensure_servers_dat', { gameDir: effectiveGameDir });
  } catch (e) {
    console.warn('Could not ensure servers.dat:', e);
  }

  let officialSyncEntries: SyncModEntry[] | undefined;
  if (activeInst.isOfficial && (activeInst.loaderType === 'neoforge' || !activeInst.loaderType)) {
    if (skipModSync) {
      setStoreState(() => ({
        launch: {
          status: 'DOWNLOADING',
          progress: 20,
          message: 'Omitiendo verificación de mods oficiales...',
        },
      }));
    } else {
      try {
        const syncResult = await syncOfficialModsForInstance(
          effectiveGameDir,
          (message, progress) => {
            setStoreState(() => ({
              launch: {
                status: 'DOWNLOADING',
                progress: Math.min(40, Math.round(progress * 0.4)),
                message,
              },
            }));
          },
        );

        if (!syncResult.ok) {
          setStoreState(() => ({
            modSyncPrompt: { error: syncResult.error },
            launch: {
              status: 'DOWNLOADING',
              progress: 20,
              message: `Aviso: Fallo al verificar mods (${syncResult.error})`,
            },
          }));
          return { halted: true };
        }

        officialSyncEntries = syncResult.entries;
      } catch (modErr) {
        const errorMsg = modErr instanceof Error ? modErr.message : String(modErr);
        console.warn('Official mod sync error, proceeding with prompt:', errorMsg);
        setStoreState(() => ({
          modSyncPrompt: { error: errorMsg },
          launch: {
            status: 'DOWNLOADING',
            progress: 20,
            message: `Aviso: Fallo al verificar mods (${errorMsg})`,
          },
        }));
        return { halted: true };
      }
    }
  }

  const isPerfDisabled = Boolean(activeInst.disableOptimization);
  if (state.settings.useOptimization && !isPerfDisabled && activeInst.loaderType && !activeInst.isOfficial) {
    try {
      await syncPerformanceStackForInstance(
        effectiveGameDir,
        activeInst.mcVersion,
        activeInst.loaderType,
        (message, progress) => {
          setStoreState(() => ({
            launch: {
              status: 'DOWNLOADING',
              progress: Math.min(50, Math.round(progress * 0.5)),
              message,
            },
          }));
        },
        officialSyncEntries,
        isPerfDisabled,
      );
    } catch (perfErr) {
      console.warn('[Launcher] Error sincronizando stack de rendimiento:', perfErr);
    }

    const boostMcVersion = resolveBoostMcVersion(activeInst.loaderType, activeInst.mcVersion);
    if (BOOST_ENABLED && boostMcVersion) {
      try {
        // El backend elige el jar del grupo de esa versión; si no tiene build, retira el desplegado
        await invoke('deploy_crystaltides_boost', {
          gameDir: effectiveGameDir,
          loaderType: activeInst.loaderType,
          mcVersion: boostMcVersion,
        });
      } catch (boostErr) {
        console.warn('[Launcher] Error inyectando crystaltides-boost:', boostErr);
      }
    } else {
      try {
        await invoke('remove_crystaltides_boost', { gameDir: effectiveGameDir });
      } catch (cleanErr) {
        console.warn('[Launcher] Error limpiando crystaltides-boost:', cleanErr);
      }
    }
  } else {
    try {
      await invoke('remove_crystaltides_boost', { gameDir: effectiveGameDir });
    } catch {
      // Ignorar fallo de limpieza en instancias que no usan optimización
    }
  }

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

  return { halted: false };
};

// Flag maestro para habilitar/deshabilitar el despliegue automático de crystaltides-boost
export const BOOST_ENABLED = true;

// Loaders con build de crystaltides-boost; Quilt ejecuta el de Fabric
const BOOST_LOADERS = new Set(['fabric', 'quilt', 'neoforge']);

/**
 * Versión de Minecraft que se pasa a deploy_crystaltides_boost, o undefined si el loader no tiene
 * build de crystaltides-boost. Qué versiones tienen jar lo decide el backend con los jars embebidos.
 * Normaliza identificadores compuestos: quilt-loader-0.31.0-beta.4-26.2 -> 26.2.
 */
export const resolveBoostMcVersion = (
  loaderType?: string,
  mcVersion?: string,
): string | undefined => {
  if (!loaderType || !mcVersion?.trim()) {
    return undefined;
  }
  if (!BOOST_LOADERS.has(loaderType.toLowerCase().trim())) {
    return undefined;
  }
  return extractCleanMinecraftVersion(mcVersion);
};

export const resolveEffectiveResolution = (activeInst: GameInstance): string => {
  const w = activeInst.resolutionWidth;
  const h = activeInst.resolutionHeight;
  if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    return `${w}x${h}`;
  }
  return state.settings.resolution || '1280x720';
};

export const resolveEffectiveLoaderVersion = (
  loaderType: string,
  rawVersion: string = '',
  mcVersion: string = '1.21.1',
): string | undefined => {
  if (loaderType === 'vanilla') {
    return undefined;
  }
  const trimmed = rawVersion ? rawVersion.trim() : '';

  // Si mcVersion es un identificador compuesto (ej: quilt-loader-0.31.0-beta.4-26.2), extraer la versión real del loader
  const compoundLoaderVer = extractLoaderVersionFromCompound(mcVersion, loaderType);
  if (compoundLoaderVer) {
    return compoundLoaderVer;
  }

  if (loaderType === 'neoforge') {
    if (!trimmed || trimmed === '21.1.65') {
      return '21.1.252';
    }
    return trimmed;
  }
  if (loaderType === 'fabric') {
    return trimmed || '0.16.10';
  }
  if (loaderType === 'quilt') {
    return trimmed || '0.31.0-beta.4';
  }
  if (loaderType === 'forge') {
    if (trimmed) return trimmed;
    return mcVersion === '1.20.1' ? '47.3.0' : '52.1.0';
  }
  return trimmed || 'latest';
};

export const buildLaunchOptions = (
  activeAcc: UserAccount,
  activeInst: GameInstance,
  effectiveGameDir: string,
) => {
  const loaderType = activeInst.loaderType ?? 'vanilla';
  const loaderVersion = resolveEffectiveLoaderVersion(
    loaderType,
    activeInst.loaderVersion,
    activeInst.mcVersion,
  );
  const effectiveRes = resolveEffectiveResolution(activeInst);
  const effectiveFullscreen =
    activeInst.fullscreen !== undefined
      ? activeInst.fullscreen === true
      : state.settings.fullscreen === true;

  const getCmd = (instVal?: string, setVal?: string) => {
    const inst = instVal?.trim();
    if (inst) return inst;
    const set = setVal?.trim();
    if (set) return set;
    return undefined;
  };

  return {
    username: activeAcc.username,
    uuid: activeAcc.uuid?.length ? activeAcc.uuid : '00000000-0000-0000-0000-000000000000',
    accessToken: activeAcc.accessToken?.length
      ? activeAcc.accessToken
      : '00000000-0000-0000-0000-000000000000',
    mcVersion: activeInst.mcVersion,
    loaderType: loaderType !== 'vanilla' ? loaderType : undefined,
    loaderVersion,
    maxRam: (activeInst.maxRamGb ?? state.settings.maxRamGb) * 1024,
    minRam: (activeInst.minRamGb ?? state.settings.minRamGb) * 1024,
    gameDir: effectiveGameDir,
    javaPath: state.settings.javaPath,
    javaDistribution: state.settings.javaDistribution ?? 'adoptium',
    javaArgs: activeInst.jvmArgs?.trim() || undefined,
    useOptimization: state.settings.useOptimization ?? true,
    resolution: effectiveRes,
    fullscreen: effectiveFullscreen,
    profileId: activeInst.id,
    preLaunchCommand: getCmd(activeInst.preLaunchCommand, state.settings.preLaunchCommand),
    wrapperCommand: getCmd(activeInst.wrapperCommand, state.settings.wrapperCommand),
    postExitCommand: getCmd(activeInst.postExitCommand, state.settings.postExitCommand),
    environmentVariables: getCmd(
      activeInst.environmentVariables,
      state.settings.environmentVariables,
    ),
  };
};

let activeTauriUnlisteners: Array<() => void> = [];
let serverStatusIntervalId: ReturnType<typeof setInterval> | null = null;
let watchdogIntervalId: ReturnType<typeof setInterval> | null = null;
let currentLaunchAttemptId = 0;
let gameStoppedDuringLaunch = false;

const cleanupTauriListeners = () => {
  if (serverStatusIntervalId !== null) {
    clearInterval(serverStatusIntervalId);
    serverStatusIntervalId = null;
  }
  if (watchdogIntervalId !== null) {
    clearInterval(watchdogIntervalId);
    watchdogIntervalId = null;
  }
  for (const unlisten of activeTauriUnlisteners) {
    try {
      unlisten();
    } catch (e) {
      console.warn('[Launcher Store] Error cleaning up listener:', e);
    }
  }
  activeTauriUnlisteners = [];
};

export const launcherActions = {
  setView: (view: ViewType) => {
    setStoreState(() => ({ currentView: view }));
  },

  setSelectedDockButtonId: (id: DockButtonId | null, openInspector = false) => {
    setStoreState(() => ({
      selectedDockButtonId: id,
      isButtonInspectorOpen: id !== null ? openInspector : false,
    }));
  },

  setButtonInspectorOpen: (open: boolean) => {
    setStoreState(() => ({ isButtonInspectorOpen: open }));
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
      return {
        isEditingHud: editing,
        selectedDockButtonId: null,
        isButtonInspectorOpen: false,
        customizingButtonId: null,
        activeModal: 'none',
        dockConfig: nextDockConfig,
      };
    });
    hudEditingListeners.forEach((cb) => {
      try {
        cb(editing);
      } catch {}
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

  sanitizePositions: () => {
    setStoreState((prev) => {
      const nextConfig = sanitizeAllPositions(prev.dockConfig);
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

  resetAllPositions: (activeButtonIds?: DockButtonId[]) => {
    setStoreState((prev) => {
      const buttonsToReset: DockButtonId[] =
        activeButtonIds && activeButtonIds.length > 0
          ? [...activeButtonIds]
          : getEffectiveActiveButtons(prev.dockConfig);

      const calculatedPositions = calculateDefaultButtonPositions(buttonsToReset);

      const nextConfig: DockConfig = {
        ...prev.dockConfig,
        positionPreset: 'center',
        customCoordinates: { x: 50, y: 50 },
        buttonPositions: calculatedPositions,
        widgetPositions: { ...DEFAULT_DOCK_CONFIG.widgetPositions },
        buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
      };

      const sanitized = sanitizeAllPositions(nextConfig);

      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
      } catch {}
      return { dockConfig: sanitized, hudManualSide: 'auto' };
    });
  },

  setDockConfig: (partial: Partial<DockConfig>) => {
    if (typeof partial.iconScale === 'number') {
      partial.iconScale = Number.isNaN(partial.iconScale)
        ? 1.0
        : Math.min(1.8, Math.max(0.6, partial.iconScale));
    }
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
    const freshDefault: DockConfig = {
      ...DEFAULT_DOCK_CONFIG,
      positionPreset: 'center',
      customCoordinates: { x: 50, y: 50 },
      buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
      visibleButtons: ['instances', 'about', 'accounts', 'settings', 'launch'],
      buttonPositions: {
        instances: { x: 20, y: 50 },
        about: { x: 35, y: 50 },
        accounts: { x: 50, y: 50 },
        settings: { x: 65, y: 50 },
        launch: { x: 80, y: 50 },
      },
      widgetPositions: {
        userPill: { x: 8, y: 93 },
        socials: { x: 50, y: 93 },
        serverStatus: { x: 92, y: 93 },
      },
      customButtonColors: {},
      buttonCustomizations: {},
    };
    try {
      localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(freshDefault));
    } catch {}
    const currentConfig = state.dockConfig;
    clearDockPanorama().catch(() => {});
    const btnIds = new Set<string>([
      'instances',
      'about',
      'accounts',
      'settings',
      'launch',
      ...currentConfig.buttonOrder,
      ...currentConfig.visibleButtons,
      ...Object.keys(currentConfig.buttonCustomizations ?? {}),
    ]);
    for (const btnId of btnIds) {
      clearButtonMedia(btnId, false).catch(() => {});
      clearButtonMedia(btnId, true).catch(() => {});
    }
    setStoreState(() => ({ dockConfig: freshDefault, hudManualSide: 'auto' }));
  },

  toggleDockButton: (id: DockButtonId) => {
    setStoreState((prev) => {
      // Essential core buttons can never be hidden
      if (PROTECTED_DOCK_BUTTONS.includes(id)) {
        return {};
      }
      const current = prev.dockConfig.visibleButtons;
      let next: DockButtonId[];
      if (current.includes(id)) {
        next = current.length > 1 ? current.filter((b) => b !== id) : current;
      } else {
        next = [...current, id];
      }
      const nextConfig = { ...prev.dockConfig, visibleButtons: next };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  moveDockButton: (id: DockButtonId, direction: 'left' | 'right') => {
    setStoreState((prev) => {
      let order = [...prev.dockConfig.buttonOrder];
      if (!order.includes(id)) {
        order.push(id);
      }
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

  reorderDockButtons: (newOrder: DockButtonId[]) => {
    setStoreState((prev) => {
      const nextConfig = { ...prev.dockConfig, buttonOrder: newOrder };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
      } catch {}
      return { dockConfig: nextConfig };
    });
  },

  setCustomWallpaper: (url: string | null, isVideo?: boolean) => {
    const isVid = isVideo ?? Boolean(url && isVideoSource(url));
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

  setDockButtonCustomization: (
    id: DockButtonId,
    customization: Partial<DockButtonCustomization>,
  ) => {
    setStoreState((prev) => {
      const current = prev.dockConfig.buttonCustomizations?.[id] || {};
      const updated = { ...current, ...customization };
      const nextCustomizations = {
        ...prev.dockConfig.buttonCustomizations,
        [id]: updated,
      };
      let nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        buttonCustomizations: nextCustomizations,
      };
      if (
        prev.dockConfig.layoutMode === 'free_buttons' &&
        (customization.customWidth !== undefined || customization.customHeight !== undefined)
      ) {
        nextDockConfig = sanitizeAllPositions(nextDockConfig);
      }
      try {
        localStorage.setItem(
          DOCK_CONFIG_STORAGE_KEY,
          JSON.stringify(sanitizeDockConfigForStorage(nextDockConfig)),
        );
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  resetDockButtonCustomization: (id: DockButtonId) => {
    setStoreState((prev) => {
      const nextCustomizations = { ...prev.dockConfig.buttonCustomizations };
      delete nextCustomizations[id];
      const nextColors = { ...prev.dockConfig.customButtonColors };
      delete nextColors[id];
      const nextDockConfig = {
        ...prev.dockConfig,
        buttonCustomizations: nextCustomizations,
        customButtonColors: nextColors,
      };
      try {
        localStorage.setItem(
          DOCK_CONFIG_STORAGE_KEY,
          JSON.stringify(sanitizeDockConfigForStorage(nextDockConfig)),
        );
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  setDockBackground: (type: 'default' | 'image' | 'video', url?: string, opacity?: number) => {
    setStoreState((prev) => {
      const isVideo = type === 'video';
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        dockBgType: type,
        dockBgImage: isVideo ? undefined : url,
        dockBgVideo: isVideo ? url : undefined,
        dockBgVideoOpacity: opacity ?? prev.dockConfig.dockBgVideoOpacity ?? 0.85,
      };
      try {
        localStorage.setItem(
          DOCK_CONFIG_STORAGE_KEY,
          JSON.stringify(sanitizeDockConfigForStorage(nextDockConfig)),
        );
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  clearDockBackground: () => {
    clearDockPanorama().catch(() => {});
    setStoreState((prev) => {
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        dockBgType: 'default',
        dockBgImage: undefined,
        dockBgVideo: undefined,
        dockBgPosX: 50,
        dockBgPosY: 50,
        dockBgScale: 100,
        dockBgOpacity: 1,
        dockBgBlur: 0,
        dockBgFit: 'cover',
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  updateDockBackgroundTransform: (transform: {
    posX?: number;
    posY?: number;
    scale?: number;
    opacity?: number;
    blur?: number;
    fit?: 'cover' | 'contain' | 'auto';
  }) => {
    setStoreState((prev) => {
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        dockBgPosX: transform.posX ?? prev.dockConfig.dockBgPosX ?? 50,
        dockBgPosY: transform.posY ?? prev.dockConfig.dockBgPosY ?? 50,
        dockBgScale: transform.scale ?? prev.dockConfig.dockBgScale ?? 100,
        dockBgOpacity: transform.opacity ?? prev.dockConfig.dockBgOpacity ?? 1,
        dockBgBlur: transform.blur ?? prev.dockConfig.dockBgBlur ?? 0,
        dockBgFit: transform.fit ?? prev.dockConfig.dockBgFit ?? 'cover',
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  resetDockBackgroundTransform: () => {
    setStoreState((prev) => {
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        dockBgPosX: 50,
        dockBgPosY: 50,
        dockBgScale: 100,
        dockBgOpacity: 1,
        dockBgBlur: 0,
        dockBgFit: 'cover',
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  togglePanoramaButton: (btnId: DockButtonId) => {
    setStoreState((prev) => {
      const current = prev.dockConfig.panoramaButtons || prev.dockConfig.visibleButtons || [];
      const next = current.includes(btnId)
        ? current.filter((id) => id !== btnId)
        : [...current, btnId];
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        panoramaButtons: next,
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  setPanoramaButtons: (buttonIds: DockButtonId[]) => {
    setStoreState((prev) => {
      const nextDockConfig: DockConfig = {
        ...prev.dockConfig,
        panoramaButtons: buttonIds,
      };
      try {
        localStorage.setItem(DOCK_CONFIG_STORAGE_KEY, JSON.stringify(nextDockConfig));
      } catch {}
      return { dockConfig: nextDockConfig };
    });
  },

  openButtonCustomizer: (id: DockButtonId) => {
    setStoreState(() => ({ customizingButtonId: id }));
  },

  closeButtonCustomizer: () => {
    setStoreState(() => ({ customizingButtonId: null }));
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
    const targetInst = state.instances.find((i) => i.id === id);
    setStoreState((prev) => {
      const nextSettings = targetInst
        ? {
            ...prev.settings,
            mcVersion: targetInst.mcVersion,
            loaderType: targetInst.loaderType,
            loaderVersion: resolveEffectiveLoaderVersion(
              targetInst.loaderType,
              targetInst.loaderVersion,
              targetInst.mcVersion,
            ),
            maxRamGb: targetInst.maxRamGb ?? prev.settings.maxRamGb,
          }
        : prev.settings;
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch {}
      return {
        activeInstanceId: id,
        settings: nextSettings,
      };
    });
  },

  createInstance: (data: Parameters<typeof createNewInstance>[0]) => {
    const newInst = createNewInstance(data);
    const saved = getSavedInstances();
    setStoreState((prev) => {
      const nextSettings = {
        ...prev.settings,
        mcVersion: newInst.mcVersion,
        loaderType: newInst.loaderType,
        loaderVersion: resolveEffectiveLoaderVersion(
          newInst.loaderType,
          newInst.loaderVersion,
          newInst.mcVersion,
        ),
        maxRamGb: newInst.maxRamGb ?? prev.settings.maxRamGb,
      };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch {}
      return {
        instances: saved,
        activeInstanceId: newInst.id,
        settings: nextSettings,
      };
    });
    return newInst;
  },

  deleteInstance: (id: string) => {
    removeInstance(id);
    const saved = getSavedInstances();
    const nextActiveId = getActiveInstanceId();
    const nextActive = saved.find((i) => i.id === nextActiveId) ?? saved[0];
    setStoreState((prev) => {
      const nextSettings = nextActive
        ? {
            ...prev.settings,
            mcVersion: nextActive.mcVersion,
            loaderType: nextActive.loaderType,
            loaderVersion: resolveEffectiveLoaderVersion(
              nextActive.loaderType,
              nextActive.loaderVersion,
              nextActive.mcVersion,
            ),
            maxRamGb: nextActive.maxRamGb ?? prev.settings.maxRamGb,
          }
        : prev.settings;
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch {}
      return {
        instances: saved,
        activeInstanceId: nextActiveId,
        settings: nextSettings,
      };
    });
  },

  duplicateInstance: (id: string) => {
    const duplicated = duplicateInstance(id);
    const saved = getSavedInstances();
    setStoreState((prev) => {
      const nextSettings = {
        ...prev.settings,
        mcVersion: duplicated.mcVersion,
        loaderType: duplicated.loaderType,
        loaderVersion: resolveEffectiveLoaderVersion(
          duplicated.loaderType,
          duplicated.loaderVersion,
          duplicated.mcVersion,
        ),
        maxRamGb: duplicated.maxRamGb ?? prev.settings.maxRamGb,
      };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      } catch {}
      return {
        instances: saved,
        activeInstanceId: duplicated.id,
        settings: nextSettings,
      };
    });
    return duplicated;
  },

  refreshInstances: () => {
    setStoreState(() => ({
      instances: getSavedInstances(),
      activeInstanceId: getActiveInstanceId(),
    }));
  },

  updateInstanceData: (id: string, updates: Partial<GameInstance>) => {
    const current = getSavedInstances();
    const inst = current.find((i) => i.id === id);
    if (inst) {
      const merged: GameInstance = { ...inst, ...updates };
      updateInstance(merged);
      const activeId = state.activeInstanceId ?? getActiveInstanceId();
      const isCurrentlyActive = activeId === id || (!activeId && current[0]?.id === id);
      setStoreState((prev) => {
        let nextSettings = prev.settings;
        if (isCurrentlyActive) {
          nextSettings = {
            ...prev.settings,
            mcVersion: merged.mcVersion,
            loaderType: merged.loaderType,
            loaderVersion: resolveEffectiveLoaderVersion(
              merged.loaderType,
              merged.loaderVersion,
              merged.mcVersion,
            ),
            maxRamGb: merged.maxRamGb ?? prev.settings.maxRamGb,
          };
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
          } catch {}
        }
        return {
          instances: getSavedInstances(),
          settings: nextSettings,
        };
      });
    }
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
      const rawVaultData = localStorage.getItem(ACCOUNTS_VAULT_KEY);
      const vaultHadData = Boolean(rawVaultData && rawVaultData.trim().length > 0);

      // 1. Prospección en SQLite nativo (crystaltides.db) y carga de bóveda cifrada
      const dbAccounts = await getDatabaseAccounts();
      const decrypted = await loadSecureItem<UserAccount[]>(
        ACCOUNTS_VAULT_KEY,
        (data) => Array.isArray(data),
      );

      const vaultDecryptionFailed =
        vaultHadData && (!decrypted || !Array.isArray(decrypted) || decrypted.length === 0);

      const vaultMap = new Map<string, UserAccount>();
      if (decrypted && Array.isArray(decrypted)) {
        for (const va of decrypted) {
          if (va && va.id) vaultMap.set(va.id, va);
        }
      }

      if (dbAccounts && dbAccounts.length > 0) {
        const mapped: UserAccount[] = dbAccounts.map((a) => {
          const vaultAcc = vaultMap.get(a.id);
          const hasMissingRefreshToken =
            a.account_type === 'microsoft' && (!vaultAcc || !vaultAcc.refreshToken);
          const needsReauth = vaultDecryptionFailed || hasMissingRefreshToken;

          return {
            id: a.id,
            username: a.username,
            uuid: a.uuid,
            type: (a.account_type as UserAccount['type']) ?? 'microsoft',
            skinUrl: a.skin_url,
            accessToken: a.access_token,
            refreshToken: vaultAcc?.refreshToken,
            role: vaultAcc?.role,
            email: vaultAcc?.email,
            capeUrl: vaultAcc?.capeUrl,
            lastUsed: a.created_at,
            requiresReauth: needsReauth,
          };
        });
        const active = dbAccounts.find((a) => a.is_active)?.id ?? mapped[0].id;
        setStoreState(() => ({
          accounts: mapped,
          activeAccountId: active,
        }));
        return;
      }

      // 2. Fallback y migración desde SecureVault
      if (decrypted && Array.isArray(decrypted) && decrypted.length > 0) {
        const validAccounts = decrypted.filter(isUserAccount);
        if (validAccounts.length > 0) {
          const sorted = validAccounts.toSorted(
            (a: UserAccount, b: UserAccount) => b.lastUsed - a.lastUsed,
          );
          setStoreState(() => ({
            accounts: sorted,
            activeAccountId: sorted[0].id,
          }));

          // Migrar automáticamente a SQLite para persistencia atómica
          await Promise.all(
            sorted.map((acc) =>
              saveDatabaseAccount({
                id: acc.id,
                username: acc.username,
                uuid: acc.uuid,
                account_type: acc.type,
                access_token: acc.accessToken,
                skin_url: acc.skinUrl,
                is_active: acc.id === sorted[0].id,
                created_at: acc.lastUsed || Date.now(),
              }).catch((e) => {
                logFrontend('WARN', `[Store] Error migrando cuenta a SQLite: ${String(e)}`);
                setStoreState(() => ({
                  accountPersistenceError: 'Error migrando cuenta a base de datos local',
                }));
              }),
            ),
          );
          return;
        }
      }

      // 3. Si la bóveda tenía datos pero nada descifró, NO sobrescribir con vacío
      if (vaultDecryptionFailed) {
        logFrontend(
          'WARN',
          '[Store] No se pudo descifrar la bóveda de cuentas. Se conservan los datos cifrados sin sobrescribir.',
        );
      }

      setStoreState(() => ({ accounts: [], activeAccountId: null }));
    } catch {
      setStoreState(() => ({ accounts: [], activeAccountId: null }));
    }
  },

  addAccount: async (account: UserAccount, persist: boolean = true) => {
    const current = state.accounts.filter((a: UserAccount) => a.id !== account.id);
    const updated = [account, ...current];
    setStoreState(() => ({
      accounts: updated,
      activeAccountId: account.id,
      currentView: 'home',
    }));
    if (persist) {
      await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
      saveDatabaseAccount({
        id: account.id,
        username: account.username,
        uuid: account.uuid,
        account_type: account.type,
        access_token: account.accessToken,
        skin_url: account.skinUrl,
        is_active: true,
        created_at: account.lastUsed || Date.now(),
      })
        .then(() => setActiveDatabaseAccount(account.id))
        .catch((err) => {
          logFrontend('ERROR', `[Store] Error guardando cuenta en SQLite: ${String(err)}`);
          setStoreState(() => ({
            accountPersistenceError: 'Error al guardar cuenta en base de datos local',
          }));
        });
    }
  },

  updateAccount: async (id: string, updates: Partial<UserAccount>) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, ...updates } : acc,
    );
    setStoreState(() => ({ accounts: updated }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
    const target = updated.find((a) => a.id === id);
    if (target) {
      saveDatabaseAccount({
        id: target.id,
        username: target.username,
        uuid: target.uuid,
        account_type: target.type,
        access_token: target.accessToken,
        skin_url: target.skinUrl,
        is_active: target.id === state.activeAccountId,
        created_at: target.lastUsed || Date.now(),
      }).catch((err) => {
        logFrontend('ERROR', `[Store] Error actualizando cuenta en SQLite: ${String(err)}`);
        setStoreState(() => ({
          accountPersistenceError: 'Error al actualizar cuenta en base de datos local',
        }));
      });
    }
  },

  setActiveAccount: async (id: string) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, lastUsed: Date.now() } : acc,
    );
    setStoreState(() => ({ accounts: updated, activeAccountId: id, currentView: 'home' }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
    setActiveDatabaseAccount(id).catch((err) => {
      logFrontend('WARN', `[Store] Error marcando cuenta activa en SQLite: ${String(err)}`);
      setStoreState(() => ({
        accountPersistenceError: 'Error al marcar cuenta activa en base de datos local',
      }));
    });
  },

  removeAccount: async (id: string) => {
    const wasActive = state.activeAccountId === id;
    const updated = state.accounts.filter((a: UserAccount) => a.id !== id);
    const nextActive = wasActive ? (updated.length > 0 ? updated[0].id : null) : state.activeAccountId;
    const nextView = updated.length > 0 ? state.currentView : 'login';
    setStoreState(() => ({
      accounts: updated,
      activeAccountId: nextActive,
      currentView: nextView,
    }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
    deleteDatabaseAccount(id).catch((err) => {
      logFrontend('ERROR', `[Store] Error eliminando cuenta de SQLite: ${String(err)}`);
      setStoreState(() => ({
        accountPersistenceError: 'Error al eliminar cuenta en base de datos local',
      }));
    });
    if (wasActive && nextActive) {
      setActiveDatabaseAccount(nextActive).catch((err) => {
        logFrontend(
          'WARN',
          `[Store] Error marcando nueva cuenta activa en SQLite tras eliminar: ${String(err)}`,
        );
        setStoreState(() => ({
          accountPersistenceError: 'Error al actualizar cuenta activa en base de datos local',
        }));
      });
    }
  },

  logout: async () => {
    try {
      const currentAccounts = state.accounts;
      await Promise.all(
        currentAccounts.map((acc) =>
          deleteDatabaseAccount(acc.id).catch((err) => {
            logFrontend('WARN', `[Store] Error eliminando cuenta en logout: ${String(err)}`);
          }),
        ),
      );
    } catch (e) {
      logFrontend('ERROR', `[Store] Error limpiando cuentas de SQLite en logout: ${String(e)}`);
    }
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

    // Sincronizar automáticamente con la instancia activa para que los cambios se reflejen en Instancias
    const activeId = state.activeInstanceId ?? getActiveInstanceId();
    const currentInstances = getSavedInstances();
    const activeInst = currentInstances.find((i) => i.id === activeId) ?? currentInstances[0];
    if (activeInst) {
      const mergedInst: GameInstance = {
        ...activeInst,
        mcVersion: updated.mcVersion ?? activeInst.mcVersion,
        loaderType: updated.loaderType ?? activeInst.loaderType,
        loaderVersion: updated.loaderVersion ?? activeInst.loaderVersion,
        maxRamGb: updated.maxRamGb ?? activeInst.maxRamGb,
      };
      updateInstance(mergedInst);
    }

    setStoreState(() => ({
      settings: updated,
      instances: getSavedInstances(),
    }));
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
  setupTauriListeners: async (): Promise<() => void> => {
    cleanupTauriListeners();

    let isDisposed = false;
    const registerListener = async <P>(
      eventName: string,
      handler: (event: { payload: P }) => void | Promise<void>,
    ) => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        if (isDisposed) return;
        const unlisten = await listen<P>(eventName, (e) => {
          if (!isDisposed) {
            handler(e);
          }
        });
        if (isDisposed) {
          unlisten();
        } else {
          activeTauriUnlisteners.push(unlisten);
        }
      } catch (err) {
        console.warn(`[Launcher Store] Error setting up listener for ${eventName}:`, err);
      }
    };

    try {
      launcherActions.updateLiveServerStatus();
      serverStatusIntervalId = setInterval(() => {
        launcherActions.updateLiveServerStatus();
      }, 45000);

      // Sincronizar instancias y perfiles con SQLite (crystaltides.db)
      syncInstancesWithDatabase()
        .then((insts) => {
          setStoreState(() => ({ instances: insts }));
        })
        .catch((e) => console.warn('[Launcher Store] Error syncing instances with SQLite:', e));

      await registerListener<number>('game-started', (event) => {
        console.log('[Launcher Store] Minecraft PID started:', event.payload);
        setStoreState(() => ({
          launch: {
            status: 'RUNNING',
            progress: 100,
            message: `Minecraft en ejecución (PID: ${event.payload})`,
          },
        }));
      });

      await registerListener<number | undefined>('game-ipc-ready', async (event) => {
        console.log(
          '[Launcher Store] game-ipc-ready recibido (TitleScreen listo en',
          event.payload,
          'ms).',
        );
        if (state.settings.autoCloseLauncher) {
          try {
            const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
            const win = getCurrentWebviewWindow();
            await win.minimize();
          } catch (err) {
            console.warn('[Launcher Store] Auto-minimizado no disponible en entorno web:', err);
          }
        }
      });

      await registerListener<{ exit_code: number | null; success: boolean }>(
        'game-stopped',
        (event) => {
          console.log('[Launcher Store] Minecraft process stopped:', event.payload);
          gameStoppedDuringLaunch = true;
          setStoreState(() => ({
            launch: {
              status: 'IDLE',
              progress: 0,
              message: event.payload.success
                ? 'Juego finalizado.'
                : `Juego cerrado (Código: ${event.payload.exit_code ?? 'desconocido'})`,
            },
          }));

          import('@tauri-apps/api/core')
            .then(({ invoke }) => invoke('clear_discord_presence'))
            .catch(() => {});

          // Restaurar ventana en segundo plano sin bloquear el estado
          import('@tauri-apps/api/webviewWindow')
            .then(({ getCurrentWebviewWindow }) => {
              const win = getCurrentWebviewWindow();
              win.unminimize().catch(() => {});
              win.show().catch(() => {});
              win.setFocus().catch(() => {});
            })
            .catch(() => {});
        },
      );

      // Watchdog activo cada 1s: detecta automáticamente si el proceso de Minecraft ya no existe
      watchdogIntervalId = setInterval(async () => {
        if (state.launch.status === 'RUNNING') {
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const isRunning = await invoke<boolean>('is_game_running');
            if (!isRunning) {
              setStoreState(() => ({
                launch: {
                  status: 'IDLE',
                  progress: 0,
                  message: 'Juego finalizado.',
                },
              }));
            }
          } catch (e) {
            console.warn('[Launcher Store] Error en watchdog de estado del juego:', e);
          }
        }
      }, 1000);

      await registerListener<number | { progress?: number; message?: string }>(
        'java-install-progress',
        (event) => {
          let prog = 0;
          let msg = '';
          if (typeof event.payload === 'number') {
            prog = Math.min(95, Math.max(10, Math.round(event.payload * 100)));
            msg = `Instalando entorno Java... (${Math.round(event.payload * 100)}%)`;
          } else if (event.payload && typeof event.payload === 'object') {
            const rawProg = typeof event.payload.progress === 'number' ? event.payload.progress : 0;
            prog = Math.min(95, Math.max(10, Math.round(rawProg * 100)));
            msg = event.payload.message || `Instalando entorno Java... (${prog}%)`;
          }
          setStoreState(() => ({
            launch: {
              status: 'DOWNLOADING',
              progress: prog,
              message: msg,
            },
          }));
        },
      );

      await registerListener<number>('mod-download-progress', (event) => {
        const currentModIdx = (event.payload ?? 0) + 1;
        setStoreState((prev) => {
          if (prev.launch.status === 'DOWNLOADING') {
            return {
              launch: {
                ...prev.launch,
                message: `Descargando mods (${currentModIdx})...`,
              },
            };
          }
          return {};
        });
      });

      await registerListener<{ line: string; level: string }>('game-log', (event) => {
        if (event.payload?.line && event.payload.level === 'ERROR') {
          console.error('[Minecraft Log]', event.payload.line);
        }
      });

      await registerListener<{ lines: Array<{ line: string; level?: string }> }>('game-log-batch', (event) => {
        if (Array.isArray(event.payload?.lines)) {
          for (const item of event.payload.lines) {
            if (item?.line && item.level === 'ERROR') {
              console.error('[Minecraft Log]', item.line);
            }
          }
        }
      });
    } catch {
      // Browser preview mode fallback
    }

    return () => {
      isDisposed = true;
      cleanupTauriListeners();
    };
  },

  startLaunchFlow: async (launchOpts?: { skipModSync?: boolean }) => {
    if (state.launch.status !== 'IDLE' && !state.modSyncPrompt) return;

    const attemptId = ++currentLaunchAttemptId;
    gameStoppedDuringLaunch = false;
    setStoreState(() => ({ modSyncPrompt: null }));

    let activeAcc = resolveActiveAccount();

    if (activeAcc.type === 'microsoft' && activeAcc.refreshToken) {
      // 1.3: Renovar solo si el token de Minecraft caduca en menos de 1 hora
      const needsTokenRefresh = (() => {
        if (!activeAcc.accessToken) return true;
        try {
          const payload = decodeJwt(activeAcc.accessToken);
          if (!payload.exp) return true;
          const nowSec = Math.floor(Date.now() / 1000);
          return payload.exp - nowSec < 3600;
        } catch {
          return true;
        }
      })();

      if (needsTokenRefresh) {
        try {
          setStoreState(() => ({
            launch: { status: 'VERIFYING', progress: 5, message: 'Validando sesión de Microsoft...' },
          }));
          const { refreshMicrosoftSession } = await import('../services/microsoftAuthService');
          const refreshed = await refreshMicrosoftSession(activeAcc.refreshToken);
          if (refreshed?.accessToken) {
            const updatedAcc: UserAccount = {
              ...activeAcc,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken ?? activeAcc.refreshToken,
              username: refreshed.username || activeAcc.username,
              uuid: refreshed.uuid || activeAcc.uuid,
              lastUsed: Date.now(),
              requiresReauth: false,
            };
            activeAcc = updatedAcc;
            await launcherActions.updateAccount(updatedAcc.id, updatedAcc);
          }
        } catch (authErr) {
          const errString = String(authErr);
          logFrontend('WARN', `[Launcher Store] Error refrescando sesión previa de Microsoft: ${errString}`);

          const errorCode =
            authErr && typeof authErr === 'object' && 'code' in authErr
              ? String((authErr as { code: unknown }).code)
              : undefined;

          if (errorCode === 'invalid_grant' || /invalid_grant/i.test(errString)) {
            // Si la renovación falla con invalid_grant, no lanzar con el token viejo: pedir volver a iniciar sesión
            await launcherActions.updateAccount(activeAcc.id, { requiresReauth: true });
            setStoreState(() => ({
              launch: {
                status: 'IDLE',
                progress: 0,
                message:
                  'La sesión de Microsoft ha expirado (invalid_grant). Por favor, vuelve a iniciar sesión en Gestión de Cuentas.',
              },
            }));
            return;
          }
        }
      } else {
        logFrontend(
          'INFO',
          '[Launcher Store] Token de Minecraft vigente (expira en >1h), omitiendo renovación previa.',
        );
      }
    }

    setStoreState(() => ({
      launch: { status: 'VERIFYING', progress: 10, message: 'Iniciando motor de juego...' },
    }));

    try {
      const { launchGame } = await import('../services/launcherService');
      const { invoke } = await import('@tauri-apps/api/core');

      if (currentLaunchAttemptId !== attemptId) return;

      const instances = state.instances;
      const activeInst =
        instances.find((i) => i.id === state.activeInstanceId) ||
        instances[0] ||
        DEFAULT_OFFICIAL_INSTANCE;

      const effectiveGameDir = await resolveInstanceGameDir(activeInst);
      const syncResult = await syncInstanceAssets(
        activeInst,
        effectiveGameDir,
        launchOpts?.skipModSync,
      );
      if (syncResult?.halted || currentLaunchAttemptId !== attemptId) return;

      const options = buildLaunchOptions(activeAcc, activeInst, effectiveGameDir);

      const resolveLaunchProgressStatus = (prog: number): LaunchStatus => {
        if (prog >= 90) return 'LAUNCHING';
        if (prog >= 20) return 'DOWNLOADING';
        return 'VERIFYING';
      };

      await launchGame(
        options,
        (message, progress) => {
          if (currentLaunchAttemptId !== attemptId) return;
          setStoreState(() => ({
            launch: {
              status: resolveLaunchProgressStatus(progress),
              progress,
              message,
            },
          }));
        },
        () => currentLaunchAttemptId !== attemptId,
      );

      if (currentLaunchAttemptId !== attemptId || gameStoppedDuringLaunch) {
        return;
      }

      const isStillRunning = await invoke<boolean>('is_game_running').catch(() => false);
      if (currentLaunchAttemptId !== attemptId || gameStoppedDuringLaunch) {
        return;
      }

      if (state.launch.status !== 'IDLE') {
        const nextLaunchState = isStillRunning
          ? { status: 'RUNNING' as const, progress: 100, message: 'Minecraft en ejecución' }
          : { status: 'IDLE' as const, progress: 0, message: 'Juego finalizado.' };
        setStoreState(() => ({ launch: nextLaunchState }));
      }
    } catch (err: unknown) {
      if (currentLaunchAttemptId === attemptId) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[Launcher Store] Launch failed:', errorMsg);

        if (
          activeAcc.type === 'microsoft' &&
          activeAcc.refreshToken &&
          /token|auth|expired|401|invalid/i.test(errorMsg)
        ) {
          try {
            const { refreshMicrosoftSession } = await import('../services/microsoftAuthService');
            const refreshed = await refreshMicrosoftSession(activeAcc.refreshToken);
            if (refreshed?.accessToken) {
              const updatedAcc: UserAccount = {
                ...activeAcc,
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken ?? activeAcc.refreshToken,
                username: refreshed.username || activeAcc.username,
                uuid: refreshed.uuid || activeAcc.uuid,
                lastUsed: Date.now(),
              };
              await launcherActions.updateAccount(updatedAcc.id, updatedAcc);
            }
          } catch (reAuthErr) {
            console.warn(
              '[Launcher Store] Falló recuperación de sesión Microsoft tras error:',
              reAuthErr,
            );
          }
        }

        setStoreState(() => ({
          launch: { status: 'IDLE', progress: 0, message: `Error: ${errorMsg}` },
        }));
      }
    } finally {
      if (currentLaunchAttemptId === attemptId) {
        setStoreState((prev) => {
          if (prev.modSyncPrompt) {
            return {};
          }
          if (prev.launch.status !== 'RUNNING' && prev.launch.status !== 'IDLE') {
            return {
              launch: {
                status: 'IDLE',
                progress: 0,
                message: prev.launch.message || 'Listo para jugar',
              },
            };
          }
          return {};
        });
      }
    }
  },

  killGameFlow: async () => {
    ++currentLaunchAttemptId;
    try {
      const { killGame } = await import('../services/launcherService');
      await killGame();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[Launcher Store] Kill game failed:', errorMsg);
    }
    setStoreState(() => ({
      launch: { status: 'IDLE', progress: 0, message: 'Juego detenido.' },
    }));
  },

  cancelLaunchFlow: () => {
    ++currentLaunchAttemptId;
    setStoreState(() => ({
      modSyncPrompt: null,
      launch: { status: 'IDLE', progress: 0, message: 'Listo para jugar' },
    }));
  },

  retryModSyncAndLaunch: () => {
    setStoreState(() => ({ modSyncPrompt: null }));
    void launcherActions.startLaunchFlow();
  },

  proceedLaunchWithoutModSync: () => {
    setStoreState(() => ({ modSyncPrompt: null }));
    void launcherActions.startLaunchFlow({ skipModSync: true });
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

// Function to read current launcher state outside of React components
export const getLauncherState = (): LauncherState => state;
useLauncherStore.getState = getLauncherState;
useLauncherStore.setState = (
  partial: Partial<LauncherState> | ((prev: LauncherState) => Partial<LauncherState>),
) => {
  setStoreState(typeof partial === 'function' ? partial : () => partial);
};

// React hook to access current active translations
export function useT(): TranslationDictionary {
  const lang = useLauncherStore((s: LauncherState) => s.language);
  return getTranslation(lang);
}
