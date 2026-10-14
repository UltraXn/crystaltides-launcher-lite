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
  Compass,
  Globe,
  Copy,
  HardDrive,
  Check,
  FolderDown,
  Pencil,
} from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState, useT } from '../../store/launcherStore';
import { GameInstance, resolveInstanceGameDir } from '../../services/instanceService';
import {
  openInstanceDirectory,
  listMods,
  toggleMod,
  deleteMod,
  LocalModInfo,
} from '../../services/modService';
import {
  fetchVanillaVersions,
  fetchInstalledLocalVersions,
} from '../../services/minecraftMetadataService';
import {
  listSingleplayerSaves,
  readServersDat,
  saveServersDat,
  SingleplayerSaveInfo,
  ServerEntry,
} from '../../services/nbtService';
import { InstancesCreateTab } from './InstancesCreateTab';
import { InstancesImportTab } from './InstancesImportTab';

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

import { getGameTypeBadge } from '../../utils/instanceUtils';

const renderScreenResolutionTag = (inst: GameInstance) => {
  if (inst.fullscreen) {
    return (
      <span
        style={{
          fontSize: '10px',
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          fontWeight: 600,
        }}
      >
        Fullscreen
      </span>
    );
  }
  if (inst.resolutionWidth && inst.resolutionHeight) {
    return (
      <span
        style={{
          fontSize: '10px',
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          fontWeight: 600,
        }}
      >
        {inst.resolutionWidth}×{inst.resolutionHeight}
      </span>
    );
  }
  return null;
};

export const InstancesModal: React.FC = () => {
  const t = useT();
  const activeModal = useLauncherStore((s: LauncherState) => s.activeModal);
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const activeInstanceId = useLauncherStore((s: LauncherState) => s.activeInstanceId);
  const launchStatus = useLauncherStore((s: LauncherState) => s.launch.status);

  const [activeTab, setActiveTab] = useState<
    'list' | 'create' | 'saves' | 'servers' | 'mods' | 'import' | 'edit'
  >('list');
  const [editingInstance, setEditingInstance] = useState<GameInstance | null>(null);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [localSaves, setLocalSaves] = useState<SingleplayerSaveInfo[]>([]);
  const [savedServers, setSavedServers] = useState<ServerEntry[]>([]);
  const [copiedServerIp, setCopiedServerIp] = useState<string | null>(null);
  const [loadingNbt, setLoadingNbt] = useState(false);
  const [localMods, setLocalMods] = useState<LocalModInfo[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerIp, setNewServerIp] = useState('');
  const [savingServers, setSavingServers] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState<{ id: string; name: string } | null>(
    null,
  );

  // Carga reactiva de mundos locales, servidores y mods cuando se seleccionan sus pestañas
  useEffect(() => {
    let isCancelled = false;
    if (activeModal !== 'instances') return;
    if (activeTab === 'saves' || activeTab === 'servers' || activeTab === 'mods') {
      const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
      if (activeInst) {
        if (activeTab === 'mods') {
          setLoadingMods(true);
        } else {
          setLoadingNbt(true);
        }
        resolveInstanceGameDir(activeInst)
          .then(async (dir) => {
            if (isCancelled) return;
            if (activeTab === 'saves') {
              const s = await listSingleplayerSaves(dir);
              if (!isCancelled) setLocalSaves(s);
            } else if (activeTab === 'servers') {
              const srvs = await readServersDat(dir);
              if (!isCancelled) setSavedServers(srvs);
            } else if (activeTab === 'mods') {
              const m = await listMods(dir);
              if (!isCancelled) setLocalMods(m);
            }
          })
          .catch((err) => {
            if (!isCancelled) console.warn('[InstancesModal] Error leyendo datos:', err);
          })
          .finally(() => {
            if (!isCancelled) {
              setLoadingNbt(false);
              setLoadingMods(false);
            }
          });
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [activeModal, activeTab, activeInstanceId, instances]);

  const reloadMods = async () => {
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;
    try {
      setLoadingMods(true);
      const dir = await resolveInstanceGameDir(activeInst);
      const m = await listMods(dir);
      setLocalMods(m);
    } catch (err) {
      console.warn('[InstancesModal] Error recargando mods:', err);
    } finally {
      setLoadingMods(false);
    }
  };

  const handleToggleMod = async (mod: LocalModInfo) => {
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;
    try {
      const dir = await resolveInstanceGameDir(activeInst);
      await toggleMod(dir, mod.filename, !mod.enabled);
      await reloadMods();
    } catch (err) {
      console.warn('[InstancesModal] Error cambiando estado del mod:', err);
    }
  };

  const handleDeleteMod = async (filename: string) => {
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;
    try {
      const dir = await resolveInstanceGameDir(activeInst);
      await deleteMod(dir, filename);
      await reloadMods();
    } catch (err) {
      console.warn('[InstancesModal] Error eliminando mod:', err);
    }
  };

  const handleOpenModsFolder = async () => {
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;
    try {
      const dir = await resolveInstanceGameDir(activeInst);
      await openInstanceDirectory(dir);
    } catch (err) {
      console.warn('[InstancesModal] Error abriendo carpeta de mods:', err);
    }
  };

  const handleAddServer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newServerName.trim() || !newServerIp.trim()) return;
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;

    const newEntry: ServerEntry = {
      name: newServerName.trim(),
      ip: newServerIp.trim(),
    };
    const updated = [...savedServers, newEntry];
    setSavedServers(updated);
    setNewServerName('');
    setNewServerIp('');

    try {
      setSavingServers(true);
      const dir = await resolveInstanceGameDir(activeInst);
      await saveServersDat(dir, updated);
    } catch (err) {
      console.error('[InstancesModal] Error guardando servidor:', err);
    } finally {
      setSavingServers(false);
    }
  };

  const handleDeleteServer = async (indexToDelete: number) => {
    const activeInst = instances.find((i) => i.id === activeInstanceId) || instances[0];
    if (!activeInst) return;

    const updated = savedServers.filter((_, idx) => idx !== indexToDelete);
    setSavedServers(updated);

    try {
      setSavingServers(true);
      const dir = await resolveInstanceGameDir(activeInst);
      await saveServersDat(dir, updated);
    } catch (err) {
      console.error('[InstancesModal] Error eliminando servidor de servers.dat:', err);
    } finally {
      setSavingServers(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'instances') {
      Promise.all([fetchVanillaVersions(false), fetchInstalledLocalVersions()])
        .then(([vanillaVers, localVers]) => {
          const combined = Array.from(new Set([...localVers, ...vanillaVers]));
          if (combined.length > 0) {
            setAvailableVersions(combined);
          }
        })
        .catch((err) => {
          console.warn('[InstancesModal] Error cargando versiones:', err);
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
    setDeletingInstance({ id, name });
  };

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
      <dialog
        open
        className="papyrus-settings-card"
        style={{
          width: '880px',
          maxWidth: '92vw',
          minHeight: '540px',
          maxHeight: '88vh',
          color: 'inherit',
          margin: 0,
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
        aria-labelledby="instances-modal-title"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ minWidth: '220px', flex: '1 1 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers style={{ width: '22px', height: '22px', color: '#00e5ff', flexShrink: 0 }} />
              <h2 id="instances-modal-title" className="settings-main-title" style={{ margin: 0 }}>
                {t.instances.title}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
              {t.instances.subtitle}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            {/* View Switcher Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '3px',
                gap: '2px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('list');
                }}
                style={{
                  padding: '6px 12px',
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
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('saves');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'saves' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'saves' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Compass style={{ width: '13px', height: '13px' }} />
                Mundos
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('servers');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'servers' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'servers' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Globe style={{ width: '13px', height: '13px' }} />
                Servidores
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('mods');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'mods' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'mods' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Box style={{ width: '13px', height: '13px' }} />
                Mods
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('create');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
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
                <Plus style={{ width: '13px', height: '13px' }} />
                {t.instances.tabNew}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingInstance(null);
                  setActiveTab('import');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'import' ? '#00e5ff' : 'transparent',
                  color: activeTab === 'import' ? '#0a0a0f' : '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <FolderDown style={{ width: '13px', height: '13px' }} />
                Importar
              </button>
              {activeTab === 'edit' && (
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: '#00e5ff',
                    color: '#0a0a0f',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'default',
                  }}
                >
                  <Pencil style={{ width: '13px', height: '13px' }} />
                  {t.instances.editTitle}
                </button>
              )}
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
        {activeTab === 'list' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '14px',
              overflowY: 'auto',
              overflowX: 'hidden',
              maxHeight: 'calc(88vh - 140px)',
              paddingRight: '6px',
              paddingLeft: '2px',
              paddingBottom: '8px',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            {instances.map((inst) => {
              const isActive = inst.id === activeInstanceId;
              return (
                <div
                  key={inst.id}
                  style={{
                    backgroundColor: isActive
                      ? 'rgba(0, 229, 255, 0.04)'
                      : 'rgba(255, 255, 255, 0.025)',
                    border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.55)' : 'rgba(255, 255, 255, 0.08)'}`,
                    boxShadow: isActive
                      ? '0 0 18px rgba(0, 229, 255, 0.12), inset 0 1px 0 rgba(0, 229, 255, 0.15)'
                      : '0 2px 8px rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    minWidth: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: isActive
                            ? 'rgba(0, 229, 255, 0.08)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: `1px solid ${isActive ? 'rgba(0, 229, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {getIconComponent(inst.icon)}
                      </div>
                      <div
                        style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              fontSize: '14.5px',
                              color: '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.01em',
                            }}
                            title={inst.name}
                          >
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
                                flexShrink: 0,
                                letterSpacing: '0.04em',
                              }}
                            >
                              {t.instances.officialTag}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '3px',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {inst.mcVersion} • {inst.loaderType.toUpperCase()}
                            {inst.loaderVersion ? ` (${inst.loaderVersion})` : ''}
                          </span>
                          {renderScreenResolutionTag(inst)}
                        </div>
                      </div>
                    </div>

                    {isActive && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10.5px',
                          color: '#00e5ff',
                          fontWeight: 700,
                          background: 'rgba(0, 229, 255, 0.12)',
                          border: '1px solid rgba(0, 229, 255, 0.3)',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          flexShrink: 0,
                          letterSpacing: '0.04em',
                        }}
                      >
                        <CheckCircle2 style={{ width: '12px', height: '12px' }} />
                        {t.instances.activeTag}
                      </span>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      gap: '8px',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        minWidth: 0,
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(inst)}
                        title={t.instances.openFolder}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 8px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          background: 'rgba(255, 255, 255, 0.035)',
                          color: '#cbd5e1',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <FolderOpen style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                        <span>{t.instances.folder}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingInstance(inst);
                          setActiveTab('edit');
                        }}
                        title={t.instances.edit}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 8px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 229, 255, 0.25)',
                          background: 'rgba(0, 229, 255, 0.06)',
                          color: '#00e5ff',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Pencil style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                        <span>{t.instances.edit}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => launcherActions.duplicateInstance(inst.id)}
                        title={t.instances.duplicate}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 8px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          background: 'rgba(255, 255, 255, 0.035)',
                          color: '#cbd5e1',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Copy style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                        <span>{t.instances.duplicate}</span>
                      </button>

                      {!inst.isOfficial && (
                        <button
                          type="button"
                          onClick={() => handleDelete(inst.id, inst.name)}
                          title={t.instances.delete}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            background: 'rgba(244, 63, 94, 0.08)',
                            color: '#fb7185',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                    </div>

                    {!isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSelectInstance(inst.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '28px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#f8fafc',
                          fontWeight: 600,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
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
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          height: '28px',
                          padding: '0 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#22c55e',
                          color: '#0a0a0f',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: '0 0 10px rgba(34, 197, 94, 0.3)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Play style={{ width: '11px', height: '11px', fill: '#0a0a0f' }} />
                        {t.instances.play}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab: Crear Instancia */}
        {activeTab === 'create' && (
          <InstancesCreateTab
            availableVersions={availableVersions}
            onCancel={() => setActiveTab('list')}
            t={t}
          />
        )}

        {/* Tab: Editar Instancia */}
        {activeTab === 'edit' && editingInstance && (
          <InstancesCreateTab
            availableVersions={availableVersions}
            initialInstance={instances.find((i) => i.id === editingInstance.id) ?? editingInstance}
            onCancel={() => {
              setEditingInstance(null);
              setActiveTab('list');
            }}
            onSubmitSuccess={() => {
              setEditingInstance(null);
              setActiveTab('list');
            }}
            t={t}
          />
        )}

        {/* Tab: Importar Instancia */}
        {activeTab === 'import' && (
          <InstancesImportTab onImportSuccess={() => setActiveTab('list')} />
        )}

        {/* Tab: Mundos Locales (Rust NBT Level.dat Engine) */}
        {activeTab === 'saves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                Mundos locales singleplayer leídos directamente en Rust con{' '}
                <code style={{ color: '#00e5ff' }}>fastnbt</code> desde{' '}
                <code style={{ color: '#00e5ff' }}>saves/</code>.
              </p>
              {loadingNbt && (
                <span
                  style={{
                    fontSize: '12px',
                    color: '#00e5ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <HardDrive size={14} /> Parseando level.dat...
                </span>
              )}
            </div>

            {localSaves.length === 0 && !loadingNbt ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  color: '#64748b',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <Compass size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px' }}>
                  No se encontraron mundos singleplayer en esta instancia.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '12px',
                  overflowY: 'auto',
                  maxHeight: 'calc(88vh - 180px)',
                  paddingRight: '6px',
                }}
              >
                {localSaves.map((save) => (
                  <div
                    key={save.folder_name}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#1a1f2c',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {save.icon_base64 ? (
                        <img
                          src={save.icon_base64}
                          alt={save.level_name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Box size={24} color="#64748b" />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#f8fafc',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {save.level_name}
                        </h4>
                        {(() => {
                          const badge = getGameTypeBadge(save.hardcore, save.game_type);
                          return (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: badge.background,
                                color: badge.color,
                              }}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>
                        {save.version_name ?? 'Versión no registrada'} •{' '}
                        {save.last_played
                          ? new Date(save.last_played).toLocaleDateString()
                          : 'Sin fecha'}
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#64748b' }}>
                        saves/{save.folder_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Servidores Guardados (Rust NBT Servers.dat Engine) */}
        {activeTab === 'servers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                Servidores multijugador guardados en{' '}
                <code style={{ color: '#00e5ff' }}>servers.dat</code> serializados y parseados en
                Rust.
              </p>
              {loadingNbt && (
                <span
                  style={{
                    fontSize: '12px',
                    color: '#00e5ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <HardDrive size={14} /> Leyendo servers.dat...
                </span>
              )}
            </div>

            {/* Top form: Añadir Servidor */}
            <form
              onSubmit={handleAddServer}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              <input
                type="text"
                placeholder="Nombre del servidor (ej. CrystalTides SMP)"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                style={{
                  flex: '1 1 180px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Dirección IP / Host (ej. mc.crystaltides.net)"
                value={newServerIp}
                onChange={(e) => setNewServerIp(e.target.value)}
                style={{
                  flex: '1 1 180px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  color: '#f8fafc',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={savingServers || !newServerName.trim() || !newServerIp.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    !newServerName.trim() || !newServerIp.trim()
                      ? 'rgba(0, 229, 255, 0.2)'
                      : '#00e5ff',
                  color: '#0a0a0f',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor:
                    !newServerName.trim() || !newServerIp.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <Plus size={13} />
                Añadir Servidor
              </button>
            </form>

            {savedServers.length === 0 && !loadingNbt ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  color: '#64748b',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <Globe size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px' }}>
                  No hay servidores multijugador registrados en servers.dat.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '12px',
                  overflowY: 'auto',
                  maxHeight: 'calc(88vh - 180px)',
                  paddingRight: '6px',
                }}
              >
                {savedServers.map((server, srvIdx) => (
                  <div
                    key={`${server.name}-${server.ip}-${srvIdx}`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      padding: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#1a1f2c',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {server.icon ? (
                          <img
                            src={
                              server.icon.startsWith('data:')
                                ? server.icon
                                : `data:image/png;base64,${server.icon}`
                            }
                            alt={server.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Globe size={20} color="#00e5ff" />
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#f8fafc',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {server.name}
                        </h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#00e5ff' }}>
                          {server.ip}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(server.ip);
                          setCopiedServerIp(server.ip);
                          setTimeout(() => setCopiedServerIp(null), 2000);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: copiedServerIp === server.ip ? '#22c55e' : '#cbd5e1',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {copiedServerIp === server.ip ? (
                          <>
                            <Check size={12} /> Copiada
                          </>
                        ) : (
                          <>
                            <Copy size={12} /> Copiar IP
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteServer(srvIdx)}
                        title="Eliminar servidor de servers.dat"
                        aria-label={`Eliminar servidor ${server.name}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Mods de la Instancia */}
        {activeTab === 'mods' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                  Mods instalados en <code style={{ color: '#00e5ff' }}>mods/</code> para esta instancia.
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                  Puedes activar, desactivar o eliminar mods comunitarios.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {loadingMods && (
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#00e5ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <HardDrive size={14} /> Escaneando mods...
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleOpenModsFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    background: 'rgba(0, 229, 255, 0.08)',
                    color: '#00e5ff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FolderOpen size={14} />
                  Abrir carpeta mods
                </button>
              </div>
            </div>

            {localMods.length === 0 && !loadingMods ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 20px',
                  color: '#64748b',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <Box size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px' }}>
                  No se encontraron mods en la carpeta mods de esta instancia.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                  gap: '12px',
                  overflowY: 'auto',
                  maxHeight: 'calc(88vh - 180px)',
                  paddingRight: '6px',
                }}
              >
                {localMods.map((mod) => {
                  const sizeMb = (mod.size_bytes / (1024 * 1024)).toFixed(2);
                  return (
                    <div
                      key={mod.filename}
                      style={{
                        background: mod.enabled
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(255, 255, 255, 0.01)',
                        border: `1px solid ${mod.enabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)'}`,
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        opacity: mod.enabled ? 1 : 0.65,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#f8fafc',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '220px',
                            }}
                            title={mod.filename}
                          >
                            {mod.filename.replace(/\.disabled$/, '')}
                          </h4>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: mod.official
                                ? 'rgba(0, 229, 255, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                              color: mod.official ? '#00e5ff' : '#94a3b8',
                            }}
                          >
                            {mod.official ? 'Oficial' : 'Comunidad'}
                          </span>
                        </div>
                        <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                          {sizeMb} MB •{' '}
                          <span style={{ color: mod.enabled ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                            {mod.enabled ? 'Activo' : 'Desactivado'}
                          </span>
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleMod(mod)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: `1px solid ${mod.enabled ? 'rgba(245, 158, 11, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                            background: mod.enabled
                              ? 'rgba(245, 158, 11, 0.1)'
                              : 'rgba(34, 197, 94, 0.1)',
                            color: mod.enabled ? '#f59e0b' : '#22c55e',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {mod.enabled ? 'Desactivar' : 'Activar'}
                        </button>
                        {!mod.official && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMod(mod.filename)}
                            title="Eliminar mod"
                            aria-label={`Eliminar mod ${mod.filename}`}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* In-app confirmation modal for instance deletion */}
        {deletingInstance && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 7, 15, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '20px',
              borderRadius: '16px',
            }}
          >
            <div
              style={{
                background: '#0f172a',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '420px',
                width: '100%',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                }}
              >
                <Trash2 size={24} />
              </div>
              <h3
                style={{ margin: '0 0 8px 0', fontSize: '17px', color: '#f8fafc', fontWeight: 600 }}
              >
                ¿Eliminar instancia?
              </h3>
              <p
                style={{
                  margin: '0 0 20px 0',
                  fontSize: '13px',
                  color: '#94a3b8',
                  lineHeight: 1.5,
                }}
              >
                ¿Estás seguro de que deseas eliminar permanentemente{' '}
                <strong style={{ color: '#f8fafc' }}>{deletingInstance.name}</strong>? Se perderán
                sus mundos y mods aislados.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDeletingInstance(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'transparent',
                    color: '#cbd5e1',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {t.instances.formCancelBtn}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = deletingInstance.id;
                    setDeletingInstance(null);
                    launcherActions.deleteInstance(id);
                  }}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.instances.delete}
                </button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};
