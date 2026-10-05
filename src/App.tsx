import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useLauncherStore, launcherActions, LauncherState } from './store/launcherStore';
import { WallpaperBackground } from './components/WallpaperBackground';
import { WindowHeader } from './components/WindowHeader';
import { BottomBar } from './components/BottomBar';
import { HomeDock } from './components/HomeDock';
import { HudEditorOverlay } from './components/HudEditorOverlay';
import { LoginView } from './components/LoginView';
import { SettingsModal } from './components/modals/SettingsModal';
import { AccountsModal } from './components/modals/AccountsModal';
import { AboutModal } from './components/modals/AboutModal';
import { InstancesModal } from './components/modals/InstancesModal';
import { CrashReportModal } from './components/modals/CrashReportModal';
import { InstallerView } from './components/installer/InstallerView';
import { UninstallerView } from './components/uninstaller/UninstallerView';
import { UpdaterModal } from './components/modals/UpdaterModal';
import { SplashScreen } from './components/SplashScreen';
import { GameLaunchOverlay } from './components/GameLaunchOverlay';
import { checkForAppUpdates, AppUpdateInfo } from './services/updateService';
import { loadActiveWallpaper } from './utils/wallpaperStorage';

interface BootContext {
  mode: 'install' | 'launcher' | 'uninstall';
  defaultInstallDir: string;
  currentExe: string;
  isInstalled: boolean;
  os: string;
}

export const App: React.FC = () => {
  const [bootContext, setBootContext] = useState<BootContext | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [crashModalOpen, setCrashModalOpen] = useState(false);
  const [crashData, setCrashData] = useState<{ reason: string; details: string; code: number }>({
    reason: 'Incompatibilidad de mods o fallo de memoria de Java',
    details: 'java.lang.OutOfMemoryError: Java heap space',
    code: 1,
  });

  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);

  // Revelar la ventana de forma fluida una vez montado el DOM (Zero White Flash)
  useEffect(() => {
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

  // Cargar fondo personalizado persistente desde IndexedDB (sin límites de localStorage)
  useEffect(() => {
    loadActiveWallpaper().then((meta) => {
      if (meta) {
        launcherActions.setCustomWallpaper(meta.url, meta.isVideo);
      }
    });
  }, []);

  // 1. Detección inicial de modo (Bootstrapping) con SplashScreen suave
  useEffect(() => {
    const initBoot = async () => {
      const startTime = Date.now();
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
      } finally {
        const elapsed = Date.now() - startTime;
        const minDisplayTime = 1200;
        const remaining = Math.max(0, minDisplayTime - elapsed);
        setTimeout(() => setBootLoading(false), remaining);
      }
    };
    initBoot();
  }, []);

  // 2. Cargar cuentas, listeners y verificación autónoma de actualizaciones en modo Launcher
  useEffect(() => {
    if (bootContext?.mode === 'launcher') {
      launcherActions.loadAccountsFromVault();
      launcherActions.setupTauriListeners();

      // Chequeo autónomo de actualizaciones
      checkForAppUpdates()
        .then((info) => {
          if (info.available) {
            console.log('[App] Auto-updater found update:', info.version);
            setUpdateInfo(info);
          }
        })
        .catch((err) => {
          console.warn('[App] Auto-updater background check error:', err);
        });
    }
  }, [bootContext?.mode]);

  // Listener de crashes del juego
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const bindCrash = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<{ exit_code: number | null; success: boolean }>(
          'game-stopped',
          (event) => {
            if (
              !event.payload.success &&
              event.payload.exit_code &&
              event.payload.exit_code !== 0
            ) {
              setCrashData({
                reason: `El proceso de Minecraft se detuvo inesperadamente (Código: ${event.payload.exit_code})`,
                details: `Salida con código de error ${event.payload.exit_code}. Revisa logs/latest.log o la pestaña de Registros.`,
                code: event.payload.exit_code,
              });
              setCrashModalOpen(true);
            }
          },
        );
      } catch {
        // Dev mode
      }
    };
    bindCrash();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 3. Listener global de teclado (Escape cierra modales)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal !== 'none') {
        launcherActions.closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  if (bootLoading) {
    return <SplashScreen />;
  }

  // Vista del Instalador
  if (bootContext?.mode === 'install') {
    return (
      <InstallerView
        defaultInstallDir={bootContext.defaultInstallDir}
        onLaunchMain={() => setBootContext({ ...bootContext, mode: 'launcher' })}
      />
    );
  }

  // Vista del Desinstalador
  if (bootContext?.mode === 'uninstall') {
    return <UninstallerView installDir={bootContext.defaultInstallDir} />;
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

          {/* Modales */}
          <InstancesModal />
          <SettingsModal />
          <AccountsModal />
          <AboutModal />
          <CrashReportModal
            isOpen={crashModalOpen}
            onClose={() => setCrashModalOpen(false)}
            onRetry={() => {
              setCrashModalOpen(false);
              launcherActions.startLaunchFlow();
            }}
            crashReason={crashData.reason}
            crashDetails={crashData.details}
            exitCode={crashData.code}
          />
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
