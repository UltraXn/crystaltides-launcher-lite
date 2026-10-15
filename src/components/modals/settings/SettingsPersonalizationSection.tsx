import React from 'react';
import {
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Upload,
  Link as LinkIcon,
  Volume2,
  VolumeX,
  Type,
  Palette,
  Check,
  Film,
  AlertCircle,
} from 'lucide-react';
import {
  launcherActions,
  LauncherState,
  WALLPAPERS,
  WallpaperOption,
  ACCENT_PRESETS,
  AccentColorPreset,
  useT,
  GuiFontFamily,
  GuiBgPreset,
  GuiBorderPreset,
} from '../../../store/launcherStore';
import { CustomColorPicker } from '../../common/CustomColorPicker';
import { getCustomWallpaperLabel } from '../../../utils/settingsUtils';
import { isVideoSource } from '../../../utils/wallpaperStorage';

export interface SettingsPersonalizationSectionProps {
  accentColor: string;
  guiTheme: LauncherState['guiTheme'];
  customUrlInput: string;
  setCustomUrlInput: (v: string) => void;
  wallpaperFeedback: { type: 'success' | 'error'; message: string } | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  activeWallpaperId: string | null;
  customWallpaperUrl: string | null;
  isVideoWallpaper: boolean;
  wallpaperMuted: boolean;
  wallpaperVolume: number;
  handleResetWallpaper: () => void;
  handleSelectPreset: (id: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleApplyUrl: (urlToApply?: string) => void;
  t?: ReturnType<typeof useT>;
}

export const SettingsPersonalizationSection: React.FC<SettingsPersonalizationSectionProps> = ({
  accentColor,
  guiTheme,
  customUrlInput,
  setCustomUrlInput,
  wallpaperFeedback,
  fileInputRef,
  activeWallpaperId,
  customWallpaperUrl,
  isVideoWallpaper,
  wallpaperMuted,
  wallpaperVolume,
  handleResetWallpaper,
  handleSelectPreset,
  handleFileChange,
  handleApplyUrl,
}) => {
  return (
    <>
      {/* Section: Wallpaper & Personalization */}
      <div className="settings-section">
        <div className="settings-section-header">
          <span
            className="settings-label-title"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} style={{ color: '#16A085' }} />
            Fondo de Pantalla & Personalización
          </span>
          {customWallpaperUrl && (
            <button
              type="button"
              onClick={handleResetWallpaper}
              className="wallpaper-reset-btn"
              title="Volver a los fondos oficiales"
            >
              <RotateCcw size={12} />
              Restablecer oficial
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(248, 250, 252, 0.5)',
            margin: '2px 0 8px 0',
          }}
        >
          Selecciona un entorno oficial de CrystalTides o añade tu propia imagen, GIF animado o
          vídeo (hasta 500 MB):
        </p>

        {/* Preset Wallpapers */}
        <div className="wallpaper-presets-grid">
          {WALLPAPERS.map((wp: WallpaperOption) => {
            const isSelected = !customWallpaperUrl && activeWallpaperId === wp.id;
            return (
              <div
                key={wp.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectPreset(wp.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPreset(wp.id);
                  }
                }}
                className={`wallpaper-preset-card ${isSelected ? 'active' : ''}`}
                style={{ backgroundImage: `url(${wp.url})` }}
              >
                <div className="wallpaper-preset-overlay" />
                <span className="wallpaper-preset-title">{wp.name}</span>
                {isSelected && (
                  <div style={{ position: 'absolute', top: '6px', right: '6px', zIndex: 2 }}>
                    <CheckCircle2 size={14} color="#16A085" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Custom Upload or URL */}
        <div className="wallpaper-custom-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime"
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="wallpaper-upload-btn"
              >
                <Upload size={14} />
                Subir Imagen, GIF o Vídeo
              </button>
            </div>

            {customWallpaperUrl && (
              <div className="wallpaper-active-badge">
                {isVideoWallpaper || isVideoSource(customWallpaperUrl) ? (
                  <Film size={12} color="#16A085" />
                ) : (
                  <CheckCircle2 size={12} />
                )}
                <span>{getCustomWallpaperLabel(customWallpaperUrl, isVideoWallpaper)}</span>
              </div>
            )}
          </div>

          {/* Video Audio & Volume Controls */}
          {customWallpaperUrl && (isVideoWallpaper || isVideoSource(customWallpaperUrl)) && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(21, 61, 76, 0.25)',
                border: '1px solid rgba(22, 160, 133, 0.35)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Film size={12} color="#16A085" />
                  Audio del Vídeo de Fondo:
                </span>
                <button
                  type="button"
                  onClick={() => launcherActions.setWallpaperMuted(!wallpaperMuted)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: wallpaperMuted
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(22, 160, 133, 0.18)',
                    border: wallpaperMuted
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(22, 160, 133, 0.45)',
                    color: wallpaperMuted ? '#f87171' : '#16A085',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition:
                      'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  {wallpaperMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  {wallpaperMuted ? 'Silenciado' : 'Con Sonido'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Volume2 size={12} color="rgba(248, 250, 252, 0.6)" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={wallpaperMuted ? 0 : wallpaperVolume}
                  onChange={(e) => {
                    if (wallpaperMuted) launcherActions.setWallpaperMuted(false);
                    launcherActions.setWallpaperVolume(parseFloat(e.target.value));
                  }}
                  aria-label="Volumen del fondo de pantalla"
                  style={{ flex: 1, accentColor: '#16A085', cursor: 'pointer' }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    color: '#16A085',
                    fontWeight: 600,
                    width: '32px',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {wallpaperMuted ? '0%' : `${Math.round(wallpaperVolume * 100)}%`}
                </span>
              </div>
            </div>
          )}

          {/* URL input option */}
          <div className="wallpaper-url-box">
            <input
              type="text"
              placeholder="O pega un enlace directo (ej: https://.../fondo.gif)"
              aria-label="URL directa del fondo de pantalla"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
              className="wallpaper-url-input"
            />
            <button
              type="button"
              onClick={() => handleApplyUrl()}
              className="wallpaper-url-apply-btn"
            >
              <LinkIcon
                size={12}
                style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}
              />
              Aplicar
            </button>
          </div>

          {/* Feedback message */}
          {wallpaperFeedback && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: wallpaperFeedback.type === 'success' ? '#4ade80' : '#f87171',
                marginTop: '2px',
              }}
            >
              {wallpaperFeedback.type === 'success' ? (
                <CheckCircle2 size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
              <span>{wallpaperFeedback.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section: Accent Color Customization */}
      <div
        className="settings-section"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}
      >
        <div className="settings-section-header">
          <span
            className="settings-label-title"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Palette size={14} style={{ color: accentColor }} />
            Color de Acento & Iluminación
          </span>
          {accentColor.toLowerCase() !== '#16a085' && (
            <button
              type="button"
              onClick={() => launcherActions.setAccentColor('#16A085')}
              className="wallpaper-reset-btn"
              title="Restablecer color jade oficial"
            >
              <RotateCcw size={12} />
              Restablecer a Jade
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(248, 250, 252, 0.5)',
            margin: '2px 0 8px 0',
          }}
        >
          Selecciona la paleta de iluminación que tiñe los botones, resplandores ambientales y
          bordes:
        </p>

        <div className="accent-colors-grid">
          {ACCENT_PRESETS.map((preset: AccentColorPreset) => {
            const isActive = accentColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => launcherActions.setAccentColor(preset.hex)}
                className={`accent-color-swatch ${isActive ? 'active' : ''}`}
                style={{ backgroundColor: preset.hex }}
                title={preset.name}
                aria-label={preset.name}
              >
                {isActive && <Check size={14} color="#ffffff" strokeWidth={3} />}
              </button>
            );
          })}

          {/* Custom In-App Glass Color Picker */}
          <CustomColorPicker
            color={accentColor}
            onChange={(hex) => launcherActions.setAccentColor(hex)}
            label="Personalizado"
          />
        </div>
      </div>

      {/* Section: GUI Theme & Typography Customization */}
      <div
        className="settings-section"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}
      >
        <div className="settings-section-header">
          <span
            className="settings-label-title"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Type size={14} style={{ color: accentColor }} />
            Personalización de la GUI (Tema & Tipografía)
          </span>
          {(guiTheme.fontFamily !== 'jost' ||
            guiTheme.bgMode !== 'obsidian' ||
            guiTheme.borderMode !== 'subtle' ||
            guiTheme.borderRadius !== 16) && (
            <button
              type="button"
              onClick={() => launcherActions.resetGuiTheme()}
              className="wallpaper-reset-btn"
              title="Restablecer tema de la GUI a valores predeterminados"
            >
              <RotateCcw size={12} />
              Restablecer GUI
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: '11px',
            color: 'rgba(248, 250, 252, 0.5)',
            margin: '2px 0 12px 0',
          }}
        >
          Personaliza la tipografía de la interfaz, los colores de fondo de las ventanas y los
          bordes:
        </p>

        {/* 1. Fuente / Tipografía */}
        <div style={{ marginBottom: '14px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Fuente de la Interfaz:
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'jost', label: 'Jost (Elegante)' },
              { id: 'inter', label: 'Inter (Limpia)' },
              { id: 'outfit', label: 'Outfit (Gaming)' },
              { id: 'fira-code', label: 'Fira Code (Mono)' },
              { id: 'pixel', label: 'Pixel (VT323)' },
            ].map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() =>
                  launcherActions.setGuiTheme({ fontFamily: font.id as GuiFontFamily })
                }
                className={`dock-preset-pill ${guiTheme.fontFamily === font.id ? 'active' : ''}`}
              >
                {guiTheme.fontFamily === font.id && <Check size={12} color="#16A085" />}
                <span>{font.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Color de Fondo de la GUI / Modales */}
        <div style={{ marginBottom: '14px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Color de Fondo de la GUI (Ventanas y Modales):
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'obsidian', label: 'Obsidiana Abisal', hex: '#140C30' },
              { id: 'midnight', label: 'Medianoche Océano', hex: '#14253E' },
              { id: 'amethyst', label: 'Amatista Cyber', hex: '#160a24' },
              { id: 'emerald', label: 'Petróleo Abisal', hex: '#153D4C' },
              { id: 'crimson', label: 'Carmesí Nether', hex: '#20080e' },
            ].map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => launcherActions.setGuiTheme({ bgMode: bg.id as GuiBgPreset })}
                className={`dock-preset-pill ${guiTheme.bgMode === bg.id ? 'active' : ''}`}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    backgroundColor: bg.hex,
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                />
                <span>{bg.label}</span>
              </button>
            ))}

            <CustomColorPicker
              color={guiTheme.customBgColor || '#140C30'}
              onChange={(hex) =>
                launcherActions.setGuiTheme({
                  bgMode: 'custom',
                  customBgColor: hex,
                })
              }
              label="Color Propio"
            />
          </div>
        </div>

        {/* 3. Color de Bordes de la GUI */}
        <div style={{ marginBottom: '14px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#e2e8f0',
              display: 'block',
              marginBottom: '6px',
            }}
          >
            Color de Bordes de la GUI:
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'subtle', label: 'Sutil (Translúcido)' },
              { id: 'accent', label: `Acento Dinámico (${accentColor.toUpperCase()})` },
              { id: 'cyan', label: 'Jade Abisal' },
              { id: 'amber', label: 'Oro Solar' },
            ].map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => launcherActions.setGuiTheme({ borderMode: b.id as GuiBorderPreset })}
                className={`dock-preset-pill ${guiTheme.borderMode === b.id ? 'active' : ''}`}
              >
                {guiTheme.borderMode === b.id && <Check size={12} color="#16A085" />}
                <span>{b.label}</span>
              </button>
            ))}

            <CustomColorPicker
              color={guiTheme.customBorderColor || '#16A085'}
              onChange={(hex) =>
                launcherActions.setGuiTheme({
                  borderMode: 'custom',
                  customBorderColor: hex,
                })
              }
              label="Borde Propio"
            />
          </div>
        </div>

        {/* 4. Curvatura de Bordes (Border Radius) */}
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
            Curvatura de Bordes (Radio):
          </span>
          <div className="dock-preset-group" style={{ margin: 0 }}>
            {[
              { radius: 8, label: '8px (Angular)' },
              { radius: 12, label: '12px (Suave)' },
              { radius: 16, label: '16px (Estándar)' },
              { radius: 22, label: '22px (Cápsula)' },
            ].map((r) => (
              <button
                key={r.radius}
                type="button"
                onClick={() => launcherActions.setGuiTheme({ borderRadius: r.radius })}
                className={`dock-preset-pill ${guiTheme.borderRadius === r.radius ? 'active' : ''}`}
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
