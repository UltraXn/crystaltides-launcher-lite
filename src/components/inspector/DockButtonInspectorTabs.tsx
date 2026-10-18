import React from 'react';
import {
  Upload,
  Columns,
  Check,
  RotateCcw,
  Video,
  EyeOff,
  Sparkles,
  Activity,
  Tv,
  Layers,
  Flame,
  Ban,
  Trash2,
} from 'lucide-react';
import {
  launcherActions,
  useT,
  type DockButtonId,
  type DockButtonEffect,
  type DockButtonCustomization,
  type LauncherState,
} from '../../store/launcherStore';
import {
  saveDockPanoramaFile,
  clearButtonMedia,
  clearDockPanorama,
} from '../../utils/wallpaperStorage';
import { DockBackgroundAdjuster } from '../hud/DockBackgroundAdjuster';

export const COLOR_PRESETS = [
  { label: 'Grafito', value: 'rgba(18, 22, 30, 0.92)' },
  { label: 'Titanio', value: 'rgba(38, 44, 58, 0.75)' },
  { label: 'Pizarra', value: 'rgba(51, 65, 85, 0.65)' },
  { label: 'Bruma', value: 'rgba(30, 41, 59, 0.85)' },
  { label: 'Ámbar', value: 'rgba(68, 44, 28, 0.75)' },
  { label: 'Obsidiana', value: 'rgba(8, 10, 15, 0.95)' },
];

export const EFFECT_OPTIONS: { id: DockButtonEffect; label: string; icon: React.ReactNode }[] = [
  { id: 'none', label: 'Ninguno', icon: <Ban size={13} /> },
  { id: 'rainbow_rgb', label: 'Chroma RGB', icon: <Sparkles size={13} /> },
  { id: 'neon_pulse', label: 'Pulso Luminoso', icon: <Activity size={13} /> },
  { id: 'glitch', label: 'Glitch Digital', icon: <Tv size={13} /> },
  { id: 'hologram', label: 'Holograma', icon: <Layers size={13} /> },
  { id: 'fire', label: 'Fuego Cálido', icon: <Flame size={13} /> },
];

// ─────────────────────────────────────────────────────────────
// TAB 1: FONDO & MEDIOS LOCALES (PC UPLOAD)
// ─────────────────────────────────────────────────────────────
interface BgTabProps {
  buttonId: DockButtonId;
  customization: DockButtonCustomization;
  dockConfig: LauncherState['dockConfig'];
  hasDockPanorama: boolean;
  isParticipant: boolean;
  bgFileInputRef: React.RefObject<HTMLInputElement | null>;
  dockBgInputRef: React.RefObject<HTMLInputElement | null>;
  setUploadStatus: React.Dispatch<React.SetStateAction<string | null>>;
}

export const DockButtonInspectorBgTab: React.FC<BgTabProps> = ({
  buttonId,
  customization,
  dockConfig,
  hasDockPanorama,
  isParticipant,
  bgFileInputRef,
  dockBgInputRef,
  setUploadStatus,
}) => {
  const t = useT();
  const handleDockBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setUploadStatus('Cargando fondo de barra...');
      const res = await saveDockPanoramaFile(file);
      launcherActions.setDockBackground(res.isVideo ? 'video' : 'image', res.url);
      if (dockConfig.panoramaButtons && !dockConfig.panoramaButtons.includes(buttonId)) {
        launcherActions.togglePanoramaButton(buttonId);
      }
      setUploadStatus('¡Fondo de barra activo!');
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Error saving dock panorama:', err);
      setUploadStatus('Error al cargar');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '8px' }}>
      <input
        ref={dockBgInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleDockBgUpload}
      />

      <button
        type="button"
        onClick={() => bgFileInputRef.current?.click()}
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '10px',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#f8fafc',
          fontWeight: 600,
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.15s ease',
        }}
      >
        <Upload size={14} style={{ color: '#cbd5e1' }} />
        <span>Subir Fondo Solo Para Este Botón</span>
      </button>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.035)',
          border: '1px solid rgba(255, 255, 255, 0.09)',
          borderRadius: '10px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Columns size={13} style={{ color: '#cbd5e1' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9' }}>
              Pantalla Compartida (Fondo de Barra)
            </span>
          </div>
          {hasDockPanorama && (
            <span
              style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              {dockConfig.dockBgType === 'video' ? 'Vídeo' : 'Imagen'}
            </span>
          )}
        </div>

        <p
          style={{
            fontSize: '9.5px',
            color: 'rgba(255, 255, 255, 0.6)',
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          Divide una sola imagen continua entre varios botones como un monitor múltiple.
        </p>

        {hasDockPanorama ? (
          <>
            <button
              type="button"
              onClick={() => launcherActions.togglePanoramaButton(buttonId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: '7px',
                background: isParticipant
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isParticipant
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                color: isParticipant ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Usar fondo panorámico compartido</span>
              {isParticipant ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#4ade80',
                  }}
                >
                  <Check size={12} /> Activo
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#64748b' }}>Inactivo</span>
              )}
            </button>
            <DockBackgroundAdjuster />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginTop: '4px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (dockBgInputRef.current) {
                    dockBgInputRef.current.value = '';
                    dockBgInputRef.current.click();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 8px',
                  borderRadius: '7px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Upload size={12} />
                <span>Cambiar Fondo</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setUploadStatus('Eliminando fondo...');
                    await clearDockPanorama();
                    launcherActions.clearDockBackground();
                    launcherActions.resetDockBackgroundTransform();
                    setUploadStatus('¡Fondo eliminado!');
                    setTimeout(() => setUploadStatus(null), 2000);
                  } catch (err) {
                    console.error('Error clearing dock panorama:', err);
                    setUploadStatus('Error al eliminar');
                    setTimeout(() => setUploadStatus(null), 3000);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 8px',
                  borderRadius: '7px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={12} />
                <span>Quitar Fondo de Barra</span>
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (dockBgInputRef.current) {
                dockBgInputRef.current.value = '';
                dockBgInputRef.current.click();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 10px',
              borderRadius: '7px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.2)',
              color: '#e2e8f0',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={12} />
            <span>Colocar imagen completa en la barra</span>
          </button>
        )}
      </div>

      <div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
          Color o tinte del fondo:
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {COLOR_PRESETS.map((p) => {
            const isSelected = customization.bgColor === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  launcherActions.setDockButtonCustomization(buttonId, {
                    bgType: 'color',
                    bgColor: p.value,
                    bgImage: undefined,
                    bgVideo: undefined,
                  });
                }}
                style={{
                  background: p.value,
                  border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '10px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: isSelected ? '0 0 10px rgba(255, 255, 255, 0.3)' : 'none',
                }}
              >
                {isSelected && <Check size={10} />}
                <span>{p.label}</span>
              </button>
            );
          })}
          <label
            htmlFor={`dock-custom-color-${buttonId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '3px 6px',
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: '10px',
              gap: '4px',
              color: '#e2e8f0',
            }}
          >
            <span>Otro</span>
            <input
              id={`dock-custom-color-${buttonId}`}
              type="color"
              aria-label={t.hudEditor.customBgColor}
              value={
                /^#[0-9A-Fa-f]{6}$/.test(customization.bgColor ?? '')
                  ? customization.bgColor
                  : '#1e293b'
              }
              style={{
                width: '16px',
                height: '16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
              onChange={(e) => {
                launcherActions.setDockButtonCustomization(buttonId, {
                  bgType: 'color',
                  bgColor: e.target.value,
                });
              }}
            />
          </label>
        </div>
      </div>

      {customization.bgType === 'video' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '4px',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Video size={11} /> Opacidad de Vídeo:
            </span>
            <span>{Math.round((customization.bgVideoOpacity ?? 0.85) * 100)}%</span>
          </div>
          <input
            type="range"
            aria-label={t.hudEditor.videoOpacity}
            min="0.1"
            max="1"
            step="0.05"
            value={customization.bgVideoOpacity ?? 0.85}
            onChange={(e) => {
              launcherActions.setDockButtonCustomization(buttonId, {
                bgVideoOpacity: Number.parseFloat(e.target.value),
              });
            }}
            style={{ width: '100%', accentColor: '#cbd5e1' }}
          />
        </div>
      )}

      {(customization.bgImage || customization.bgVideo || customization.bgColor) && (
        <button
          type="button"
          onClick={async () => {
            await clearButtonMedia(buttonId, false);
            launcherActions.setDockButtonCustomization(buttonId, {
              bgType: 'default',
              bgImage: undefined,
              bgVideo: undefined,
              bgColor: undefined,
            });
          }}
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: '8px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            flexShrink: 0,
            width: '100%',
          }}
        >
          <RotateCcw size={12} />
          <span>Quitar Fondo Personalizado</span>
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TAB 2: ICONO & SVG
// ─────────────────────────────────────────────────────────────
interface IconTabProps {
  buttonId: DockButtonId;
  customization: DockButtonCustomization;
  iconFileInputRef: React.RefObject<HTMLInputElement | null>;
}

export const DockButtonInspectorIconTab: React.FC<IconTabProps> = ({
  buttonId,
  customization,
  iconFileInputRef,
}) => {
  const t = useT();
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
    <button
      type="button"
      onClick={() => iconFileInputRef.current?.click()}
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '10px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        color: '#f8fafc',
        fontWeight: 600,
        fontSize: '11px',
        cursor: 'pointer',
      }}
    >
      <Upload size={14} style={{ color: '#cbd5e1' }} />
      <span>Subir Icono / SVG propio de mi PC</span>
    </button>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
      <button
        type="button"
        onClick={() => {
          launcherActions.setDockButtonCustomization(buttonId, {
            iconType: customization.iconType === 'none' ? 'default' : 'none',
          });
        }}
        style={{
          background:
            customization.iconType === 'none'
              ? 'rgba(245, 158, 11, 0.15)'
              : 'rgba(255, 255, 255, 0.05)',
          border:
            customization.iconType === 'none'
              ? '1px solid rgba(245, 158, 11, 0.4)'
              : '1px solid rgba(255, 255, 255, 0.1)',
          color: customization.iconType === 'none' ? '#fbbf24' : '#cbd5e1',
          borderRadius: '8px',
          padding: '6px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        <EyeOff size={13} />
        <span>{customization.iconType === 'none' ? 'Icono Oculto' : 'Ocultar Icono'}</span>
      </button>

      <button
        type="button"
        onClick={async () => {
          await clearButtonMedia(buttonId, true);
          launcherActions.setDockButtonCustomization(buttonId, {
            iconType: 'default',
            customIconUrl: undefined,
            customSvg: undefined,
          });
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#94a3b8',
          borderRadius: '8px',
          padding: '6px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        <RotateCcw size={12} />
        <span>SVG Original</span>
      </button>
    </div>

    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#94a3b8',
          marginBottom: '4px',
        }}
      >
        <span>Escala del Icono:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{(customization.iconScale ?? 1).toFixed(2)}x</span>
          {customization.iconScale !== undefined && customization.iconScale !== 1 && (
            <button
              type="button"
              onClick={() => {
                launcherActions.setDockButtonCustomization(buttonId, { iconScale: 1.0 });
              }}
              title="Restablecer a 1.0x"
              aria-label="Restablecer escala a 1.0x"
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <RotateCcw size={10} />
              <span>1.0x</span>
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        aria-label={t.hudEditor.iconScale}
        min="0.5"
        max="5.0"
        step="0.05"
        value={customization.iconScale ?? 1}
        onChange={(e) => {
          launcherActions.setDockButtonCustomization(buttonId, {
            iconScale: Number.parseFloat(e.target.value),
          });
        }}
        style={{ width: '100%', accentColor: '#cbd5e1' }}
      />
      {customization.iconScale !== undefined && customization.iconScale !== 1 && (
        <button
          type="button"
          onClick={() => {
            launcherActions.setDockButtonCustomization(buttonId, { iconScale: 1.0 });
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '8px',
            width: '100%',
            transition: 'all 0.15s ease',
          }}
        >
          <RotateCcw size={12} />
          <span>{t.hudEditor.resetScale ?? 'Reiniciar Tamaño del Icono (1.0x)'}</span>
        </button>
      )}
    </div>
  </div>
  );
};

// ─────────────────────────────────────────────────────────────
// TAB 3: EFECTOS VISUALES FX
// ─────────────────────────────────────────────────────────────
interface FxTabProps {
  buttonId: DockButtonId;
  customization: DockButtonCustomization;
}

export const DockButtonInspectorFxTab: React.FC<FxTabProps> = ({ buttonId, customization }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
    {EFFECT_OPTIONS.map((fx) => {
      const isSelected = (customization.specialEffect ?? 'none') === fx.id;
      return (
        <button
          key={fx.id}
          type="button"
          onClick={() => {
            launcherActions.setDockButtonCustomization(buttonId, {
              specialEffect: fx.id,
            });
          }}
          style={{
            background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: isSelected
              ? '1px solid rgba(255, 255, 255, 0.3)'
              : '1px solid rgba(255, 255, 255, 0.08)',
            color: isSelected ? '#ffffff' : '#cbd5e1',
            borderRadius: '8px',
            padding: '7px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'flex-start',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{fx.icon}</span>
          <span>{fx.label}</span>
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────
// TAB 4: FORMA, ROTACIÓN Y RESTABLECER TAMAÑO
// ─────────────────────────────────────────────────────────────
interface ShapeTabProps {
  buttonId: DockButtonId;
  dockConfig: LauncherState['dockConfig'];
  customization: DockButtonCustomization;
}

export const DockButtonInspectorShapeTab: React.FC<ShapeTabProps> = ({
  buttonId,
  dockConfig,
  customization,
}) => {
  const t = useT();
  const isUnifiedDock = dockConfig.layoutMode === 'dock';

  if (isUnifiedDock) {
    const isCompact = dockConfig.scale === 'compact';
    const isNoLabels = !dockConfig.showLabels;
    const defaultSegmentW = isNoLabels ? 56 : isCompact ? 96 : 136;
    const defaultDockH = isNoLabels ? 56 : isCompact ? 74 : 108;
    const currentSegmentW = dockConfig.customSegmentWidth ?? defaultSegmentW;
    const currentDockH = dockConfig.customDockHeight ?? defaultDockH;
    const buttonCount =
      dockConfig.buttonOrder && dockConfig.buttonOrder.length > 0
        ? dockConfig.buttonOrder.length
        : 5;
    const totalBarW = currentSegmentW * buttonCount;
    const hasCustomBarSize = Boolean(
      dockConfig.customSegmentWidth !== undefined || dockConfig.customDockHeight !== undefined
    );
    const currentRadius = dockConfig.borderRadius ?? 14;
    const hasCustomRadius = dockConfig.borderRadius !== undefined && dockConfig.borderRadius !== 14;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Banner Barra Unificada */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Columns size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#7dd3fc' }}>
              Barra Unificada (Forma Compartida)
            </span>
            <span style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.3 }}>
              La forma, dimensiones y bordes aplican a la barra completa como un solo elemento.
            </span>
          </div>
        </div>

        {/* Dimensiones de la Barra */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tamaño de Barra:</span>
          <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '11px' }}>
            {totalBarW}px × {currentDockH}px{' '}
            <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 500 }}>
              ({currentSegmentW}px / botón)
            </span>
          </span>
        </div>

        {/* Restablecer Tamaño de Barra si está personalizado */}
        {hasCustomBarSize && (
          <button
            type="button"
            onClick={() => {
              launcherActions.setDockConfig({
                customSegmentWidth: undefined,
                customDockHeight: undefined,
              });
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#e2e8f0',
              borderRadius: '8px',
              padding: '6px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={12} />
            <span>Restablecer Tamaño de Barra</span>
          </button>
        )}

        {/* Etiqueta de Texto */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
              Etiqueta de Texto
            </span>
            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
              {customization.hideLabel || !dockConfig.showLabels
                ? 'Oculto (permite tamaño ultra-compacto)'
                : 'Visible (ancho protegido contra recortes)'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              launcherActions.setDockButtonCustomization(buttonId, {
                hideLabel: !customization.hideLabel,
              });
            }}
            style={{
              background: customization.hideLabel
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(22, 160, 133, 0.15)',
              border: customization.hideLabel
                ? '1px solid rgba(255, 255, 255, 0.14)'
                : '1px solid rgba(22, 160, 133, 0.35)',
              color: customization.hideLabel ? '#94a3b8' : 'var(--accent-primary, #16A085)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {customization.hideLabel ? 'Mostrar' : 'Ocultar'}
          </button>
        </div>

        {/* Borde Redondeado de la Barra */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '4px',
            }}
          >
            <span>Borde Redondeado de la Barra:</span>
            <span>{currentRadius}px</span>
          </div>
          <input
            type="range"
            aria-label={t.hudEditor.borderRadius}
            min="0"
            max="40"
            value={currentRadius}
            onChange={(e) => {
              launcherActions.setDockConfig({
                borderRadius: Number.parseInt(e.target.value, 10),
              });
            }}
            style={{ width: '100%', accentColor: '#cbd5e1' }}
          />
        </div>

        {/* Rotación Bloqueada en Barra Unificada */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '7px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Rotación:</span>
            <span style={{ fontSize: '9.5px', color: '#64748b' }}>
              Fija a 0° en Barra Unificada (disponible en Botones Libres)
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#94a3b8',
              fontWeight: 600,
            }}
          >
            0° (Bloqueada)
          </span>
        </div>

        {/* Restablecer Forma de la Barra si tiene cambios */}
        {(hasCustomBarSize || hasCustomRadius) && (
          <button
            type="button"
            onClick={() => {
              launcherActions.setDockConfig({
                borderRadius: 14,
                customSegmentWidth: undefined,
                customDockHeight: undefined,
              });
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              borderRadius: '8px',
              padding: '6px',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={12} />
            <span>Restablecer Forma de la Barra</span>
          </button>
        )}
      </div>
    );
  }

  // MODO BOTONES LIBRES (comportamiento individual por botón)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tamaño Actual:</span>
        <span style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '11px' }}>
          {customization.customWidth ? `${customization.customWidth}px` : 'Auto'} ×{' '}
          {customization.customHeight ? `${customization.customHeight}px` : 'Auto'}
        </span>
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '8px',
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
            Etiqueta de Texto
          </span>
          <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>
            {customization.hideLabel || !dockConfig.showLabels
              ? 'Oculto (permite tamaño ultra-compacto)'
              : 'Visible (ancho protegido contra recortes)'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            launcherActions.setDockButtonCustomization(buttonId, {
              hideLabel: !customization.hideLabel,
            });
          }}
          style={{
            background: customization.hideLabel
              ? 'rgba(255, 255, 255, 0.06)'
              : 'rgba(22, 160, 133, 0.15)',
            border: customization.hideLabel
              ? '1px solid rgba(255, 255, 255, 0.14)'
              : '1px solid rgba(22, 160, 133, 0.35)',
            color: customization.hideLabel ? '#94a3b8' : 'var(--accent-primary, #16A085)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '10.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {customization.hideLabel ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>

      {(customization.customWidth || customization.customHeight) && (
        <button
          type="button"
          onClick={() => {
            launcherActions.setDockButtonCustomization(buttonId, {
              customWidth: undefined,
              customHeight: undefined,
            });
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            color: '#e2e8f0',
            borderRadius: '8px',
            padding: '6px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={12} />
          <span>Restablecer Tamaño Original</span>
        </button>
      )}

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#94a3b8',
            marginBottom: '4px',
          }}
        >
          <span>Borde Redondeado:</span>
          <span>
            {customization.borderRadius !== undefined ? `${customization.borderRadius}px` : 'Auto'}
          </span>
        </div>
        <input
          type="range"
          aria-label={t.hudEditor.borderRadius}
          min="0"
          max="40"
          value={customization.borderRadius ?? 14}
          onChange={(e) => {
            launcherActions.setDockButtonCustomization(buttonId, {
              borderRadius: Number.parseInt(e.target.value, 10),
            });
          }}
          style={{ width: '100%', accentColor: '#cbd5e1' }}
        />
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#94a3b8',
            marginBottom: '4px',
          }}
        >
          <span>Rotación:</span>
          <span>{customization.rotation ?? 0}°</span>
        </div>
        <input
          type="range"
          aria-label={t.hudEditor.rotation}
          min="-30"
          max="30"
          value={customization.rotation ?? 0}
          onChange={(e) => {
            launcherActions.setDockButtonCustomization(buttonId, {
              rotation: Number.parseInt(e.target.value, 10),
            });
          }}
          style={{ width: '100%', accentColor: '#cbd5e1' }}
        />
      </div>
    </div>
  );
};
