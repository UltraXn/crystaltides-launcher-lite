import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Layers,
  FolderOpen,
  Trash2,
  CheckCircle2,
  Play,
  Sparkles,
  Shield,
  Flame,
  Sword,
  Box,
  Feather,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  useT,
  LoaderType,
} from '../../store/launcherStore';
import { GameInstance, resolveInstanceGameDir } from '../../services/instanceService';
import { openInstanceDirectory } from '../../services/modService';
import { fetchVanillaVersions } from '../../services/minecraftMetadataService';
import { CustomSelect, SelectOption } from '../common/CustomSelect';

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case 'crystal':
      return <Sparkles style={{ width: '22px', height: '22px', color: '#00e5ff' }} />;
    case 'sword':
      return <Sword style={{ width: '22px', height: '22px', color: '#f59e0b' }} />;
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

export const InstancesModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const activeInstanceId = useLauncherStore((s: LauncherState) => s.activeInstanceId);
  const launchStatus = useLauncherStore((s: LauncherState) => s.launch.status);

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);

  // Form State for Creating Instance
  const [formName, setFormName] = useState('');
  const [formMcVersion, setFormMcVersion] = useState('1.21.1');
  const [formLoader, setFormLoader] = useState<LoaderType>('neoforge');
  const [formIcon, setFormIcon] = useState<'cube' | 'sword' | 'feather' | 'flame' | 'shield'>('cube');

  useEffect(() => {
    if (activeModal === 'instances') {
      fetchVanillaVersions(false).then((vers) => {
        if (vers.length > 0) {
          setAvailableVersions(vers);
        }
      });
    }
  }, [activeModal]);

  if (activeModal !== 'instances') return null;

  const handleSelectInstance = (id: string) => {
    launcherActions.selectInstance(id);
  };

  const handleOpenFolder = async (inst: GameInstance) => {
    try {
      const dir = await resolveInstanceGameDir(inst);
      await openInstanceDirectory(dir);
    } catch (e) {
      console.warn('Error opening folder:', e);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(t.instances.deleteConfirm.replace('{name}', name))) {
      try {
        launcherActions.deleteInstance(id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = formName.trim() || `Minecraft ${formMcVersion} (${formLoader})`;
    launcherActions.createInstance({
      name: finalName,
      mcVersion: formMcVersion,
      loaderType: formLoader,
      icon: formIcon,
    });
    setFormName('');
    setActiveTab('list');
  };

  const instanceVersionOptions: SelectOption[] = (
    availableVersions.length > 0
      ? availableVersions
      : ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.16.5', '1.8.9']
  ).map((v) => ({
    value: v,
    label: v === '1.21.1' ? '1.21.1 (Oficial CrystalTides SMP)' : `Minecraft ${v}`,
  }));

  const instanceLoaderOptions: SelectOption[] = [
    { value: 'vanilla', label: 'Vanilla' },
    { value: 'neoforge', label: 'NeoForge' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'forge', label: 'Forge' },
    { value: 'quilt', label: 'Quilt' },
  ];

  return (
    <div className="papyrus-modal-overlay">
      <button
        type="button"
        aria-label={t.settings.close}
        tabIndex={-1}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
        onClick={launcherActions.closeModal}
      />
      <div
        className="papyrus-settings-card"
        style={{ maxWidth: '820px', minHeight: '520px', maxHeight: '88vh' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="instances-modal-title"
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers style={{ width: '22px', height: '22px', color: '#00e5ff' }} />
              <h2 id="instances-modal-title" className="settings-main-title" style={{ margin: 0 }}>
                {t.instances.title}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {t.instances.subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* View Switcher Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '3px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'list' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'list' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.instances.tabInstances} ({instances.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'create' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'create' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
                {t.instances.tabNew}
              </button>
            </div>

            <button
              type="button"
              onClick={launcherActions.closeModal}
              className="settings-card-close"
              title={t.settings.close}
              aria-label={t.settings.close}
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'list' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '14px',
              overflowY: 'auto',
              maxHeight: 'calc(88vh - 140px)',
              paddingRight: '6px',
            }}
          >
            {instances.map((inst) => {
              const isActive = inst.id === activeInstanceId;
              return (
                <div
                  key={inst.id}
                  style={{
                    backgroundColor: isActive ? 'rgba(0, 229, 255, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isActive ? '#00e5ff' : 'rgba(255, 255, 255, 0.08)'}`,
                    boxShadow: isActive ? '0 0 16px rgba(0, 229, 255, 0.15)' : 'none',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {getIconComponent(inst.icon)}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '15px', color: '#f8fafc' }}>
                            {inst.name}
                          </span>
                          {inst.isOfficial && (
                            <span
                              style={{
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(0, 229, 255, 0.15)',
                                color: '#00e5ff',
                                fontWeight: 700,
                              }}
                            >
                              {t.instances.officialTag}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {inst.mcVersion} • {inst.loaderType.toUpperCase()}
                          {inst.loaderVersion ? ` (${inst.loaderVersion})` : ''}
                        </span>
                      </div>
                    </div>

                    {isActive && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          color: '#00e5ff',
                          fontWeight: 600,
                          background: 'rgba(0, 229, 255, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                        {t.instances.activeTag}
                      </span>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(inst)}
                        title={t.instances.openFolder}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#cbd5e1',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <FolderOpen style={{ width: '14px', height: '14px' }} />
                        {t.instances.openFolder}
                      </button>

                      {!inst.isOfficial && (
                        <button
                          type="button"
                          onClick={() => handleDelete(inst.id, inst.name)}
                          title={t.instances.delete}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(244, 63, 94, 0.2)',
                            background: 'rgba(244, 63, 94, 0.08)',
                            color: '#fb7185',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                    </div>

                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSelectInstance(inst.id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#f8fafc',
                          fontWeight: 600,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {t.accounts.select}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          launcherActions.closeModal();
                          if (launchStatus === 'IDLE') {
                            launcherActions.startLaunchFlow();
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#22c55e',
                          color: '#0a0a0f',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        <Play style={{ width: '12px', height: '12px', fill: '#0a0a0f' }} />
                        {t.instances.play}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Create Form */
          <form
            onSubmit={handleCreateSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '520px',
              margin: '0 auto',
              padding: '10px 0',
            }}
          >
            <div>
              <label htmlFor="create-instance-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
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
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  {t.instances.formVersionLabel}
                </span>
                <CustomSelect
                  value={formMcVersion}
                  onChange={(v) => setFormMcVersion(v)}
                  options={instanceVersionOptions}
                  height={38}
                />
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  {t.instances.formLoaderLabel}
                </span>
                <CustomSelect
                  value={formLoader}
                  onChange={(v) => setFormLoader(v as LoaderType)}
                  options={instanceLoaderOptions}
                  height={38}
                />
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                {t.instances.formIconLabel}
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['cube', 'sword', 'feather', 'flame', 'shield'] as const).map((ico) => {
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('list')}
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
                {t.instances.formCreateBtn}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
