import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import logoImg from '../../assets/logo.webp';
import { Minus, X, FolderOpen, CheckCircle2, ChevronDown } from 'lucide-react';
import { AmbientBubbles } from '../common/AmbientBubbles';

interface InstallerViewProps {
  defaultInstallDir: string;
  onLaunchMain: () => void;
}

const INSTALL_TIPS = [
  'Optimizando JVM y configurando perfiles de rendimiento...',
  'Aislando instancias de Minecraft de la carpeta original...',
  'Preparando aceleración de gráficos y soporte para shaders...',
  'Configurando accesos directos y registros de sistema...',
];

interface WindowButtonProps {
  onClick: () => void;
  ariaLabel: string;
  hoverBg?: string;
  hoverColor?: string;
  children: React.ReactNode;
}

const WindowButton: React.FC<WindowButtonProps> = ({
  onClick,
  ariaLabel,
  hoverBg = 'rgba(255, 255, 255, 0.08)',
  hoverColor,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    style={{
      width: '32px',
      height: '28px',
      background: 'transparent',
      border: 'none',
      color: '#94a3b8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'all 0.15s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = hoverBg;
      if (hoverColor) e.currentTarget.style.color = hoverColor;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = '#94a3b8';
    }}
  >
    {children}
  </button>
);

interface InstallerTitleBarProps {
  onMinimize: () => void;
  onClose: () => void;
}

const InstallerTitleBar: React.FC<InstallerTitleBarProps> = ({ onMinimize, onClose }) => (
  <div
    data-tauri-drag-region
    style={{
      height: '36px',
      minHeight: '36px',
      padding: '0 10px 0 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'transparent',
      zIndex: 50,
    }}
  >
    {/* Logo e Icono en Barra */}
    <div
      data-tauri-drag-region
      style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}
    >
      <img
        src={logoImg}
        alt="Logo"
        style={{ width: '16px', height: '16px', objectFit: 'contain' }}
      />
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#cbd5e1',
          letterSpacing: '0.2px',
        }}
      >
        CrystalTides Instalador
      </span>
    </div>

    {/* Botones de Ventana */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      <WindowButton onClick={onMinimize} ariaLabel="Minimizar">
        <Minus size={13} />
      </WindowButton>
      <WindowButton onClick={onClose} ariaLabel="Cerrar" hoverBg="#e11d48" hoverColor="#ffffff">
        <X size={14} />
      </WindowButton>
    </div>
  </div>
);

export const InstallerView: React.FC<InstallerViewProps> = ({
  defaultInstallDir,
  onLaunchMain,
}) => {
  const [step, setStep] = useState<'welcome' | 'folder' | 'installing' | 'finish'>('welcome');
  const [installPath, setInstallPath] = useState(() => defaultInstallDir.replace(/\\/g, '/'));
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Iniciando instalación...');
  const [tipIndex, setTipIndex] = useState(0);

  // Redimensionar ventana de Tauri a tamaño discreto estilo Lunar (600x400)
  useEffect(() => {
    const setupDiscreteWindow = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        const win = getCurrentWebviewWindow();
        await win.setSize(new LogicalSize(600, 400));
        await win.setResizable(false);
        await win.center();
      } catch {
        // En navegador / dev preview
      }
    };
    setupDiscreteWindow();
  }, []);

  // Rotar tips durante la instalación
  useEffect(() => {
    if (step !== 'installing') return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % INSTALL_TIPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [step]);

  const handleBrowseFolder = async () => {
    const chosen = prompt('Ingresa la ruta de instalación:', installPath);
    if (chosen?.trim()) {
      setInstallPath(chosen.trim().replace(/\\/g, '/'));
    }
  };

  const handleStartInstall = async () => {
    setStep('installing');
    setProgress(0.15);
    setStatusText('Preparando entorno aislado...');

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProgress(0.4);
      setStatusText('Copiando binario optimizado y librerías...');

      await invoke('perform_self_install', { targetDir: installPath, createDesktopShortcut });

      setProgress(0.75);
      setStatusText('Creando accesos directos en el sistema...');

      await new Promise((r) => setTimeout(r, 700));
      setProgress(0.95);
      setStatusText('Registrando CrystalTides en Windows...');

      await new Promise((r) => setTimeout(r, 500));
      setProgress(1.0);
      setStatusText('¡Instalación completada!');
      setStep('finish');
    } catch (err) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        console.error('Error durante la instalación en Tauri:', err);
        setStatusText(`Error en la instalación: ${String(err)}`);
        setStep('folder');
        return;
      }
      console.warn('Simulación suave de instalación en navegador:', err);
      setProgress(0.4);
      setStatusText('Copiando binario optimizado y librerías...');
      await new Promise((r) => setTimeout(r, 1200));
      setProgress(0.75);
      setStatusText('Creando accesos directos en el sistema...');
      await new Promise((r) => setTimeout(r, 1200));
      setProgress(0.95);
      setStatusText('Registrando CrystalTides en Windows...');
      await new Promise((r) => setTimeout(r, 1000));
      setProgress(1.0);
      setStatusText('¡Instalación completada!');
      setStep('finish');
    }
  };

  const handlePlayNow = async () => {
    try {
      await invoke('launch_installed_app', { targetDir: installPath });
      try {
        await invoke('close_app');
      } catch {
        await handleLaunchInPlace();
      }
    } catch {
      await handleLaunchInPlace();
    }
  };

  const handleLaunchInPlace = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWebviewWindow();
      await win.setResizable(true);
      await win.setSize(new LogicalSize(1280, 720));
      await win.center();
    } catch {
      // Dev preview
    }
    onLaunchMain();
  };

  const handleMinimize = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().minimize();
    } catch {
      // Browser preview
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_app');
    } catch {
      if (typeof window !== 'undefined') window.close();
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#0a0b0e',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Burbujas Ambientales Pixel Art Estilo Web */}
      <AmbientBubbles />

      {/* BARRA SUPERIOR DISCRETA (ESTILO LUNAR) */}
      <InstallerTitleBar onMinimize={handleMinimize} onClose={handleClose} />

      {/* CONTENIDO PRINCIPAL */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: '0 28px',
        }}
      >
        {/* PASO 1: BIENVENIDA */}
        {step === 'welcome' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                color: '#cbd5e1',
                fontWeight: 500,
                marginBottom: '16px',
                letterSpacing: '0.3px',
              }}
            >
              Bienvenido a
            </div>

            {/* Logo Central de CrystalTides */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: 'drop-shadow(0 0 25px rgba(34, 148, 227, 0.25))',
                }}
              >
                <img
                  src={logoImg}
                  alt="CrystalTides"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  letterSpacing: '2.5px',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                }}
              >
                CRYSTALTIDES
              </div>

              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#2294e3',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  background: 'rgba(34, 148, 227, 0.1)',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid rgba(34, 148, 227, 0.25)',
                }}
              >
                Papyrus Edition · v1.0
              </div>
            </div>
          </div>
        )}

        {/* PASO 2: CARPETA DE INSTALACIÓN Y TÉRMINOS */}
        {step === 'folder' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              animation: 'fadeIn 0.25s ease',
              paddingTop: '10px',
            }}
          >
            <div
              style={{
                fontSize: '13.5px',
                color: '#cbd5e1',
                fontWeight: 500,
                marginBottom: '10px',
              }}
            >
              Carpeta de instalación:
            </div>

            {/* Input de Ruta */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#13151b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '20px',
                transition: 'border-color 0.15s ease',
              }}
            >
              <input
                type="text"
                aria-label="Ruta de instalación"
                value={installPath}
                onChange={(e) => setInstallPath(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '11px 14px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                title="Examinar carpeta"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8',
                  padding: '11px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f8fafc';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              >
                <FolderOpen size={14} />
                <span>Examinar</span>
              </button>
            </div>

            {/* Opciones y Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label
                htmlFor="create-desktop-shortcut-checkbox"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  color: '#cbd5e1',
                }}
              >
                <input
                  id="create-desktop-shortcut-checkbox"
                  type="checkbox"
                  checked={createDesktopShortcut}
                  onChange={(e) => setCreateDesktopShortcut(e.target.checked)}
                  style={{
                    accentColor: '#2294e3',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer',
                  }}
                />
                <span>Crear acceso directo en el Escritorio</span>
              </label>

              <label
                htmlFor="accepted-terms-checkbox"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#94a3b8',
                  lineHeight: '1.4',
                }}
              >
                <input
                  id="accepted-terms-checkbox"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{
                    accentColor: '#2294e3',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer',
                  }}
                />
                <span>
                  Acepto los Términos de Uso y Políticas de Rendimiento de CrystalTides
                </span>
              </label>
            </div>
          </div>
        )}

        {/* PASO 3: INSTALANDO (CON ILUSTRACIÓN Y BARRA) */}
        {step === 'installing' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#f8fafc',
                marginBottom: '18px',
                letterSpacing: '0.3px',
              }}
            >
              Installing CrystalTides
            </div>

            {/* Arte Central / Mascota Voxel en Órbita con Partículas */}
            <div
              style={{
                position: 'relative',
                width: '180px',
                height: '90px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '26px',
              }}
            >
              {/* Estela de Estrellas Voxel (Estilo Lunar) */}
              <div
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '100px',
                  height: '40px',
                  opacity: 0.65,
                }}
              >
                <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
                  <circle cx="15" cy="22" r="1.5" fill="#ffffff" />
                  <circle cx="30" cy="16" r="2" fill="#ffffff" opacity="0.8" />
                  <circle cx="45" cy="26" r="1" fill="#ffffff" opacity="0.5" />
                  <circle cx="60" cy="18" r="2.5" fill="#38bdf8" />
                  <circle cx="75" cy="24" r="1.5" fill="#ffffff" opacity="0.9" />
                  <circle cx="90" cy="19" r="2" fill="#2294e3" />
                  <path
                    d="M 10 24 Q 50 15 95 20"
                    stroke="rgba(34, 148, 227, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </svg>
              </div>

              {/* Emblema CrystalTides Voxel Navegando */}
              <div
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  marginLeft: '75px',
                  animation: 'floatBob 2.2s ease-in-out infinite',
                  filter: 'drop-shadow(0 4px 14px rgba(34, 148, 227, 0.45))',
                }}
              >
                <img
                  src={logoImg}
                  alt="Nave Crystal"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            </div>

            {/* Barra de Progreso de ancho completo (Estilo Lunar: Delgada 3px) */}
            <div
              style={{
                width: '100%',
                height: '3px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(progress * 100)}%`,
                  background: 'linear-gradient(90deg, #0ea5e9 0%, #2294e3 100%)',
                  boxShadow: '0 0 12px rgba(34, 148, 227, 0.8)',
                  transition: 'width 0.35s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* PASO 4: COMPLETADO */}
        {step === 'finish' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34, 148, 227, 0.12)',
                border: '1px solid rgba(34, 148, 227, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 0 24px rgba(34, 148, 227, 0.25)',
              }}
            >
              <CheckCircle2 size={32} color="#2294e3" />
            </div>

            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '6px',
              }}
            >
              ¡Instalación completada!
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                maxWidth: '340px',
                lineHeight: '1.4',
              }}
            >
              CrystalTides Launcher está listo para ejecutarse en tu equipo.
            </div>
          </div>
        )}
      </div>

      {/* SEPARADOR INFERIOR DISCRETO (ESTILO LUNAR) */}
      <div
        style={{
          width: '100%',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.08)',
        }}
      />

      {/* BARRA INFERIOR DE ACCIÓN (ESTILO LUNAR) */}
      <div
        style={{
          height: '54px',
          minHeight: '54px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          position: 'relative',
        }}
      >
        {/* Esquina Inferior Izquierda */}
        {step === 'welcome' && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              style={{
                background: '#13151b',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                padding: '6px 14px',
                color: '#cbd5e1',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <span>{language === 'es' ? 'Español' : 'English'}</span>
              <ChevronDown size={13} color="#94a3b8" />
            </button>

            {showLangMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '6px',
                  background: '#13151b',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '4px',
                  width: '110px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                  zIndex: 100,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('es');
                    setShowLangMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: language === 'es' ? '#2294e3' : '#cbd5e1',
                    borderRadius: '4px',
                    background: language === 'es' ? 'rgba(34, 148, 227, 0.1)' : 'transparent',
                  }}
                >
                  Español
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    setShowLangMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: language === 'en' ? '#2294e3' : '#cbd5e1',
                    borderRadius: '4px',
                    background: language === 'en' ? 'rgba(34, 148, 227, 0.1)' : 'transparent',
                  }}
                >
                  English
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'folder' && (
          <button
            type="button"
            onClick={() => setStep('welcome')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12.5px',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            Atrás
          </button>
        )}

        {step === 'installing' && (
          <div
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{statusText} · {INSTALL_TIPS[tipIndex]}</span>
          </div>
        )}

        {step === 'finish' && <div />}

        {/* Esquina Inferior Derecha (Botones Principales Estilo Lunar: Azul Sólido) */}
        <div>
          {step === 'welcome' && (
            <button
              type="button"
              onClick={() => setStep('folder')}
              style={{
                background: '#2294e3',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 24px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a82cc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#2294e3')}
            >
              Siguiente
            </button>
          )}

          {step === 'folder' && (
            <button
              type="button"
              disabled={!acceptedTerms}
              onClick={handleStartInstall}
              style={{
                background: acceptedTerms ? '#2294e3' : '#1e293b',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 24px',
                color: acceptedTerms ? '#ffffff' : '#64748b',
                fontSize: '13px',
                fontWeight: 600,
                cursor: acceptedTerms ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (acceptedTerms) e.currentTarget.style.background = '#1a82cc';
              }}
              onMouseLeave={(e) => {
                if (acceptedTerms) e.currentTarget.style.background = '#2294e3';
              }}
            >
              Instalar
            </button>
          )}

          {step === 'installing' && (
            <button
              type="button"
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '4px',
                padding: '6px 18px',
                color: '#94a3b8',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.color = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              Cancelar
            </button>
          )}

          {step === 'finish' && (
            <button
              type="button"
              onClick={handlePlayNow}
              style={{
                background: '#2294e3',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 24px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1a82cc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#2294e3')}
            >
              Iniciar CrystalTides
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
