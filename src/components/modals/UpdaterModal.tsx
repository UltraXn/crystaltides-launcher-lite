import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import { AppUpdateInfo, applyAppUpdate, fetchRemoteReleaseNotes } from '../../services/updateService';
import logoImg from '../../assets/logo.webp';

interface UpdaterModalProps {
  updateInfo: AppUpdateInfo;
  onClose: () => void;
}

interface ParsedNoteLine {
  key: string;
  line: string;
  trimmed: string;
  isFirst: boolean;
}

const parseReleaseLines = (text: string): ParsedNoteLine[] => {
  const counts: Record<string, number> = {};
  const rawLines = text.split('\n');
  return rawLines.map((rawLine, index) => {
    const trimmed = rawLine.trim();
    const count = (counts[trimmed] ?? 0) + 1;
    counts[trimmed] = count;
    return {
      key: `note-${index}-${trimmed.slice(0, 12)}-${count}`,
      line: rawLine,
      trimmed,
      isFirst: index === 0,
    };
  });
};

const renderFormattedNotes = (rawText: string) => {
  const items = parseReleaseLines(rawText);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item) => {
        if (!item.trimmed) {
          return <div key={item.key} style={{ height: '4px' }} />;
        }
        if (item.trimmed.startsWith('#')) {
          const headerText = item.trimmed.replace(/^#+\s*/, '');
          return (
            <div
              key={item.key}
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#2DD4BF',
                marginTop: item.isFirst ? '0' : '6px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {headerText}
            </div>
          );
        }
        if (item.trimmed.startsWith('•') || item.trimmed.startsWith('-') || item.trimmed.startsWith('*')) {
          const bulletText = item.trimmed.replace(/^[•\-*]\s*/, '');
          return (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.88)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ color: '#2DD4BF', fontSize: '14px', lineHeight: '14px', marginTop: '1px' }}>•</span>
              <span style={{ flex: 1 }}>{bulletText}</span>
            </div>
          );
        }
        return (
          <div key={item.key} style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.45 }}>
            {item.line}
          </div>
        );
      })}
    </div>
  );
};

export const UpdaterModal: React.FC<UpdaterModalProps> = ({ updateInfo, onClose }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(updateInfo.body ?? null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  useEffect(() => {
    // Si ya contamos con notas detalladas en latest.json que no sean el mensaje por defecto
    const isGenericDefault = !updateInfo.body || updateInfo.body.trim().toLowerCase().startsWith('actualización de crystaltides launcher');
    if (!isGenericDefault && updateInfo.body) {
      setReleaseNotes(updateInfo.body);
      return;
    }

    const versionTag = updateInfo.version ? `v${updateInfo.version.replace(/^v/, '')}` : null;
    if (!versionTag) return;

    let isMounted = true;
    setLoadingNotes(true);

    void fetchRemoteReleaseNotes(versionTag)
      .then((notes) => {
        if (isMounted && notes && notes.length > 0) {
          setReleaseNotes(notes);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingNotes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [updateInfo.body, updateInfo.version]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    setErrorMsg(null);
    try {
      await applyAppUpdate();
    } catch (err: unknown) {
      console.error('[UpdaterModal] Failed to install update:', err);
      const msg = err instanceof Error ? err.message : 'Error al descargar la actualización.';
      setErrorMsg(msg);
      setIsUpdating(false);
    }
  };

  const defaultFallbackNotes =
    '• Corrección en cálculo y posicionamiento de botones del dock\n• Importación automática de RAM, argumentos JVM y resolución\n• Optimización de rendimiento e interfaz gráfica';

  return (
    <div className="papyrus-modal-overlay">
      <dialog
        open
        className="papyrus-updater-card"
        aria-labelledby="updater-title"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'radial-gradient(ellipse at top, #1A1924 0%, #0E0D14 100%)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(45, 212, 191, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative',
          color: '#F8FAFC',
          zIndex: 1000,
        }}
      >
        {/* Close Button */}
        {!isUpdating && (
          <button
            type="button"
            onClick={onClose}
            className="settings-card-close"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
            }}
            title="Cerrar"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        )}

        {/* Header Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(45, 212, 191, 0.15)',
            }}
          >
            <img
              src={logoImg}
              alt="CrystalTides Logo"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 6px rgba(45, 212, 191, 0.35))',
              }}
            />
          </div>
          <div>
            <h2 id="updater-title" style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFF' }}>
              Actualización Disponible
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>v{updateInfo.currentVersion}</span>
              <span style={{ fontSize: '11px', color: '#2DD4BF' }}>➔</span>
              <span style={{ fontSize: '12px', color: '#2DD4BF', fontWeight: 700 }}>
                v{updateInfo.version ?? 'Nueva'}
              </span>
            </div>
          </div>
        </div>

        {/* Release Notes */}
        <div
          style={{
            maxHeight: '160px',
            overflowY: 'auto',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.5,
          }}
        >
          {loadingNotes ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94A3B8' }}>
              <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
              <span>Cargando notas de la versión...</span>
            </div>
          ) : (
            renderFormattedNotes(releaseNotes ?? defaultFallbackNotes)
          )}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              fontSize: '12px',
              color: '#F87171',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '10px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Updating Status */}
        {isUpdating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2DD4BF', fontSize: '12px', fontWeight: 600 }}>
            <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1.2s linear infinite' }} />
            <span>Descargando e instalando paquete autónomo...</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          {!isUpdating && (
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#CBD5E1',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Más tarde
            </button>
          )}

          <button
            type="button"
            disabled={isUpdating}
            onClick={handleUpdate}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              background: isUpdating
                ? 'rgba(45, 212, 191, 0.25)'
                : 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)',
              border: 'none',
              color: '#052A26',
              fontSize: '13px',
              fontWeight: 800,
              cursor: isUpdating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(45, 212, 191, 0.3)',
            }}
          >
            {isUpdating ? (
              <>
                <RefreshCw style={{ width: '15px', height: '15px', animation: 'spin 1.2s linear infinite' }} />
                <span>Instalando...</span>
              </>
            ) : (
              <>
                <Download style={{ width: '15px', height: '15px' }} />
                <span>Actualizar Ahora</span>
              </>
            )}
          </button>
        </div>
      </dialog>
    </div>
  );
};
