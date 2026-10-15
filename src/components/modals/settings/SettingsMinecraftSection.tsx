import React from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';
import { useT, resolveEffectiveLoaderVersion } from '../../../store/launcherStore';
import { CustomSelect, SelectOption } from '../../common/CustomSelect';
import { LoaderIconBadge } from '../../common/LoaderIcons';

export interface SettingsMinecraftSectionProps {
  t: ReturnType<typeof useT>;
  language: string;
  mcVersion: string;
  setMcVersion: (v: string) => void;
  showAllVersions: boolean;
  setShowAllVersions: (b: boolean) => void;
  customVersionMode: boolean;
  setCustomVersionMode: (b: boolean) => void;
  allVersions: string[];
  localVersions: string[];
  isLoadingVersions: boolean;
  loaderType: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt';
  setLoaderType: (t: 'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt') => void;
  loaderVersion: string;
  setLoaderVersion: (v: string) => void;
  customLoaderMode: boolean;
  setCustomLoaderMode: (b: boolean) => void;
  availableLoaderVersions: string[];
  loaderInstallStatus: { loading: boolean; success?: boolean; message?: string };
  handleInstallLoader: () => void;
  showBetaLoaders?: boolean;
  setShowBetaLoaders?: (b: boolean) => void;
  ramMb: number;
  setRamMb: (v: number) => void;
  width: string;
  setWidth: (v: string) => void;
  height: string;
  setHeight: (v: string) => void;
  useDesktopRes: boolean;
  setUseDesktopRes: (b: boolean) => void;
}

export const SettingsMinecraftSection: React.FC<SettingsMinecraftSectionProps> = ({
  t,
  language: _language,
  mcVersion,
  setMcVersion,
  showAllVersions,
  setShowAllVersions,
  customVersionMode,
  setCustomVersionMode,
  allVersions,
  localVersions,
  isLoadingVersions,
  loaderType,
  setLoaderType,
  loaderVersion,
  setLoaderVersion,
  customLoaderMode,
  setCustomLoaderMode,
  availableLoaderVersions,
  loaderInstallStatus,
  handleInstallLoader,
  showBetaLoaders,
  setShowBetaLoaders,
  ramMb,
  setRamMb,
  width,
  setWidth,
  height,
  setHeight,
  useDesktopRes,
  setUseDesktopRes,
}) => {
  const [showLoaderModal, setShowLoaderModal] = React.useState(false);
  const defaultPopular = [
    '1.21.1',
    '1.20.4',
    '1.20.1',
    '1.19.4',
    '1.18.2',
    '1.16.5',
    '1.12.2',
    '1.8.9',
  ];
  const displayVersions = showAllVersions && allVersions.length > 0 ? allVersions : defaultPopular;

  const mcVersionOptions: SelectOption[] = [
    { value: '1.21.1', label: `1.21.1 (${t.instances.officialTag} CrystalTides SMP)` },
    ...localVersions.map((v) => ({
      value: v,
      label: v,
      group: t.settings.installedLocallyGroup,
    })),
    ...displayVersions
      .filter((v) => v !== '1.21.1')
      .map((v) => ({
        value: v,
        label: `Minecraft ${v}`,
        group: t.settings.officialMojangGroup,
      })),
    { value: '__custom_version__', label: t.settings.manualVersionPlaceholder },
  ];

  const loaderTypeOptions: SelectOption[] = [
    { value: 'neoforge', label: 'NeoForge', icon: <LoaderIconBadge type="neoforge" size={18} /> },
    { value: 'fabric', label: 'Fabric', icon: <LoaderIconBadge type="fabric" size={18} /> },
    { value: 'forge', label: 'Forge', icon: <LoaderIconBadge type="forge" size={18} /> },
    { value: 'quilt', label: 'Quilt', icon: <LoaderIconBadge type="quilt" size={18} /> },
    { value: 'vanilla', label: 'Vanilla', icon: <LoaderIconBadge type="vanilla" size={18} /> },
  ];

  const loaderVersionOptions: SelectOption[] = [
    ...availableLoaderVersions.map((lv) => ({ value: lv, label: lv })),
    { value: '__custom_loader__', label: t.settings.manualLoaderPlaceholder },
  ];

  const renderLoaderInput = () => {
    if (loaderType === 'vanilla') {
      return (
        <input
          type="text"
          value="N/A (Vanilla Puro)"
          disabled
          aria-label="Versión del loader no aplicable"
          className="login-text-input"
          style={{
            width: '100%',
            height: '36px',
            background: 'rgba(255, 255, 255, 0.03)',
            color: 'rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            fontSize: '12px',
            paddingLeft: '10px',
          }}
        />
      );
    }
    if (customLoaderMode) {
      return (
        <input
          type="text"
          value={loaderVersion}
          onChange={(e) => setLoaderVersion(e.target.value.trim())}
          placeholder="Ej. 21.1.252, 0.16.10, 47.3.0..."
          aria-label="Versión personalizada del loader"
          className="login-text-input"
          style={{
            width: '100%',
            height: '36px',
            paddingLeft: '10px',
            background: 'rgba(5, 9, 14, 0.75)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        />
      );
    }
    if (availableLoaderVersions.length > 0) {
      return (
        <CustomSelect
          value={loaderVersion}
          onChange={(v) => {
            if (v === '__custom_loader__') {
              setCustomLoaderMode(true);
            } else {
              setLoaderVersion(v);
            }
          }}
          options={loaderVersionOptions}
          height={36}
        />
      );
    }
    return (
      <input
        type="text"
        value={loaderVersion}
        onChange={(e) => setLoaderVersion(e.target.value.trim())}
        placeholder="Ej. 21.1.252, 0.16.10 o versión custom"
        aria-label="Versión del loader"
        className="login-text-input"
        style={{
          width: '100%',
          height: '36px',
          paddingLeft: '10px',
          background: 'rgba(5, 9, 14, 0.75)',
          color: '#f1f5f9',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '8px',
          fontSize: '12px',
        }}
      />
    );
  };

  return (
    <>
      {/* Section 0: Minecraft Version Selector */}
      <div className="settings-section">
        <div className="settings-section-header">
          <span className="settings-label-title">{t.settings.mcVersion}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#22c55e',
              fontFamily: 'var(--font-inter)',
            }}
          >
            {mcVersion} {loaderType !== 'vanilla' ? `(${loaderType})` : '(Vanilla)'}
          </span>
        </div>

        {customVersionMode ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <input
              type="text"
              value={mcVersion}
              onChange={(e) => setMcVersion(e.target.value.trim())}
              placeholder="Escribe versión (ej. 26.2, 1.21.4, 25w10a, 1.16.5...)"
              aria-label="Versión personalizada de Minecraft"
              className="login-text-input"
              style={{
                flex: 1,
                height: '38px',
                paddingLeft: '12px',
                paddingRight: '12px',
                background: 'rgba(5, 9, 14, 0.75)',
                color: '#22c55e',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            />
            <button
              type="button"
              onClick={() => setCustomVersionMode(false)}
              className="settings-action-btn"
              style={{ height: '38px', fontSize: '11px', padding: '0 12px' }}
            >
              Lista
            </button>
          </div>
        ) : (
          <div style={{ marginTop: '6px' }}>
            <CustomSelect
              value={mcVersion}
              onChange={(val) => {
                if (val === '__custom_version__') {
                  setCustomVersionMode(true);
                } else {
                  setMcVersion(val);
                }
              }}
              options={mcVersionOptions}
              height={38}
            />
          </div>
        )}

        <div style={{ marginTop: '8px' }}>
          <label
            htmlFor="settings-show-all-versions"
            className="settings-checkbox-item"
            style={{ cursor: isLoadingVersions ? 'wait' : 'pointer' }}
          >
            <input
              id="settings-show-all-versions"
              type="checkbox"
              checked={showAllVersions}
              disabled={isLoadingVersions}
              onChange={(e) => setShowAllVersions(e.target.checked)}
              className="papyrus-checkbox"
            />
            <span className="checkbox-text">
              {isLoadingVersions
                ? 'Consultando lista completa de versiones a Mojang...'
                : 'Mostrar todas las versiones y snapshots'}
            </span>
          </label>
        </div>
      </div>

      {/* Section 1: Mod Loader Engine & Version */}
      <div
        className="settings-section"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '14px' }}
      >
        <div className="settings-section-header">
          <span
            className="settings-label-title"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={14} style={{ color: '#00e5ff' }} />
            {t.settings.loaderType}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.5)' }}>
            {loaderType === 'neoforge' && 'Recomendado para CrystalTides SMP'}
            {loaderType === 'fabric' && 'Alto rendimiento (Sodium/Iris compatible)'}
            {loaderType === 'quilt' && 'Ecosistema moderno compatible con Fabric'}
            {loaderType === 'forge' && 'Motor clásico para modpacks legacy'}
            {loaderType === 'vanilla' && 'Sin modificaciones'}
          </span>
        </div>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}
        >
          <div>
            <label className="settings-field-label">Tipo de Cargador</label>
            <CustomSelect
              value={loaderType}
              onChange={(val) => {
                const newLoader = val as any;
                setLoaderType(newLoader);
                setLoaderVersion(resolveEffectiveLoaderVersion(newLoader, '', mcVersion) || '');
              }}
              options={loaderTypeOptions}
              height={36}
            />
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <label className="settings-field-label" style={{ marginBottom: 0 }}>
                Versión del Loader
              </label>
              {loaderType !== 'vanilla' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {setShowBetaLoaders && (
                    <label
                      htmlFor="settings-show-beta-loaders"
                      className="settings-checkbox-item"
                      style={{ cursor: 'pointer', marginRight: '2px' }}
                    >
                      <input
                        id="settings-show-beta-loaders"
                        type="checkbox"
                        checked={showBetaLoaders ?? false}
                        onChange={(e) => setShowBetaLoaders(e.target.checked)}
                        className="papyrus-checkbox"
                        aria-checked={showBetaLoaders ? 'true' : 'false'}
                      />
                      <span className="checkbox-text" style={{ fontSize: '11px' }}>Ver Betas</span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLoaderModal(true)}
                    className="settings-action-btn"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
                    title="Abrir asistente de instalación"
                  >
                    Elegir otra versión o loader
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomLoaderMode(!customLoaderMode)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      textDecoration: 'underline',
                    }}
                  >
                    {customLoaderMode ? 'Ver Lista' : 'Manual'}
                  </button>
                </div>
              )}
            </div>
            {renderLoaderInput()}
            {showLoaderModal &&
              (typeof document !== 'undefined' ? (
                createPortal(
                  <div
                    className="papyrus-modal-overlay"
                    role="presentation"
                    style={{ zIndex: 100000, background: 'rgba(2, 6, 23, 0.75)' }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setShowLoaderModal(false);
                    }}
                  >
                    <dialog
                      open
                      className="papyrus-settings-card"
                      aria-label="Descargar e Instalar Mod Loader"
                      style={{
                        margin: 'auto',
                        padding: '24px',
                        width: '460px',
                        maxWidth: '92vw',
                        background: 'rgba(11, 19, 34, 0.98)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        boxShadow:
                          '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(56, 189, 248, 0.15)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                          paddingBottom: '10px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Zap size={18} style={{ color: '#00e5ff' }} />
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '15px',
                              fontWeight: 700,
                              color: '#f8fafc',
                            }}
                          >
                            Descargar e Instalar Mod Loader
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLoaderModal(false)}
                          className="settings-card-close"
                          title="Cerrar"
                          style={{ position: 'static' }}
                        >
                          ✕
                        </button>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          fontSize: '12px',
                          color: 'rgba(248, 250, 252, 0.85)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <span>1. Versión Base de Minecraft:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#22c55e',
                              fontFamily: 'monospace',
                              background: 'rgba(34, 197, 94, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {mcVersion}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <span>2. Mod Loader (Motor de Mods):</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#00e5ff',
                              textTransform: 'uppercase',
                              background: 'rgba(0, 229, 255, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {loaderType}
                          </span>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <span>3. Versión del Loader a descargar:</span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: '#38bdf8',
                              fontFamily: 'monospace',
                              background: 'rgba(56, 189, 248, 0.12)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            {loaderVersion || 'Recomendada'}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          marginTop: '20px',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setShowLoaderModal(false)}
                          className="settings-action-btn"
                        >
                          Cerrar
                        </button>
                        {loaderType !== 'vanilla' && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowLoaderModal(false);
                              handleInstallLoader();
                            }}
                            className="settings-action-btn primary"
                            style={{
                              background: 'rgba(0, 229, 255, 0.2)',
                              borderColor: '#00e5ff',
                              color: '#00e5ff',
                              fontWeight: 700,
                            }}
                          >
                            Descargar e Instalar Ahora
                          </button>
                        )}
                      </div>
                    </dialog>
                  </div>,
                  document.body,
                )
              ) : null)}
          </div>
        </div>

        {loaderType !== 'vanilla' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '10px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#f8fafc' }}>
                ¿No tienes instalado {loaderType} {loaderVersion}?
              </span>
              <button
                type="button"
                onClick={handleInstallLoader}
                disabled={loaderInstallStatus.loading}
                className="settings-action-btn"
                style={{
                  fontSize: '11px',
                  padding: '4px 12px',
                  background: 'rgba(0, 229, 255, 0.15)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                }}
              >
                {loaderInstallStatus.loading
                  ? 'Descargando e instalando...'
                  : `Descargar e Instalar ${loaderType} ${loaderVersion}`}
              </button>
            </div>
            {loaderInstallStatus.message && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: loaderInstallStatus.success ? '#22c55e' : '#f43f5e',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: loaderInstallStatus.success
                    ? 'rgba(34, 197, 94, 0.1)'
                    : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${loaderInstallStatus.success ? 'rgba(34, 197, 94, 0.25)' : 'rgba(244, 63, 94, 0.25)'}`,
                  wordBreak: 'break-word',
                }}
              >
                {loaderInstallStatus.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Memory Allocated (RAM) */}
      <div className="settings-section">
        <div className="settings-section-header">
          <span className="settings-label-title">{t.settings.memoryTitle}</span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#38bdf8',
              fontFamily: 'var(--font-inter)',
            }}
          >
            {Math.round(ramMb / 1024)} GB ({ramMb} MB)
          </span>
        </div>
        <div className="settings-ram-slider-wrapper">
          <input
            type="range"
            min="2048"
            max="16384"
            step="512"
            value={ramMb}
            onChange={(e) => setRamMb(Number(e.target.value))}
            className="papyrus-range-slider"
          />
        </div>
        <div className="settings-ram-markers">
          <span>2 GB</span>
          <span>4 GB (Base)</span>
          <span>8 GB (Recomendado)</span>
          <span>16 GB</span>
        </div>
      </div>

      {/* Section 2.5: Game Resolution */}
      <div className="settings-section">
        <span className="settings-label-title">{t.settings.resolutionTitle}</span>
        <div className="settings-resolution-grid">
          <div className="settings-res-input-group">
            <span className="settings-res-label">{t.settings.resWidth}:</span>
            <input
              type="text"
              value={width}
              disabled={useDesktopRes}
              onChange={(e) => setWidth(e.target.value)}
              className="settings-res-input"
            />
          </div>
          <div className="settings-res-input-group">
            <span className="settings-res-label">{t.settings.resHeight}:</span>
            <input
              type="text"
              value={height}
              disabled={useDesktopRes}
              onChange={(e) => setHeight(e.target.value)}
              className="settings-res-input"
            />
          </div>
        </div>
        <div className="settings-res-checkbox">
          <label htmlFor="settings-res-desktop" className="settings-checkbox-item">
            <input
              id="settings-res-desktop"
              type="checkbox"
              checked={useDesktopRes}
              onChange={(e) => setUseDesktopRes(e.target.checked)}
              className="papyrus-checkbox"
            />
            <span className="checkbox-text">Use desktop resolution.</span>
          </label>
        </div>
      </div>
    </>
  );
};
