import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Copy,
  Check,
  Image as ImageIcon,
  Palette,
  Code2,
  Sparkles,
  EyeOff,
  Layers,
  Info,
  User,
  Settings,
  Rocket,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
  ORIGINAL_BUTTON_SVGS,
  DockButtonCustomization,
} from '../../store/launcherStore';
import { CustomColorPicker } from '../common/CustomColorPicker';

interface ButtonCustomizerModalProps {
  buttonId: DockButtonId;
  isOpen: boolean;
  onClose: () => void;
}

const BUTTON_METADATA: Record<
  DockButtonId,
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

const BG_IMAGE_PRESETS = [
  {
    name: 'Obsidiana',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Portal Nether',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Ciber Neón',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=300&auto=format&fit=crop&q=80',
  },
  {
    name: 'Esmeralda',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80',
  },
];

export const ButtonCustomizerModal: React.FC<ButtonCustomizerModalProps> = ({
  buttonId,
  isOpen,
  onClose,
}) => {
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);

  const custom = dockConfig.buttonCustomizations?.[buttonId] || {};
  const currentBgType = custom.bgType || 'default';
  const currentIconType = custom.iconType || 'default';

  const [activeTab, setActiveTab] = useState<'background' | 'icon' | 'color'>('background');
  const [copiedOriginalSvg, setCopiedOriginalSvg] = useState(false);

  if (!isOpen) return null;

  const meta = BUTTON_METADATA[buttonId];
  const effectiveContentColor = custom.contentColor || meta.defaultColor || accentColor;

  const handleUpdate = (patch: Partial<DockButtonCustomization>) => {
    launcherActions.setDockButtonCustomization(buttonId, patch);
  };

  const handleCopyOriginalSvg = () => {
    const rawSvg = ORIGINAL_BUTTON_SVGS[buttonId] || '';
    navigator.clipboard.writeText(rawSvg);
    setCopiedOriginalSvg(true);
    setTimeout(() => setCopiedOriginalSvg(false), 2000);
  };

  const renderIconPreview = () => {
    if (currentIconType === 'none') {
      return (
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
          (Sin icono)
        </span>
      );
    }
    if (currentIconType === 'custom_svg' && custom.customSvg) {
      const sanitized = DOMPurify.sanitize(custom.customSvg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      return (
        <div
          style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: effectiveContentColor }}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }
    if (currentIconType === 'custom_image' && custom.customIconUrl) {
      return (
        <img
          src={custom.customIconUrl}
          alt=""
          style={{ width: '22px', height: '22px', objectFit: 'contain' }}
        />
      );
    }
    return meta.icon;
  };

  return (
    <div
      className="papyrus-modal-overlay"
      role="presentation"
      style={{ zIndex: 110, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="papyrus-settings-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Personalizar botón ${meta.name}`}
        style={{
          width: '560px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          border: '1px solid rgba(0, 229, 255, 0.3)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(0, 229, 255, 0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00e5ff',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                Personalizar Botón: {meta.name}
              </h2>
              <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.5)' }}>
                Modifica el fondo, color, SVG o imagen del botón en tiempo real
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Card */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '18px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#38bdf8',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Vista Previa en Vivo (Dock Segment)
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Así se verá este botón en tu Dock actual
            </span>
          </div>

          {/* Rendered Mockup Button */}
          <div
            style={{
              minWidth: '84px',
              height: '56px',
              padding: '8px 16px',
              borderRadius: `${dockConfig.borderRadius || 16}px`,
              border: custom.bgType === 'color' && custom.bgColor
                ? `1px solid ${custom.bgColor}80`
                : '1px solid rgba(255, 255, 255, 0.12)',
              background:
                custom.bgType === 'color' && custom.bgColor
                  ? custom.bgColor
                  : custom.bgType === 'image' && custom.bgImage
                    ? `url(${custom.bgImage}) center / cover no-repeat`
                    : `rgba(12, 17, 24, ${dockConfig.bgOpacity || 0.85})`,
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {renderIconPreview()}
            {dockConfig.showLabels && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: effectiveContentColor,
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                  whiteSpace: 'nowrap',
                }}
              >
                {meta.name.split(' ')[0]}
              </span>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('background')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border:
                activeTab === 'background' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background:
                activeTab === 'background' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'background' ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <ImageIcon size={14} />
            <span>Fondo del Botón</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('icon')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: activeTab === 'icon' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background:
                activeTab === 'icon' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'icon' ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Code2 size={14} />
            <span>Icono / SVG</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('color')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border:
                activeTab === 'color' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background:
                activeTab === 'color' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === 'color' ? '#38bdf8' : 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Palette size={14} />
            <span>Color del Contenido</span>
          </button>
        </div>

        {/* Tab 1: Background Settings */}
        {activeTab === 'background' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                Tipo de Fondo
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleUpdate({ bgType: 'default' })}
                  className={`dock-preset-pill ${currentBgType === 'default' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                >
                  Vidrio Dock (Por Defecto)
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ bgType: 'color', bgColor: custom.bgColor || '#1e293b' })}
                  className={`dock-preset-pill ${currentBgType === 'color' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                >
                  Color Sólido / Alpha
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ bgType: 'image' })}
                  className={`dock-preset-pill ${currentBgType === 'image' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                >
                  Imagen de Fondo
                </button>
              </div>
            </div>

            {currentBgType === 'color' && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                  Seleccionar Color de Fondo
                </span>
                <CustomColorPicker
                  color={custom.bgColor || '#1e293b'}
                  onChange={(hex) => handleUpdate({ bgColor: hex })}
                  label="Color del Botón"
                />
              </div>
            )}

            {currentBgType === 'image' && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div>
                  <label htmlFor="button-bg-image-url" style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                    URL Directa de la Imagen
                  </label>
                  <input
                    id="button-bg-image-url"
                    type="text"
                    value={custom.bgImage || ''}
                    onChange={(e) => handleUpdate({ bgImage: e.target.value.trim() })}
                    placeholder="https://.../textura.png o data:image/..."
                    aria-label="URL de la imagen de fondo"
                    className="login-text-input"
                    style={{ fontSize: '11.5px', height: '34px' }}
                  />
                </div>

                <div>
                  <span style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.5)', display: 'block', marginBottom: '6px' }}>
                    O elige una textura predefinida:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {BG_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => handleUpdate({ bgImage: preset.url })}
                        style={{
                          height: '42px',
                          borderRadius: '6px',
                          border: custom.bgImage === preset.url ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: `url(${preset.url}) center / cover no-repeat`,
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 700,
                          textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Icon & SVG Customization */}
        {activeTab === 'icon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                Modo de Icono / SVG
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleUpdate({ iconType: 'default' })}
                  className={`dock-preset-pill ${currentIconType === 'default' ? 'active' : ''}`}
                >
                  Icono Original
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ iconType: 'custom_svg' })}
                  className={`dock-preset-pill ${currentIconType === 'custom_svg' ? 'active' : ''}`}
                >
                  Código SVG Personalizado
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ iconType: 'custom_image' })}
                  className={`dock-preset-pill ${currentIconType === 'custom_image' ? 'active' : ''}`}
                >
                  Imagen / Icono URL
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate({ iconType: 'none' })}
                  className={`dock-preset-pill ${currentIconType === 'none' ? 'active' : ''}`}
                >
                  <EyeOff size={13} style={{ marginRight: '4px' }} />
                  Sin Icono (Sacar SVG)
                </button>
              </div>
            </div>

            {currentIconType === 'custom_svg' && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label htmlFor="custom-svg-textarea" style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0' }}>
                    Código SVG (&lt;svg&gt;...&lt;/svg&gt;)
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyOriginalSvg}
                    style={{
                      background: 'rgba(56, 189, 248, 0.1)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      color: '#38bdf8',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copiedOriginalSvg ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedOriginalSvg ? '¡SVG Copiado!' : 'Copiar SVG Original'}</span>
                  </button>
                </div>

                <textarea
                  id="custom-svg-textarea"
                  value={custom.customSvg || ''}
                  onChange={(e) => handleUpdate({ customSvg: e.target.value })}
                  placeholder={`Pega aquí el código SVG completo, por ejemplo:\n<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>`}
                  aria-label="Código SVG del botón"
                  className="login-text-input"
                  style={{
                    height: '110px',
                    fontFamily: 'monospace',
                    fontSize: '10.5px',
                    lineHeight: '1.4',
                    padding: '8px',
                    resize: 'none',
                  }}
                />
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.45)' }}>
                  💡 Tip: Puedes copiar el SVG original, modificar los trazos o colores en tu editor favorito y pegarlo aquí.
                </span>
              </div>
            )}

            {currentIconType === 'custom_image' && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <label htmlFor="custom-icon-url-input" style={{ fontSize: '11px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                  URL de Imagen o Icono Externo
                </label>
                <input
                  id="custom-icon-url-input"
                  type="text"
                  value={custom.customIconUrl || ''}
                  onChange={(e) => handleUpdate({ customIconUrl: e.target.value.trim() })}
                  placeholder="https://.../icono.png o .svg"
                  aria-label="URL del icono personalizado"
                  className="login-text-input"
                  style={{ fontSize: '11.5px', height: '34px' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Content Color */}
        {activeTab === 'color' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Ajusta el color del texto y del icono para lograr el contraste perfecto sobre tu nuevo fondo:
            </span>
            <CustomColorPicker
              color={effectiveContentColor}
              onChange={(hex) => handleUpdate({ contentColor: hex })}
              label="Color de Texto e Icono"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '14px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              launcherActions.resetDockButtonCustomization(buttonId);
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
            onClick={onClose}
            style={{
              background: 'var(--accent-primary, #00e5ff)',
              color: '#090d16',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '8px 18px',
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
      </div>
    </div>
  );
};
