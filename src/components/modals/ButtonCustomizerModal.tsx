import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  RotateCcw,
  Copy,
  Check,
  Palette,
  Code2,
  Sparkles,
  Layers,
  Info,
  User,
  Settings,
  Rocket,
  Video,
  Maximize2,
  Flame,
  Ban,
  Activity,
  Tv,
  Upload,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
  ORIGINAL_BUTTON_SVGS,
  DockButtonCustomization,
  DockButtonEffect,
} from '../../store/launcherStore';
import { useModuleStore } from '../../modules';
import { CustomColorPicker } from '../common/CustomColorPicker';
import { saveButtonMediaFile } from '../../utils/wallpaperStorage';

interface ButtonCustomizerModalProps {
  buttonId?: DockButtonId;
  isOpen?: boolean;
  onClose?: () => void;
}

const BUTTON_METADATA: Record<
  string,
  { name: string; icon: React.ReactNode; defaultColor: string }
> = {
  instances: {
    name: 'Instancias (Instances)',
    icon: <Layers size={18} color="#38bdf8" />,
    defaultColor: '#38bdf8',
  },
  about: {
    name: 'Acerca de (About)',
    icon: <Info size={18} color="#94a3b8" />,
    defaultColor: '#94a3b8',
  },
  accounts: {
    name: 'Cuentas (Accounts)',
    icon: <User size={18} color="#a855f7" />,
    defaultColor: '#a855f7',
  },
  settings: {
    name: 'Ajustes (Settings)',
    icon: <Settings size={18} color="#cbd5e1" />,
    defaultColor: '#cbd5e1',
  },
  launch: {
    name: 'Iniciar Juego (Start Game)',
    icon: <Rocket size={18} color="#22c55e" />,
    defaultColor: '#22c55e',
  },
};

const SPECIAL_EFFECT_OPTIONS: {
  id: DockButtonEffect;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    id: 'none',
    label: 'Ninguno',
    icon: <Ban size={14} />,
    desc: 'Elegante y limpio sin animaciones extrañas.',
  },
  {
    id: 'rainbow_rgb',
    label: 'Chroma RGB',
    icon: <Sparkles size={14} />,
    desc: 'Borde rotativo continuo y fluido.',
  },
  {
    id: 'neon_pulse',
    label: 'Pulso Luminoso',
    icon: <Activity size={14} />,
    desc: 'Resplandor profundo que palpita suavemente.',
  },
  {
    id: 'glitch',
    label: 'Glitch Digital',
    icon: <Tv size={14} />,
    desc: 'Distorsión digital estética y sutil.',
  },
  {
    id: 'hologram',
    label: 'Holograma',
    icon: <Layers size={14} />,
    desc: 'Trama de líneas scanline con resplandor suave.',
  },
  {
    id: 'fire',
    label: 'Fuego Cálido',
    icon: <Flame size={14} />,
    desc: 'Aura ardiente con matices cálidos intensos.',
  },
];

function getButtonMeta(
  activeBtnId: string,
  modules: {
    id: string;
    name: string;
    slots: { dockButton?: { label?: string; icon?: React.ReactNode; defaultColor?: string } };
  }[],
  accentColor: string,
) {
  const modId = activeBtnId.startsWith('mod:') ? activeBtnId.slice(4) : null;
  const mod = modId ? modules.find((m) => m.id === modId) : null;

  return (
    BUTTON_METADATA[activeBtnId] ?? {
      name: mod?.slots.dockButton?.label
        ? `${mod.slots.dockButton.label} (${mod.name})`
        : (mod?.name ?? activeBtnId),
      icon: mod?.slots.dockButton?.icon ?? <Sparkles size={18} color="#00e5ff" />,
      defaultColor: mod?.slots.dockButton?.defaultColor ?? accentColor,
    }
  );
}

interface ButtonIconPreviewProps {
  currentIconType: string;
  custom: DockButtonCustomization;
  metaIcon: React.ReactNode;
  effectiveContentColor: string;
}

const ButtonIconPreview: React.FC<ButtonIconPreviewProps> = ({
  currentIconType,
  custom,
  metaIcon,
  effectiveContentColor,
}) => {
  if (currentIconType === 'none') {
    return (
      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
        (Sin icono)
      </span>
    );
  }
  const scale = custom.iconScale ?? 1;
  if (currentIconType === 'custom_svg' && custom.customSvg) {
    const sanitized = DOMPurify.sanitize(custom.customSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    return (
      <div
        style={{
          width: `${24 * scale}px`,
          height: `${24 * scale}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: effectiveContentColor,
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  if (currentIconType === 'custom_image' && custom.customIconUrl) {
    return (
      <img
        src={custom.customIconUrl}
        alt=""
        style={{
          width: `${22 * scale}px`,
          height: `${22 * scale}px`,
          objectFit: 'contain',
        }}
      />
    );
  }
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {metaIcon}
    </div>
  );
};

interface CustomizerLivePreviewProps {
  custom: DockButtonCustomization;
  dockConfig: LauncherState['dockConfig'];
  meta: { name: string; icon: React.ReactNode };
  effectiveContentColor: string;
  currentBgType: string;
  currentIconType: string;
  currentEffect: string;
}

const CustomizerLivePreview: React.FC<CustomizerLivePreviewProps> = ({
  custom,
  dockConfig,
  meta,
  effectiveContentColor,
  currentBgType,
  currentIconType,
  currentEffect,
}) => {
  const previewWidth = custom.customWidth ? `${custom.customWidth}px` : '136px';
  const previewHeight = custom.customHeight ? `${custom.customHeight}px` : '80px';
  const previewScale = custom.scale ?? 1;
  const previewRadius = custom.borderRadius ?? dockConfig.borderRadius;
  const previewRotation = custom.rotation ?? 0;

  const getEffectClassName = () => {
    if (currentEffect === 'rainbow_rgb') return 'btn-fx-rainbow-rgb';
    if (currentEffect === 'neon_pulse') return 'btn-fx-neon-pulse';
    if (currentEffect === 'glitch') return 'btn-fx-glitch';
    if (currentEffect === 'hologram') return 'btn-fx-hologram';
    if (currentEffect === 'fire') return 'btn-fx-fire';
    return '';
  };

  const getBackgroundStyle = () => {
    if (currentBgType === 'color' && custom.bgColor) return custom.bgColor;
    if (currentBgType === 'image' && custom.bgImage) {
      return `url(${custom.bgImage}) center / cover no-repeat`;
    }
    return 'rgba(15, 23, 42, 0.9)';
  };

  return (
    <div
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.6) 0%, rgba(10, 15, 25, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        borderRadius: '12px',
        padding: '24px 16px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '140px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'rgba(255, 255, 255, 0.4)',
        }}
      >
        Vista Previa en Vivo (Live Render)
      </div>

      <div
        className={`dock-segment ${getEffectClassName()}`}
        style={{
          width: previewWidth,
          height: previewHeight,
          transform: `scale(${previewScale}) rotate(${previewRotation}deg)`,
          transformOrigin: 'center center',
          borderRadius: `${previewRadius}px`,
          background: getBackgroundStyle(),
          color: effectiveContentColor,
          border:
            currentBgType === 'color' && custom.bgColor
              ? `1px solid ${custom.bgColor}80`
              : '1px solid rgba(255, 255, 255, 0.16)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
          transition: 'all 0.25s ease',
        }}
      >
        {currentBgType === 'video' && custom.bgVideo && (
          <video
            src={custom.bgVideo}
            autoPlay
            loop
            muted
            playsInline
            className="dock-button-video-bg"
            style={{ opacity: custom.bgVideoOpacity ?? 0.85 }}
          />
        )}

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px',
            pointerEvents: 'none',
          }}
        >
          <ButtonIconPreview
            currentIconType={currentIconType}
            custom={custom}
            metaIcon={meta.icon}
            effectiveContentColor={effectiveContentColor}
          />
          {dockConfig.showLabels && (
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: effectiveContentColor,
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}
            >
              {meta.name.split(' (')[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface CustomizerBackgroundTabProps {
  buttonId: DockButtonId;
  custom: DockButtonCustomization;
  currentBgType: string;
  handleUpdate: (patch: Partial<DockButtonCustomization>) => void;
}

const CustomizerBackgroundTab: React.FC<CustomizerBackgroundTabProps> = ({
  buttonId,
  custom,
  currentBgType,
  handleUpdate,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const res = await saveButtonMediaFile(buttonId, file, false);
      handleUpdate({
        bgType: 'image',
        bgImage: res.url,
        bgVideo: undefined,
      });
    } catch (err) {
      console.error('Error al subir imagen de fondo:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const res = await saveButtonMediaFile(buttonId, file, false);
      handleUpdate({
        bgType: 'video',
        bgVideo: res.url,
        bgImage: undefined,
        bgVideoOpacity: custom.bgVideoOpacity ?? 0.85,
      });
    } catch (err) {
      console.error('Error al subir vídeo de fondo:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Tipo de Fondo:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { id: 'default', label: 'Vidrio Estándar', desc: 'Translúcido' },
            { id: 'color', label: 'Color Sólido', desc: 'Color / Gradiente' },
            { id: 'image', label: 'Imagen / Textura', desc: 'Foto o patrón' },
            { id: 'video', label: 'Vídeo en Bucle', desc: '¡Animado MP4/WebM!' },
          ].map((bgOpt) => (
            <button
              key={bgOpt.id}
              type="button"
              onClick={() =>
                handleUpdate({ bgType: bgOpt.id as DockButtonCustomization['bgType'] })
              }
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border:
                  currentBgType === bgOpt.id
                    ? '1px solid var(--accent-primary, #38bdf8)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                background:
                  currentBgType === bgOpt.id
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)',
                color: currentBgType === bgOpt.id ? '#ffffff' : '#94a3b8',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 600 }}>{bgOpt.label}</span>
              <span style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.45)' }}>
                {bgOpt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {currentBgType === 'color' && (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <CustomColorPicker
            color={custom.bgColor ?? '#1e293b'}
            onChange={(hex) => handleUpdate({ bgColor: hex })}
            label="Color de Fondo del Botón"
          />
        </div>
      )}

      {currentBgType === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp,.gif"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />

          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Imagen de Fondo:
            </span>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--accent-primary, #38bdf8)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={15} />
              <span>{isUploading ? 'Subiendo imagen...' : 'Subir Imagen'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <span
              style={{
                fontSize: '10px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              o pegar URL
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label
              htmlFor="bg-image-url-input"
              style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}
            >
              URL de Imagen Personalizada:
            </label>
            <input
              id="bg-image-url-input"
              type="text"
              value={custom.bgImage ?? ''}
              onChange={(e) => handleUpdate({ bgImage: e.target.value.trim() })}
              placeholder="https://... o ruta de imagen"
              aria-label="URL de imagen de fondo"
              className="login-text-input"
              style={{ fontSize: '11.5px', height: '34px' }}
            />
          </div>
        </div>
      )}

      {currentBgType === 'video' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleVideoUpload}
          />

          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#e2e8f0',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Vídeo en Bucle:
            </span>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: 'var(--accent-primary, #38bdf8)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              <Upload size={15} />
              <span>{isUploading ? 'Subiendo vídeo...' : 'Subir Vídeo'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            <span
              style={{
                fontSize: '10px',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              o pegar URL
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
          </div>

          <div>
            <label
              htmlFor="bg-video-url-input"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#94a3b8',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              URL del Vídeo en Bucle (MP4 / WebM / WebP animado):
            </label>
            <input
              id="bg-video-url-input"
              type="text"
              value={custom.bgVideo ?? ''}
              onChange={(e) => handleUpdate({ bgVideo: e.target.value.trim() })}
              placeholder="https://.../video.mp4"
              aria-label="URL del vídeo de fondo"
              className="login-text-input"
              style={{ fontSize: '11.5px', height: '34px' }}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Opacidad del Vídeo:</span>
              <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 600 }}>
                {Math.round((custom.bgVideoOpacity ?? 0.85) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={custom.bgVideoOpacity ?? 0.85}
              onChange={(e) => handleUpdate({ bgVideoOpacity: parseFloat(e.target.value) })}
              aria-label="Opacidad del vídeo"
              style={{ width: '100%', accentColor: 'var(--accent-primary, #00e5ff)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface CustomizerGeometryTabProps {
  custom: DockButtonCustomization;
  dockConfig: LauncherState['dockConfig'];
  handleUpdate: (patch: Partial<DockButtonCustomization>) => void;
}

const CustomizerGeometryTab: React.FC<CustomizerGeometryTabProps> = ({
  custom,
  dockConfig,
  handleUpdate,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
        Modifica las dimensiones, zoom, redondeo y rotación libremente para este botón:
      </span>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
            Ancho del Botón:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-primary, #38bdf8)',
                fontWeight: 700,
              }}
            >
              {custom.customWidth ? `${custom.customWidth}px` : 'Automático'}
            </span>
            {custom.customWidth && (
              <button
                type="button"
                onClick={() => handleUpdate({ customWidth: undefined })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f43f5e',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Auto
              </button>
            )}
          </div>
        </div>
        <input
          type="range"
          min="50"
          max="320"
          step="2"
          value={custom.customWidth ?? 136}
          onChange={(e) => handleUpdate({ customWidth: parseInt(e.target.value, 10) })}
          aria-label="Ancho del botón"
          style={{ width: '100%', accentColor: 'var(--accent-primary, #38bdf8)' }}
        />
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
            Alto del Botón:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-primary, #38bdf8)',
                fontWeight: 700,
              }}
            >
              {(() => {
                if (dockConfig.layoutMode === 'dock') return 'Automático (Dock Unificado)';
                if (custom.customHeight) return `${custom.customHeight}px`;
                return 'Automático';
              })()}
            </span>
            {custom.customHeight && (
              <button
                type="button"
                onClick={() => handleUpdate({ customHeight: undefined })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f43f5e',
                  fontSize: '10px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Auto
              </button>
            )}
          </div>
        </div>
        {dockConfig.layoutMode === 'dock' ? (
          <p style={{ margin: 0, fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
            En el modo Dock Unificado, la altura se sincroniza automáticamente con el ajuste de
            escala y etiquetas (Ajustes &gt; Dock).
          </p>
        ) : (
          <input
            type="range"
            min="36"
            max="160"
            step="2"
            value={custom.customHeight ?? 80}
            onChange={(e) => handleUpdate({ customHeight: parseInt(e.target.value, 10) })}
            aria-label="Alto del botón"
            style={{ width: '100%', accentColor: 'var(--accent-primary, #38bdf8)' }}
          />
        )}
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
            Escala / Zoom General:
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--accent-primary, #00e5ff)',
              fontWeight: 700,
            }}
          >
            {(custom.scale ?? 1).toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={custom.scale ?? 1}
          onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) })}
          aria-label="Escala del botón"
          style={{ width: '100%', accentColor: 'var(--accent-primary, #00e5ff)' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
              Borde Redondeado:
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-primary, #00e5ff)',
                fontWeight: 700,
              }}
            >
              {custom.borderRadius ?? dockConfig.borderRadius}px
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            step="1"
            value={custom.borderRadius ?? dockConfig.borderRadius}
            onChange={(e) => handleUpdate({ borderRadius: parseInt(e.target.value, 10) })}
            aria-label="Radio de bordes"
            style={{ width: '100%', accentColor: 'var(--accent-primary, #00e5ff)' }}
          />
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
              Rotación / Inclinación:
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--accent-primary, #00e5ff)',
                fontWeight: 700,
              }}
            >
              {custom.rotation ?? 0}°
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="30"
            step="1"
            value={custom.rotation ?? 0}
            onChange={(e) => handleUpdate({ rotation: parseInt(e.target.value, 10) })}
            aria-label="Rotación del botón"
            style={{ width: '100%', accentColor: 'var(--accent-primary, #00e5ff)' }}
          />
        </div>
      </div>
    </div>
  );
};

interface CustomizerEffectsTabProps {
  currentEffect: string;
  handleUpdate: (patch: Partial<DockButtonCustomization>) => void;
}

const CustomizerEffectsTab: React.FC<CustomizerEffectsTabProps> = ({
  currentEffect,
  handleUpdate,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
        Elige un efecto visual experimental para darle una vibra única a este botón:
      </span>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {SPECIAL_EFFECT_OPTIONS.map((eff) => (
          <button
            key={eff.id}
            type="button"
            onClick={() => handleUpdate({ specialEffect: eff.id })}
            style={{
              padding: '12px',
              borderRadius: '10px',
              border:
                currentEffect === eff.id
                  ? '1px solid var(--accent-primary, #00e5ff)'
                  : '1px solid rgba(255, 255, 255, 0.07)',
              background:
                currentEffect === eff.id ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255, 255, 255, 0.025)',
              color: currentEffect === eff.id ? '#ffffff' : '#94a3b8',
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>{eff.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>{eff.label}</span>
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>{eff.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface CustomizerIconTabProps {
  custom: DockButtonCustomization;
  currentIconType: string;
  copiedOriginalSvg: boolean;
  handleUpdate: (patch: Partial<DockButtonCustomization>) => void;
  handleCopyOriginalSvg: () => void;
}

const CustomizerIconTab: React.FC<CustomizerIconTabProps> = ({
  custom,
  currentIconType,
  copiedOriginalSvg,
  handleUpdate,
  handleCopyOriginalSvg,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#e2e8f0',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Modo de Icono:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {[
            { id: 'default', label: 'Icono Original' },
            { id: 'custom_svg', label: 'Código SVG Propio' },
            { id: 'custom_image', label: 'Imagen / URL' },
            { id: 'none', label: 'Sin Icono' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() =>
                handleUpdate({ iconType: opt.id as DockButtonCustomization['iconType'] })
              }
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border:
                  currentIconType === opt.id
                    ? '1px solid var(--accent-primary, #00e5ff)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                background:
                  currentIconType === opt.id
                    ? 'rgba(0, 229, 255, 0.12)'
                    : 'rgba(255, 255, 255, 0.03)',
                color: currentIconType === opt.id ? '#ffffff' : '#94a3b8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
            Tamaño / Escala del Icono:
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--accent-primary, #00e5ff)',
              fontWeight: 700,
            }}
          >
            {(custom.iconScale ?? 1).toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={custom.iconScale ?? 1}
          onChange={(e) => handleUpdate({ iconScale: parseFloat(e.target.value) })}
          aria-label="Escala del icono"
          style={{ width: '100%', accentColor: 'var(--accent-primary, #00e5ff)' }}
        />
      </div>

      {currentIconType === 'custom_svg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label
              htmlFor="custom-svg-code-input"
              style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}
            >
              Pega aquí tu código SVG:
            </label>
            <button
              type="button"
              onClick={handleCopyOriginalSvg}
              style={{
                background: copiedOriginalSvg
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: copiedOriginalSvg
                  ? '1px solid #22c55e'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: copiedOriginalSvg ? '#86efac' : '#cbd5e1',
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {copiedOriginalSvg ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedOriginalSvg ? '¡SVG Copiado!' : 'Copiar SVG Original'}</span>
            </button>
          </div>
          <textarea
            id="custom-svg-code-input"
            rows={4}
            value={custom.customSvg ?? ''}
            onChange={(e) => handleUpdate({ customSvg: e.target.value })}
            placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>'
            aria-label="Código SVG personalizado"
            style={{
              width: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#38bdf8',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {currentIconType === 'custom_image' && (
        <div>
          <label
            htmlFor="custom-icon-url-input"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            URL de Imagen o Icono Externo:
          </label>
          <input
            id="custom-icon-url-input"
            type="text"
            value={custom.customIconUrl ?? ''}
            onChange={(e) => handleUpdate({ customIconUrl: e.target.value.trim() })}
            placeholder="https://.../icono.png o .svg"
            aria-label="URL del icono personalizado"
            className="login-text-input"
            style={{ fontSize: '11.5px', height: '34px' }}
          />
        </div>
      )}
    </div>
  );
};

interface CustomizerColorTabProps {
  effectiveContentColor: string;
  handleUpdate: (patch: Partial<DockButtonCustomization>) => void;
}

const CustomizerColorTab: React.FC<CustomizerColorTabProps> = ({
  effectiveContentColor,
  handleUpdate,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
        Ajusta el color del texto y del icono para lograr el contraste perfecto sobre tu nuevo fondo
        o vídeo:
      </span>
      <CustomColorPicker
        color={effectiveContentColor}
        onChange={(hex) => handleUpdate({ contentColor: hex })}
        label="Color de Texto e Icono"
      />
    </div>
  );
};

export const ButtonCustomizerModal: React.FC<ButtonCustomizerModalProps> = ({
  buttonId: propButtonId,
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const storeButtonId = useLauncherStore((s: LauncherState) => s.customizingButtonId);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);

  const activeBtnId = propButtonId ?? storeButtonId;
  const isModalOpen = propIsOpen ?? storeButtonId !== null;

  const handleClose = useCallback(() => {
    if (propOnClose) {
      propOnClose();
    } else {
      launcherActions.closeButtonCustomizer();
    }
  }, [propOnClose]);

  const [activeTab, setActiveTab] = useState<
    'background' | 'geometry' | 'effects' | 'icon' | 'color'
  >('background');
  const [copiedOriginalSvg, setCopiedOriginalSvg] = useState(false);

  const modules = useModuleStore((s) => s.modules);

  useEffect(() => {
    if (!isModalOpen || !activeBtnId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, activeBtnId, handleClose]);

  if (!isModalOpen || !activeBtnId) return null;

  const meta = getButtonMeta(activeBtnId, modules, accentColor);
  const custom = dockConfig.buttonCustomizations?.[activeBtnId] ?? {};
  const currentBgType = custom.bgType ?? 'default';
  const currentIconType = custom.iconType ?? 'default';
  const currentEffect = custom.specialEffect ?? 'none';
  const effectiveContentColor = custom.contentColor ?? meta.defaultColor ?? accentColor;

  const handleUpdate = (patch: Partial<DockButtonCustomization>) => {
    launcherActions.setDockButtonCustomization(activeBtnId, patch);
  };

  const handleCopyOriginalSvg = () => {
    const rawSvg = (ORIGINAL_BUTTON_SVGS as Record<string, string>)[activeBtnId] ?? '';
    if (!rawSvg) return;
    navigator.clipboard.writeText(rawSvg);
    setCopiedOriginalSvg(true);
    setTimeout(() => setCopiedOriginalSvg(false), 2000);
  };

  return (
    <div
      className="papyrus-modal-overlay"
      style={{ zIndex: 120, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(12px)' }}
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
        onClick={handleClose}
      />
      <dialog
        open
        className="papyrus-settings-card"
        aria-label={`Personalizar botón ${meta.name}`}
        style={{
          width: '680px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.95), 0 0 25px rgba(56, 189, 248, 0.08)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} color="var(--accent-primary, #38bdf8)" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                Ultra-Personalizador: {meta.name}
              </h2>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Personaliza fondo, vídeo en bucle, tamaño libre, SVG y efectos visuales extremos.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar modal de personalización"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Interactive Preview Box */}
        <CustomizerLivePreview
          custom={custom}
          dockConfig={dockConfig}
          meta={meta}
          effectiveContentColor={effectiveContentColor}
          currentBgType={currentBgType}
          currentIconType={currentIconType}
          currentEffect={currentEffect}
        />

        {/* Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Opciones de personalización del botón"
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '8px',
          }}
        >
          {[
            { id: 'background', label: 'Fondo & Vídeo', icon: <Video size={13} /> },
            { id: 'geometry', label: 'Tamaño & Forma', icon: <Maximize2 size={13} /> },
            { id: 'effects', label: 'Cosas Raras (FX)', icon: <Flame size={13} /> },
            { id: 'icon', label: 'Icono / SVG', icon: <Code2 size={13} /> },
            { id: 'color', label: 'Color Contenido', icon: <Palette size={13} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                background:
                  activeTab === tab.id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                color: activeTab === tab.id ? 'var(--accent-primary, #38bdf8)' : '#94a3b8',
                border:
                  activeTab === tab.id
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', minHeight: '260px' }}>
          {activeTab === 'background' && (
            <CustomizerBackgroundTab
              buttonId={activeBtnId}
              custom={custom}
              currentBgType={currentBgType}
              handleUpdate={handleUpdate}
            />
          )}

          {activeTab === 'geometry' && (
            <CustomizerGeometryTab
              custom={custom}
              dockConfig={dockConfig}
              handleUpdate={handleUpdate}
            />
          )}

          {activeTab === 'effects' && (
            <CustomizerEffectsTab currentEffect={currentEffect} handleUpdate={handleUpdate} />
          )}

          {activeTab === 'icon' && (
            <CustomizerIconTab
              custom={custom}
              currentIconType={currentIconType}
              copiedOriginalSvg={copiedOriginalSvg}
              handleUpdate={handleUpdate}
              handleCopyOriginalSvg={handleCopyOriginalSvg}
            />
          )}

          {activeTab === 'color' && (
            <CustomizerColorTab
              effectiveContentColor={effectiveContentColor}
              handleUpdate={handleUpdate}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '14px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              launcherActions.resetDockButtonCustomization(activeBtnId);
            }}
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '8px',
              color: '#fda4af',
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '7px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={13} />
            <span>Restablecer Botón a Fábrica</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'var(--accent-primary, #38bdf8)',
              color: '#090d16',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '8px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>Listo</span>
          </button>
        </div>
      </dialog>
    </div>
  );
};
