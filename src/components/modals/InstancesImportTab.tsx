import React, { useEffect, useState } from 'react';
import {
  FolderDown,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  Search,
} from 'lucide-react';
import {
  fetchExternalInstances,
  inspectCustomDirectory,
  pickInstanceFolder,
  importInstanceToLauncher,
  ImportableInstance,
} from '../../services/instanceImportService';
import { useLauncherStore, LauncherState, useT } from '../../store/launcherStore';
import { getSavedInstances } from '../../services/instanceService';
import { LauncherBrandIcon, CrystalTidesLogo } from '../icons/LauncherBrandIcon';

interface InstancesImportTabProps {
  onImportSuccess: () => void;
}

const resolveCustomImportLabel = (
  imported: boolean,
  importing: boolean,
  labels: { already: string; importing: string; importNow: string },
) => {
  if (imported) return labels.already;
  if (importing) return labels.importing;
  return labels.importNow;
};

const renderImportButtonLabel = (
  already: boolean,
  isWorking: boolean,
  labels: { already: string; importing: string; importBtn: string },
) => {
  if (already) {
    return (
      <>
        <CheckCircle2 style={{ width: '14px', height: '14px' }} />
        {labels.already}
      </>
    );
  }
  if (isWorking) {
    return (
      <>
        <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
        {labels.importing}
      </>
    );
  }
  return (
    <>
      <CrystalTidesLogo size={14} />
      {labels.importBtn}
    </>
  );
};

export const InstancesImportTab: React.FC<InstancesImportTabProps> = ({ onImportSuccess }) => {
  const t = useT();
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const [loading, setLoading] = useState(true);
  const [scannedInstances, setScannedInstances] = useState<ImportableInstance[]>([]);
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [customScanning, setCustomScanning] = useState(false);
  const [customResult, setCustomResult] = useState<ImportableInstance | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const loadInstances = async () => {
    setLoading(true);
    try {
      const items = await fetchExternalInstances();
      setScannedInstances(items);
    } catch (err) {
      console.warn('[InstancesImportTab] Error cargando instancias externas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  const handleBrowseFolder = async () => {
    const selected = await pickInstanceFolder();
    if (selected) {
      setCustomPath(selected);
      handleInspectPath(selected);
    }
  };

  const handleInspectPath = async (pathToInspect?: string) => {
    const target = (pathToInspect ?? customPath).trim();
    if (!target) return;
    setCustomScanning(true);
    setCustomError(null);
    setCustomResult(null);

    const res = await inspectCustomDirectory(target);
    setCustomScanning(false);
    if (res) {
      setCustomResult(res);
    } else {
      setCustomError(t.instances.importInvalidMinecraftDir);
    }
  };

  const handleImport = async (item: ImportableInstance) => {
    setImportingId(item.id);
    try {
      await importInstanceToLauncher(item);
      setImportedIds((prev) => new Set(prev).add(item.id));
      // Sincronizar el store de launcher
      useLauncherStore.setState({ instances: getSavedInstances() });
      setTimeout(() => {
        onImportSuccess();
      }, 700);
    } catch (err) {
      console.error('[InstancesImportTab] Error importando instancia:', err);
    } finally {
      setImportingId(null);
    }
  };

  const isAlreadyImported = (item: ImportableInstance) => {
    if (importedIds.has(item.id)) return true;
    return instances.some((inst) => {
      // 1. Coincidencia directa por ID de origen importado
      if (inst.importedSourceId && inst.importedSourceId === item.id) {
        return true;
      }

      if (!inst.gameDir || !item.game_dir) return false;

      // Normalizar rutas Windows/Unix y eliminar barras finales
      const normInstDir = inst.gameDir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
      const normItemDir = item.game_dir.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

      if (normInstDir !== normItemDir) return false;

      // Para Minecraft Oficial (Mojang), múltiples perfiles comparten la raíz (.minecraft).
      // Por ende, una coincidencia de carpeta NO es suficiente para Mojang:
      // se requiere además que coincida el nombre exacto de la instancia.
      if (item.source === 'mojang') {
        return inst.name.trim().toLowerCase() === item.name.trim().toLowerCase();
      }

      // Para CurseForge, Modrinth, Prism o carpetas personalizadas:
      // Cada instancia reside en una subcarpeta dedicada y aislada (1 carpeta = 1 modpack).
      return true;
    });
  };

  const filteredList = scannedInstances.filter((item) => {
    if (filterSource !== 'all' && item.source !== filterSource) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.mc_version.toLowerCase().includes(q) ||
        item.loader_type.toLowerCase().includes(q) ||
        item.game_dir.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getSourceIcon = (source: string) => {
    return <LauncherBrandIcon source={source} size={16} />;
  };

  const getLoaderBadgeColor = (loader: string) => {
    switch (loader.toLowerCase()) {
      case 'neoforge':
        return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.35)' };
      case 'forge':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: 'rgba(234, 179, 8, 0.35)' };
      case 'fabric':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.35)' };
      case 'quilt':
        return { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' };
      default:
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.35)' };
    }
  };

  const importLabels = {
    already: t.instances.alreadyImported,
    importing: t.instances.importingStatus,
    importBtn: t.instances.importBtn,
    importNow: t.instances.importBtn,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxHeight: 'calc(88vh - 140px)',
        overflowY: 'auto',
        paddingRight: '6px',
      }}
    >
      {/* Top Banner / Custom Directory Box */}
      <div
        style={{
          background: 'rgba(20, 37, 62, 0.35)',
          border: '1px solid rgba(21, 61, 76, 0.45)',
          borderRadius: '14px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'rgba(22, 160, 133, 0.12)',
                border: '1px solid rgba(22, 160, 133, 0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FolderDown style={{ width: '18px', height: '18px', color: '#16A085' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                {t.instances.importTitle}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                {t.instances.importSubtitle}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadInstances}
            disabled={loading}
            className="instance-action-btn"
            style={{
              height: '32px',
              padding: '0 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {t.instances.rescanBtn}
          </button>
        </div>

        {/* Manual Path Input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder={t.instances.customPathPlaceholder}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(0, 0, 0, 0.35)',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleBrowseFolder}
            className="instance-action-btn edit"
            style={{ height: '34px', padding: '0 14px', fontSize: '12px' }}
          >
            <FolderOpen style={{ width: '14px', height: '14px' }} />
            {t.instances.browseBtn}
          </button>
          <button
            type="button"
            onClick={() => handleInspectPath()}
            disabled={customScanning || !customPath.trim()}
            className="instance-play-btn"
            style={{
              height: '34px',
              padding: '0 16px',
              fontSize: '12px',
              borderRadius: '8px',
              opacity: customScanning || !customPath.trim() ? 0.6 : 1,
              cursor: customScanning || !customPath.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {customScanning ? t.instances.importInspectingStatus : t.instances.importInspectBtn}
          </button>
        </div>

        {customError && (
          <div style={{ fontSize: '11px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: '6px' }}>
            {customError}
          </div>
        )}

        {/* Custom Inspect Preview Card */}
        {customResult && (
          <div
            style={{
              background: 'rgba(21, 61, 76, 0.15)',
              border: '1px solid rgba(21, 86, 91, 0.4)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{customResult.name}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '8px' }}>
                <span>{t.instances.importVersionPrefix}: {customResult.mc_version}</span>
                <span>{t.instances.importLoaderPrefix}: {customResult.loader_type.toUpperCase()}</span>
                <span>{t.instances.importModsPrefix}: {customResult.mods_count}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{customResult.game_dir}</div>
            </div>
            <button
              type="button"
              onClick={() => handleImport(customResult)}
              disabled={importingId === customResult.id || isAlreadyImported(customResult)}
              className={isAlreadyImported(customResult) ? 'instance-action-btn' : 'instance-play-btn'}
              style={{
                height: '32px',
                padding: '0 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: isAlreadyImported(customResult) ? 'default' : 'pointer',
              }}
            >
              {resolveCustomImportLabel(isAlreadyImported(customResult), importingId === customResult.id, importLabels)}
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: t.instances.importFilterAll },
            { id: 'mojang', label: t.instances.importFilterOfficial },
            { id: 'curseforge', label: 'CurseForge' },
            { id: 'modrinth', label: 'Modrinth' },
            { id: 'prism', label: 'Prism / MultiMC' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterSource(f.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: filterSource === f.id ? '1px solid rgba(22, 160, 133, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: filterSource === f.id ? 'rgba(22, 160, 133, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: filterSource === f.id ? '#16A085' : '#cbd5e1',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {f.id !== 'all' && <LauncherBrandIcon source={f.id} size={14} />}
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <Search style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: '#64748b' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.instances.importSearchPlaceholder}
            style={{
              width: '100%',
              padding: '6px 10px 6px 28px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(10, 14, 23, 0.8)',
              color: '#f8fafc',
              fontSize: '11px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Scanned Instances Grid */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
          {t.instances.importScanningLaunchers}
        </div>
      )}
      {!loading && filteredList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
          {t.instances.importNoInstancesFound}
        </div>
      )}
      {!loading && filteredList.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '12px',
          }}
        >
          {filteredList.map((item, index) => {
            const already = isAlreadyImported(item);
            const badge = getLoaderBadgeColor(item.loader_type);
            const isWorking = importingId === item.id;

            return (
              <div
                key={item.id}
                className="instance-subitem-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  animation: 'instanceCardEntrance 0.22s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                  animationDelay: `${Math.min(index * 35, 210)}ms`,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getSourceIcon(item.source)}
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{item.source_name}</span>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {item.loader_type.toUpperCase()} {item.loader_version ? `(${item.loader_version})` : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '8px' }}>
                    {item.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    <span>Minecraft {item.mc_version}</span>
                    <span>•</span>
                    <span>{item.mods_count > 0 ? `${item.mods_count} mods` : t.instances.importNoMods}</span>
                  </div>

                  <div
                    title={item.game_dir}
                    style={{
                      fontSize: '10px',
                      color: '#64748b',
                      marginTop: '6px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.game_dir}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleImport(item)}
                  disabled={already || isWorking}
                  className={already ? 'instance-action-btn' : 'instance-play-btn'}
                  style={{
                    width: '100%',
                    height: '34px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: already ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  {renderImportButtonLabel(already, isWorking, importLabels)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
