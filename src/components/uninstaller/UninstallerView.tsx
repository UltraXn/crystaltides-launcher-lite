import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import logoImg from '../../assets/logo.png';
import { Minus, X, Trash2, CheckCircle2 } from 'lucide-react';
import { AmbientBubbles } from '../common/AmbientBubbles';

interface UninstallerViewProps {
  installDir: string;
}

export const UninstallerView: React.FC<UninstallerViewProps> = ({ installDir }) => {
  const [step, setStep] = useState<'confirm' | 'uninstalling' | 'finish'>('confirm');
  const [keepUserData, setKeepUserData] = useState(true);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Iniciando desinstalación...');

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

  const handleStartUninstall = async () => {
    setStep('uninstalling');
    setProgress(0.2);
    setStatusText('Cerrando procesos y eliminando accesos directos...');

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProgress(0.5);
      setStatusText('Eliminando registros de Windows y entradas del sistema...');

      await invoke('perform_self_uninstall', {
        targetDir: installDir,
        removeUserData: !keepUserData,
      });

      setProgress(0.85);
      setStatusText('Limpiando archivos de ejecución y temporales...');

      await invoke('schedule_self_deletion', {
        targetDir: installDir,
      });

      await new Promise((r) => setTimeout(r, 600));
      setProgress(1.0);
      setStatusText('Desinstalación completada con éxito.');
      setStep('finish');
    } catch (err) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        console.error('Error durante la desinstalación en Tauri:', err);
        setStatusText(`Error en la desinstalación: ${String(err)}`);
        setStep('confirm');
        return;
      }
      console.warn('Simulación suave de desinstalación en navegador:', err);
      setProgress(0.5);
      setStatusText('Eliminando registros de Windows y entradas del sistema...');
      await new Promise((r) => setTimeout(r, 1200));
      setProgress(0.85);
      setStatusText('Limpiando archivos de ejecución y temporales...');
      await new Promise((r) => setTimeout(r, 1000));
      setProgress(1.0);
      setStatusText('Desinstalación completada con éxito.');
      setStep('finish');
    }
  };

  const handleMinimize = async () => {
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().minimize();
    } catch {}
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

      {/* BARRA SUPERIOR DISCRETA */}
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
            CrystalTides Desinstalador
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            type="button"
            onClick={handleMinimize}
            aria-label="Minimizar"
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
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
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
              e.currentTarget.style.background = '#e11d48';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: '0 28px',
          justifyContent: 'center',
        }}
      >
        {/* PASO 1: CONFIRMAR */}
        {step === 'confirm' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(244, 63, 94, 0.12)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 0 20px rgba(244, 63, 94, 0.2)',
              }}
            >
              <Trash2 size={26} color="#f43f5e" />
            </div>

            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '6px',
              }}
            >
              ¿Desinstalar CrystalTides Launcher?
            </div>

            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                maxWidth: '420px',
                lineHeight: '1.45',
                marginBottom: '18px',
              }}
            >
              Esta acción removerá el lanzador, sus accesos directos de escritorio y registros de
              Windows.
            </div>

            {/* Caja de Ubicación */}
            <div
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#13151b',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                fontSize: '12px',
              }}
            >
              <span style={{ color: '#64748b' }}>Ubicación:</span>
              <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{installDir}</span>
            </div>

            {/* Checkbox Conservar Datos */}
            <label
              htmlFor="keep-user-data-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#cbd5e1',
                maxWidth: '420px',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <input
                id="keep-user-data-checkbox"
                type="checkbox"
                checked={keepUserData}
                onChange={(e) => setKeepUserData(e.target.checked)}
                style={{
                  accentColor: '#2294e3',
                  width: '15px',
                  height: '15px',
                  cursor: 'pointer',
                }}
              />
              <span>Conservar partidas guardadas, capturas y perfiles descargados</span>
            </label>
          </div>
        )}

        {/* PASO 2: DESINSTALANDO */}
        {step === 'uninstalling' && (
          <div
            style={{
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
                marginBottom: '24px',
              }}
            >
              Desinstalando CrystalTides
            </div>

            <div
              style={{
                width: '100%',
                height: '3px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(progress * 100)}%`,
                  background: 'linear-gradient(90deg, #f43f5e 0%, #fb7185 100%)',
                  boxShadow: '0 0 12px rgba(244, 63, 94, 0.8)',
                  transition: 'width 0.35s ease',
                }}
              />
            </div>

            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{statusText}</div>
          </div>
        )}

        {/* PASO 3: COMPLETADO */}
        {step === 'finish' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              animation: 'fadeIn 0.25s ease',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(34, 148, 227, 0.12)',
                border: '1px solid rgba(34, 148, 227, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 0 20px rgba(34, 148, 227, 0.2)',
              }}
            >
              <CheckCircle2 size={30} color="#2294e3" />
            </div>

            <div
              style={{
                fontSize: '17px',
                fontWeight: 700,
                color: '#f8fafc',
                marginBottom: '6px',
              }}
            >
              Desinstalación completada
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                maxWidth: '380px',
                lineHeight: '1.4',
              }}
            >
              CrystalTides ha sido eliminado de tu equipo. Esperamos verte pronto en los servidores.
            </div>
          </div>
        )}
      </div>

      {/* SEPARADOR INFERIOR DISCRETO */}
      <div
        style={{
          width: '100%',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.08)',
        }}
      />

      {/* BARRA INFERIOR DE ACCIÓN */}
      <div
        style={{
          height: '54px',
          minHeight: '54px',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
        }}
      >
        {step === 'confirm' && (
          <button
            type="button"
            onClick={handleClose}
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
            Cancelar
          </button>
        )}

        {step !== 'confirm' && <div />}

        <div>
          {step === 'confirm' && (
            <button
              type="button"
              onClick={handleStartUninstall}
              style={{
                background: '#e11d48',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 24px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#be123c')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#e11d48')}
            >
              Desinstalar
            </button>
          )}

          {step === 'finish' && (
            <button
              type="button"
              onClick={handleClose}
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
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
