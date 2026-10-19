import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  X,
  CheckCircle2,
  FileText,
  FolderOpen,
  RotateCcw,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  useT,
  resolveEffectiveLoaderVersion,
} from '../../store/launcherStore';
import { SettingsPluginSdkSection } from './settings/SettingsPluginSdkSection';
import {
  saveWallpaperFile,
  clearCustomWallpaper,
  isVideoSource,
} from '../../utils/wallpaperStorage';
import { invoke } from '@tauri-apps/api/core';
const LogViewerModal = React.lazy(() =>
  import('./LogViewerModal').then((m) => ({ default: m.LogViewerModal })),
);
const ButtonCustomizerModal = React.lazy(() =>
  import('./ButtonCustomizerModal').then((m) => ({ default: m.ButtonCustomizerModal })),
);
const UpdaterModal = React.lazy(() =>
  import('./UpdaterModal').then((m) => ({ default: m.UpdaterModal })),
);
import { checkForAppUpdates, type AppUpdateInfo } from '../../services/updateService';
import {
  SettingsMinecraftSection,
  type SettingsMinecraftSectionProps,
} from './settings/SettingsMinecraftSection';
import {
  SettingsPersonalizationSection,
  type SettingsPersonalizationSectionProps,
} from './settings/SettingsPersonalizationSection';
import {
  SettingsDockSection,
  type SettingsDockSectionProps,
} from './settings/SettingsDockSection';
import {
  SettingsLanguageSection,
  type SettingsLanguageSectionProps,
} from './settings/SettingsLanguageSection';
import {
  fetchVanillaVersions,
  fetchInstalledLocalVersions,
  fetchFabricLoaderVersions,
  fetchQuiltLoaderVersions,
  fetchNeoForgeVersions,
  fetchForgeVersions,
  installLoader,
} from '../../services/minecraftMetadataService';
import { getJavaVersionForMinecraft, ensureJava } from '../../services/javaService';

const resolveBaseMinecraftVersion = (version: string): string => {
  if (!version) return '1.21.1';
  const trimmed = version.trim();
  if (trimmed.startsWith('quilt-loader-') || trimmed.startsWith('fabric-loader-')) {
    const parts = trimmed.split('-');
    const last = parts[parts.length - 1];
    if (last && /\d+\.\d+/.test(last)) return last;
  }
  const match = /(\d+\.\d+(?:\.\d+)?)/.exec(trimmed);
  if (match) return match[1];
  return trimmed;
};

const resolveUpdateFeedbackColor = (type: 'success' | 'available' | 'info'): string => {
  if (type === 'success') return '#34D399';
  if (type === 'available') return '#2DD4BF';
  return '#94A3B8';
};

export const SettingsModal: React.FC = () => {
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const settings = useLauncherStore((s: LauncherState) => s.settings);
  const activeWallpaperId = useLauncherStore((s: LauncherState) => s.activeWallpaperId);
  const customWallpaperUrl = useLauncherStore((s: LauncherState) => s.customWallpaperUrl);
  const isVideoWallpaper = useLauncherStore((s: LauncherState) => s.isVideoWallpaper);
  const wallpaperMuted = useLauncherStore((s: LauncherState) => s.wallpaperMuted);
  const wallpaperVolume = useLauncherStore((s: LauncherState) => s.wallpaperVolume);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);
  const guiTheme = useLauncherStore((s: LauncherState) => s.guiTheme);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const language = useLauncherStore((s: LauncherState) => s.language);
  const t = useT();

  // Local state for interactive editing before saving
  const initialMc = settings.mcVersion ?? '1.21.1';
  const [mcVersion, setMcVersion] = useState(initialMc);
  const [loaderType, setLoaderType] = useState<
    'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt'
  >(settings.loaderType ?? 'neoforge');
  const initialLoaderVer =
    !settings.loaderVersion || settings.loaderVersion === '21.1.65'
      ? '21.1.252'
      : settings.loaderVersion;
  const [loaderVersion, setLoaderVersion] = useState(initialLoaderVer);
  const [ramMb, setRamMb] = useState(settings.maxRamGb * 1024);
  const [width, setWidth] = useState('1280');
  const [height, setHeight] = useState('720');
  const [useDesktopRes, setUseDesktopRes] = useState(false);
  const [javaDistribution, setJavaDistribution] = useState<'adoptium' | 'graalvm'>(
    settings.javaDistribution ?? 'adoptium',
  );
  const [keepLauncher, setKeepLauncher] = useState(!settings.autoCloseLauncher);
  const [disableBgAnim, setDisableBgAnim] = useState(settings.disableBgAnim ?? false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [customVersionMode, setCustomVersionMode] = useState(false);
  const [customLoaderMode, setCustomLoaderMode] = useState(false);
  const [disableAnimations, setDisableAnimations] = useState(settings.disableAnimations ?? false);
  const [disableHardwareAccel, setDisableHardwareAccel] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ct_disable_hw_accel') === 'true';
  });
  const [showHwRestartModal, setShowHwRestartModal] = useState(false);
  const [pendingHwAccel, setPendingHwAccel] = useState<boolean | null>(null);
  const [launcherDir, setLauncherDir] = useState('C:\\Users\\Default\\.crystaltides');
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // Updates state
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{
    type: 'success' | 'available' | 'info';
    message: string;
  } | null>(null);
  const [foundUpdate, setFoundUpdate] = useState<AppUpdateInfo | null>(null);
  const [showUpdaterModal, setShowUpdaterModal] = useState(false);


  // Wallpaper state
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [wallpaperFeedback, setWallpaperFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dynamic lists
  const [allVersions, setAllVersions] = useState<string[]>([]);
  const [localVersions, setLocalVersions] = useState<string[]>([]);
  const [availableLoaderVersions, setAvailableLoaderVersions] = useState<string[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [showBetaLoaders, setShowBetaLoaders] = useState(false);
  const [loaderInstallStatus, setLoaderInstallStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Resolve user home directory
  useEffect(() => {
    if (activeModal !== 'settings') return;
    invoke<string | null>('get_home_dir')
      .then((home) => {
        if (home) {
          setLauncherDir(`${home}\\.crystaltides`);
        }
      })
      .catch(() => {});
  }, [activeModal]);

  // Fetch online Minecraft versions and local installed versions
  useEffect(() => {
    if (activeModal !== 'settings') return;
    let isMounted = true;
    setIsLoadingVersions(true);

    Promise.all([fetchVanillaVersions(showAllVersions), fetchInstalledLocalVersions()])
      .then(([vanillaList, localList]) => {
        if (!isMounted) return;
        setAllVersions(vanillaList);
        setLocalVersions(localList);
      })
      .catch((err) => {
        console.warn('Could not load versions:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingVersions(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeModal, showAllVersions]);


  // Fetch available loader versions whenever mcVersion, loaderType or showBetaLoaders changes
  useEffect(() => {
    if (activeModal !== 'settings') return;
    let isMounted = true;

    if (loaderType === 'vanilla') {
      setAvailableLoaderVersions([]);
      return;
    }

    const cleanMc = resolveBaseMinecraftVersion(mcVersion);

    if (loaderType === 'fabric') {
      fetchFabricLoaderVersions(cleanMc, showBetaLoaders)
        .then((loaders) => {
          if (isMounted && loaders.length > 0) {
            setAvailableLoaderVersions(loaders);
            setLoaderVersion((current) => (!loaders.includes(current) ? loaders[0] : current));
          }
        })
        .catch(() => {});
    } else if (loaderType === 'quilt') {
      fetchQuiltLoaderVersions(cleanMc, showBetaLoaders)
        .then((loaders) => {
          if (isMounted && loaders.length > 0) {
            setAvailableLoaderVersions(loaders);
            setLoaderVersion((current) => (!loaders.includes(current) ? loaders[0] : current));
          }
        })
        .catch(() => {});
    } else if (loaderType === 'neoforge') {
      fetchNeoForgeVersions(cleanMc, showBetaLoaders)
        .then((versions) => {
          if (isMounted) {
            setAvailableLoaderVersions(versions);
            if (versions.length > 0) {
              setLoaderVersion((current) => (!versions.includes(current) ? versions[0] : current));
            }
          }
        })
        .catch(() => {});
    } else if (loaderType === 'forge') {
      fetchForgeVersions(cleanMc, showBetaLoaders)
        .then((versions) => {
          if (isMounted) {
            setAvailableLoaderVersions(versions);
            if (versions.length > 0) {
              setLoaderVersion((current) => (!versions.includes(current) ? versions[0] : current));
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [activeModal, loaderType, mcVersion, showBetaLoaders]);

  useEffect(() => {
    if (activeModal !== 'settings') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        launcherActions.closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModal]);

  useEffect(() => {
    if (activeModal === 'settings') {
      setMcVersion(settings.mcVersion ?? '1.21.1');
      setLoaderType(settings.loaderType ?? 'neoforge');
      setLoaderVersion(
        !settings.loaderVersion || settings.loaderVersion === '21.1.65'
          ? '21.1.252'
          : settings.loaderVersion,
      );
      setRamMb((settings.maxRamGb ?? 4) * 1024);
      setKeepLauncher(!settings.autoCloseLauncher);
      setDisableBgAnim(settings.disableBgAnim ?? false);
      setDisableAnimations(settings.disableAnimations ?? false);
      setDisableHardwareAccel(
        typeof window !== 'undefined' &&
          window.localStorage.getItem('ct_disable_hw_accel') === 'true',
      );
    }
  }, [
    activeModal,
    settings.mcVersion,
    settings.loaderType,
    settings.loaderVersion,
    settings.maxRamGb,
    settings.autoCloseLauncher,
    settings.disableBgAnim,
    settings.disableAnimations,
  ]);

  if (activeModal !== 'settings') return null;

  const handleSave = () => {
    if (disableHardwareAccel) {
      localStorage.setItem('ct_disable_hw_accel', 'true');
    } else {
      localStorage.removeItem('ct_disable_hw_accel');
    }
    launcherActions.updateSettings({
      mcVersion,
      loaderType,
      loaderVersion,
      maxRamGb: Math.round(ramMb / 1024),
      javaDistribution,
      autoCloseLauncher: !keepLauncher,
      disableBgAnim,
      disableAnimations,
      resolution: useDesktopRes ? 'Desktop' : `${width}x${height}`,
    });
    launcherActions.closeModal();
  };

  const handleReset = () => {
    setMcVersion('1.21.1');
    setLoaderType('neoforge');
    setLoaderVersion('21.1.252');
    setRamMb(4096);
    setWidth('1280');
    setHeight('720');
    setUseDesktopRes(false);
    setKeepLauncher(false);
    setDisableBgAnim(false);
    setShowAllVersions(false);
    setDisableAnimations(false);
    setDisableHardwareAccel(false);
    launcherActions.resetDockConfig();
  };

  const handleConfirmHwRestart = async (relaunchNow: boolean) => {
    if (pendingHwAccel === null) return;
    const newValue = pendingHwAccel;
    setDisableHardwareAccel(newValue);
    localStorage.setItem('ct_disable_hw_accel', String(newValue));

    try {
      const home = await invoke<string | null>('get_home_dir');
      if (home) {
        const configPath = `${home.replace(/\\/g, '/')}/.crystaltides/hardware_config.json`;
        await invoke('write_text_file', {
          path: configPath,
          content: JSON.stringify({ disable_hardware_acceleration: newValue }, null, 2),
        });
      }
    } catch (err) {
      console.warn('Nota al persistir hardware_config.json:', err);
    }

    setShowHwRestartModal(false);
    setPendingHwAccel(null);

    if (relaunchNow) {
      try {
        await invoke('restart_app');
      } catch (err) {
        console.error('Error al reiniciar el launcher:', err);
        window.location.reload();
      }
    }
  };

  const handleInstallLoader = async () => {
    if (loaderType === 'vanilla') return;

    setLoaderInstallStatus({
      loading: true,
      message: `Descargando e instalando ${loaderType} ${loaderVersion}...`,
    });
    try {
      const cleanMc = resolveBaseMinecraftVersion(mcVersion);
      let javaToUse = '';
      try {
        const requiredJava = getJavaVersionForMinecraft(cleanMc, loaderType, loaderVersion);
        const home = await invoke<string | null>('get_home_dir');
        const runtimesDir = `${(home ?? 'C:/Users/Default').replace(/\\/g, '/')}/.crystaltides/runtimes`;
        javaToUse = await ensureJava(requiredJava, runtimesDir).catch(() => '');
      } catch {
        javaToUse = '';
      }

      const result = await installLoader(
        loaderType,
        loaderVersion,
        cleanMc,
        launcherDir.replace(/\\/g, '/'),
        javaToUse,
      );

      const updatedLocal = await fetchInstalledLocalVersions();
      setLocalVersions(updatedLocal);

      setLoaderInstallStatus({
        loading: false,
        success: true,
        message: result || `¡${loaderType} ${loaderVersion} instalado exitosamente!`,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLoaderInstallStatus({
        loading: false,
        success: false,
        message: `Error: ${errorMsg}`,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Límite aumentado a 500 MB para vídeos, GIFs y fondos en alta resolución
    const MAX_SIZE_MB = 500;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setWallpaperFeedback({
        type: 'error',
        message: `El archivo supera los ${MAX_SIZE_MB} MB máximos permitidos. Por favor elige un archivo más liviano.`,
      });
      return;
    }

    setWallpaperFeedback({
      type: 'success',
      message: 'Guardando y optimizando fondo en almacenamiento local...',
    });

    try {
      const result = await saveWallpaperFile(file);
      launcherActions.setCustomWallpaper(result.url, result.isVideo);
      let feedbackMsg = 'Imagen de fondo aplicada exitosamente.';
      if (result.isVideo) {
        feedbackMsg =
          'Vídeo de fondo configurado exitosamente (reproducción con audio habilitada).';
      } else if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
        feedbackMsg = 'GIF animado aplicado exitosamente.';
      }
      setWallpaperFeedback({
        type: 'success',
        message: feedbackMsg,
      });
      setTimeout(() => setWallpaperFeedback(null), 4500);
    } catch (err) {
      console.error('Error al guardar wallpaper:', err);
      setWallpaperFeedback({
        type: 'error',
        message: 'Ocurrió un error al guardar el archivo en almacenamiento local.',
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleApplyUrl = async () => {
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('data:')
    ) {
      setWallpaperFeedback({
        type: 'error',
        message: 'Por favor introduce una URL válida que empiece por https:// o http://',
      });
      return;
    }
    await clearCustomWallpaper();
    const isVid = isVideoSource(trimmed);
    launcherActions.setCustomWallpaper(trimmed, isVid);
    let urlFeedbackMsg = 'Fondo aplicado desde URL.';
    if (isVid) {
      urlFeedbackMsg = 'Vídeo aplicado desde enlace directo (audio habilitado).';
    } else if (trimmed.toLowerCase().includes('.gif')) {
      urlFeedbackMsg = 'GIF animado aplicado desde URL.';
    }
    setWallpaperFeedback({
      type: 'success',
      message: urlFeedbackMsg,
    });
    setCustomUrlInput('');
    setTimeout(() => setWallpaperFeedback(null), 4000);
  };

  const handleSelectPreset = async (id: string) => {
    await clearCustomWallpaper();
    launcherActions.setCustomWallpaper(null, false);
    launcherActions.setWallpaper(id);
    setWallpaperFeedback({
      type: 'success',
      message: 'Fondo oficial aplicado.',
    });
    setTimeout(() => setWallpaperFeedback(null), 3000);
  };

  const handleResetWallpaper = async () => {
    await clearCustomWallpaper();
    launcherActions.setCustomWallpaper(null, false);
    launcherActions.setWallpaper('ct_night');
    setWallpaperFeedback({
      type: 'success',
      message: 'Restablecido al fondo por defecto.',
    });
    setTimeout(() => setWallpaperFeedback(null), 3000);
  };

  const handleCheckUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      const info = await checkForAppUpdates();
      if (info.available && info.version) {
        setFoundUpdate(info);
        setUpdateFeedback({
          type: 'available',
          message: `${t.settings.updateAvailable} (v${info.version})`,
        });
        setShowUpdaterModal(true);
      } else {
        setUpdateFeedback({
          type: 'success',
          message: `${t.settings.upToDate} (v${info.currentVersion})`,
        });
      }
    } catch {
      setUpdateFeedback({
        type: 'info',
        message: t.settings.offlineUpdates,
      });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <>
      <div className="papyrus-modal-overlay">
        <button
          type="button"
          aria-label={t.settings.close}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'default',
          }}
          onClick={() => launcherActions.closeModal()}
        />
        <dialog
          open
          className="papyrus-settings-card settings-modal-dialog"
          aria-label={t.settings.title}
          style={{ margin: 0, padding: 0 }}
        >
          {/* Header fijo / Sticky: Título, Botones de Acción y Cierre */}
          <div className="settings-header-block">
            <h2 className="settings-main-title">{t.settings.title}</h2>
            <div className="settings-header-actions">
              <div className="settings-btn-actions">
                <button onClick={handleSave} className="settings-action-btn primary">
                  {t.settings.saveChanges}
                </button>
                <button onClick={handleReset} className="settings-action-btn">
                  {t.hudEditor.reset}
                </button>
              </div>
              <button
                onClick={launcherActions.closeModal}
                className="settings-card-close"
                title={t.settings.close}
                aria-label={t.settings.close}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>

          {/* Cuerpo scrolleable con todas las secciones de ajustes */}
          <div className="settings-modal-body">
            {/* Section: Language / Idioma Selector */}
            <SettingsLanguageSection language={language} t={t} />

            {/* Section 0: Minecraft Version Selector */}
            <SettingsMinecraftSection
              t={t}
              language={language}
              mcVersion={mcVersion}
              setMcVersion={setMcVersion}
              showAllVersions={showAllVersions}
              setShowAllVersions={setShowAllVersions}
              customVersionMode={customVersionMode}
              setCustomVersionMode={setCustomVersionMode}
              allVersions={allVersions}
              localVersions={localVersions}
              isLoadingVersions={isLoadingVersions}
              loaderType={loaderType}
              setLoaderType={(newLoader) => {
                setLoaderType(newLoader);
                setLoaderVersion(resolveEffectiveLoaderVersion(newLoader, '', mcVersion) ?? '');
              }}
              loaderVersion={loaderVersion}
              setLoaderVersion={setLoaderVersion}
              customLoaderMode={customLoaderMode}
              setCustomLoaderMode={setCustomLoaderMode}
              availableLoaderVersions={availableLoaderVersions}
              loaderInstallStatus={loaderInstallStatus}
              handleInstallLoader={handleInstallLoader}
              showBetaLoaders={showBetaLoaders}
              setShowBetaLoaders={setShowBetaLoaders}
              ramMb={ramMb}
              setRamMb={setRamMb}
              width={width}
              setWidth={setWidth}
              height={height}
              setHeight={setHeight}
              useDesktopRes={useDesktopRes}
              setUseDesktopRes={setUseDesktopRes}
            />

            {/* Section: Wallpaper & Personalization */}
            <SettingsPersonalizationSection
              accentColor={accentColor}
              guiTheme={guiTheme}
              customUrlInput={customUrlInput}
              setCustomUrlInput={setCustomUrlInput}
              wallpaperFeedback={wallpaperFeedback}
              fileInputRef={fileInputRef}
              activeWallpaperId={activeWallpaperId}
              customWallpaperUrl={customWallpaperUrl}
              isVideoWallpaper={isVideoWallpaper}
              wallpaperMuted={wallpaperMuted}
              wallpaperVolume={wallpaperVolume}
              handleResetWallpaper={handleResetWallpaper}
              handleSelectPreset={handleSelectPreset}
              handleFileChange={handleFileChange}
              handleApplyUrl={handleApplyUrl}
              t={t}
            />

            {/* Section: Dock & Main Menu Customization */}
            <SettingsDockSection
              dockConfig={dockConfig}
              accentColor={accentColor}
              t={t}
            />

            {/* Section: Plugin & Module SDK */}
            <SettingsPluginSdkSection />

            {/* Section 3: Advanced Options Checkboxes */}
            <div className="settings-section">
              <span className="settings-label-title">{t.settings.advancedOptionsTitle}</span>
              <div className="settings-grid-checkboxes">
                <div className="settings-col-checkboxes">
                  <label htmlFor="settings-keep-launcher" className="settings-checkbox-item">
                    <input
                      id="settings-keep-launcher"
                      type="checkbox"
                      checked={keepLauncher}
                      onChange={(e) => setKeepLauncher(e.target.checked)}
                      className="papyrus-checkbox"
                    />
                    <span className="checkbox-text">{t.settings.keepLauncher}</span>
                  </label>

                  <label htmlFor="settings-disable-bg-anim" className="settings-checkbox-item">
                    <input
                      id="settings-disable-bg-anim"
                      type="checkbox"
                      checked={disableBgAnim}
                      onChange={(e) => setDisableBgAnim(e.target.checked)}
                      className="papyrus-checkbox"
                    />
                    <span className="checkbox-text">{t.settings.disableBgAnim}</span>
                  </label>
                </div>

                <div className="settings-col-checkboxes">
                  <label htmlFor="settings-disable-animations" className="settings-checkbox-item">
                    <input
                      id="settings-disable-animations"
                      type="checkbox"
                      checked={disableAnimations}
                      onChange={(e) => setDisableAnimations(e.target.checked)}
                      className="papyrus-checkbox"
                    />
                    <span className="checkbox-text">{t.settings.disableAnimations}</span>
                  </label>

                  <label
                    htmlFor="settings-disable-hw-accel"
                    className="settings-checkbox-item"
                    aria-label={`${t.settings.disableHwAccel} ${t.settings.requiresRestart}`}
                  >
                    <input
                      id="settings-disable-hw-accel"
                      type="checkbox"
                      checked={disableHardwareAccel}
                      onChange={(e) => {
                        setPendingHwAccel(e.target.checked);
                        setShowHwRestartModal(true);
                      }}
                      className="papyrus-checkbox"
                    />
                    <span className="checkbox-multi-line">
                      <span className="checkbox-text">{t.settings.disableHwAccel}</span>
                      <span className="checkbox-subtext">{t.settings.requiresRestart}</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 4: Launcher Directory & Management */}
            <div className="settings-section">
              <span className="settings-label-title">{t.settings.launcherDirTitle}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={launcherDir}
                  readOnly
                  aria-label={t.settings.launcherDirAria}
                  className="settings-dir-input"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            {/* Section 5: Diagnóstico y Registros (Logs) */}
            <div
              className="settings-section"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '14px' }}
            >
              <span className="settings-label-title" style={{ color: '#16A085' }}>
                {t.settings.diagnosticsTitle}
              </span>
              <p
                style={{
                  fontSize: '11px',
                  color: 'rgba(248, 250, 252, 0.5)',
                  margin: '4px 0 10px 0',
                }}
              >
                {t.settings.diagnosticsDesc}
              </p>
              <div
                style={{
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <span className="settings-field-label">{t.settings.javaRuntimeTitle}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setJavaDistribution('graalvm')}
                    className={`dock-preset-pill ${javaDistribution === 'graalvm' ? 'active' : ''}`}
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    {t.settings.graalvmLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => setJavaDistribution('adoptium')}
                    className={`dock-preset-pill ${javaDistribution === 'adoptium' ? 'active' : ''}`}
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    {t.settings.adoptiumLabel}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsLogViewerOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(22, 160, 133, 0.14)',
                    border: '1px solid rgba(22, 160, 133, 0.35)',
                    borderRadius: '8px',
                    color: '#16A085',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    transition:
                      'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  <FileText size={14} />
                  {t.settings.viewLogsBtn}
                </button>

                <button
                  type="button"
                  onClick={() => invoke('open_logs_folder').catch(() => {})}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    transition:
                      'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  <FolderOpen size={14} />
                  {t.settings.openLogsFolderBtn}
                </button>
              </div>
            </div>

            {/* Section: Actualizaciones del Sistema */}
            <div
              className="settings-section"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '14px' }}
            >
              <div className="settings-section-header">
                <span
                  className="settings-label-title"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2DD4BF' }}
                >
                  <Sparkles size={14} style={{ color: '#2DD4BF' }} />
                  {t.settings.updatesTitle}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'monospace',
                  }}
                >
                  v0.1.2-lite
                </span>
              </div>
              <p
                style={{
                  fontSize: '11px',
                  color: 'rgba(248, 250, 252, 0.5)',
                  margin: '4px 0 10px 0',
                }}
              >
                {t.settings.updatesDesc}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isCheckingUpdate}
                  onClick={handleCheckUpdates}
                  className="settings-action-btn"
                  style={{
                    background: isCheckingUpdate
                      ? 'rgba(45, 212, 191, 0.1)'
                      : 'rgba(45, 212, 191, 0.15)',
                    border: '1px solid rgba(45, 212, 191, 0.35)',
                    borderRadius: '8px',
                    color: '#2DD4BF',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '8px 14px',
                    cursor: isCheckingUpdate ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <RefreshCw
                    size={13}
                    style={{
                      animation: isCheckingUpdate ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                  <span>
                    {isCheckingUpdate ? t.settings.checkingUpdates : t.settings.checkUpdatesBtn}
                  </span>
                </button>

                {updateFeedback && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11.5px',
                      color: resolveUpdateFeedbackColor(updateFeedback.type),
                    }}
                  >
                    {updateFeedback.type === 'success' && <CheckCircle2 size={13} />}
                    {updateFeedback.type === 'available' && <Sparkles size={13} />}
                    <span>{updateFeedback.message}</span>
                    {updateFeedback.type === 'available' && foundUpdate && (
                      <button
                        type="button"
                        onClick={() => setShowUpdaterModal(true)}
                        style={{
                          background: 'linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%)',
                          border: 'none',
                          color: '#052A26',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          marginLeft: '4px',
                        }}
                      >
                        {t.settings.viewDetails}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Section 6: App Lifecycle */}
            <div
              className="settings-section"
              style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '14px' }}
            >
              <span className="settings-label-title" style={{ color: '#FDA4AF' }}>
                {t.settings.maintenanceTitle}
              </span>
              <p
                style={{
                  fontSize: '11px',
                  color: 'rgba(248, 250, 252, 0.5)',
                  margin: '4px 0 10px 0',
                }}
              >
                {t.settings.maintenanceDesc}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      t.settings.resetLocalConfigConfirm,
                    )
                  ) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  borderRadius: '8px',
                  color: '#FDA4AF',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                {t.settings.resetLocalConfigBtn}
              </button>
            </div>
          </div>
        </dialog>
      </div>

      {isLogViewerOpen && (
        <Suspense fallback={null}>
          <LogViewerModal isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
        </Suspense>
      )}

      {showUpdaterModal && foundUpdate && (
        <Suspense fallback={null}>
          <UpdaterModal updateInfo={foundUpdate} onClose={() => setShowUpdaterModal(false)} />
        </Suspense>
      )}

      {showHwRestartModal && (
        <div
          className="papyrus-modal-overlay"
          style={{ zIndex: 20100, background: 'rgba(0, 0, 0, 0.75)' }}
        >
          <button
            type="button"
            aria-label={t.settings.cancel}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'default',
            }}
            onClick={() => {
              setShowHwRestartModal(false);
              setPendingHwAccel(null);
            }}
          />
          <dialog
            open
            className="papyrus-settings-card"
            aria-label={t.settings.confirmRestartAria}
            style={{
              width: '420px',
              padding: '24px 26px',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 229, 255, 0.15)',
              margin: 0,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(22, 160, 133, 0.15)',
                  border: '1px solid rgba(22, 160, 133, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary, #16A085)',
                }}
              >
                <RotateCcw style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                {t.settings.hwRestartRequiredTitle}
              </h3>
            </div>

            <p
              style={{
                fontSize: '13px',
                lineHeight: '1.5',
                color: 'rgba(248, 250, 252, 0.8)',
                margin: '8px 0 16px 0',
              }}
            >
              {pendingHwAccel ? t.settings.hwRestartDisableDesc : t.settings.hwRestartEnableDesc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleConfirmHwRestart(true)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'var(--accent-primary, #16A085)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--accent-glow, rgba(22, 160, 133, 0.35))',
                }}
              >
                <RotateCcw style={{ width: '15px', height: '15px' }} />
                {t.settings.restartNow}
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleConfirmHwRestart(false)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {t.settings.restartLater}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowHwRestartModal(false);
                    setPendingHwAccel(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'rgba(248, 250, 252, 0.6)',
                    fontWeight: 500,
                    fontSize: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {t.settings.cancel}
                </button>
              </div>
            </div>
          </dialog>
        </div>
      )}

      <Suspense fallback={null}>
        <ButtonCustomizerModal />
      </Suspense>
    </>
  );
};

export {
  SettingsMinecraftSection,
  SettingsPersonalizationSection,
  SettingsDockSection,
  SettingsLanguageSection,
};
export type {
  SettingsMinecraftSectionProps,
  SettingsPersonalizationSectionProps,
  SettingsDockSectionProps,
  SettingsLanguageSectionProps,
};
