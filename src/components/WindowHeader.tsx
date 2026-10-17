import React, { useEffect, useState } from 'react';
import { Minus, Square, Copy, X, Move, Check } from 'lucide-react';
import logoImg from '../assets/logo.webp';
import { useLauncherStore, launcherActions, LauncherState, useT } from '../store/launcherStore';
import { TelemetryCapsule } from './TelemetryCapsule';

const handleMinimize = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch (err) {
    console.log('[Window] Minimize (Web mode)', err);
  }
};

const handleClose = async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    console.log('[Window] Close (Web mode)');
  }
};

export const WindowHeader: React.FC = () => {
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const launchStatus = useLauncherStore((s: LauncherState) => s.launch.status);
  const telemetryCapsuleEnabled = useLauncherStore(
    (s: LauncherState) => s.settings.telemetryCapsuleEnabled,
  );
  const t = useT();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const syncWindowState = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const max = await appWindow.isMaximized();
        if (isMounted) {
          setIsMaximized(max);
        }

        unlisten = await appWindow.onResized(async () => {
          if (isMounted) {
            setIsMaximized(await appWindow.isMaximized());
          }
        });
      } catch {
        // Running in browser/web mode
      }
    };

    void syncWindowState();

    return () => {
      isMounted = false;
      if (unlisten) {
        void Promise.resolve(unlisten()).catch(() => {});
      }
    };
  }, []);

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.toggleMaximize();
      const max = await appWindow.isMaximized();
      setIsMaximized(max);
    } catch {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        const max = await appWindow.isMaximized();
        if (max) {
          await appWindow.unmaximize();
          setIsMaximized(false);
        } else {
          await appWindow.maximize();
          setIsMaximized(true);
        }
      } catch {
        console.log('[Window] Maximize (Web mode)');
      }
    }
  };

  return (
    <header data-tauri-drag-region className="papyrus-window-header">
      {/* Left Branding: Logo + Title + Lite Tech Pill */}
      <div className="papyrus-header-branding" data-tauri-drag-region>
        <img src={logoImg} alt="CrystalTides Logo" className="papyrus-header-logo" />
        <div className="papyrus-header-title">
          <span>CrystalTides</span>
          <span className="papyrus-header-title-launcher">Launcher</span>
        </div>
        <div className="papyrus-header-lite-badge" title={t.window.badgeTitle}>
          <span className="papyrus-header-lite-dot" />
          <span>LITE</span>
        </div>
      </div>

      <div style={{ flex: 1 }} data-tauri-drag-region />

      {/* In-Game Live Telemetry Capsule */}
      {launchStatus === 'RUNNING' && telemetryCapsuleEnabled && (
        <div style={{ marginRight: '10px' }}>
          <TelemetryCapsule />
        </div>
      )}

      {/* Quick GUI Edit Button (Always accessible anywhere in the launcher) */}
      {currentView !== 'login' && (
        <button
          type="button"
          onClick={() => launcherActions.setEditingHud(!isEditingHud)}
          title={
            isEditingHud
              ? 'Guardar y salir del modo edición (F8 o Esc)'
              : 'Mover y personalizar botones de la GUI (F8)'
          }
          className="papyrus-header-edit-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '7px',
            background: isEditingHud ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.05)',
            border: isEditingHud ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
            color: isEditingHud ? '#38bdf8' : 'rgba(248, 250, 252, 0.8)',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            marginRight: '10px',
            transition: 'all 0.15s ease',
            boxShadow: isEditingHud ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
          }}
        >
          {isEditingHud ? <Check size={13} /> : <Move size={13} />}
          <span>{isEditingHud ? 'Listo (Salir)' : 'Editar GUI'}</span>
          <span
            style={{
              fontSize: '9px',
              opacity: 0.7,
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '1px 4px',
              borderRadius: '4px',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            F8
          </span>
        </button>
      )}

      {/* Top-Right Window Controls */}
      <div className="papyrus-window-controls">
        <button
          type="button"
          onClick={handleMinimize}
          className="papyrus-win-btn"
          title={t.window.minimize}
          aria-label={t.window.minimize}
        >
          <Minus style={{ width: '14px', height: '14px' }} />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          className="papyrus-win-btn"
          title={isMaximized ? t.window.restore : t.window.maximize}
          aria-label={isMaximized ? t.window.restore : t.window.maximize}
        >
          {isMaximized ? (
            <Copy style={{ width: '12px', height: '12px' }} />
          ) : (
            <Square style={{ width: '12px', height: '12px' }} />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="papyrus-win-btn close"
          title={t.window.close}
          aria-label={t.window.close}
        >
          <X style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </header>
  );
};
