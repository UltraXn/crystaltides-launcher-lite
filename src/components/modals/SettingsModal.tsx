import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  FolderOpen,
  Upload,
  Link as LinkIcon,
  RotateCcw,
  Sparkles,
  Palette,
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
  Volume2,
  VolumeX,
  Film,
  Globe,
  Type,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  WALLPAPERS,
  WallpaperOption,
  ACCENT_PRESETS,
  AccentColorPreset,
  DockButtonId,
  useT,
  LoaderType,
  GuiFontFamily,
  GuiBgPreset,
  GuiBorderPreset,
} from '../../store/launcherStore';
import {
  saveWallpaperFile,
  clearCustomWallpaper,
  isVideoSource,
} from '../../utils/wallpaperStorage';
import { invoke } from '@tauri-apps/api/core';
import { LogViewerModal } from './LogViewerModal';
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
import { CustomSelect, SelectOption } from '../common/CustomSelect';

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
  const [keepLauncher, setKeepLauncher] = useState(!settings.autoCloseLauncher);
  const [disableBgAnim, setDisableBgAnim] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [customVersionMode, setCustomVersionMode] = useState(false);
  const [customLoaderMode, setCustomLoaderMode] = useState(false);
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [disableHardwareAccel, setDisableHardwareAccel] = useState(() => {
    return localStorage.getItem('ct_disable_hw_accel') === 'true';
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
  const [loaderInstallStatus, setLoaderInstallStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  // Resolve user home directory
  useEffect(() => {
    invoke<string | null>('get_home_dir')
      .then((home) => {
        if (home) {
          setLauncherDir(`${home}\\.crystaltides`);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch online Minecraft versions and local installed versions
  useEffect(() => {
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
  }, [showAllVersions]);

  // Fetch available loader versions whenever mcVersion or loaderType changes
  useEffect(() => {
    let isMounted = true;

    if (loaderType === 'vanilla') {
      setAvailableLoaderVersions([]);
      return;
    }

    if (loaderType === 'fabric') {
      fetchFabricLoaderVersions(mcVersion).then((loaders) => {
        if (isMounted && loaders.length > 0) {
          setAvailableLoaderVersions(loaders);
          setLoaderVersion((current) => (!loaders.includes(current) ? loaders[0] : current));
        }
      });
    } else if (loaderType === 'quilt') {
      fetchQuiltLoaderVersions(mcVersion).then((loaders) => {
        if (isMounted && loaders.length > 0) {
          setAvailableLoaderVersions(loaders);
          setLoaderVersion((current) => (!loaders.includes(current) ? loaders[0] : current));
        }
      });
    } else if (loaderType === 'neoforge') {
      fetchNeoForgeVersions(mcVersion).then((versions) => {
        if (isMounted) {
          setAvailableLoaderVersions(versions);
          if (versions.length > 0) {
            setLoaderVersion((current) => (!versions.includes(current) ? versions[0] : current));
          }
        }
      });
    } else if (loaderType === 'forge') {
      fetchForgeVersions(mcVersion).then((versions) => {
        if (isMounted) {
          setAvailableLoaderVersions(versions);
          if (versions.length > 0) {
            setLoaderVersion((current) => (!versions.includes(current) ? versions[0] : current));
          }
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [loaderType, mcVersion]);

  if (activeModal !== 'settings') return null;

  const handleSave = () => {
    launcherActions.updateSettings({
      mcVersion,
      loaderType,
      loaderVersion,
      maxRamGb: Math.round(ramMb / 1024),
      autoCloseLauncher: !keepLauncher,
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
    localStorage.removeItem('ct_disable_hw_accel');
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
      let javaToUse = '';
      try {
        const requiredJava = getJavaVersionForMinecraft(mcVersion, loaderType, loaderVersion);
        const home = await invoke<string | null>('get_home_dir');
        const runtimesDir = `${(home || 'C:/Users/Default').replace(/\\/g, '/')}/.crystaltides/runtimes`;
        javaToUse = await ensureJava(requiredJava, runtimesDir).catch(() => '');
      } catch {
        javaToUse = '';
      }

      const result = await installLoader(
        loaderType,
        loaderVersion,
        mcVersion,
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
      setWallpaperFeedback({
        type: 'success',
        message: result.isVideo
          ? 'Vídeo de fondo configurado exitosamente (reproducción con audio habilitada).'
          : file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
            ? 'GIF animado aplicado exitosamente.'
            : 'Imagen de fondo aplicada exitosamente.',
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
    setWallpaperFeedback({
      type: 'success',
      message: isVid
        ? 'Vídeo aplicado desde enlace directo (audio habilitado).'
        : trimmed.toLowerCase().includes('.gif')
          ? 'GIF animado aplicado desde URL.'
          : 'Fondo aplicado desde URL.',
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

  // Compile version options
  const defaultPopular = [
    '1.21.1',
    '1.21.0',
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
    { value: 'neoforge', label: 'NeoForge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'forge', label: 'Forge' },
    { value: 'quilt', label: 'Quilt' },
    { value: 'vanilla', label: 'Vanilla' },
  ];

  const loaderVersionOptions: SelectOption[] = [
    ...availableLoaderVersions.map((lv) => ({ value: lv, label: lv })),
    { value: '__custom_loader__', label: t.settings.manualLoaderPlaceholder },
  ];

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
        <div
          className="papyrus-settings-card"
          role="dialog"
          aria-modal="true"
          aria-label={t.settings.title}
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
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-inter)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setCustomVersionMode(false)}
                  className="settings-action-btn"
                  style={{ padding: '0 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
                >
                  Ver Lista
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <div style={{ flex: 1 }}>
                  <CustomSelect
                    value={mcVersion}
                    onChange={(v) => {
                      if (v === '__custom_version__') {
                        setCustomVersionMode(true);
                      } else {
                        setMcVersion(v);
                      }
                    }}
                    options={mcVersionOptions}
                    height={38}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCustomVersionMode(true)}
                  title="Escribir cualquier versión manualmente"
                  style={{
                    padding: '0 10px',
                    height: '38px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Manual
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'rgba(248, 250, 252, 0.7)',
                }}
              >
                <input
                  type="checkbox"
                  checked={showAllVersions}
                  onChange={(e) => setShowAllVersions(e.target.checked)}
                  className="papyrus-checkbox"
                />
                <span>
                  Mostrar todas las versiones históricas (
                  {allVersions.length > 0 ? allVersions.length : '17+'} versiones)
                </span>
              </label>
              {isLoadingVersions && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Loader2
                    style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }}
                  />
                  Consultando Mojang...
                </span>
              )}
            </div>
          </div>

          {/* Section 0.5: Mod Loader Selector & Installer (Forge, NeoForge, Fabric, Quilt) */}
          <div
            className="settings-section"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '12px' }}
          >
            <div className="settings-section-header">
              <span className="settings-label-title">Mod Loader (Motor de Mods)</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#38bdf8',
                  fontFamily: 'var(--font-inter)',
                  textTransform: 'uppercase',
                }}
              >
                {loaderType}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '6px',
              }}
            >
              {/* Loader Type Select */}
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'rgba(248, 250, 252, 0.5)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Tipo de Loader:
                </span>
                <CustomSelect
                  value={loaderType}
                  onChange={(v) => setLoaderType(v as LoaderType)}
                  options={loaderTypeOptions}
                  height={36}
                />
              </div>

              {/* Loader Version Select */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'rgba(248, 250, 252, 0.5)',
                    }}
                  >
                    Versión del Loader:
                  </span>
                  {loaderType !== 'vanilla' && (
                    <button
                      type="button"
                      onClick={() => setCustomLoaderMode(!customLoaderMode)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {customLoaderMode ? 'Ver lista' : 'Manual'}
                    </button>
                  )}
                </div>
                {loaderType === 'vanilla' ? (
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
                ) : customLoaderMode ? (
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
                ) : availableLoaderVersions.length > 0 ? (
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
                ) : (
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
                )}
              </div>
            </div>

            {/* Action button to install mod loader */}
            {loaderType !== 'vanilla' && (
              <div
                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <button
                  type="button"
                  onClick={handleInstallLoader}
                  disabled={loaderInstallStatus.loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '6px 12px',
                    cursor: loaderInstallStatus.loading ? 'not-allowed' : 'pointer',
                    transition:
                      'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                  }}
                >
                  {loaderInstallStatus.loading ? (
                    <Loader2
                      style={{
                        width: '13px',
                        height: '13px',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  ) : (
                    <Download style={{ width: '13px', height: '13px' }} />
                  )}
                  Descargar e Instalar {loaderType} {loaderVersion}
                </button>

                {loaderInstallStatus.message && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: loaderInstallStatus.success
                        ? '#22c55e'
                        : loaderInstallStatus.loading
                          ? '#38bdf8'
                          : '#f43f5e',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {loaderInstallStatus.success && (
                      <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                    )}
                    {!loaderInstallStatus.success && !loaderInstallStatus.loading && (
                      <AlertCircle style={{ width: '13px', height: '13px' }} />
                    )}
                    {loaderInstallStatus.message}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 1: Memory (RAM) Allocation Slider */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span className="settings-label-title">Memory Allocation (RAM)</span>
              <span className="settings-label-value tabular-nums">
                {Math.round(ramMb / 1024)} GB ({ramMb} MB)
              </span>
            </div>
            <div className="settings-slider-wrapper">
              <input
                type="range"
                min="2048"
                max="16384"
                step="512"
                value={ramMb}
                onChange={(e) => setRamMb(Number(e.target.value))}
                aria-label="Asignación de memoria RAM"
                className="papyrus-range-slider"
              />
            </div>
          </div>

          {/* Section 2: Game Screen Resolution */}
          <div className="settings-section">
            <span className="settings-label-title">Game Resolution</span>
            <div className="settings-res-row">
              <div className="settings-input-group">
                <span className="settings-input-sub">Width</span>
                <input
                  type="text"
                  value={width}
                  disabled={useDesktopRes}
                  onChange={(e) => setWidth(e.target.value)}
                  aria-label="Ancho de resolución"
                  className="settings-text-input"
                />
              </div>
              <div className="settings-input-group">
                <span className="settings-input-sub">Height</span>
                <input
                  type="text"
                  value={height}
                  disabled={useDesktopRes}
                  onChange={(e) => setHeight(e.target.value)}
                  aria-label="Alto de resolución"
                  className="settings-text-input"
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

          {/* Section: Wallpaper & Personalization */}
          <div className="settings-section">
            <div className="settings-section-header">
              <span
                className="settings-label-title"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} style={{ color: '#38bdf8' }} />
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
                        <CheckCircle2 size={14} color="#38bdf8" />
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
                      <Film size={12} color="#00e5ff" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    <span>
                      {isVideoWallpaper || isVideoSource(customWallpaperUrl)
                        ? 'Vídeo de fondo en uso'
                        : customWallpaperUrl.toLowerCase().includes('.gif') ||
                            customWallpaperUrl.startsWith('data:image/gif')
                          ? 'GIF animado en uso'
                          : 'Fondo personalizado en uso'}
                    </span>
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
                    background: 'rgba(0, 229, 255, 0.05)',
                    border: '1px solid rgba(0, 229, 255, 0.2)',
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
                      <Film size={12} color="#00e5ff" />
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
                          : 'rgba(0, 229, 255, 0.15)',
                        border: wallpaperMuted
                          ? '1px solid rgba(239, 68, 68, 0.3)'
                          : '1px solid rgba(0, 229, 255, 0.3)',
                        color: wallpaperMuted ? '#f87171' : '#38bdf8',
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
                      style={{ flex: 1, accentColor: '#00e5ff', cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'rgba(248, 250, 252, 0.7)',
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
                      e.preventDefault();
                      handleApplyUrl();
                    }
                  }}
                  className="wallpaper-url-input"
                />
                <button type="button" onClick={handleApplyUrl} className="wallpaper-url-apply-btn">
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
              {accentColor.toLowerCase() !== '#00e5ff' && (
                <button
                  type="button"
                  onClick={() => launcherActions.setAccentColor('#00e5ff')}
                  className="wallpaper-reset-btn"
                  title="Restablecer color cian oficial"
                >
                  <RotateCcw size={12} />
                  Restablecer a Cian
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
              Personaliza la tipografía de la interfaz, los colores de fondo de las ventanas y los bordes:
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
                    {guiTheme.fontFamily === font.id && <Check size={12} color="#38bdf8" />}
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
                  { id: 'obsidian', label: 'Obsidiana Profunda', hex: '#0a0f18' },
                  { id: 'midnight', label: 'Medianoche Azul', hex: '#081224' },
                  { id: 'amethyst', label: 'Amatista Cyber', hex: '#160a24' },
                  { id: 'emerald', label: 'Esmeralda Abisal', hex: '#061a12' },
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
                  color={guiTheme.customBgColor || '#0a0f18'}
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
                  { id: 'cyan', label: 'Cian Cristalino' },
                  { id: 'amber', label: 'Oro Solar' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      launcherActions.setGuiTheme({ borderMode: b.id as GuiBorderPreset })
                    }
                    className={`dock-preset-pill ${guiTheme.borderMode === b.id ? 'active' : ''}`}
                  >
                    {guiTheme.borderMode === b.id && <Check size={12} color="#38bdf8" />}
                    <span>{b.label}</span>
                  </button>
                ))}

                <CustomColorPicker
                  color={guiTheme.customBorderColor || '#00e5ff'}
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
                    className={`dock-preset-pill ${dockConfig.bgOpacity === 0.92 ? 'active' : ''}`}
                  >
                    Sólido (92%)
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.7 })}
                    className={`dock-preset-pill ${dockConfig.bgOpacity === 0.7 ? 'active' : ''}`}
                  >
                    Medio (70%)
                  </button>
                  <button
                    type="button"
                    onClick={() => launcherActions.setDockConfig({ bgOpacity: 0.45 })}
                    className={`dock-preset-pill ${dockConfig.bgOpacity === 0.45 ? 'active' : ''}`}
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
                    const activeBtnColor =
                      dockConfig.customButtonColors?.[btnId] ||
                      (btnId === 'launch'
                        ? dockConfig.startBtnColorMode === 'custom' && dockConfig.customStartBtnColor
                          ? dockConfig.customStartBtnColor
                          : '#22c55e'
                        : accentColor);

                    return (
                      <div
                        key={btnId}
                        className={`dock-reorder-item ${!isVisible ? 'disabled' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
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

                          {/* Toggle Visibility */}
                          <button
                            type="button"
                            onClick={() => launcherActions.toggleDockButton(btnId)}
                            className={`dock-action-icon-btn ${isVisible ? 'active-eye' : ''}`}
                            title={isVisible ? 'Ocultar botón del dock' : 'Mostrar botón en el dock'}
                          >
                            {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
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
                onClick={() => invoke('open_logs_folder')}
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
        </div>
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
          <div
            className="papyrus-settings-card"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm Restart"
            style={{
              width: '420px',
              padding: '24px 26px',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 229, 255, 0.15)',
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
          </div>
        </div>
      )}
    </>
  );
};
