import React, { useEffect, useState, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
} from './store/launcherStore';
import { WallpaperBackground } from './components/WallpaperBackground';
import { WindowHeader } from './components/WindowHeader';
import { BottomBar } from './components/BottomBar';
import { HomeDock } from './components/HomeDock';
import { HudEditorOverlay } from './components/HudEditorOverlay';
import { LoginView } from './components/LoginView';
import { AccountsModal } from './components/modals/AccountsModal';
import { AboutModal } from './components/modals/AboutModal';
import { UpdaterModal } from './components/modals/UpdaterModal';
import { SplashScreen } from './components/SplashScreen';
import { GameLaunchOverlay } from './components/GameLaunchOverlay';
import { checkForAppUpdates, AppUpdateInfo } from './services/updateService';
import {
  loadActiveWallpaper,
  loadAllButtonMedia,
  loadDockPanorama,
} from './utils/wallpaperStorage';
import { initializeBuiltinModules, useModuleStore } from './modules';
import { ModuleModalRenderer } from './components/modals/ModuleModalRenderer';
import { GuiHintToast } from './components/GuiHintToast';
import { CrashDiagnosis } from './services/crashDoctorService';
import { resolveInstanceGameDir } from './services/instanceService';
import { IS_SUPABASE_CONFIGURED } from './config/supabase';

const SettingsModal = React.lazy(() =>
  import('./components/modals/SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const InstancesModal = React.lazy(() =>
  import('./components/modals/InstancesModal').then((m) => ({ default: m.InstancesModal })),
);
const CrashReportModal = React.lazy(() =>
  import('./components/modals/CrashReportModal').then((m) => ({ default: m.CrashReportModal })),
);
const OutOfMemoryScreen = React.lazy(() =>
  import('./components/OutOfMemoryScreen').then((m) => ({ default: m.OutOfMemoryScreen })),
);
const InstallerView = React.lazy(() =>
  import('./components/installer/InstallerView').then((m) => ({ default: m.InstallerView })),
);
const UninstallerView = React.lazy(() =>
  import('./components/uninstaller/UninstallerView').then((m) => ({ default: m.UninstallerView })),
);

interface BootContext {
  mode: 'install' | 'launcher' | 'uninstall';
  defaultInstallDir: string;
  currentExe: string;
  isInstalled: boolean;
  os: string;
}

export const App: React.FC = () => {
  const [bootContext, setBootContext] = useState<BootContext | null>(null);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [crashModalOpen, setCrashModalOpen] = useState(false);
  const [oomScreenOpen, setOomScreenOpen] = useState(false);
  const [crashData, setCrashData] = useState<{
    reason: string;
    details: string;
    code?: number;
    gameDir?: string;
    offendingMod?: string;
    suggestedAction?: CrashDiagnosis['suggested_action'];
  }>({
    reason: 'Incompatibilidad de mods o fallo de memoria de Java',
    details: 'java.lang.OutOfMemoryError: Java heap space',
    code: 1,
  });

  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const customizingButtonId = useLauncherStore((s: LauncherState) => s.customizingButtonId);

  // Revelar la ventana de forma fluida una vez montado el DOM (Zero White Flash)
  useEffect(() => {
    initializeBuiltinModules();
    const revealWindow = async () => {
      try {
        const win = getCurrentWebviewWindow();
        await win.show();
        await win.setFocus();
      } catch {
        // Modo navegador / dev preview
      }
    };
    revealWindow();
  }, []);

  // Cargar fondo personalizado, panorama de dock y medias de botones persistentes desde IndexedDB
  useEffect(() => {
    loadActiveWallpaper()
      .then((meta) => {
        if (meta) {
          launcherActions.setCustomWallpaper(meta.url, meta.isVideo);
        }
      })
      .catch((err) => console.warn('[App] Failed loading active wallpaper:', err));

    loadDockPanorama()
      .then((meta) => {
        if (meta) {
          launcherActions.setDockBackground(meta.isVideo ? 'video' : 'image', meta.url);
        }
      })
      .catch((err) => console.warn('[App] Failed loading dock panorama:', err));

    loadAllButtonMedia()
      .then(({ backgrounds, icons }) => {
        Object.entries(backgrounds).forEach(([btnId, meta]) => {
          launcherActions.setDockButtonCustomization(btnId as DockButtonId, {
            bgType: meta.isVideo ? 'video' : 'image',
            bgVideo: meta.isVideo ? meta.url : undefined,
            bgImage: !meta.isVideo ? meta.url : undefined,
          });
        });
        Object.entries(icons).forEach(([btnId, url]) => {
          launcherActions.setDockButtonCustomization(btnId as DockButtonId, {
            iconType: 'custom_image',
            customIconUrl: url,
          });
        });
      })
      .catch((err) => console.warn('[App] Failed loading button media:', err));
  }, []);

  // 1. Detección inicial de modo (Bootstrapping Instant-Launch - Cero esperas artificiales)
  useEffect(() => {
    const initBoot = async () => {
      try {
        const ctx = await invoke<BootContext>('get_boot_context');
        setBootContext(ctx);
      } catch (e) {
        console.warn('Could not retrieve boot context, defaulting to launcher:', e);
        setBootContext({
          mode: 'launcher',
          defaultInstallDir: 'C:/.crystaltides',
          currentExe: '',
          isInstalled: true,
          os: 'windows',
        });
      }
    };
    initBoot();
  }, []);

  // 2. Cargar cuentas, listeners y verificación autónoma de actualizaciones en modo Launcher
  useEffect(() => {
    if (bootContext?.mode === 'launcher') {
      let cancelled = false;
      launcherActions.loadAccountsFromVault();
      const setupPromise = launcherActions.setupTauriListeners();

      // Chequeo autónomo de actualizaciones
      checkForAppUpdates()
        .then((info) => {
          if (cancelled) return;
          if (info.available) {
            console.log('[App] Auto-updater found update:', info.version);
            setUpdateInfo(info);
          }
        })
        .catch((err) => {
          console.warn('[App] Auto-updater background check error:', err);
        });

      return () => {
        cancelled = true;
        void setupPromise.then((unlisten: (() => void) | void) => {
          if (typeof unlisten === 'function') {
            unlisten();
          }
        });
      };
    }
  }, [bootContext?.mode]);

interface CrashPayload {
  data: {
    reason: string;
    details: string;
    code?: number;
    gameDir?: string;
    offendingMod?: string;
    suggestedAction?: CrashDiagnosis['suggested_action'];
  };
  isOom: boolean;
}

const formatCrashDetails = (diagnosis: CrashDiagnosis, isOom: boolean): string => {
  const snippet = diagnosis.log_snippet;
  if (isOom) {
    return snippet ? `${diagnosis.explanation}\n\n${snippet}` : diagnosis.explanation;
  }
  const base = `${diagnosis.explanation}\n\nRecomendación: ${diagnosis.recommendation}`;
  return snippet ? `${base}\n\n[Detalle Forense]:\n${snippet}` : base;
};

const buildCrashPayload = async (
  exitCode: number,
  defaultInstallDir?: string,
): Promise<CrashPayload> => {
  const { analyzeLatestCrash } = await import('./services/crashDoctorService');
  const storeState = useLauncherStore.getState();
  const instances = storeState.instances;
  const activeInst = instances.find((i) => i.id === storeState.activeInstanceId) ?? instances[0];
  const gameDir = activeInst
    ? await resolveInstanceGameDir(activeInst)
    : (defaultInstallDir ?? 'C:/.crystaltides');

  const diagnosis = await analyzeLatestCrash(gameDir, exitCode);
  const isOom = diagnosis.crash_type === 'OUT_OF_MEMORY';
  const details = formatCrashDetails(diagnosis, isOom);

  return {
    isOom,
    data: {
      reason: diagnosis.title,
      details,
      code: exitCode,
      gameDir,
      offendingMod: diagnosis.offending_mod,
      suggestedAction: diagnosis.suggested_action,
    },
  };
};

  // Listener de crashes del juego con diagnóstico forense de Crash Doctor
  useEffect(() => {
    let cancelled = false;
    let unlistenFn: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        if (cancelled) return;
        return listen<{ exit_code: number | null; success: boolean }>(
          'game-stopped',
          async (event) => {
            if (cancelled) return;
            const exitCode = event.payload.exit_code;
            if (!event.payload.success && exitCode && exitCode !== 0) {
              const crash = await buildCrashPayload(exitCode, bootContext?.defaultInstallDir);
              if (cancelled) return;
              setCrashData(crash.data);
              if (crash.isOom) {
                setOomScreenOpen(true);
              } else {
                setCrashModalOpen(true);
              }
            }
          },
        );
      })
      .then((fn) => {
        if (!fn) return;
        if (cancelled) {
          fn();
        } else {
          unlistenFn = fn;
        }
      })
      .catch(() => {
        // Dev mode
      });

    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, [bootContext?.defaultInstallDir]);

  // 3. Listener global de teclado (Escape cierra modales, F8 alterna edición GUI)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isF8 = e.key === 'F8' || e.code === 'F8' || e.key === 'f8';
      if (isF8) {
        e.preventDefault();
        e.stopPropagation();
        useModuleStore.getState().closeModal();
        launcherActions.closeModal();
        const currentEditing = useLauncherStore.getState().isEditingHud;
        launcherActions.setEditingHud(!currentEditing);
        return;
      }
      if (e.key === 'Escape') {
        if (updateInfo?.available) {
          setUpdateInfo(null);
        } else if (customizingButtonId) {
          launcherActions.closeButtonCustomizer();
        } else if (useModuleStore.getState().activeModalModuleId) {
          useModuleStore.getState().closeModal();
        } else if (activeModal !== 'none') {
          launcherActions.closeModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeModal, customizingButtonId, updateInfo]);

  const isDev = Boolean(import.meta.env.DEV);

  if (!IS_SUPABASE_CONFIGURED) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0a0d14',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          zIndex: 9999,
          fontFamily: 'var(--app-font-family, sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 16,
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: '#ef4444',
              fontSize: '1.75rem',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: '#f8fafc',
            }}
          >
            Error de Configuración de Servicios
          </h2>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}
          >
            La configuración de conexión a Supabase está ausente o incompleta. En entornos de
            producción, las variables de entorno <code style={{ color: '#38bdf8' }}>VITE_SUPABASE_URL</code> y{' '}
            <code style={{ color: '#38bdf8' }}>VITE_SUPABASE_ANON_KEY</code> son obligatorias para
            autenticación y sincronización oficial.
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
            style={{
              padding: '0.625rem 1.5rem',
              background: 'var(--accent-primary, #16A085)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const isSplashPreview =
    isDev && typeof window !== 'undefined' && window.location.search.includes('preview=splash');

  if (isSplashPreview) {
    return <SplashScreen />;
  }

  const isOomPreview =
    isDev &&
    typeof window !== 'undefined' &&
    (window.location.search.includes('preview=oom') ||
      window.location.search.includes('preview=ram'));

  if (isOomPreview) {
    return (
      <Suspense fallback={null}>
        <OutOfMemoryScreen
          onRetry={() => {
            if (typeof window !== 'undefined') window.location.href = window.location.pathname;
          }}
          onClose={() => {
            if (typeof window !== 'undefined') window.location.href = window.location.pathname;
          }}
          crashReason="java.lang.OutOfMemoryError: Java heap space"
          crashDetails="Exception in thread 'main' java.lang.OutOfMemoryError: Java heap space&#10;    at net.minecraft.client.renderer.texture.TextureAtlas.load(TextureAtlas.java:142)&#10;    at net.minecraft.client.Minecraft.run(Minecraft.java:940)"
          exitCode={137}
        />
      </Suspense>
    );
  }

  const isCrashPreview =
    isDev && typeof window !== 'undefined' && window.location.search.includes('preview=crash');

  if (isCrashPreview) {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0a0d14' }}>
        <Suspense fallback={null}>
          <CrashReportModal
            isOpen={true}
            onClose={() => {
              if (typeof window !== 'undefined') window.location.href = window.location.pathname;
            }}
            onRetry={() => {
              if (typeof window !== 'undefined') window.location.href = window.location.pathname;
            }}
            onOpenOomAssistant={() => {
              if (typeof window !== 'undefined')
                window.location.href = `${window.location.pathname}?preview=oom`;
            }}
            exitCode={1}
            crashReason="Fallo al inicializar renderizador gráfico (GLFW error 65542: The driver does not appear to support OpenGL)"
            crashDetails="[18:42:10] [Render thread/INFO]: Setting user: Steve&#10;[18:42:11] [Render thread/ERROR]: Minecraft has stopped running because it couldn't find a compatible graphics driver.&#10;org.lwjgl.LWJGLException: Could not find OpenGL driver.&#10;    at org.lwjgl.opengl.WindowsPeerInfo.nChoosePixelFormat(Native Method)&#10;    at net.minecraft.client.main.Main.main(Main.java:214)"
          />
        </Suspense>
      </div>
    );
  }

  const isInstallPreview =
    isDev && typeof window !== 'undefined' && window.location.search.includes('preview=install');

  if (isInstallPreview) {
    return (
      <Suspense fallback={null}>
        <InstallerView
          defaultInstallDir="C:/.crystaltides"
          onLaunchMain={() => {
            if (typeof window !== 'undefined') window.location.href = window.location.pathname;
          }}
        />
      </Suspense>
    );
  }

  const isUninstallPreview =
    isDev && typeof window !== 'undefined' && window.location.search.includes('preview=uninstall');

  if (isUninstallPreview) {
    return (
      <Suspense fallback={null}>
        <UninstallerView installDir="C:/.crystaltides" />
      </Suspense>
    );
  }

  // Vista del Instalador
  if (bootContext?.mode === 'install') {
    return (
      <Suspense fallback={null}>
        <InstallerView
          defaultInstallDir={bootContext.defaultInstallDir}
          onLaunchMain={() => setBootContext({ ...bootContext, mode: 'launcher' })}
        />
      </Suspense>
    );
  }

  // Vista del Desinstalador
  if (bootContext?.mode === 'uninstall') {
    return (
      <Suspense fallback={null}>
        <UninstallerView installDir={bootContext.defaultInstallDir} />
      </Suspense>
    );
  }

  // Vista Principal del Launcher
  return (
    <div className="app-viewport">
      {/* Fondo con blur dinámico en modales */}
      <WallpaperBackground />

      {/* Controles de Ventana y Drag Region Global */}
      <WindowHeader />

      {/* Switcher de vistas: Login vs Home */}
      {currentView === 'login' ? (
        <LoginView />
      ) : (
        <>
          <HudEditorOverlay />
          <HomeDock />
          <BottomBar />
          <GuiHintToast />

          {/* Modales */}
          <Suspense fallback={null}>
            <InstancesModal />
            <SettingsModal />
            <AccountsModal />
            <AboutModal />
            <ModuleModalRenderer />
            <CrashReportModal
              isOpen={crashModalOpen}
              onClose={() => {
                setCrashModalOpen(false);
                launcherActions.cancelLaunchFlow();
              }}
              onRetry={() => {
                setCrashModalOpen(false);
                launcherActions.startLaunchFlow();
              }}
              onOpenOomAssistant={() => {
                setCrashModalOpen(false);
                setOomScreenOpen(true);
              }}
              crashReason={crashData.reason}
              crashDetails={crashData.details}
              exitCode={crashData.code}
              gameDir={crashData.gameDir}
              offendingMod={crashData.offendingMod}
              suggestedAction={crashData.suggestedAction}
            />

            {/* Pantalla Especial de Falta de RAM (La Nubecita) */}
            {oomScreenOpen && (
              <OutOfMemoryScreen
                onClose={() => {
                  setOomScreenOpen(false);
                  launcherActions.cancelLaunchFlow();
                }}
                onRetry={() => {
                  setOomScreenOpen(false);
                  launcherActions.startLaunchFlow();
                }}
                crashReason={crashData.reason}
                crashDetails={crashData.details}
                exitCode={crashData.code}
              />
            )}
          </Suspense>
        </>
      )}

      {/* Pantalla de carga interactiva al iniciar el juego */}
      <GameLaunchOverlay />

      {/* Modal de Actualización Autónoma */}
      {updateInfo?.available && (
        <UpdaterModal updateInfo={updateInfo} onClose={() => setUpdateInfo(null)} />
      )}
    </div>
  );
};
