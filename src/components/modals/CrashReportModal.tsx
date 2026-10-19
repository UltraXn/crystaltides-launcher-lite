import React, { useState, Suspense } from 'react';
import {
  AlertOctagon,
  Copy,
  Check,
  RefreshCw,
  X,
  FileText,
  Activity,
  RotateCcw,
  ShieldAlert,
  CloudLightning,
  Send,
} from 'lucide-react';
import { useLauncherStore } from '../../store/launcherStore';
import { translations, type TranslationDictionary } from '../../i18n';
import { CrashDiagnosis } from '../../services/crashDoctorService';

const LogViewerModal = React.lazy(() =>
  import('./LogViewerModal').then((m) => ({ default: m.LogViewerModal }))
);

type TelemetryStatus = 'idle' | 'sending' | 'sent' | 'error';

const TELEMETRY_ICONS: Record<TelemetryStatus, React.ReactNode> = {
  idle: <Send size={14} />,
  sending: <RefreshCw size={14} className="crash-spin" />,
  sent: <Check size={14} color="#34d399" />,
  error: <AlertOctagon size={14} color="#fb7185" />,
};

interface CrashTelemetryButtonProps {
  diagnosis: CrashDiagnosis;
  exitCode: number;
  t: TranslationDictionary['crashModal'];
}

/** Envía el diagnóstico sanitizado solo cuando el usuario pulsa el botón. */
const CrashTelemetryButton: React.FC<CrashTelemetryButtonProps> = ({ diagnosis, exitCode, t }) => {
  const [status, setStatus] = useState<TelemetryStatus>('idle');
  const labels: Record<TelemetryStatus, string> = {
    idle: t.sendReport,
    sending: t.sendingReport,
    sent: t.reportSent,
    error: t.reportFailed,
  };

  const handleSend = async () => {
    setStatus('sending');
    const ok = await import('../../services/crashDoctorService')
      .then((m) => m.submitCrashTelemetry(diagnosis, exitCode))
      .catch(() => false);
    if (ok) {
      setStatus('sent');
      return;
    }
    setStatus('error');
    setTimeout(() => setStatus('idle'), 3000);
  };

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={status === 'sending' || status === 'sent'}
      title={t.sendReportTooltip}
      className="crash-btn-secondary"
    >
      {TELEMETRY_ICONS[status]}
      <span>{labels[status]}</span>
    </button>
  );
};

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
  suggestedAction?: CrashDiagnosis['suggested_action'];
  crashType?: CrashDiagnosis['crash_type'];
}

export const CrashReportModal: React.FC<CrashReportModalProps> = ({
  isOpen,
  onClose,
  onRetry,
  onOpenOomAssistant,
  crashReason,
  crashDetails,
  exitCode = 1,
  gameDir,
  offendingMod,
  suggestedAction,
  crashType = 'GENERIC_CRASH',
}) => {
  const language = useLauncherStore((s) => s.language);
  const t = translations[language].crashModal;

  const effectiveReason = crashReason || t.defaultReason;
  const effectiveDetails = crashDetails || t.defaultDetails;

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
    const report = `${t.reportHeader}\n${t.reportReason}: ${effectiveReason}\n${t.reportExitCode}: ${exitCode}\n${t.reportDetails}:\n${effectiveDetails}`;
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
      <div className="crash-modal-overlay">
        <div
          className="crash-modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crash-dialog-title"
        >
          {/* Botón cerrar */}
          <button
            type="button"
            onClick={onClose}
            className="crash-modal-close-btn"
            aria-label={t.closeAria}
          >
            <X size={16} />
          </button>

          {/* Encabezado del Crash */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="crash-icon-box">
              <AlertOctagon size={22} color="#fb7185" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3
                id="crash-dialog-title"
                style={{
                  fontSize: '16.5px',
                  fontWeight: 700,
                  margin: '0 0 5px 0',
                  color: '#f8fafc',
                  letterSpacing: '-0.015em',
                }}
              >
                {t.title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="crash-exit-badge">
                  <span className="crash-exit-dot" />
                  {t.exitCodeBadge.replace('{code}', String(exitCode))}
                </span>
              </div>
            </div>
          </div>

          {/* Diagnóstico en caliente (Crash Doctor) */}
          <div className="crash-diagnosis-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Activity size={13} color="#fda4af" />
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#fda4af',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {t.doctorBadge}
              </span>
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.45, color: '#f1f5f9', fontWeight: 500 }}>
              {effectiveReason}
            </div>
          </div>

          {/* Feedback de acción rápida */}
          {actionFeedback && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Check size={14} />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* 1-Click Fix: Desactivar mod conflictivo */}
          {suggestedAction === 'DISABLE_MOD' && offendingMod && gameDir && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                disabled={isFixing}
                onClick={handleFixMod}
                className="crash-fix-btn crash-fix-mod"
              >
                <ShieldAlert size={15} />
                <span>
                  {isFixing
                    ? t.disablingMod
                    : t.disableModAction.replace('{mod}', offendingMod)}
                </span>
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
                className="crash-fix-btn crash-fix-options"
              >
                <RotateCcw size={15} className={isFixing ? 'crash-spin' : ''} />
                <span>{isFixing ? t.resettingOptions : t.resetOptionsAction}</span>
              </button>
            </div>
          )}

          {/* Botón especial si es Out of Memory */}
          {(suggestedAction === 'INCREASE_RAM' ||
            exitCode === 137 ||
            /out of memory|heap space|could not reserve/i.test(
              effectiveReason + ' ' + effectiveDetails,
            )) &&
            onOpenOomAssistant && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenOomAssistant();
                  }}
                  className="crash-fix-btn crash-fix-oom"
                >
                  <CloudLightning size={15} />
                  <span>{t.fixOomAssistant}</span>
                </button>
              </div>
            )}

          {/* Consola resumida de error con cabecera de terminal */}
          <div className="crash-terminal-container">
            <div className="crash-terminal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="crash-terminal-dots">
                  <span className="crash-terminal-dot" style={{ background: 'rgba(244, 63, 94, 0.7)' }} />
                  <span className="crash-terminal-dot" style={{ background: 'rgba(234, 179, 8, 0.7)' }} />
                  <span className="crash-terminal-dot" style={{ background: 'rgba(34, 197, 94, 0.7)' }} />
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: '#94a3b8',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  {t.stackTraceHeader}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReport}
                className="crash-terminal-copy-btn"
                title={t.copyReport}
              >
                {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
            </div>
            <pre className="crash-terminal-body">{effectiveDetails}</pre>
          </div>

          {/* Acciones principales */}
          <div className="crash-actions-row">
            <button type="button" onClick={onRetry} className="crash-btn-primary">
              <RefreshCw size={14} className={isFixing ? 'crash-spin' : ''} />
              <span>{t.retry}</span>
            </button>
            <button type="button" onClick={handleCopyReport} className="crash-btn-secondary">
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
              <span>{copied ? t.reportCopied : t.copyReport}</span>
            </button>
            <CrashTelemetryButton
              diagnosis={{
                crash_type: crashType,
                title: effectiveReason,
                explanation: effectiveDetails,
                offending_mod: offendingMod,
                recommendation: '',
                suggested_action: suggestedAction,
                log_snippet: effectiveDetails,
              }}
              exitCode={exitCode}
              t={t}
            />
            <button
              type="button"
              onClick={() => setIsLogViewerOpen(true)}
              title={t.viewLogsTooltip}
              className="crash-btn-tertiary"
            >
              <FileText size={14} />
              <span>{t.viewLogs}</span>
            </button>
          </div>
        </div>
      </div>

      {isLogViewerOpen && (
        <Suspense fallback={null}>
          <LogViewerModal
            isOpen={isLogViewerOpen}
            onClose={() => setIsLogViewerOpen(false)}
            defaultTab="minecraft"
          />
        </Suspense>
      )}
    </>
  );
};
