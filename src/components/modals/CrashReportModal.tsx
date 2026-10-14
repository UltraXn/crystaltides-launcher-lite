import React, { useState } from 'react';
import { AlertOctagon, Copy, Check, RefreshCw, X, FileText } from 'lucide-react';
import { LogViewerModal } from './LogViewerModal';

interface CrashReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onOpenOomAssistant?: () => void;
  crashReason?: string;
  crashDetails?: string;
  exitCode?: number;
  gameDir?: string;
  offendingMod?: string;
  suggestedAction?:
    | 'INCREASE_RAM'
    | 'DISABLE_MOD'
    | 'UPDATE_GPU_DRIVER'
    | 'RESET_OPTIONS'
    | 'UPDATE_JAVA'
    | 'VIEW_LOGS';
}

export const CrashReportModal: React.FC<CrashReportModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  onOpenOomAssistant,
  crashReason = 'Incompatibilidad de mods o fallo de memoria de Java',
  crashDetails = 'java.lang.OutOfMemoryError: Java heap space',
  exitCode = 1,
  gameDir,
  offendingMod,
  suggestedAction,
}) => {
  const [copied, setCopied] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFixMod = async () => {
    if (!gameDir || !offendingMod) return;
    setIsFixing(true);
    try {
      const { fixOffendingMod } = await import('../../services/crashDoctorService');
      const msg = await fixOffendingMod(gameDir, offendingMod);
      setActionFeedback(msg);
      setTimeout(() => {
        onRetry();
      }, 1000);
    } catch (err) {
      console.error('Error fixing offending mod:', err);
      setActionFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleResetOptions = async () => {
    if (!gameDir) return;
    setIsFixing(true);
    try {
      const { resetOptionsTxt } = await import('../../services/crashDoctorService');
      const msg = await resetOptionsTxt(gameDir);
      setActionFeedback(msg);
      setTimeout(() => {
        onRetry();
      }, 1000);
    } catch (err) {
      console.error('Error resetting options:', err);
      setActionFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleCopyReport = async () => {
    const report = `[CrystalTides Crash Report]\nMotivo: ${crashReason}\nCódigo de salida: ${exitCode}\nDetalles:\n${crashDetails}`;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Could not copy crash report:', e);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#16131B',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(244, 63, 94, 0.15)',
          color: '#F8FAFC',
          position: 'relative',
        }}
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar reporte de error"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(248, 250, 252, 0.5)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Encabezado del Crash */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid #F43F5E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertOctagon size={22} color="#F43F5E" />
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              El juego se cerró inesperadamente
            </h3>
            <span style={{ fontSize: '12px', color: 'rgba(248, 250, 252, 0.5)' }}>
              Código de salida: {exitCode}
            </span>
          </div>
        </div>

        {/* Diagnóstico en caliente */}
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#FDA4AF', marginBottom: '4px' }}>
            Causa detectada por Crash Doctor:
          </div>
          <div style={{ fontSize: '13px', color: '#F8FAFC' }}>{crashReason}</div>
        </div>

        {/* Feedback de acción rápida */}
        {actionFeedback && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              color: '#4ade80',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {actionFeedback}
          </div>
        )}

        {/* 1-Click Fix: Desactivar mod conflictivo */}
        {suggestedAction === 'DISABLE_MOD' && offendingMod && gameDir && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              disabled={isFixing}
              onClick={handleFixMod}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(249, 115, 22, 0.25) 100%)',
                border: '1px solid rgba(249, 115, 22, 0.5)',
                borderRadius: '10px',
                padding: '11px 14px',
                color: '#fdba74',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isFixing ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(249, 115, 22, 0.15)',
              }}
            >
              <span>🛡️ {isFixing ? 'Desactivando...' : `Desactivar "${offendingMod}" y Reintentar`}</span>
            </button>
          </div>
        )}

        {/* 1-Click Fix: Restablecer options.txt */}
        {suggestedAction === 'RESET_OPTIONS' && gameDir && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              disabled={isFixing}
              onClick={handleResetOptions}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 179, 8, 0.25) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                borderRadius: '10px',
                padding: '11px 14px',
                color: '#fde047',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isFixing ? 'not-allowed' : 'pointer',
              }}
            >
              <span>⚙️ {isFixing ? 'Restableciendo...' : 'Restablecer options.txt y Reintentar'}</span>
            </button>
          </div>
        )}

        {/* Botón especial si es Out of Memory */}
        {(suggestedAction === 'INCREASE_RAM' ||
          exitCode === 137 ||
          /out of memory|heap space|could not reserve/i.test(crashReason + ' ' + (crashDetails || ''))) &&
          onOpenOomAssistant && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOomAssistant();
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(99, 102, 241, 0.2) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(56, 189, 248, 0.15)',
                }}
              >
                <span>☁️ Solucionar Falta de RAM (La Nubecita)</span>
              </button>
            </div>
          )}

        {/* Consola resumida de error */}
        <div style={{ marginBottom: '20px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(248, 250, 252, 0.5)',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            Detalle del error:
          </span>
          <pre
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#FCA5A5',
              maxHeight: '120px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: '6px 0 0 0',
            }}
          >
            {crashDetails}
          </pre>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onRetry}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#0A090E',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Reintentar
          </button>
          <button
            onClick={handleCopyReport}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#F8FAFC',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={14} color="#2DD4BF" /> : <Copy size={14} />}
            {copied ? "¡Copiado!" : "Copiar reporte"}
          </button>
          <button
            onClick={() => setIsLogViewerOpen(true)}
            title="Ver registros detallados de Minecraft"
            style={{
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              color: "#38bdf8",
              fontSize: "13px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
          >
            <FileText size={14} />
            Ver Registros
          </button>
        </div>
      </div>
    </div>

    {isLogViewerOpen && (
      <LogViewerModal
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
        defaultTab="minecraft"
      />
    )}
  </>
);
};
