import React, { useEffect, useState } from 'react';
import {
  Monitor,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Box,
  Sword,
  Feather,
  Flame,
  Shield,
  Sparkles,
  Pencil,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '../common/CustomSelect';
import { LoaderIconBadge } from '../common/LoaderIcons';
import {
  LoaderType,
  launcherActions,
  useT,
  resolveEffectiveLoaderVersion,
} from '../../store/launcherStore';
import { GameInstance } from '../../services/instanceService';

export const getIconComponent = (
  icon: 'cube' | 'sword' | 'feather' | 'flame' | 'shield' | 'crystal',
) => {
  switch (icon) {
    case 'crystal':
      return <Sparkles style={{ width: '22px', height: '22px', color: '#00e5ff' }} />;
    case 'sword':
      return <Sword style={{ width: '22px', height: '22px', color: '#38bdf8' }} />;
    case 'feather':
      return <Feather style={{ width: '22px', height: '22px', color: '#ec4899' }} />;
    case 'flame':
      return <Flame style={{ width: '22px', height: '22px', color: '#ef4444' }} />;
    case 'shield':
      return <Shield style={{ width: '22px', height: '22px', color: '#8b5cf6' }} />;
    case 'cube':
    default:
      return <Box style={{ width: '22px', height: '22px', color: '#22c55e' }} />;
  }
};

interface InstancesCreateTabProps {
  availableVersions: string[];
  initialInstance?: GameInstance | null;
  onCancel: () => void;
  onSubmitSuccess?: () => void;
  t: ReturnType<typeof useT>;
}

export const InstancesCreateTab: React.FC<InstancesCreateTabProps> = ({
  availableVersions,
  initialInstance,
  onCancel,
  onSubmitSuccess,
  t,
}) => {
  const isEditing = Boolean(initialInstance);
  const [formName, setFormName] = useState(initialInstance?.name ?? '');
  const [formMcVersion, setFormMcVersion] = useState(initialInstance?.mcVersion ?? '1.21.1');
  const [formLoader, setFormLoader] = useState<LoaderType>(
    initialInstance?.loaderType ?? 'neoforge',
  );
  const [formLoaderVersion, setFormLoaderVersion] = useState(
    initialInstance?.loaderVersion ??
      resolveEffectiveLoaderVersion(
        initialInstance?.loaderType ?? 'neoforge',
        '',
        initialInstance?.mcVersion ?? '1.21.1',
      ) ??
      '',
  );
  const [formIcon, setFormIcon] = useState<
    'cube' | 'sword' | 'feather' | 'flame' | 'shield' | 'crystal'
  >(
    (initialInstance?.icon as 'cube' | 'sword' | 'feather' | 'flame' | 'shield' | 'crystal') ??
      'cube',
  );
  const [formMaxRam, setFormMaxRam] = useState(
    initialInstance?.maxRamGb ? String(initialInstance.maxRamGb) : '',
  );
  const [formWidth, setFormWidth] = useState(
    initialInstance?.resolutionWidth ? String(initialInstance.resolutionWidth) : '',
  );
  const [formHeight, setFormHeight] = useState(
    initialInstance?.resolutionHeight ? String(initialInstance.resolutionHeight) : '',
  );
  const [formFullscreen, setFormFullscreen] = useState(initialInstance?.fullscreen ?? false);
  const [showAdvancedRes, setShowAdvancedRes] = useState(
    Boolean(initialInstance?.resolutionWidth || initialInstance?.fullscreen),
  );
  const [formPreLaunch, setFormPreLaunch] = useState(initialInstance?.preLaunchCommand ?? '');
  const [formWrapper, setFormWrapper] = useState(initialInstance?.wrapperCommand ?? '');
  const [formPostExit, setFormPostExit] = useState(initialInstance?.postExitCommand ?? '');
  const [formEnvVars, setFormEnvVars] = useState(initialInstance?.environmentVariables ?? '');
  const [showAdvancedHooks, setShowAdvancedHooks] = useState(
    Boolean(
      initialInstance?.preLaunchCommand ||
      initialInstance?.wrapperCommand ||
      initialInstance?.postExitCommand ||
      initialInstance?.environmentVariables ||
      initialInstance?.maxRamGb,
    ),
  );

  useEffect(() => {
    if (initialInstance) {
      setFormName(initialInstance.name);
      setFormMcVersion(initialInstance.mcVersion);
      setFormLoader(initialInstance.loaderType);
      setFormIcon(
        (initialInstance.icon as 'cube' | 'sword' | 'feather' | 'flame' | 'shield' | 'crystal') ??
          'cube',
      );
      setFormMaxRam(initialInstance.maxRamGb ? String(initialInstance.maxRamGb) : '');
      setFormWidth(initialInstance.resolutionWidth ? String(initialInstance.resolutionWidth) : '');
      setFormHeight(
        initialInstance.resolutionHeight ? String(initialInstance.resolutionHeight) : '',
      );
      setFormFullscreen(Boolean(initialInstance.fullscreen));
      setFormLoaderVersion(
        initialInstance.loaderVersion ??
          resolveEffectiveLoaderVersion(
            initialInstance.loaderType,
            initialInstance.loaderVersion,
            initialInstance.mcVersion,
          ) ??
          '',
      );
      setFormPreLaunch(initialInstance.preLaunchCommand ?? '');
      setFormWrapper(initialInstance.wrapperCommand ?? '');
      setFormPostExit(initialInstance.postExitCommand ?? '');
      setFormEnvVars(initialInstance.environmentVariables ?? '');
      if (initialInstance.resolutionWidth || initialInstance.fullscreen) {
        setShowAdvancedRes(true);
      }
      if (
        initialInstance.preLaunchCommand ||
        initialInstance.wrapperCommand ||
        initialInstance.postExitCommand ||
        initialInstance.environmentVariables ||
        initialInstance.maxRamGb
      ) {
        setShowAdvancedHooks(true);
      }
    }
  }, [initialInstance]);

  const handleVersionChange = (val: string) => {
    setFormMcVersion(val);
    const lower = val.toLowerCase();
    let detectedLoader = formLoader;
    if (lower.includes('quilt')) {
      detectedLoader = 'quilt';
    } else if (lower.includes('fabric')) {
      detectedLoader = 'fabric';
    } else if (lower.includes('neoforge')) {
      detectedLoader = 'neoforge';
    } else if (lower.includes('forge')) {
      detectedLoader = 'forge';
    }
    setFormLoader(detectedLoader);
    setFormLoaderVersion(
      resolveEffectiveLoaderVersion(detectedLoader, formLoaderVersion, val) ?? '',
    );
  };

  const handleLoaderChange = (newLoader: LoaderType) => {
    setFormLoader(newLoader);
    setFormLoaderVersion(resolveEffectiveLoaderVersion(newLoader, '', formMcVersion) ?? '');
  };

  const instanceVersionOptions: SelectOption[] = (
    availableVersions.length > 0
      ? availableVersions
      : ['1.21.1', '1.21', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9']
  ).map((v) => {
    const isLoaderComposite =
      v.toLowerCase().includes('quilt') ||
      v.toLowerCase().includes('fabric') ||
      v.toLowerCase().includes('neoforge') ||
      v.toLowerCase().includes('forge');
    return {
      label: isLoaderComposite ? v : `Minecraft ${v}`,
      value: v,
    };
  });

  const instanceLoaderOptions: SelectOption[] = [
    {
      label: 'NeoForge',
      value: 'neoforge',
      icon: <LoaderIconBadge type="neoforge" size={20} />,
    },
    {
      label: 'Fabric',
      value: 'fabric',
      icon: <LoaderIconBadge type="fabric" size={20} />,
    },
    {
      label: 'Forge',
      value: 'forge',
      icon: <LoaderIconBadge type="forge" size={20} />,
    },
    {
      label: 'Quilt',
      value: 'quilt',
      icon: <LoaderIconBadge type="quilt" size={20} />,
    },
    {
      label: 'Vanilla',
      value: 'vanilla',
      icon: <LoaderIconBadge type="vanilla" size={20} />,
    },
  ];


  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalName = formName.trim() || `Minecraft ${formMcVersion} (${formLoader})`;
    const parsedW = formWidth.trim() ? Number.parseInt(formWidth.trim(), 10) : undefined;
    const parsedH = formHeight.trim() ? Number.parseInt(formHeight.trim(), 10) : undefined;
    const parsedRam = formMaxRam.trim() ? Number.parseInt(formMaxRam.trim(), 10) : undefined;
    const finalLoaderVersion = resolveEffectiveLoaderVersion(
      formLoader,
      formLoaderVersion,
      formMcVersion,
    );

    if (initialInstance) {
      launcherActions.updateInstanceData(initialInstance.id, {
        name: finalName,
        mcVersion: formMcVersion,
        loaderType: formLoader,
        loaderVersion: finalLoaderVersion,
        icon: formIcon,
        maxRamGb: parsedRam && !Number.isNaN(parsedRam) ? parsedRam : undefined,
        resolutionWidth: parsedW && !Number.isNaN(parsedW) ? parsedW : undefined,
        resolutionHeight: parsedH && !Number.isNaN(parsedH) ? parsedH : undefined,
        fullscreen: formFullscreen,
        preLaunchCommand: formPreLaunch.trim() || undefined,
        wrapperCommand: formWrapper.trim() || undefined,
        postExitCommand: formPostExit.trim() || undefined,
        environmentVariables: formEnvVars.trim() || undefined,
      });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      } else {
        onCancel();
      }
    } else {
      launcherActions.createInstance({
        name: finalName,
        mcVersion: formMcVersion,
        loaderType: formLoader,
        loaderVersion: finalLoaderVersion,
        icon: formIcon,
        maxRamGb: parsedRam && !Number.isNaN(parsedRam) ? parsedRam : undefined,
        resolutionWidth: parsedW && !Number.isNaN(parsedW) ? parsedW : undefined,
        resolutionHeight: parsedH && !Number.isNaN(parsedH) ? parsedH : undefined,
        fullscreen: formFullscreen,
        preLaunchCommand: formPreLaunch.trim() || undefined,
        wrapperCommand: formWrapper.trim() || undefined,
        postExitCommand: formPostExit.trim() || undefined,
        environmentVariables: formEnvVars.trim() || undefined,
      });
      onCancel();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '10px 0',
      }}
    >
      {initialInstance && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(0, 229, 255, 0.08)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pencil size={15} style={{ color: '#00e5ff' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
              {t.instances.editTitle}:{' '}
              <span style={{ color: '#00e5ff' }}>{initialInstance.name}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            ← {t.instances.tabInstances}
          </button>
        </div>
      )}
      <div>
        <label
          htmlFor="create-instance-name"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: '#e2e8f0',
            marginBottom: '6px',
          }}
        >
          {t.instances.formNameLabel}
        </label>
        <input
          id="create-instance-name"
          type="text"
          placeholder={t.instances.formNamePlaceholder}
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: '#fff',
            fontSize: '13px',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <span
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#e2e8f0',
              marginBottom: '6px',
            }}
          >
            {t.instances.formVersionLabel}
          </span>
          <CustomSelect
            value={formMcVersion}
            onChange={handleVersionChange}
            options={instanceVersionOptions}
            height={38}
          />
        </div>

        <div>
          <span
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#e2e8f0',
              marginBottom: '6px',
            }}
          >
            {t.instances.formLoaderLabel}
          </span>
          <CustomSelect
            value={formLoader}
            onChange={(v: string) => handleLoaderChange(v as LoaderType)}
            options={instanceLoaderOptions}
            height={38}
          />
          {formLoader !== 'vanilla' && (
            <div style={{ marginTop: '8px' }}>
              <input
                id="create-instance-loader-version"
                type="text"
                placeholder={
                  resolveEffectiveLoaderVersion(formLoader, '', formMcVersion) ?? 'Versión'
                }
                value={formLoaderVersion}
                onChange={(e) => setFormLoaderVersion(e.target.value)}
                className="login-text-input"
                aria-label="Versión del loader"
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(0, 0, 0, 0.25)',
                  color: '#38bdf8',
                  fontSize: '11.5px',
                  fontFamily: 'var(--font-inter)',
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <span
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 600,
            color: '#e2e8f0',
            marginBottom: '6px',
          }}
        >
          {t.instances.formIconLabel}
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {(['cube', 'sword', 'feather', 'flame', 'shield', 'crystal'] as const).map((ico) => {
            const isSelected = formIcon === ico;
            return (
              <button
                key={ico}
                type="button"
                onClick={() => setFormIcon(ico)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${isSelected ? '#00e5ff' : 'rgba(255,255,255,0.08)'}`,
                  background: isSelected ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {getIconComponent(ico)}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '10px 12px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowAdvancedRes((prev) => !prev)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: '#cbd5e1',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Monitor size={14} style={{ color: '#00e5ff' }} />
            Resolución Personalizada (Opcional)
          </span>
          {showAdvancedRes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvancedRes && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { label: '1080p', w: '1920', h: '1080' },
                { label: '900p', w: '1600', h: '900' },
                { label: '4:3 PvP', w: '1440', h: '1080' },
                { label: '720p', w: '1280', h: '720' },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFormWidth(p.w);
                    setFormHeight(p.h);
                    setFormFullscreen(false);
                  }}
                  style={{
                    padding: '5px',
                    borderRadius: '6px',
                    border:
                      formWidth === p.w && formHeight === p.h && !formFullscreen
                        ? '1px solid #00e5ff'
                        : '1px solid rgba(255,255,255,0.08)',
                    background:
                      formWidth === p.w && formHeight === p.h && !formFullscreen
                        ? 'rgba(0,229,255,0.12)'
                        : 'rgba(255,255,255,0.03)',
                    color: '#e2e8f0',
                    fontSize: '10.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#94a3b8',
                    marginBottom: '4px',
                  }}
                >
                  Ancho (px):
                </span>
                <input
                  type="number"
                  placeholder="Por defecto global"
                  disabled={formFullscreen}
                  value={formWidth}
                  onChange={(e) => setFormWidth(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: formFullscreen ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#94a3b8',
                    marginBottom: '4px',
                  }}
                >
                  Alto (px):
                </span>
                <input
                  type="number"
                  placeholder="Por defecto global"
                  disabled={formFullscreen}
                  value={formHeight}
                  onChange={(e) => setFormHeight(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: formFullscreen ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            <label
              htmlFor="form-fullscreen-checkbox"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '11.5px',
                color: '#cbd5e1',
              }}
            >
              <input
                id="form-fullscreen-checkbox"
                type="checkbox"
                checked={formFullscreen}
                onChange={(e) => setFormFullscreen(e.target.checked)}
                className="papyrus-checkbox"
              />
              <span>Iniciar esta instancia siempre en Pantalla Completa</span>
            </label>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => setShowAdvancedHooks(!showAdvancedHooks)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HardDrive size={14} style={{ color: '#00e5ff' }} />
            Comandos Hook & Ciclo de Vida (Opcional)
          </span>
          {showAdvancedHooks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showAdvancedHooks && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginBottom: '3px',
                }}
              >
                Comando Pre-Launch:
              </span>
              <input
                type="text"
                placeholder="ej. echo 'Iniciando instancia...'"
                value={formPreLaunch}
                onChange={(e) => setFormPreLaunch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginBottom: '3px',
                }}
              >
                Comando Wrapper (Envoltorio Java):
              </span>
              <input
                type="text"
                placeholder="ej. mangohud o optirun"
                value={formWrapper}
                onChange={(e) => setFormWrapper(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginBottom: '3px',
                }}
              >
                Comando Post-Exit:
              </span>
              <input
                type="text"
                placeholder="ej. sync_backup.bat"
                value={formPostExit}
                onChange={(e) => setFormPostExit(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginBottom: '3px',
                }}
              >
                Variables de Entorno:
              </span>
              <input
                type="text"
                placeholder='KEY=VAL o { "KEY": "VAL" }'
                value={formEnvVars}
                onChange={(e) => setFormEnvVars(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              />
            </div>

            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#94a3b8',
                  marginBottom: '3px',
                }}
              >
                RAM Máxima Asignada (GB, opcional):
              </span>
              <input
                type="number"
                min="1"
                max="64"
                placeholder="Por defecto global (ej. 4)"
                value={formMaxRam}
                onChange={(e) => setFormMaxRam(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#fff',
                  fontSize: '11px',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent',
            color: '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {t.instances.formCancelBtn}
        </button>
        <button
          type="submit"
          style={{
            padding: '10px 22px',
            borderRadius: '8px',
            border: 'none',
            background: '#00e5ff',
            color: '#0a0a0f',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {isEditing ? t.instances.formSaveBtn : t.instances.formCreateBtn}
        </button>
      </div>
    </form>
  );
};
