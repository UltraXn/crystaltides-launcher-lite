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
  t: propT,
}) => {
  const storeT = useT();
  const t = propT || storeT;

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
            {t.settings.wallpaperTitle}
          </span>
          {customWallpaperUrl && (
            <button
              type="button"
              onClick={handleResetWallpaper}
              className="wallpaper-reset-btn"
              title={t.settings.resetOfficialTitle}
            >
              <RotateCcw size={12} />
              {t.settings.resetOfficial}
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
          {t.settings.wallpaperDesc}
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
                {t.settings.uploadBtn}
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
                  {t.settings.videoAudio}
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
                  {wallpaperMuted ? t.settings.soundMuted : t.settings.soundActive}
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
                  aria-label={t.settings.wallpaperVolumeAria}
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
              placeholder={t.settings.directUrlPlaceholder}
              aria-label={t.settings.wallpaperUrlAria}
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
              {t.settings.apply}
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
            {t.settings.accentColorTitle}
          </span>
          {accentColor.toLowerCase() !== '#16a085' && (
            <button
              type="button"
              onClick={() => launcherActions.setAccentColor('#16A085')}
              className="wallpaper-reset-btn"
              title={t.settings.resetAccentJadeTitle}
            >
              <RotateCcw size={12} />
              {t.settings.resetAccentJade}
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
          {t.settings.accentColorDesc}
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
            label={t.settings.customColor}
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
            {t.settings.guiThemeTitle}
          </span>
          {(guiTheme.fontFamily !== 'jost' ||
            guiTheme.bgMode !== 'obsidian' ||
            guiTheme.borderMode !== 'subtle' ||
            guiTheme.borderRadius !== 16) && (
            <button
              type="button"
              onClick={() => launcherActions.resetGuiTheme()}
              className="wallpaper-reset-btn"
              title={t.settings.resetGuiTitle}
            >
              <RotateCcw size={12} />
              {t.settings.resetGui}
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
          {t.settings.guiThemeDesc}
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
            {t.settings.fontTitle}
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'jost', label: t.settings.fontJost },
              { id: 'inter', label: t.settings.fontInter },
              { id: 'outfit', label: t.settings.fontOutfit },
              { id: 'fira-code', label: t.settings.fontFiraCode },
              { id: 'pixel', label: t.settings.fontPixel },
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
            {t.settings.guiBgColorTitle}
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'obsidian', label: t.settings.bgObsidian, hex: '#140C30' },
              { id: 'midnight', label: t.settings.bgMidnight, hex: '#14253E' },
              { id: 'amethyst', label: t.settings.bgAmethyst, hex: '#160a24' },
              { id: 'emerald', label: t.settings.bgEmerald, hex: '#153D4C' },
              { id: 'crimson', label: t.settings.bgCrimson, hex: '#20080e' },
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
              label={t.settings.customBgPicker}
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
            {t.settings.guiBorderColorTitle}
          </span>
          <div className="dock-preset-group" style={{ margin: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'subtle', label: t.settings.borderSubtle },
              {
                id: 'accent',
                label: t.settings.borderDynamicAccent.replace(
                  '{accent}',
                  accentColor.toUpperCase(),
                ),
              },
              { id: 'cyan', label: t.settings.borderCyan },
              { id: 'amber', label: t.settings.borderAmber },
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
              label={t.settings.customBorderPicker}
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
            {t.settings.borderRadiusTitle}
          </span>
          <div className="dock-preset-group" style={{ margin: 0 }}>
            {[
              { radius: 8, label: t.settings.radiusAngular },
              { radius: 12, label: t.settings.radiusSoft },
              { radius: 16, label: t.settings.radiusStandard },
              { radius: 22, label: t.settings.radiusCapsule },
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
