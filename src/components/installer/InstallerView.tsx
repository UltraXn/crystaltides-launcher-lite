import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight, Play, CheckCircle2, HardDrive, Sparkles } from 'lucide-react';
import { AmbientBubbles } from '../common/AmbientBubbles';

interface InstallerViewProps {
  defaultInstallDir: string;
  onLaunchMain: () => void;
}

export const InstallerView: React.FC<InstallerViewProps> = ({
  defaultInstallDir,
  onLaunchMain,
}) => {
  const [step, setStep] = useState<'welcome' | 'installing' | 'finish'>('welcome');
  const [installPath, setInstallPath] = useState(defaultInstallDir.replace(/\\/g, '/'));
  const [createDesktopShortcut, setCreateDesktopShortcut] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Preparando instalación...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartInstall = async () => {
    setStep('installing');
    setProgress(0.15);
    setStatusText('Creando estructura de archivos aislada...');
    setErrorMessage(null);

    try {
      await new Promise((r) => setTimeout(r, 500));
      setProgress(0.45);
      setStatusText('Copiando binario a la carpeta de usuario...');

      await invoke('perform_self_install', { targetDir: installPath });

      setProgress(0.8);
      setStatusText('Registrando accesos directos y configuración del sistema...');

      await new Promise((r) => setTimeout(r, 600));
      setProgress(1.0);
      setStatusText('¡Instalación completada con éxito!');
      setStep('finish');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStatusText('Ocurrió un error durante la instalación.');
    }
  };

  const handlePlayNow = async () => {
    try {
      await invoke('launch_installed_app', { targetDir: installPath });
      try {
        await invoke('close_app');
      } catch {
        onLaunchMain();
      }
    } catch (err: unknown) {
      console.warn('Could not spawn new process, switching view in-place:', err);
      onLaunchMain();
    }
  };

  const handleClose = async () => {
    try {
      await invoke('close_app');
    } catch (e) {
      console.warn('Could not close window:', e);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: 'radial-gradient(ellipse at top, #14131B 0%, #0A090E 100%)',
        color: '#F8FAFC',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      <AmbientBubbles count={20} />

      {/* Barra de título */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '38px',
          padding: '0 16px',
          background: 'rgba(15, 14, 20, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#2DD4BF',
              boxShadow: '0 0 8px #2DD4BF',
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: 'rgba(248, 250, 252, 0.6)',
              textTransform: 'uppercase',
            }}
          >
            CrystalTides Launcher · Papyrus Edition (Asistente de Instalación)
          </span>
        </div>
      </div>

      {/* Contenido principal */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {step === 'welcome' && (
          <div style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '20px',
                background:
                  'linear-gradient(135deg, rgba(45, 212, 191, 0.25), rgba(14, 165, 233, 0.1))',
                border: '1px solid rgba(45, 212, 191, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                boxShadow: '0 8px 32px rgba(45, 212, 191, 0.15)',
              }}
            >
              <Sparkles size={32} color="#2DD4BF" />
            </div>

            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.5px',
                margin: '0 0 8px 0',
              }}
            >
              Bienvenido a CrystalTides
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(248, 250, 252, 0.65)',
                margin: '0 0 28px 0',
                lineHeight: '1.5',
              }}
            >
              Instala el lanzador de alto rendimiento para Minecraft en tu computadora con soporte
              integrado para mods y servidores.
            </p>

            {/* Input de carpeta */}
            <div style={{ textAlign: 'left', marginBottom: '20px' }}>
              <label
                htmlFor="lite-install-path"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(248, 250, 252, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                }}
              >
                <HardDrive size={14} color="#2DD4BF" /> Ruta de instalación:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="lite-install-path"
                  type="text"
                  value={installPath}
                  onChange={(e) => setInstallPath(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#F8FAFC',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Checkbox */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '32px',
                textAlign: 'left',
              }}
            >
              <input
                type="checkbox"
                id="shortcut"
                checked={createDesktopShortcut}
                onChange={(e) => setCreateDesktopShortcut(e.target.checked)}
                style={{ accentColor: '#2DD4BF', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label
                htmlFor="shortcut"
                style={{ fontSize: '12px', color: 'rgba(248, 250, 252, 0.7)', cursor: 'pointer' }}
              >
                Crear acceso directo en el Escritorio y Menú Inicio
              </label>
            </div>

            {/* Botón de instalación */}
            <button
              onClick={handleStartInstall}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 24px',
                color: '#0A090E',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(45, 212, 191, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              Comenzar Instalación <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 'installing' && (
          <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Instalando CrystalTides Launcher
            </h2>
            <p
              style={{ fontSize: '13px', color: 'rgba(248, 250, 252, 0.6)', margin: '0 0 24px 0' }}
            >
              {statusText}
            </p>

            {/* Barra de progreso */}
            <div
              style={{
                width: '100%',
                height: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '12px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress * 100}%`,
                  background: 'linear-gradient(90deg, #2DD4BF, #0EA5E9)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease-out',
                  boxShadow: '0 0 12px rgba(45, 212, 191, 0.6)',
                }}
              />
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.45)', fontWeight: 600 }}>
              {Math.round(progress * 100)}%
            </div>

            {errorMessage && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#FCA5A5',
                  fontSize: '12px',
                }}
              >
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {step === 'finish' && (
          <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(45, 212, 191, 0.15)',
                border: '1px solid #2DD4BF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px auto',
                boxShadow: '0 0 24px rgba(45, 212, 191, 0.25)',
              }}
            >
              <CheckCircle2 size={32} color="#2DD4BF" />
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0' }}>
              ¡Instalación Completada!
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: 'rgba(248, 250, 252, 0.65)',
                margin: '0 0 32px 0',
                lineHeight: '1.5',
              }}
            >
              CrystalTides Launcher está listo para usarse. Puedes iniciarlo de inmediato o acceder
              desde el acceso directo de tu escritorio.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePlayNow}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  color: '#0A090E',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(45, 212, 191, 0.3)',
                }}
              >
                <Play size={16} fill="#0A090E" /> Jugar Ahora
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
