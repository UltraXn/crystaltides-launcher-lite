import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  FileText,
  FolderOpen,
  RotateCcw,
  Sparkles,
  Check,
  Layout,
  Move,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ArrowUpToLine,
  ArrowDownToLine,
  Minus,
  Layers,
  Info,
  User,
  Settings as SettingsIcon,
  Rocket,
  Globe,
  Puzzle,
  Lock,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
  PROTECTED_DOCK_BUTTONS,
  useT,
  resolveEffectiveLoaderVersion,
} from '../../store/launcherStore';
import { useModuleStore } from '../../modules';
import {
  saveWallpaperFile,
  clearCustomWallpaper,
  isVideoSource,
} from '../../utils/wallpaperStorage';
import { invoke } from '@tauri-apps/api/core';
import { LogViewerModal } from './LogViewerModal';
import { ButtonCustomizerModal } from './ButtonCustomizerModal';
import {
  SettingsMinecraftSection,
  type SettingsMinecraftSectionProps,
} from './settings/SettingsMinecraftSection';
import {
  SettingsPersonalizationSection,
  type SettingsPersonalizationSectionProps,
} from './settings/SettingsPersonalizationSection';
import { CustomColorPicker } from '../common/CustomColorPicker';
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
import { isNearOpacity, resolveActiveBtnColor } from '../../utils/settingsUtils';

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

  // Module & Extension SDK
  const modules = useModuleStore((s) => s.modules);
  const enabledModuleIds = useModuleStore((s) => s.enabledModuleIds);
  const installPlugin = useModuleStore((s) => s.installPlugin);
  const [showAddExtension, setShowAddExtension] = useState(false);
  const [newExtensionName, setNewExtensionName] = useState('');
  const isModuleEnabled = useModuleStore((s) => s.isModuleEnabled);
  const toggleModule = useModuleStore((s) => s.toggleModule);
  const openModuleModal = useModuleStore((s) => s.openModal);

  // Local state for interactive editing before saving
  const initialMc = settings.mcVersion || '1.21.1';
  const [mcVersion, setMcVersion] = useState(initialMc);
  const [loaderType, setLoaderType] = useState<
    'vanilla' | 'neoforge' | 'forge' | 'fabric' | 'quilt'
  >(settings.loaderType || 'neoforge');
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
    settings.javaDistribution || 'adoptium',
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

  // Helper para resolver la versión vanilla base de Minecraft en caso de nombres locales compuestos
  const resolveBaseMinecraftVersion = (version: string): string => {
    if (!version) return '1.21.1';
    const trimmed = version.trim();
    if (trimmed.startsWith('quilt-loader-') || trimmed.startsWith('fabric-loader-')) {
      const parts = trimmed.split('-');
      const last = parts[parts.length - 1];
      if (last && /\d+\.\d+/.test(last)) return last;
    }
    const match = trimmed.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (match) return match[1];
    return trimmed;
  };

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
    if (activeModal === 'settings') {
      setMcVersion(settings.mcVersion || '1.21.1');
      setLoaderType(settings.loaderType || 'neoforge');
      setLoaderVersion(
        !settings.loaderVersion || settings.loaderVersion === '21.1.65'
          ? '21.1.252'
          : settings.loaderVersion,
      );
      setRamMb((settings.maxRamGb || 4) * 1024);
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
        const runtimesDir = `${(home || 'C:/Users/Default').replace(/\\/g, '/')}/.crystaltides/runtimes`;
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

  return (
    <>
      <div
        className="papyrus-modal-overlay"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) launcherActions.closeModal();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') launcherActions.closeModal();
        }}
      >
        <dialog
          open
          className="papyrus-settings-card"
          aria-label={t.settings.title}
          style={{ margin: 0 }}
        >
          {/* Close Button on Top Right */}
          <button
            onClick={launcherActions.closeModal}
            className="settings-card-close"
            title="Cerrar"
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>

          {/* Title & Save/Reset Actions Header */}
          <div className="settings-header-block">
            <h2 className="settings-main-title">{t.settings.title}</h2>
            <div className="settings-btn-actions">
              <button onClick={handleSave} className="settings-action-btn">
                {t.settings.saveChanges}
              </button>
              <button onClick={handleReset} className="settings-action-btn">
                {t.hudEditor.reset}
              </button>
            </div>
          </div>

          {/* Section: Language / Idioma Selector */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span
                className="settings-label-title"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Globe size={14} style={{ color: '#38bdf8' }} />
                {t.settings.languageTitle}
              </span>
            </div>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(248, 250, 252, 0.5)',
                margin: '2px 0 8px 0',
              }}
            >
              {t.settings.languageDesc}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => launcherActions.setLanguage('es')}
                className={`settings-action-btn ${language === 'es' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border:
                    language === 'es' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background:
                    language === 'es' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: language === 'es' ? '#38bdf8' : 'rgba(248, 250, 252, 0.7)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition:
                    'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                {language === 'es' && <Check size={13} color="#38bdf8" />}
                <span>{t.settings.spanish}</span>
              </button>
              <button
                type="button"
                onClick={() => launcherActions.setLanguage('en')}
                className={`settings-action-btn ${language === 'en' ? 'active' : ''}`}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border:
                    language === 'en' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background:
                    language === 'en' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: language === 'en' ? '#38bdf8' : 'rgba(248, 250, 252, 0.7)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition:
                    'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                {language === 'en' && <Check size={13} color="#38bdf8" />}
                <span>{t.settings.english}</span>
              </button>
            </div>
          </div>

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
              setLoaderVersion(resolveEffectiveLoaderVersion(newLoader, '', mcVersion) || '');
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
          <div
            className="settings-section"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}
          >
            <div className="settings-section-header">
              <span
                className="settings-label-title"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Layout size={14} style={{ color: accentColor }} />
                Personalización del Dock & Menú Principal
              </span>
              <button
                type="button"
                onClick={() => launcherActions.resetDockConfig()}
                className="wallpaper-reset-btn"
                title="Restablecer configuración del dock a valores predeterminados"
              >
                <RotateCcw size={12} />
                Restablecer Dock
              </button>
            </div>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(248, 250, 252, 0.5)',
                margin: '2px 0 10px 0',
              }}
            >
              Ajusta la posición del dock para que no tape tus fondos, personaliza los colores y
              organiza los botones:
            </p>

            {/* Banner Destacado: Entrar al Modo Edición Visual */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background:
                  'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(0, 0, 0, 0.45))',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '2px',
                  }}
                >
                  <Move size={15} style={{ color: '#38bdf8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                    Modo de Edición Visual de la GUI
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.65)' }}>
                  Arrastra libremente cualquier botón del dock o los widgets inferiores (UltraXn,
                  redes, estado) por toda la pantalla con protección de bordes.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  launcherActions.closeModal();
                  launcherActions.setEditingHud(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: '#38bdf8',
                  border: 'none',
                  color: '#090d16',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(56, 189, 248, 0.35)',
                  whiteSpace: 'nowrap',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <Move size={13} />
                <span>Entrar al Modo Edición</span>
              </button>
            </div>

            {/* 1. Posición en Pantalla */}
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
                Posición en Pantalla
              </span>
              <div className="dock-preset-group">
                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'center',
                      customCoordinates: undefined,
                    })
                  }
                  className={`dock-preset-pill ${dockConfig.positionPreset === 'center' ? 'active' : ''}`}
                >
                  <Minus size={13} />
                  <span>Centro</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'bottom',
                      customCoordinates: undefined,
                    })
                  }
                  className={`dock-preset-pill ${dockConfig.positionPreset === 'bottom' ? 'active' : ''}`}
                >
                  <ArrowDownToLine size={13} />
                  <span>Abajo (Dock Flotante)</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'top',
                      customCoordinates: undefined,
                    })
                  }
                  className={`dock-preset-pill ${dockConfig.positionPreset === 'top' ? 'active' : ''}`}
                >
                  <ArrowUpToLine size={13} />
                  <span>Arriba (Barra Superior)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (dockConfig.positionPreset !== 'free') {
                      launcherActions.setDockConfig({
                        positionPreset: 'free',
                        customCoordinates: { x: 50, y: 50 },
                      });
                    }
                  }}
                  className={`dock-preset-pill ${dockConfig.positionPreset === 'free' ? 'active' : ''}`}
                >
                  <Move size={13} />
                  <span>
                    Libre{' '}
                    {dockConfig.positionPreset === 'free' && dockConfig.customCoordinates
                      ? `(${dockConfig.customCoordinates.x}%, ${dockConfig.customCoordinates.y}%)`
                      : '(Arrastrable)'}
                  </span>
                </button>
              </div>
              {dockConfig.positionPreset === 'free' && (
                <p style={{ fontSize: '10.5px', color: accentColor, margin: '6px 0 0 0' }}>
                  Tip: En la pantalla principal puedes arrastrar directamente el dock sosteniendo el
                  botón &quot;Mover&quot;.
                </p>
              )}
            </div>

            {/* 2. Color del Botón Iniciar Juego */}
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
                Color del Botón Iniciar Juego (&quot;Start Game&quot;)
              </span>
              <div className="dock-preset-group">
                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ startBtnColorMode: 'accent' })}
                  className={`dock-preset-pill ${dockConfig.startBtnColorMode === 'accent' ? 'active' : ''}`}
                >
                  <Sparkles size={13} style={{ color: accentColor }} />
                  <span>Sincronizado con Acento ({accentColor.toUpperCase()})</span>
                </button>

                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ startBtnColorMode: 'emerald' })}
                  className={`dock-preset-pill ${dockConfig.startBtnColorMode === 'emerald' ? 'active' : ''}`}
                >
                  <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
                  <span>Verde Esmeralda Clásico</span>
                </button>

                <CustomColorPicker
                  color={dockConfig.customStartBtnColor || '#22c55e'}
                  onChange={(hex) =>
                    launcherActions.setDockConfig({
                      startBtnColorMode: 'custom',
                      customStartBtnColor: hex,
                    })
                  }
                  label="Color Propio"
                />
              </div>
            </div>

            {/* 3. Estilo y Dimensiones */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                marginBottom: '14px',
              }}
            >
              {/* Escala */}
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
                  Tamaño del Dock
                </span>
                <div className="dock-preset-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ scale: 'normal' })}
                    className={`dock-preset-pill ${dockConfig.scale === 'normal' ? 'active' : ''}`}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ scale: 'compact' })}
                    className={`dock-preset-pill ${dockConfig.scale === 'compact' ? 'active' : ''}`}
                  >
                    Compacto
                  </button>
                </div>
              </div>

              {/* Etiquetas */}
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
                  Etiquetas de Texto
                </span>
                <div className="dock-preset-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ showLabels: true })}
                    className={`dock-preset-pill ${dockConfig.showLabels ? 'active' : ''}`}
                  >
                    Iconos + Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ showLabels: false })}
                    className={`dock-preset-pill ${!dockConfig.showLabels ? 'active' : ''}`}
                  >
                    Solo Iconos
                  </button>
                </div>
              </div>

              {/* Transparencia / Cristal */}
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
                  Vidrio de Fondo
                </span>
                <div className="dock-preset-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.92 })}
                    className={`dock-preset-pill ${isNearOpacity(dockConfig.bgOpacity, 0.92) ? 'active' : ''}`}
                  >
                    Sólido (92%)
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.7 })}
                    className={`dock-preset-pill ${isNearOpacity(dockConfig.bgOpacity, 0.7) ? 'active' : ''}`}
                  >
                    Medio (70%)
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.45 })}
                    className={`dock-preset-pill ${isNearOpacity(dockConfig.bgOpacity, 0.45) ? 'active' : ''}`}
                  >
                    Translúcido (45%)
                  </button>
                </div>
              </div>

              {/* Borde */}
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
                  Bordes del Dock
                </span>
                <div className="dock-preset-group" style={{ margin: 0 }}>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ dockBorderColorMode: 'subtle' })}
                    className={`dock-preset-pill ${dockConfig.dockBorderColorMode === 'subtle' ? 'active' : ''}`}
                  >
                    Sutil Neutro
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ dockBorderColorMode: 'accent' })}
                    className={`dock-preset-pill ${dockConfig.dockBorderColorMode === 'accent' ? 'active' : ''}`}
                  >
                    Resplandor de Acento
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Organización y Visibilidad de Botones */}
            <div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#e2e8f0',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Organización y Visibilidad de Botones
              </span>
              <p
                style={{
                  fontSize: '10.5px',
                  color: 'rgba(248, 250, 252, 0.45)',
                  margin: '0 0 6px 0',
                }}
              >
                Usa las flechas para cambiar el orden de los botones en el dock o el icono de ojo
                para ocultarlos:
              </p>

              <div className="dock-buttons-reorder-list">
                {(() => {
                  const visibleButtonsSet = new Set(dockConfig.visibleButtons);
                  return dockConfig.buttonOrder.map((btnId: DockButtonId, index: number) => {
                    const isVisible = visibleButtonsSet.has(btnId);
                    const buttonLabels: Record<
                      DockButtonId,
                      { name: string; icon: React.ReactNode }
                    > = {
                      instances: {
                        name: 'Instancias (Instances)',
                        icon: <Layers size={14} color="#38bdf8" />,
                      },
                      about: {
                        name: 'Acerca de (About)',
                        icon: <Info size={14} color="#94a3b8" />,
                      },
                      accounts: {
                        name: 'Cuentas (Accounts)',
                        icon: <User size={14} color="#a855f7" />,
                      },
                      settings: {
                        name: 'Ajustes (Settings)',
                        icon: <SettingsIcon size={14} color="#cbd5e1" />,
                      },
                      launch: {
                        name: 'Iniciar Juego (Start Game)',
                        icon: <Rocket size={14} color="#22c55e" />,
                      },
                    };
                    const itemInfo = buttonLabels[btnId] || { name: btnId, icon: null };

                    const isCustomColor = Boolean(dockConfig.customButtonColors?.[btnId]);
                    const activeBtnColor = resolveActiveBtnColor(
                      btnId,
                      dockConfig.customButtonColors,
                      dockConfig.startBtnColorMode,
                      dockConfig.customStartBtnColor,
                      accentColor,
                    );

                    return (
                      <div
                        key={btnId}
                        className={`dock-reorder-item ${!isVisible ? 'disabled' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className="dock-drag-handle"
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: activeBtnColor,
                              boxShadow: `0 0 6px ${activeBtnColor}`,
                              flexShrink: 0,
                            }}
                          />
                          {itemInfo.icon}
                          <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#f8fafc' }}>
                            {itemInfo.name}
                          </span>
                        </div>

                        <div className="dock-reorder-actions" style={{ gap: '6px' }}>
                          {/* Advanced Customizer (Background, Video, SVG, Sizing, FX, Color) */}
                          <button
                            type="button"
                            onClick={() => launcherActions.openButtonCustomizer(btnId)}
                            className="dock-action-icon-btn"
                            title="Personalizar fondo, vídeo, tamaño libre, SVG o efectos especiales"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: dockConfig.buttonCustomizations?.[btnId]
                                ? 'rgba(0, 229, 255, 0.18)'
                                : 'rgba(255, 255, 255, 0.05)',
                              border: dockConfig.buttonCustomizations?.[btnId]
                                ? '1px solid rgba(0, 229, 255, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.1)',
                              color: dockConfig.buttonCustomizations?.[btnId]
                                ? '#00e5ff'
                                : '#cbd5e1',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <Sparkles size={12} />
                            <span>Personalizar</span>
                          </button>

                          {/* Individual Color Picker */}
                          <CustomColorPicker
                            color={activeBtnColor}
                            onChange={(hex) => launcherActions.setButtonColor(btnId, hex)}
                            label="Pintar"
                          />
                          {isCustomColor && (
                            <button
                              type="button"
                              onClick={() => launcherActions.setButtonColor(btnId, null)}
                              className="dock-action-icon-btn"
                              title="Restablecer color al tema predeterminado"
                              style={{ color: '#94a3b8' }}
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}

                          {/* Move Left / Up */}
                          <button
                            type="button"
                            onClick={() => launcherActions.moveDockButton(btnId, 'left')}
                            disabled={index === 0}
                            className="dock-action-icon-btn"
                            title="Mover a la izquierda / antes"
                          >
                            <ChevronUp size={14} />
                          </button>

                          {/* Move Right / Down */}
                          <button
                            type="button"
                            onClick={() => launcherActions.moveDockButton(btnId, 'right')}
                            disabled={index === dockConfig.buttonOrder.length - 1}
                            className="dock-action-icon-btn"
                            title="Mover a la derecha / después"
                          >
                            <ChevronDown size={14} />
                          </button>

                          {/* Toggle Visibility (Protected buttons cannot be hidden) */}
                          {PROTECTED_DOCK_BUTTONS.includes(btnId) ? (
                            <span
                              className="dock-action-icon-btn protected-btn"
                              title="Botón protegido del sistema (no se puede ocultar para garantizar el funcionamiento del launcher)"
                            >
                              <Lock size={12} color="#94a3b8" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => launcherActions.toggleDockButton(btnId)}
                              className={`dock-action-icon-btn ${isVisible ? 'active-eye' : ''}`}
                              title={
                                isVisible ? 'Ocultar botón del dock' : 'Mostrar botón en el dock'
                              }
                            >
                              {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Section: Plugin & Module SDK */}
          <div
            className="settings-section"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px' }}
          >
            <div className="settings-section-header">
              <span
                className="settings-label-title"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}
              >
                <Puzzle size={15} style={{ color: '#38bdf8' }} />
                Módulos &amp; Extensiones (Plugin SDK)
              </span>
              <button
                type="button"
                onClick={() => setShowAddExtension(!showAddExtension)}
                className="settings-action-btn"
                style={{ padding: '3px 8px', fontSize: '10.5px' }}
              >
                Agregar Extensión
              </button>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'rgba(248, 250, 252, 0.6)',
                  fontFamily: 'var(--font-inter)',
                }}
              >
                {modules.filter((m) => isModuleEnabled(m.id)).length} / {modules.length} Activos
              </span>
            </div>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(248, 250, 252, 0.5)',
                margin: '2px 0 12px 0',
                lineHeight: 1.45,
              }}
            >
              Arquitectura extensible SDK. Activa o desactiva herramientas modulares integradas
              (calculadoras, hubs, widgets) con integración viva en el Dock y el Launcher:
            </p>

            {showAddExtension && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  marginBottom: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                  Instalar Extensión (Plugin SDK)
                </span>
                <input
                  type="text"
                  placeholder="ej: Discord Oficial, Tienda, Mapa"
                  value={newExtensionName}
                  onChange={(e) => setNewExtensionName(e.target.value)}
                  className="login-text-input"
                  style={{
                    width: '100%',
                    height: '34px',
                    paddingLeft: '10px',
                    background: 'rgba(5, 9, 14, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#f8fafc',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newExtensionName.trim()) return;
                    installPlugin({
                      id: `custom.${Date.now()}`,
                      name: newExtensionName.trim(),
                      description: 'Personalizada',
                      author: 'Usuario',
                      version: '1.0.0',
                    });
                    setNewExtensionName('');
                    setShowAddExtension(false);
                  }}
                  className="settings-action-btn"
                  style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '5px 12px' }}
                >
                  Crear e Instalar Extensión
                </button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {modules.map((mod) => {
                const enabled = enabledModuleIds.includes(mod.id);
                const modAccent =
                  mod.accentColor || mod.slots.dockButton?.defaultColor || '#38bdf8';
                const hasModal = Boolean(mod.slots.modal);

                return (
                  <div
                    key={mod.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: enabled
                        ? 'rgba(255, 255, 255, 0.035)'
                        : 'rgba(255, 255, 255, 0.015)',
                      border: enabled
                        ? `1px solid ${modAccent}44`
                        : '1px solid rgba(255, 255, 255, 0.06)',
                      transition: 'border-color 0.2s ease, background-color 0.2s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: `${modAccent}18`,
                            border: `1px solid ${modAccent}33`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: modAccent,
                            flexShrink: 0,
                          }}
                        >
                          <Puzzle size={16} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 700,
                                color: enabled ? '#f8fafc' : 'rgba(248, 250, 252, 0.6)',
                              }}
                            >
                              {mod.name}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'rgba(248, 250, 252, 0.5)',
                                fontWeight: 600,
                              }}
                            >
                              v{mod.version}
                            </span>
                            {mod.author && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'rgba(248, 250, 252, 0.4)',
                                }}
                              >
                                por {mod.author}
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              fontSize: '11px',
                              color: 'rgba(248, 250, 252, 0.55)',
                              margin: '2px 0 0 0',
                              lineHeight: 1.35,
                            }}
                          >
                            {mod.description}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                      >
                        {hasModal && enabled && (
                          <button
                            type="button"
                            onClick={() => openModuleModal(mod.id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: `1px solid ${modAccent}55`,
                              background: `${modAccent}15`,
                              color: modAccent,
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition:
                                'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                            }}
                          >
                            Abrir
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleModule(mod.id)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: enabled
                              ? `1px solid ${modAccent}66`
                              : '1px solid rgba(255, 255, 255, 0.1)',
                            background: enabled ? `${modAccent}25` : 'rgba(255, 255, 255, 0.04)',
                            color: enabled ? '#f8fafc' : 'rgba(248, 250, 252, 0.5)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition:
                              'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                          }}
                        >
                          {enabled ? (
                            <>
                              <Check size={12} color={modAccent} />
                              Habilitado
                            </>
                          ) : (
                            'Deshabilitado'
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Slots info tags */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      {mod.slots.dockButton && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                          }}
                        >
                          Dock Integrado
                        </span>
                      )}
                      {mod.slots.modal && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(168, 85, 247, 0.1)',
                            color: '#a855f7',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                          }}
                        >
                          Herramienta Modal
                        </span>
                      )}
                      {mod.slots.widget && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                          }}
                        >
                          Widget UI
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Advanced Options Checkboxes */}
          <div className="settings-section">
            <span className="settings-label-title">Advanced Options</span>
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
                  <span className="checkbox-text">Keep launcher after launch.</span>
                </label>

                <label htmlFor="settings-disable-bg-anim" className="settings-checkbox-item">
                  <input
                    id="settings-disable-bg-anim"
                    type="checkbox"
                    checked={disableBgAnim}
                    onChange={(e) => setDisableBgAnim(e.target.checked)}
                    className="papyrus-checkbox"
                  />
                  <span className="checkbox-text">Disable animated background.</span>
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
                  <span className="checkbox-text">Disable animations.</span>
                </label>

                <label
                  htmlFor="settings-disable-hw-accel"
                  className="settings-checkbox-item"
                  aria-label="Disable hardware acceleration (Require restart)"
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
                    <span className="checkbox-text">Disable hardware acceleration.</span>
                    <span className="checkbox-subtext">(Require restart)</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Launcher Directory & Management */}
          <div className="settings-section">
            <span className="settings-label-title">Launcher Directory</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={launcherDir}
                readOnly
                aria-label="Ruta del directorio del launcher"
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
            <span className="settings-label-title" style={{ color: '#38bdf8' }}>
              Diagnóstico y Registros (Logs)
            </span>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(248, 250, 252, 0.5)',
                margin: '4px 0 10px 0',
              }}
            >
              Revisa los eventos detallados del launcher, descargas de Java, instaladores y salidas
              del juego en caso de fallo:
            </p>
            <div
              style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <span className="settings-field-label">Motor de Ejecución Java:</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setJavaDistribution('graalvm')}
                  className={`dock-preset-pill ${javaDistribution === 'graalvm' ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  GraalVM CE (Alto Rendimiento)
                </button>
                <button
                  type="button"
                  onClick={() => setJavaDistribution('adoptium')}
                  className={`dock-preset-pill ${javaDistribution === 'adoptium' ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  Eclipse Temurin (Adoptium)
                </button>
              </div>

              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => invoke('exclude_windows_defender').catch(() => {})}
                  className="settings-action-btn"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  Excluir Carpeta en Windows Defender
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
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  transition:
                    'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                }}
              >
                <FileText size={14} />
                Ver Registro del Launcher
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
                Abrir Carpeta de Logs
              </button>
            </div>
          </div>

          {/* Section 6: App Lifecycle */}
          <div
            className="settings-section"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '14px' }}
          >
            <span className="settings-label-title" style={{ color: '#FDA4AF' }}>
              Zona de Mantenimiento
            </span>
            <p
              style={{
                fontSize: '11px',
                color: 'rgba(248, 250, 252, 0.5)',
                margin: '4px 0 10px 0',
              }}
            >
              Si experimentas algún fallo o deseas limpiar registros temporales de sesiones
              anteriores:
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    '¿Deseas reiniciar la configuración y caché local de CrystalTides Launcher?',
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
              Restablecer Configuración Local
            </button>
          </div>
        </dialog>
      </div>

      {isLogViewerOpen && (
        <LogViewerModal isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
      )}

      {showHwRestartModal && (
        <div
          className="papyrus-modal-overlay"
          role="presentation"
          style={{ zIndex: 100, background: 'rgba(0, 0, 0, 0.75)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHwRestartModal(false);
              setPendingHwAccel(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowHwRestartModal(false);
              setPendingHwAccel(null);
            }
          }}
        >
          <dialog
            open
            className="papyrus-settings-card"
            aria-label="Confirm Restart"
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
                  background: 'rgba(0, 229, 255, 0.12)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary, #00e5ff)',
                }}
              >
                <RotateCcw style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
                ¿Reiniciar Launcher?
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
                  background: 'var(--accent-primary, #00e5ff)',
                  color: '#090d16',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px var(--accent-glow, rgba(0, 229, 255, 0.35))',
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

      <ButtonCustomizerModal />
    </>
  );
};

export { SettingsMinecraftSection, SettingsPersonalizationSection };
export type { SettingsMinecraftSectionProps, SettingsPersonalizationSectionProps };
