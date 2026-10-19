import React, { useState } from 'react';
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

export type InstanceIcon = 'cube' | 'sword' | 'feather' | 'flame' | 'shield' | 'crystal';

export const AVAILABLE_ICONS: readonly InstanceIcon[] = [
  'cube',
  'sword',
  'feather',
  'flame',
  'shield',
  'crystal',
];

const DEFAULT_VERSIONS = [
  '1.21.1',
  '1.21',
  '1.20.4',
  '1.20.1',
  '1.19.4',
  '1.18.2',
  '1.16.5',
  '1.12.2',
  '1.8.9',
];

export const INSTANCE_LOADER_OPTIONS: SelectOption[] = [
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

const RESOLUTION_PRESETS = [
  { label: '1080p', w: '1920', h: '1080' },
  { label: '900p', w: '1600', h: '900' },
  { label: '4:3 PvP', w: '1440', h: '1080' },
  { label: '720p', w: '1280', h: '720' },
] as const;

export const getIconComponent = (icon: InstanceIcon) => {
  switch (icon) {
    case 'crystal':
      return <Sparkles style={{ width: '22px', height: '22px', color: '#16A085' }} />;
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

export const detectLoaderFromVersion = (version: string, currentLoader: LoaderType): LoaderType => {
  const lower = version.toLowerCase();
  if (lower.includes('quilt')) return 'quilt';
  if (lower.includes('fabric')) return 'fabric';
  if (lower.includes('neoforge')) return 'neoforge';
  if (lower.includes('forge')) return 'forge';
  return currentLoader;
};

const isCompositeVersion = (version: string): boolean => {
  const lower = version.toLowerCase();
  return (
    lower.includes('quilt') ||
    lower.includes('fabric') ||
    lower.includes('neoforge') ||
    lower.includes('forge')
  );
};

export const buildVersionOptions = (availableVersions: string[]): SelectOption[] => {
  const versions = availableVersions.length > 0 ? availableVersions : DEFAULT_VERSIONS;
  return versions.map((v) => ({
    label: isCompositeVersion(v) ? v : `Minecraft ${v}`,
    value: v,
  }));
};

export const hasAdvancedRes = (instance?: GameInstance | null): boolean => {
  return Boolean(instance?.resolutionWidth ?? instance?.fullscreen);
};

export const hasAdvancedHooks = (instance?: GameInstance | null): boolean => {
  return Boolean(
    instance?.preLaunchCommand ??
      instance?.wrapperCommand ??
      instance?.postExitCommand ??
      instance?.environmentVariables ??
      instance?.maxRamGb,
  );
};

interface FormInitialValues {
  name: string;
  mcVersion: string;
  loaderType: LoaderType;
  icon: InstanceIcon;
  maxRamGb: string;
  resolutionWidth: string;
  resolutionHeight: string;
  fullscreen: boolean;
  preLaunchCommand: string;
  wrapperCommand: string;
  postExitCommand: string;
  environmentVariables: string;
  showAdvancedRes: boolean;
  showAdvancedHooks: boolean;
}

export const getFormInitialValues = (instance?: GameInstance | null): FormInitialValues => {
  return {
    name: instance?.name ?? '',
    mcVersion: instance?.mcVersion ?? '1.21.1',
    loaderType: instance?.loaderType ?? 'neoforge',
    icon: instance?.icon ?? 'cube',
    maxRamGb: instance?.maxRamGb ? String(instance.maxRamGb) : '',
    resolutionWidth: instance?.resolutionWidth ? String(instance.resolutionWidth) : '',
    resolutionHeight: instance?.resolutionHeight ? String(instance.resolutionHeight) : '',
    fullscreen: Boolean(instance?.fullscreen),
    preLaunchCommand: instance?.preLaunchCommand ?? '',
    wrapperCommand: instance?.wrapperCommand ?? '',
    postExitCommand: instance?.postExitCommand ?? '',
    environmentVariables: instance?.environmentVariables ?? '',
    showAdvancedRes: hasAdvancedRes(instance),
    showAdvancedHooks: hasAdvancedHooks(instance),
  };
};

const parseOptionalPositiveInt = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const sanitizeOptionalText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

interface InstancePayloadInput {
  formName: string;
  formMcVersion: string;
  formLoader: LoaderType;
  formIcon: InstanceIcon;
  formMaxRam: string;
  formWidth: string;
  formHeight: string;
  formFullscreen: boolean;
  formPreLaunch: string;
  formWrapper: string;
  formPostExit: string;
  formEnvVars: string;
  initialInstance?: GameInstance | null;
}

export const buildInstancePayload = (
  input: InstancePayloadInput,
): Omit<GameInstance, 'id' | 'createdAt'> => {
  const trimmedName = input.formName.trim();
  const finalName = trimmedName || `Minecraft ${input.formMcVersion} (${input.formLoader})`;
  const existingLoaderVersion =
    input.initialInstance?.loaderType === input.formLoader
      ? input.initialInstance?.loaderVersion
      : undefined;

  const finalLoaderVersion = resolveEffectiveLoaderVersion(
    input.formLoader,
    existingLoaderVersion,
    input.formMcVersion,
  );

  return {
    name: finalName,
    mcVersion: input.formMcVersion,
    loaderType: input.formLoader,
    loaderVersion: finalLoaderVersion,
    icon: input.formIcon,
    maxRamGb: parseOptionalPositiveInt(input.formMaxRam),
    resolutionWidth: parseOptionalPositiveInt(input.formWidth),
    resolutionHeight: parseOptionalPositiveInt(input.formHeight),
    fullscreen: input.formFullscreen,
    preLaunchCommand: sanitizeOptionalText(input.formPreLaunch),
    wrapperCommand: sanitizeOptionalText(input.formWrapper),
    postExitCommand: sanitizeOptionalText(input.formPostExit),
    environmentVariables: sanitizeOptionalText(input.formEnvVars),
  };
};

// ---------------- Subcomponents ----------------

interface InstanceEditHeaderProps {
  instanceName: string;
  onCancel: () => void;
  t: ReturnType<typeof useT>;
}

export const InstanceEditHeader: React.FC<InstanceEditHeaderProps> = ({
  instanceName,
  onCancel,
  t,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: '8px',
      background: 'rgba(21, 111, 105, 0.12)',
      border: '1px solid rgba(22, 160, 133, 0.3)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Pencil size={15} style={{ color: '#16A085' }} />
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
        {t.instances.editTitle}: <span style={{ color: '#16A085' }}>{instanceName}</span>
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
);

interface InstanceVersionLoaderSectionProps {
  formMcVersion: string;
  formLoader: LoaderType;
  onVersionChange: (version: string) => void;
  onLoaderChange: (loader: LoaderType) => void;
  versionOptions: SelectOption[];
  loaderOptions: SelectOption[];
  t: ReturnType<typeof useT>;
}

export const InstanceVersionLoaderSection: React.FC<InstanceVersionLoaderSectionProps> = ({
  formMcVersion,
  formLoader,
  onVersionChange,
  onLoaderChange,
  versionOptions,
  loaderOptions,
  t,
}) => (
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
        onChange={onVersionChange}
        options={versionOptions}
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
        onChange={(v: string) => onLoaderChange(v as LoaderType)}
        options={loaderOptions}
        height={38}
      />
    </div>
  </div>
);

interface InstanceIconPickerSectionProps {
  formIcon: InstanceIcon;
  onIconSelect: (icon: InstanceIcon) => void;
  t: ReturnType<typeof useT>;
}

export const InstanceIconPickerSection: React.FC<InstanceIconPickerSectionProps> = ({
  formIcon,
  onIconSelect,
  t,
}) => (
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
      {AVAILABLE_ICONS.map((ico) => {
        const isSelected = formIcon === ico;
        return (
          <button
            key={ico}
            type="button"
            onClick={() => onIconSelect(ico)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: isSelected
                ? '1px solid rgba(56, 189, 248, 0.4)'
                : '1px solid rgba(255,255,255,0.08)',
              background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {getIconComponent(ico)}
          </button>
        );
      })}
    </div>
  </div>
);

interface InstanceResolutionSectionProps {
  showAdvancedRes: boolean;
  onToggleAdvancedRes: () => void;
  formWidth: string;
  formHeight: string;
  formFullscreen: boolean;
  onWidthChange: (w: string) => void;
  onHeightChange: (h: string) => void;
  onFullscreenChange: (fullscreen: boolean) => void;
  onSelectPreset: (w: string, h: string) => void;
  t: ReturnType<typeof useT>;
}

export const InstanceResolutionSection: React.FC<InstanceResolutionSectionProps> = ({
  showAdvancedRes,
  onToggleAdvancedRes,
  formWidth,
  formHeight,
  formFullscreen,
  onWidthChange,
  onHeightChange,
  onFullscreenChange,
  onSelectPreset,
  t,
}) => (
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
      onClick={onToggleAdvancedRes}
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
        <Monitor size={14} style={{ color: '#38bdf8' }} />
        {t.instances.customResolutionTitle}
      </span>
      {showAdvancedRes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>

    {showAdvancedRes && (
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {RESOLUTION_PRESETS.map((p) => {
            const active = !formFullscreen && formWidth === p.w && formHeight === p.h;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onSelectPreset(p.w, p.h)}
                style={{
                  padding: '5px',
                  borderRadius: '6px',
                  border: active
                    ? '1px solid rgba(22, 160, 133, 0.45)'
                    : '1px solid rgba(255,255,255,0.08)',
                  background: active
                    ? 'rgba(22, 160, 133, 0.18)'
                    : 'rgba(255,255,255,0.03)',
                  color: '#e2e8f0',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
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
              {t.instances.widthPx}
            </span>
            <input
              type="number"
              placeholder={t.instances.defaultGlobal}
              disabled={formFullscreen}
              value={formWidth}
              onChange={(e) => onWidthChange(e.target.value)}
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
              {t.instances.heightPx}
            </span>
            <input
              type="number"
              placeholder={t.instances.defaultGlobal}
              disabled={formFullscreen}
              value={formHeight}
              onChange={(e) => onHeightChange(e.target.value)}
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
            onChange={(e) => onFullscreenChange(e.target.checked)}
            className="papyrus-checkbox"
          />
          <span>{t.instances.alwaysFullscreen}</span>
        </label>
      </div>
    )}
  </div>
);

interface InstanceHooksSectionProps {
  showAdvancedHooks: boolean;
  onToggleAdvancedHooks: () => void;
  formPreLaunch: string;
  formWrapper: string;
  formPostExit: string;
  formEnvVars: string;
  formMaxRam: string;
  onPreLaunchChange: (val: string) => void;
  onWrapperChange: (val: string) => void;
  onPostExitChange: (val: string) => void;
  onEnvVarsChange: (val: string) => void;
  onMaxRamChange: (val: string) => void;
  t: ReturnType<typeof useT>;
}

export const InstanceHooksSection: React.FC<InstanceHooksSectionProps> = ({
  showAdvancedHooks,
  onToggleAdvancedHooks,
  formPreLaunch,
  formWrapper,
  formPostExit,
  formEnvVars,
  formMaxRam,
  onPreLaunchChange,
  onWrapperChange,
  onPostExitChange,
  onEnvVarsChange,
  onMaxRamChange,
  t,
}) => (
  <div
    style={{
      marginTop: '12px',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      paddingTop: '10px',
    }}
  >
    <button
      type="button"
      onClick={onToggleAdvancedHooks}
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
        <HardDrive size={14} style={{ color: '#38bdf8' }} />
        {t.instances.lifecycleHooksTitle}
      </span>
      {showAdvancedHooks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>

    {showAdvancedHooks && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
        <div>
          <label
            htmlFor="form-pre-launch-cmd"
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '3px',
            }}
          >
            {t.instances.preLaunchCmd}
          </label>
          <input
            id="form-pre-launch-cmd"
            type="text"
            placeholder="ej. echo 'Iniciando instancia...'"
            value={formPreLaunch}
            onChange={(e) => onPreLaunchChange(e.target.value)}
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
          <label
            htmlFor="form-wrapper-cmd"
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '3px',
            }}
          >
            {t.instances.wrapperCmd}
          </label>
          <input
            id="form-wrapper-cmd"
            type="text"
            placeholder="ej. mangohud o optirun"
            value={formWrapper}
            onChange={(e) => onWrapperChange(e.target.value)}
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
          <label
            htmlFor="form-post-exit-cmd"
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '3px',
            }}
          >
            {t.instances.postExitCmd}
          </label>
          <input
            id="form-post-exit-cmd"
            type="text"
            placeholder="ej. sync_backup.bat"
            value={formPostExit}
            onChange={(e) => onPostExitChange(e.target.value)}
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
          <label
            htmlFor="form-env-vars"
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '3px',
            }}
          >
            {t.instances.envVars}
          </label>
          <input
            id="form-env-vars"
            type="text"
            placeholder='KEY=VAL o { "KEY": "VAL" }'
            value={formEnvVars}
            onChange={(e) => onEnvVarsChange(e.target.value)}
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
          <label
            htmlFor="form-max-ram"
            style={{
              display: 'block',
              fontSize: '11px',
              color: '#94a3b8',
              marginBottom: '3px',
            }}
          >
            {t.instances.maxRamLabel}
          </label>
          <input
            id="form-max-ram"
            type="number"
            min="1"
            max="64"
            placeholder="Por defecto global (ej. 4)"
            value={formMaxRam}
            onChange={(e) => onMaxRamChange(e.target.value)}
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
);

// ---------------- Main Component ----------------

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
  const initialValues = getFormInitialValues(initialInstance);

  const [formName, setFormName] = useState(initialValues.name);
  const [formMcVersion, setFormMcVersion] = useState(initialValues.mcVersion);
  const [formLoader, setFormLoader] = useState<LoaderType>(initialValues.loaderType);
  const [formIcon, setFormIcon] = useState<InstanceIcon>(initialValues.icon);
  const [formMaxRam, setFormMaxRam] = useState(initialValues.maxRamGb);
  const [formWidth, setFormWidth] = useState(initialValues.resolutionWidth);
  const [formHeight, setFormHeight] = useState(initialValues.resolutionHeight);
  const [formFullscreen, setFormFullscreen] = useState(initialValues.fullscreen);
  const [showAdvancedRes, setShowAdvancedRes] = useState(initialValues.showAdvancedRes);
  const [formPreLaunch, setFormPreLaunch] = useState(initialValues.preLaunchCommand);
  const [formWrapper, setFormWrapper] = useState(initialValues.wrapperCommand);
  const [formPostExit, setFormPostExit] = useState(initialValues.postExitCommand);
  const [formEnvVars, setFormEnvVars] = useState(initialValues.environmentVariables);
  const [showAdvancedHooks, setShowAdvancedHooks] = useState(initialValues.showAdvancedHooks);

  const [prevInitialInstance, setPrevInitialInstance] = useState(initialInstance);
  if (initialInstance !== prevInitialInstance) {
    setPrevInitialInstance(initialInstance);
    if (initialInstance) {
      const vals = getFormInitialValues(initialInstance);
      setFormName(vals.name);
      setFormMcVersion(vals.mcVersion);
      setFormLoader(vals.loaderType);
      setFormIcon(vals.icon);
      setFormMaxRam(vals.maxRamGb);
      setFormWidth(vals.resolutionWidth);
      setFormHeight(vals.resolutionHeight);
      setFormFullscreen(vals.fullscreen);
      setFormPreLaunch(vals.preLaunchCommand);
      setFormWrapper(vals.wrapperCommand);
      setFormPostExit(vals.postExitCommand);
      setFormEnvVars(vals.environmentVariables);
      if (vals.showAdvancedRes) {
        setShowAdvancedRes(true);
      }
      if (vals.showAdvancedHooks) {
        setShowAdvancedHooks(true);
      }
    }
  }

  const handleVersionChange = (val: string) => {
    setFormMcVersion(val);
    setFormLoader((current) => detectLoaderFromVersion(val, current));
  };

  const handlePresetSelect = (w: string, h: string) => {
    setFormWidth(w);
    setFormHeight(h);
    setFormFullscreen(false);
  };

  const instanceVersionOptions = buildVersionOptions(availableVersions);

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = buildInstancePayload({
      formName,
      formMcVersion,
      formLoader,
      formIcon,
      formMaxRam,
      formWidth,
      formHeight,
      formFullscreen,
      formPreLaunch,
      formWrapper,
      formPostExit,
      formEnvVars,
      initialInstance,
    });

    if (initialInstance) {
      launcherActions.updateInstanceData(initialInstance.id, payload);
      launcherActions.selectInstance(initialInstance.id);
      if (onSubmitSuccess) {
        onSubmitSuccess();
        return;
      }
    } else {
      launcherActions.createInstance(payload);
    }
    onCancel();
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
        <InstanceEditHeader
          instanceName={initialInstance.name}
          onCancel={onCancel}
          t={t}
        />
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

      <InstanceVersionLoaderSection
        formMcVersion={formMcVersion}
        formLoader={formLoader}
        onVersionChange={handleVersionChange}
        onLoaderChange={setFormLoader}
        versionOptions={instanceVersionOptions}
        loaderOptions={INSTANCE_LOADER_OPTIONS}
        t={t}
      />

      <InstanceIconPickerSection
        formIcon={formIcon}
        onIconSelect={setFormIcon}
        t={t}
      />

      <InstanceResolutionSection
        showAdvancedRes={showAdvancedRes}
        onToggleAdvancedRes={() => setShowAdvancedRes((prev) => !prev)}
        formWidth={formWidth}
        formHeight={formHeight}
        formFullscreen={formFullscreen}
        onWidthChange={setFormWidth}
        onHeightChange={setFormHeight}
        onFullscreenChange={setFormFullscreen}
        onSelectPreset={handlePresetSelect}
        t={t}
      />

      <InstanceHooksSection
        showAdvancedHooks={showAdvancedHooks}
        onToggleAdvancedHooks={() => setShowAdvancedHooks((prev) => !prev)}
        formPreLaunch={formPreLaunch}
        formWrapper={formWrapper}
        formPostExit={formPostExit}
        formEnvVars={formEnvVars}
        formMaxRam={formMaxRam}
        onPreLaunchChange={setFormPreLaunch}
        onWrapperChange={setFormWrapper}
        onPostExitChange={setFormPostExit}
        onEnvVarsChange={setFormEnvVars}
        onMaxRamChange={setFormMaxRam}
        t={t}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
        <button
          type="button"
          onClick={onCancel}
          className="instance-action-btn"
          style={{ height: '36px', padding: '0 18px', fontSize: '13px' }}
        >
          {t.instances.formCancelBtn}
        </button>
        <button
          type="submit"
          className="instance-play-btn"
          style={{ height: '36px', padding: '0 22px', fontSize: '13px', borderRadius: '8px' }}
        >
          {isEditing ? t.instances.formSaveBtn : t.instances.formCreateBtn}
        </button>
      </div>
    </form>
  );
};
