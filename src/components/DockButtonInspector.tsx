import React, { useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Sparkles,
  Sliders,
  RotateCcw,
  X,
  EyeOff,
  Check,
  Video,
  Palette,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
  DockButtonEffect,
} from '../store/launcherStore';
import {
  saveButtonMediaFile,
  clearButtonMedia,
  isVideoSource,
} from '../utils/wallpaperStorage';

interface DockButtonInspectorProps {
  buttonId: DockButtonId;
  initialTab?: 'bg' | 'icon' | 'fx' | 'shape';
  onClose: () => void;
}

const BUTTON_NAMES: Record<DockButtonId, string> = {
  instances: 'Instancias',
  about: 'Acerca de',
  accounts: 'Cuentas',
  settings: 'Ajustes',
  launch: 'Lanzar Juego',
};

const COLOR_PRESETS = [
  { label: 'Vidrio', value: 'rgba(12, 17, 24, 0.92)' },
  { label: 'Cian', value: 'rgba(0, 229, 255, 0.28)' },
  { label: 'Amatista', value: 'rgba(168, 85, 247, 0.28)' },
  { label: 'Esmeralda', value: 'rgba(34, 197, 94, 0.28)' },
  { label: 'Carmesí', value: 'rgba(239, 68, 68, 0.28)' },
  { label: 'Obsidiana', value: 'rgba(0, 0, 0, 0.85)' },
];

const EFFECT_OPTIONS: { id: DockButtonEffect; label: string; icon: string }[] = [
  { id: 'none', label: 'Ninguno', icon: '⚪' },
  { id: 'rainbow_rgb', label: 'RGB Chroma', icon: '🌈' },
  { id: 'neon_pulse', label: 'Neón Pulse', icon: '⚡' },
  { id: 'glitch', label: 'Glitch Cyber', icon: '👾' },
  { id: 'hologram', label: 'Holograma', icon: '🔮' },
  { id: 'fire', label: 'Llamas Fuego', icon: '🔥' },
];

export const DockButtonInspector: React.FC<DockButtonInspectorProps> = ({
  buttonId,
  initialTab = 'bg',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'bg' | 'icon' | 'fx' | 'shape'>(initialTab);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const customization = dockConfig.buttonCustomizations?.[buttonId] || {};

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('Cargando...');
      const isVideo = file.type.startsWith('video/') || isVideoSource(file.name);
      const res = await saveButtonMediaFile(buttonId, file, false);

      if (isVideo) {
        launcherActions.setDockButtonCustomization(buttonId, {
          bgType: 'video',
          bgVideo: res.url,
          bgImage: undefined,
          bgVideoOpacity: 0.85,
        });
      } else {
        launcherActions.setDockButtonCustomization(buttonId, {
          bgType: 'image',
          bgImage: res.url,
          bgVideo: undefined,
        });
      }
      setUploadStatus('¡Guardado!');
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Error saving local media:', err);
      setUploadStatus('Error al cargar');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus('Cargando icono...');
      const res = await saveButtonMediaFile(buttonId, file, true);
      launcherActions.setDockButtonCustomization(buttonId, {
        iconType: 'custom_image',
        customIconUrl: res.url,
      });
      setUploadStatus('¡Icono guardado!');
      setTimeout(() => setUploadStatus(null), 2000);
    } catch (err) {
      console.error('Error saving local icon:', err);
      setUploadStatus('Error');
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleResetCustomization = async () => {
    await clearButtonMedia(buttonId, false);
    await clearButtonMedia(buttonId, true);
    launcherActions.resetDockButtonCustomization(buttonId);
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'relative',
        zIndex: 1000,
        background: 'rgba(10, 14, 23, 0.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 20px rgba(0, 229, 255, 0.2)',
        borderRadius: '16px',
        padding: '12px 14px',
        minWidth: '320px',
        maxWidth: '380px',
        color: '#f1f5f9',
        fontSize: '12px',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* Hidden file pickers for direct PC uploading */}
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*,video/*,.gif,.mp4,.webm"
        style={{ display: 'none' }}
        onChange={handleMediaUpload}
      />
      <input
        ref={iconFileInputRef}
        type="file"
        accept="image/*,.svg,.png,.webp,.gif"
        style={{ display: 'none' }}
        onChange={handleIconUpload}
      />

      {/* Header bar with Button Name and Close */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'linear-gradient(135deg, #00e5ff, #3b82f6)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 800,
              color: '#0a0f18',
              letterSpacing: '0.5px',
            }}
          >
            EDITANDO
          </span>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>
            {BUTTON_NAMES[buttonId] || buttonId}
          </span>
          {uploadStatus && (
            <span
              style={{
                fontSize: '11px',
                color: uploadStatus.includes('Error') ? '#ef4444' : '#22c55e',
                fontWeight: 600,
              }}
            >
              {uploadStatus}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Cerrar inspector"
        >
          <X size={15} />
        </button>
      </div>

      {/* Navigation tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          marginBottom: '12px',
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '3px',
          borderRadius: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('bg')}
          style={{
            background: activeTab === 'bg' ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
            border: activeTab === 'bg' ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid transparent',
            color: activeTab === 'bg' ? '#00e5ff' : '#94a3b8',
            borderRadius: '8px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <ImageIcon size={12} />
          <span>Fondo</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('icon')}
          style={{
            background: activeTab === 'icon' ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
            border: activeTab === 'icon' ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid transparent',
            color: activeTab === 'icon' ? '#00e5ff' : '#94a3b8',
            borderRadius: '8px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Palette size={12} />
          <span>Icono</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fx')}
          style={{
            background: activeTab === 'fx' ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
            border: activeTab === 'fx' ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid transparent',
            color: activeTab === 'fx' ? '#00e5ff' : '#94a3b8',
            borderRadius: '8px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={12} />
          <span>Efectos</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shape')}
          style={{
            background: activeTab === 'shape' ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
            border: activeTab === 'shape' ? '1px solid rgba(0, 229, 255, 0.4)' : '1px solid transparent',
            color: activeTab === 'shape' ? '#00e5ff' : '#94a3b8',
            borderRadius: '8px',
            padding: '6px 4px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Sliders size={12} />
          <span>Forma</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: FONDO & MEDIOS LOCALES (PC UPLOAD)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Primary Upload button from PC */}
          <button
            type="button"
            onClick={() => bgFileInputRef.current?.click()}
            style={{
              background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.18), rgba(59, 130, 246, 0.22))',
              border: '1px solid rgba(0, 229, 255, 0.5)',
              borderRadius: '10px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#00e5ff',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 229, 255, 0.15)',
              transition: 'all 0.15s ease',
            }}
          >
            <Upload size={15} />
            <span>Subir Imagen, GIF o Vídeo desde mi PC</span>
          </button>

          {/* Quick preset colors */}
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
                      border: isSelected ? '2px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {isSelected && <Check size={10} />}
                    <span>{p.label}</span>
                  </button>
                );
              })}
              {/* Native color picker */}
              <label
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
                }}
              >
                <span>Otro</span>
                <input
                  type="color"
                  value={customization.bgColor || '#00e5ff'}
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

          {/* If video background, show opacity slider */}
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
                min="0.1"
                max="1"
                step="0.05"
                value={customization.bgVideoOpacity ?? 0.85}
                onChange={(e) => {
                  launcherActions.setDockButtonCustomization(buttonId, {
                    bgVideoOpacity: parseFloat(e.target.value),
                  });
                }}
                style={{ width: '100%', accentColor: '#00e5ff' }}
              />
            </div>
          )}

          {/* Clear background action */}
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
              }}
            >
              <RotateCcw size={12} />
              <span>Quitar Fondo Personalizado</span>
            </button>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ICONO & SVG
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'icon' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Upload custom icon from PC */}
          <button
            type="button"
            onClick={() => iconFileInputRef.current?.click()}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '10px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <Upload size={14} />
            <span>Subir Icono / SVG propio de mi PC</span>
          </button>

          {/* Toggle between Show Icon, Hide Icon, Default */}
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
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  customization.iconType === 'none'
                    ? '1px solid rgba(245, 158, 11, 0.5)'
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

          {/* Icon Scale slider */}
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
              <span>Escala del Icono:</span>
              <span>{(customization.iconScale ?? 1).toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={customization.iconScale ?? 1}
              onChange={(e) => {
                launcherActions.setDockButtonCustomization(buttonId, {
                  iconScale: parseFloat(e.target.value),
                });
              }}
              style={{ width: '100%', accentColor: '#00e5ff' }}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: EFECTOS VISUALES FX
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'fx' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {EFFECT_OPTIONS.map((fx) => {
            const isSelected = (customization.specialEffect || 'none') === fx.id;
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
                  background: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                  color: isSelected ? '#00e5ff' : '#e2e8f0',
                  borderRadius: '8px',
                  padding: '7px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'flex-start',
                }}
              >
                <span>{fx.icon}</span>
                <span>{fx.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: FORMA, ROTACIÓN Y RESTABLECER TAMAÑO
         ───────────────────────────────────────────────────────────── */}
      {activeTab === 'shape' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Live dimensions badge and reset size */}
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
            <span style={{ fontWeight: 700, color: '#00e5ff', fontSize: '11px' }}>
              {customization.customWidth ? `${customization.customWidth}px` : 'Auto'} ×{' '}
              {customization.customHeight ? `${customization.customHeight}px` : 'Auto'}
            </span>
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
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                color: '#00e5ff',
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

          {/* Border radius slider */}
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
              <span>{customization.borderRadius !== undefined ? `${customization.borderRadius}px` : 'Auto'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              value={customization.borderRadius ?? 14}
              onChange={(e) => {
                launcherActions.setDockButtonCustomization(buttonId, {
                  borderRadius: parseInt(e.target.value, 10),
                });
              }}
              style={{ width: '100%', accentColor: '#00e5ff' }}
            />
          </div>

          {/* Rotation slider */}
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
              min="-30"
              max="30"
              value={customization.rotation ?? 0}
              onChange={(e) => {
                launcherActions.setDockButtonCustomization(buttonId, {
                  rotation: parseInt(e.target.value, 10),
                });
              }}
              style={{ width: '100%', accentColor: '#00e5ff' }}
            />
          </div>

          {/* Total reset button */}
          <button
            type="button"
            onClick={handleResetCustomization}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              borderRadius: '8px',
              padding: '7px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '4px',
            }}
          >
            <RotateCcw size={12} />
            <span>Restablecer Botón a Fábrica</span>
          </button>
        </div>
      )}
    </div>
  );
};
