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
import { useLauncherStore, LauncherState } from '../../store/launcherStore';
import { getSavedInstances } from '../../services/instanceService';
import { LauncherBrandIcon, CrystalTidesLogo } from '../icons/LauncherBrandIcon';

interface InstancesImportTabProps {
  onImportSuccess: () => void;
}

const resolveCustomImportLabel = (imported: boolean, importing: boolean) => {
  if (imported) return 'Ya Importada';
  if (importing) return 'Importando...';
  return 'Importar ahora';
};

const renderImportButtonLabel = (already: boolean, isWorking: boolean) => {
  if (already) {
    return (
      <>
        <CheckCircle2 style={{ width: '14px', height: '14px' }} />
        Ya importada en CrystalTides
      </>
    );
  }
  if (isWorking) {
    return (
      <>
        <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
        Importando...
      </>
    );
  }
  return (
    <>
      <CrystalTidesLogo size={14} />
      Importar a CrystalTides
    </>
  );
};

export const InstancesImportTab: React.FC<InstancesImportTabProps> = ({ onImportSuccess }) => {
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
      setCustomError('No se detectó una instalación o estructura válida de Minecraft en la ruta.');
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
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(0, 229, 255, 0.22)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderDown style={{ width: '18px', height: '18px', color: '#00e5ff' }} />
              Importador Automático de Instancias
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Escanea perfiles existentes de Minecraft Oficial, CurseForge, Modrinth y Prism Launcher, o selecciona cualquier carpeta manual.
            </div>
          </div>
          <button
            type="button"
            onClick={loadInstances}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Re-escanear
          </button>
        </div>

        {/* Manual Path Input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="O escribe la ruta de una carpeta de Minecraft (ej. D:\Juegos\MiModpack)..."
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(10, 14, 23, 0.8)',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleBrowseFolder}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 229, 255, 0.3)',
              background: 'rgba(0, 229, 255, 0.1)',
              color: '#00e5ff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen style={{ width: '14px', height: '14px' }} />
            Examinar
          </button>
          <button
            type="button"
            onClick={() => handleInspectPath()}
            disabled={customScanning || !customPath.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#00e5ff',
              color: '#0a0a0f',
              fontSize: '12px',
              fontWeight: 700,
              cursor: customScanning || !customPath.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {customScanning ? 'Inspeccionando...' : 'Inspeccionar'}
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
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1px solid rgba(0, 229, 255, 0.35)',
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
                <span>Versión: {customResult.mc_version}</span>
                <span>Loader: {customResult.loader_type.toUpperCase()}</span>
                <span>Mods: {customResult.mods_count}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{customResult.game_dir}</div>
            </div>
            <button
              type="button"
              onClick={() => handleImport(customResult)}
              disabled={importingId === customResult.id || isAlreadyImported(customResult)}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isAlreadyImported(customResult) ? 'rgba(34, 197, 94, 0.2)' : '#00e5ff',
                color: isAlreadyImported(customResult) ? '#22c55e' : '#0a0a0f',
                fontSize: '12px',
                fontWeight: 700,
                cursor: isAlreadyImported(customResult) ? 'default' : 'pointer',
              }}
            >
              {resolveCustomImportLabel(isAlreadyImported(customResult), importingId === customResult.id)}
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'mojang', label: 'Minecraft Oficial' },
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
                border: 'none',
                background: filterSource === f.id ? '#00e5ff' : 'rgba(255, 255, 255, 0.06)',
                color: filterSource === f.id ? '#0a0a0f' : '#cbd5e1',
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
            placeholder="Buscar por nombre o versión..."
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
          Escaneando launchers instalados en el sistema...
        </div>
      )}
      {!loading && filteredList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
          No se encontraron instancias en los launchers seleccionados. Usa el selector de carpetas superior para importar manualmente.
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
          {filteredList.map((item) => {
            const already = isAlreadyImported(item);
            const badge = getLoaderBadgeColor(item.loader_type);
            const isWorking = importingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: `1px solid ${already ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'border-color 0.15s ease',
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
                    <span>{item.mods_count > 0 ? `${item.mods_count} mods` : 'Sin mods'}</span>
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
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: already ? 'rgba(34, 197, 94, 0.15)' : '#00e5ff',
                    color: already ? '#22c55e' : '#0a0a0f',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: already ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {renderImportButtonLabel(already, isWorking)}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
