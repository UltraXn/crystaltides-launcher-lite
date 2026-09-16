import { useSyncExternalStore } from "react";
import { loadSecureItem, saveSecureItem } from "../services/secureVault";

export interface UserAccount {
  id: string;
  username: string;
  uuid: string;
  type: "microsoft" | "guest";
  skinUrl?: string;
  capeUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  lastUsed: number;
}

export interface LauncherSettings {
  minRamGb: number;
  maxRamGb: number;
  javaPath: string;
  resolution: string;
  autoCloseLauncher: boolean;
  discordRpc: boolean;
  fullscreen: boolean;
  mcVersion: string;
}

export type ModalType = "none" | "settings" | "accounts" | "about";
export type ViewType = "login" | "home";
export type LaunchStatus = "IDLE" | "VERIFYING" | "DOWNLOADING" | "LAUNCHING" | "RUNNING";

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
    id: "ct_night",
    name: "Santuario Nocturno",
    url: "/wallpapers/crystaltides_night.png",
    accent: "#00e5ff",
  },
  {
    id: "ct_day",
    name: "Costa de Cerezos (Día)",
    url: "/wallpapers/crystaltides_day.png",
    accent: "#22c55e",
  },
  {
    id: "ct_shrine",
    name: "Templo Sumergido",
    url: "/wallpapers/crystaltides_shrine.png",
    accent: "#38bdf8",
  },
];

export interface LauncherState {
  currentView: ViewType;
  accounts: UserAccount[];
  activeAccountId: string | null;
  isLoadingAccounts: boolean;
  settings: LauncherSettings;
  activeWallpaperId: string;
  activeModal: ModalType;
  launch: LaunchProgress;
  serverStatus: {
    online: boolean;
    playersCount: number;
    maxPlayers: number;
    ping: number;
  };
}

const SETTINGS_STORAGE_KEY = "crystaltides_lite_settings_v1";
const WALLPAPER_STORAGE_KEY = "crystaltides_lite_wallpaper_v1";
const ACCOUNTS_VAULT_KEY = "crystaltides_lite_vault_accounts";

const defaultSettings: LauncherSettings = {
  minRamGb: 4,
  maxRamGb: 8,
  javaPath: "Auto (Java 21 OpenJDK)",
  resolution: "1920x1080",
  autoCloseLauncher: true,
  discordRpc: true,
  fullscreen: false,
  mcVersion: "1.21.1",
};

export const isUserAccount = (obj: unknown): obj is UserAccount => {
  if (!obj || typeof obj !== "object") return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a.id === "string" &&
    typeof a.username === "string" &&
    typeof a.uuid === "string" &&
    (a.type === "microsoft" || a.type === "guest") &&
    typeof a.lastUsed === "number"
  );
};

export const sanitizeLauncherSettings = (raw: unknown): LauncherSettings => {
  if (!raw || typeof raw !== "object") return defaultSettings;
  const s = raw as Record<string, unknown>;
  return {
    minRamGb: typeof s.minRamGb === "number" && s.minRamGb >= 1 && s.minRamGb <= 64 ? s.minRamGb : defaultSettings.minRamGb,
    maxRamGb: typeof s.maxRamGb === "number" && s.maxRamGb >= 1 && s.maxRamGb <= 64 ? s.maxRamGb : defaultSettings.maxRamGb,
    javaPath: typeof s.javaPath === "string" && s.javaPath.length > 0 ? s.javaPath : defaultSettings.javaPath,
    resolution: typeof s.resolution === "string" && /^\d+x\d+$/.test(s.resolution) ? s.resolution : defaultSettings.resolution,
    autoCloseLauncher: typeof s.autoCloseLauncher === "boolean" ? s.autoCloseLauncher : defaultSettings.autoCloseLauncher,
    discordRpc: typeof s.discordRpc === "boolean" ? s.discordRpc : defaultSettings.discordRpc,
    fullscreen: typeof s.fullscreen === "boolean" ? s.fullscreen : defaultSettings.fullscreen,
    mcVersion: typeof s.mcVersion === "string" && s.mcVersion.length > 0 ? s.mcVersion : defaultSettings.mcVersion,
  };
};

let state: LauncherState = {
  currentView: "login", // Default to login view
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
  activeWallpaperId: localStorage.getItem(WALLPAPER_STORAGE_KEY) || "ct_night",
  activeModal: "none",
  launch: {
    status: "IDLE",
    progress: 0,
    message: "Listo para jugar",
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

  loadAccountsFromVault: async () => {
    try {
      const decrypted = await loadSecureItem<UserAccount[]>(ACCOUNTS_VAULT_KEY);
      if (decrypted && Array.isArray(decrypted) && decrypted.length > 0) {
        const validAccounts = decrypted.filter(isUserAccount);
        if (validAccounts.length > 0) {
          const sorted = [...validAccounts].sort((a: UserAccount, b: UserAccount) => b.lastUsed - a.lastUsed);
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
      currentView: "home",
    }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  updateAccount: async (id: string, updates: Partial<UserAccount>) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, ...updates } : acc
    );
    setStoreState(() => ({ accounts: updated }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  setActiveAccount: async (id: string) => {
    const updated = state.accounts.map((acc: UserAccount) =>
      acc.id === id ? { ...acc, lastUsed: Date.now() } : acc
    );
    setStoreState(() => ({ accounts: updated, activeAccountId: id, currentView: "home" }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  removeAccount: async (id: string) => {
    const updated = state.accounts.filter((a: UserAccount) => a.id !== id);
    const nextActive = updated.length > 0 ? updated[0].id : null;
    const nextView = updated.length > 0 ? state.currentView : "login";
    setStoreState(() => ({ accounts: updated, activeAccountId: nextActive, currentView: nextView }));
    await saveSecureItem(ACCOUNTS_VAULT_KEY, updated);
  },

  logout: async () => {
    localStorage.removeItem(ACCOUNTS_VAULT_KEY);
    setStoreState(() => ({
      accounts: [],
      activeAccountId: null,
      currentView: "login",
      activeModal: "none",
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
    setStoreState(() => ({ activeModal: "none" }));
  },

  setupTauriListeners: async () => {
    try {
      const { listen } = await import("@tauri-apps/api/event");

      listen<number>("game-started", (event) => {
        console.log("[Launcher Store] Minecraft PID started:", event.payload);
        setStoreState(() => ({
          launch: {
            status: "RUNNING",
            progress: 100,
            message: `Minecraft en ejecución (PID: ${event.payload})`,
          },
        }));
      });

      listen<{ exit_code: number | null; success: boolean }>("game-stopped", (event) => {
        console.log("[Launcher Store] Minecraft process stopped:", event.payload);
        setStoreState(() => ({
          launch: {
            status: "IDLE",
            progress: 0,
            message: event.payload.success
              ? "Juego finalizado."
              : `Juego cerrado (Código: ${event.payload.exit_code ?? "desconocido"})`,
          },
        }));
      });

      listen<number>("java-install-progress", (event) => {
        setStoreState(() => ({
          launch: {
            status: "DOWNLOADING",
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
    if (state.launch.status !== "IDLE") return;

    const activeAcc = state.accounts.find((a: UserAccount) => a.id === state.activeAccountId);
    if (!activeAcc) {
      setStoreState(() => ({
        activeModal: "accounts",
        launch: { status: "IDLE", progress: 0, message: "Selecciona o añade una cuenta primero." },
      }));
      return;
    }

    setStoreState(() => ({
      launch: { status: "VERIFYING", progress: 10, message: "Iniciando motor de juego..." },
    }));

    try {
      const { launchGame } = await import("../services/launcherService");
      const selectedVersion = state.settings.mcVersion || "1.21.1";
      const isNeoForge = selectedVersion.startsWith("1.21");

      await launchGame(
        {
          username: activeAcc.username,
          uuid: activeAcc.uuid || "00000000-0000-0000-0000-000000000000",
          accessToken: activeAcc.accessToken || "placeholder_token",
          mcVersion: selectedVersion,
          loaderType: isNeoForge ? "neoforge" : "fabric",
          loaderVersion: isNeoForge ? "21.1.65" : "0.15.11",
          maxRam: state.settings.maxRamGb * 1024,
          javaPath: state.settings.javaPath,
          resolution: state.settings.resolution,
        },
        (message, progress) => {
          setStoreState(() => ({
            launch: {
              status: progress >= 90 ? "LAUNCHING" : progress >= 20 ? "DOWNLOADING" : "VERIFYING",
              progress,
              message,
            },
          }));
        }
      );

      setStoreState(() => ({
        launch: { status: "RUNNING", progress: 100, message: "¡Minecraft en ejecución!" },
      }));
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[Launcher Store] Launch failed:", errorMsg);
      setStoreState(() => ({
        launch: { status: "IDLE", progress: 0, message: `Error: ${errorMsg}` },
      }));
    }
  },

  killGameFlow: async () => {
    try {
      const { killGame } = await import("../services/launcherService");
      await killGame();
    } catch (err) {
      console.error("[Launcher Store] Kill game failed:", err);
    }
    setStoreState(() => ({
      launch: { status: "IDLE", progress: 0, message: "Juego detenido." },
    }));
  },

  cancelLaunchFlow: () => {
    setStoreState(() => ({
      launch: { status: "IDLE", progress: 0, message: "Listo para jugar" },
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
    () => selector(state)
  );
}
