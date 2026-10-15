import React, { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Terminal,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  X,
  Search,
  FileText,
  ArrowDownToLine,
  AlertCircle,
  AlertTriangle,
  Info,
  Download,
  WrapText,
} from 'lucide-react';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'launcher' | 'minecraft';
}

const resolveBadgeStyle = (
  isError: boolean,
  isWarn: boolean,
  isInfo: boolean,
): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '1px 5px',
    borderRadius: '4px',
    fontSize: '10.5px',
    fontWeight: 700,
    marginRight: '6px',
    letterSpacing: '0.02em',
    lineHeight: '1.2',
  };

  if (isError) {
    return {
      ...base,
      background: 'rgba(239, 68, 68, 0.18)',
      color: '#f87171',
      border: '1px solid rgba(239, 68, 68, 0.35)',
    };
  }
  if (isWarn) {
    return {
      ...base,
      background: 'rgba(245, 158, 11, 0.18)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.35)',
    };
  }
  if (isInfo) {
    return {
      ...base,
      background: 'rgba(22, 160, 133, 0.18)',
      color: '#5eead4',
      border: '1px solid rgba(22, 160, 133, 0.35)',
    };
  }
  return {
    ...base,
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  };
};

const getRestTextColor = (isError: boolean, isWarn: boolean): string => {
  if (isError) return '#fca5a5';
  if (isWarn) return '#fde047';
  return '#e2e8f0';
};

const getFallbackTextColor = (text: string): string => {
  if (/error|fatal|crash|failed/i.test(text)) return '#fca5a5';
  if (/warn/i.test(text)) return '#fde047';
  return '#cbd5e1';
};

const parseMinecraftBrackets = (
  bracket1?: string,
  bracket2?: string,
  rawRest?: string,
): { thread: string; level: string; source: string; rest: string } => {
  let thread = '';
  let level = '';
  let source = '';
  let rest = rawRest ?? '';

  if (bracket1) {
    if (bracket1.includes('/')) {
      const parts = bracket1.split('/');
      thread = parts[0];
      level = parts[1];
    } else if (/^(?:INFO|WARN|WARNING|ERROR|FATAL|DEBUG|TRACE)$/i.test(bracket1)) {
      level = bracket1;
    } else {
      thread = bracket1;
    }
  }

  if (bracket2) {
    if (/^(?:INFO|WARN|WARNING|ERROR|FATAL|DEBUG|TRACE)$/i.test(bracket2)) {
      level = bracket2;
    } else {
      source = bracket2;
    }
  }

  if (rest.startsWith(':')) {
    rest = rest.slice(1).trimStart();
  }

  return { thread, level, source, rest };
};

const renderFormattedLogLine = (text: string) => {
  // 1. Java stack trace frame
  if (/^\s*at\s+/.test(text)) {
    return (
      <span style={{ color: '#94a3b8', paddingLeft: '14px' }}>
        <span style={{ color: '#f87171', opacity: 0.7, marginRight: '6px' }}>↳</span>
        {text.trim()}
      </span>
    );
  }

  // 2. Exception / Error headlines
  if (/Exception in thread|Caused by:|java\.[\w.]+(?:Exception|Error):/i.test(text)) {
    return <span style={{ color: '#f87171', fontWeight: 600 }}>{text}</span>;
  }

  // 3. Match timestamps: [YYYY-MM-DD HH:mm:ss.SSS] or [HH:mm:ss] or [HH:mm:ss.SSS]
  const match = /^(\[[^\]]+\])\s*(?:\[([^\]]+)\])?\s*(?:\[([^\]]+)\])?\s*(.*)$/.exec(text);

  if (match) {
    const [, timestamp, bracket1, bracket2, rawRest] = match;
    const { thread, level, source, rest } = parseMinecraftBrackets(bracket1, bracket2, rawRest);
    const isError = /error|fatal/i.test(level) || /error|fatal|exception|crash|failed/i.test(text);
    const isWarn = /warn/i.test(level);
    const isInfo = /info/i.test(level);
    const badgeStyle = resolveBadgeStyle(isError, isWarn, isInfo);

    return (
      <span
        style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '5px' }}
      >
        <span style={{ color: '#64748b', fontSize: '11px', userSelect: 'none' }}>{timestamp}</span>
        {thread && (
          <span style={{ color: '#94a3b8', fontSize: '11px', opacity: 0.85 }}>[{thread}]</span>
        )}
        {level && <span style={badgeStyle}>{level.toUpperCase()}</span>}
        {source && (
          <span style={{ color: '#5eead4', opacity: 0.95, fontWeight: 600, fontSize: '11px' }}>
            [{source}]
          </span>
        )}
        <span style={{ color: getRestTextColor(isError, isWarn) }}>{rest}</span>
      </span>
    );
  }

  return <span style={{ color: getFallbackTextColor(text) }}>{text}</span>;
};

const LogLineItem: React.FC<{
  item: { id: string; lineNumber: number; text: string };
  wrapLines: boolean;
}> = React.memo(({ item, wrapLines }) => (
  <div
    className="log-line-row"
    style={{
      whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
      wordBreak: wrapLines ? 'break-word' : 'normal',
    }}
  >
    <span
      style={{
        width: '38px',
        textAlign: 'right',
        color: '#475569',
        fontSize: '10.5px',
        userSelect: 'none',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
        paddingRight: '6px',
        marginRight: '2px',
      }}
    >
      {item.lineNumber}
    </span>
    <div style={{ flex: 1, minWidth: 0 }}>{renderFormattedLogLine(item.text)}</div>
  </div>
));

export type LogSeverityFilter = 'all' | 'error' | 'warn' | 'info';
export type LogActiveTab = 'launcher' | 'minecraft';

export const getLineSeverity = (line: string): 'error' | 'warn' | 'info' | 'other' => {
  if (/error|fatal|exception|crash|failed/i.test(line)) return 'error';
  if (/warn|warning/i.test(line)) return 'warn';
  if (/info/i.test(line)) return 'info';
  return 'other';
};

function useLogViewer(isOpen: boolean, defaultTab: LogActiveTab) {
  const [activeTab, setActiveTab] = useState<LogActiveTab>(defaultTab);
  const [severityFilter, setSeverityFilter] = useState<LogSeverityFilter>('all');
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    try {
      const blob = new Blob([logs], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeTab === 'launcher' ? 'launcher.log' : 'minecraft.log';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Error al descargar registros:', err);
    }
  };

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setLogs((prev) => (prev.startsWith('Error al obtener registros:') ? '' : prev));
    try {
      const cmd = activeTab === 'launcher' ? 'get_launcher_logs' : 'get_minecraft_logs';
      const fallback =
        activeTab === 'launcher'
          ? 'No hay registros disponibles en launcher.log.'
          : 'No hay registros de juego disponibles aún en minecraft.log.';
      const data = await invoke<string>(cmd, { maxLines: 1000 });
      const cleanData = typeof data === 'string' ? data.trim() : '';
      setLogs(cleanData ? data : fallback);
    } catch (e) {
      setLogs(`Error al obtener registros: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Streaming en vivo de logs de Minecraft mediante el evento game-log emitido por el backend
  useEffect(() => {
    if (!isOpen || activeTab !== 'minecraft') return;

    let cancelled = false;
    let unlistenFn: (() => void) | undefined;

    import('@tauri-apps/api/event')
      .then(({ listen }) => {
        if (cancelled) return;
        return listen<{ line: string; level: string }>('game-log', (event) => {
          if (cancelled || !event.payload?.line) return;
          setLogs((prev: string) => {
            if (prev.startsWith('No hay registros de juego disponibles')) {
              return event.payload.line;
            }
            return `${prev}\n${event.payload.line}`;
          });
        });
      })
      .then((fn) => {
        if (cancelled) {
          fn?.();
        } else {
          unlistenFn = fn;
        }
      })
      .catch((err) => {
        console.warn('[LogViewer] Error al suscribir evento game-log:', err);
      });

    return () => {
      cancelled = true;
      if (unlistenFn) unlistenFn();
    };
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const rawLines = useMemo(() => logs.split('\n'), [logs]);

  const counts = useMemo(() => {
    let errors = 0;
    let warns = 0;
    let infos = 0;
    for (const line of rawLines) {
      const sev = getLineSeverity(line);
      if (sev === 'error') errors++;
      else if (sev === 'warn') warns++;
      else if (sev === 'info') infos++;
    }
    return { errors, warns, infos, total: rawLines.length };
  }, [rawLines]);

  const filteredLines = useMemo(() => {
    const filter = searchFilter.trim().toLowerCase();
    return rawLines
      .map((line, offset) => ({
        id: `entry-${offset}-${line.slice(0, 24)}`,
        lineNumber: offset + 1,
        text: line,
      }))
      .filter((item) => {
        if (severityFilter !== 'all' && getLineSeverity(item.text) !== severityFilter) {
          return false;
        }
        if (filter && !item.text.toLowerCase().includes(filter)) {
          return false;
        }
        return true;
      });
  }, [rawLines, searchFilter, severityFilter]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Error al copiar registros:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke('open_logs_folder');
    } catch (err) {
      console.warn('Error abriendo carpeta de logs:', err);
    }
  };

  return {
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    counts,
    logs,
    loading,
    copied,
    searchFilter,
    setSearchFilter,
    autoScroll,
    setAutoScroll,
    logContainerRef,
    filteredLines,
    fetchLogs,
    handleCopy,
    wrapLines,
    setWrapLines,
    handleDownload,
    handleOpenFolder,
  };
}

interface LogViewerHeaderProps {
  onOpenFolder: () => void;
  onCopy: () => void;
  copied: boolean;
  onDownload: () => void;
  onRefresh: () => void;
  loading: boolean;
  onClose: () => void;
}

const LogViewerHeader: React.FC<LogViewerHeaderProps> = ({
  onOpenFolder,
  onCopy,
  copied,
  onDownload,
  onRefresh,
  loading,
  onClose,
}) => (
  <div
    style={{
      padding: '13px 18px',
      borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'rgba(10, 16, 27, 0.85)',
      flexShrink: 0,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '9px',
          background: 'linear-gradient(135deg, rgba(22, 160, 133, 0.2) 0%, rgba(20, 37, 62, 0.3) 100%)',
          border: '1px solid rgba(22, 160, 133, 0.35)',
          boxShadow: '0 0 12px rgba(22, 160, 133, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Terminal size={17} color="#16A085" />
      </div>
      <div style={{ minWidth: 0 }}>
        <h2
          style={{
            fontSize: '14.5px',
            fontWeight: 700,
            margin: 0,
            color: '#f8fafc',
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}
        >
          Registros y Diagnóstico
        </h2>
        <span
          style={{
            fontSize: '11px',
            color: '#94a3b8',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: '2px',
          }}
        >
          Inspección de eventos del sistema, instaladores y Minecraft
        </span>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
      <button
        type="button"
        onClick={onOpenFolder}
        title="Abrir carpeta en el Explorador"
        className="log-header-btn"
      >
        <FolderOpen size={13} />
        <span>Abrir Carpeta</span>
      </button>

      <button
        type="button"
        onClick={onDownload}
        title="Descargar archivo de registro"
        className="log-header-btn"
      >
        <Download size={13} />
        <span>Descargar</span>
      </button>

      <button
        type="button"
        onClick={onCopy}
        title="Copiar contenido al portapapeles"
        className="log-header-btn"
        style={
          copied
            ? {
                background: 'rgba(34, 197, 94, 0.18)',
                borderColor: 'rgba(34, 197, 94, 0.4)',
                color: '#4ade80',
              }
            : undefined
        }
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span>{copied ? 'Copiado' : 'Copiar'}</span>
      </button>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        title="Actualizar registros"
        className="log-refresh-btn"
      >
        <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        <span>Actualizar</span>
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar visor de registros"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: '7px',
          marginLeft: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
          e.currentTarget.style.color = '#f87171';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        <X size={17} />
      </button>
    </div>
  </div>
);

interface LogViewerToolbarProps {
  activeTab: LogActiveTab;
  setActiveTab: (tab: LogActiveTab) => void;
  severityFilter: LogSeverityFilter;
  setSeverityFilter: (filter: LogSeverityFilter) => void;
  counts: { errors: number; warns: number; infos: number; total: number };
  searchFilter: string;
  setSearchFilter: (query: string) => void;
  autoScroll: boolean;
  setAutoScroll: React.Dispatch<React.SetStateAction<boolean>>;
  wrapLines: boolean;
  setWrapLines: React.Dispatch<React.SetStateAction<boolean>>;
}

const LogViewerToolbar: React.FC<LogViewerToolbarProps> = ({
  activeTab,
  setActiveTab,
  severityFilter,
  setSeverityFilter,
  counts,
  searchFilter,
  setSearchFilter,
  autoScroll,
  setAutoScroll,
  wrapLines,
  setWrapLines,
}) => {
  const getSeverityStyle = (s: 'all' | 'error' | 'warn' | 'info') => {
    const isSelected = severityFilter === s;
    const palettes: Record<
      'all' | 'error' | 'warn' | 'info',
      {
        selected: { bg: string; color: string; borderColor: string; shadow?: string };
        unselected: { bg: string; color: string; borderColor: string; shadow?: string };
      }
    > = {
      error: {
        selected: {
          bg: 'rgba(239, 68, 68, 0.22)',
          color: '#f87171',
          borderColor: 'rgba(239, 68, 68, 0.45)',
          shadow: '0 0 10px rgba(239, 68, 68, 0.2)',
        },
        unselected: {
          bg: 'rgba(255, 255, 255, 0.04)',
          color: '#fca5a5',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
      warn: {
        selected: {
          bg: 'rgba(245, 158, 11, 0.22)',
          color: '#fbbf24',
          borderColor: 'rgba(245, 158, 11, 0.45)',
          shadow: '0 0 10px rgba(245, 158, 11, 0.2)',
        },
        unselected: {
          bg: 'rgba(255, 255, 255, 0.04)',
          color: '#fde047',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
      info: {
        selected: {
          bg: 'rgba(22, 160, 133, 0.22)',
          color: '#5eead4',
          borderColor: 'rgba(22, 160, 133, 0.45)',
          shadow: '0 0 10px rgba(22, 160, 133, 0.2)',
        },
        unselected: {
          bg: 'rgba(255, 255, 255, 0.04)',
          color: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
      all: {
        selected: {
          bg: 'rgba(255, 255, 255, 0.12)',
          color: '#f8fafc',
          borderColor: 'rgba(255, 255, 255, 0.25)',
          shadow: '0 0 10px rgba(255, 255, 255, 0.08)',
        },
        unselected: {
          bg: 'rgba(255, 255, 255, 0.04)',
          color: '#94a3b8',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
    };

    const palette = palettes[s];
    const theme = isSelected ? palette.selected : palette.unselected;

    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      background: theme.bg,
      border: `1px solid ${theme.borderColor}`,
      borderRadius: '6px',
      color: theme.color,
      fontSize: '10.5px',
      fontWeight: 600,
      padding: '3.5px 8px',
      cursor: 'pointer',
      boxShadow: isSelected && theme.shadow ? theme.shadow : 'none',
      transition: 'all 0.15s cubic-bezier(0.2, 0, 0, 1)',
    };
  };

  return (
    <div
      style={{
        padding: '8px 18px',
        backgroundColor: 'rgba(8, 14, 24, 0.88)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(20, 37, 62, 0.45)',
            border: '1px solid rgba(21, 61, 76, 0.35)',
            borderRadius: '8px',
            padding: '2px',
            gap: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('launcher')}
            className={`log-tab-btn ${activeTab === 'launcher' ? 'is-active' : ''}`}
          >
            <FileText size={12} />
            <span>Launcher (launcher.log)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('minecraft')}
            className={`log-tab-btn ${activeTab === 'minecraft' ? 'is-active' : ''}`}
          >
            <FileText size={12} />
            <span>Minecraft (minecraft.log)</span>
          </button>
        </div>

        {/* Severity quick filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setSeverityFilter('all')}
            style={getSeverityStyle('all')}
          >
            Todos
          </button>
          {counts.errors > 0 && (
            <button
              type="button"
              onClick={() => setSeverityFilter('error')}
              style={getSeverityStyle('error')}
            >
              <AlertCircle size={11} />
              <span>Errores ({counts.errors})</span>
            </button>
          )}
          {counts.warns > 0 && (
            <button
              type="button"
              onClick={() => setSeverityFilter('warn')}
              style={getSeverityStyle('warn')}
            >
              <AlertTriangle size={11} />
              <span>Avisos ({counts.warns})</span>
            </button>
          )}
          {counts.infos > 0 && (
            <button
              type="button"
              onClick={() => setSeverityFilter('info')}
              style={getSeverityStyle('info')}
            >
              <Info size={11} />
              <span>Info</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(5, 9, 16, 0.65)',
            border: '1px solid rgba(21, 61, 76, 0.45)',
            borderRadius: '7px',
            padding: '4px 9px',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <Search size={12} color="#16A085" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar por texto..."
            aria-label="Filtrar registros por texto"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '11px',
              width: '130px',
            }}
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              aria-label="Limpiar filtro de búsqueda"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Wrap lines */}
        <button
          type="button"
          onClick={() => setWrapLines((prev) => !prev)}
          role="switch"
          aria-checked={wrapLines}
          title={
            wrapLines
              ? 'Desactivar ajuste automático de líneas'
              : 'Ajustar líneas largas para evitar desplazamiento horizontal'
          }
          className={`log-toggle-btn ${wrapLines ? 'is-active' : ''}`}
        >
          <WrapText size={12} />
          <span>Ajustar líneas</span>
        </button>

        {/* Auto-scroll */}
        <button
          type="button"
          onClick={() => setAutoScroll((prev) => !prev)}
          role="switch"
          aria-checked={autoScroll}
          title={
            autoScroll
              ? 'Desactivar desplazamiento automático'
              : 'Activar desplazamiento automático al recibir nuevas líneas'
          }
          className={`log-toggle-btn ${autoScroll ? 'is-active' : ''}`}
        >
          <ArrowDownToLine size={12} />
          <span>Auto-scroll</span>
        </button>
      </div>
    </div>
  );
};

interface LogViewerBodyProps {
  logContainerRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  logsLength: number;
  searchFilter: string;
  filteredLines: Array<{ id: string; lineNumber: number; text: string }>;
  wrapLines: boolean;
}

const renderLogLinesContent = (
  loading: boolean,
  logsLength: number,
  filteredLines: Array<{ id: string; lineNumber: number; text: string }>,
  searchFilter: string,
  wrapLines: boolean,
) => {
  if (loading && logsLength === 0) {
    return (
      <div style={{ color: '#64748b', textAlign: 'center', padding: '50px' }}>
        Cargando registros...
      </div>
    );
  }
  if (filteredLines.length === 0) {
    return (
      <div style={{ color: '#64748b', textAlign: 'center', padding: '50px' }}>
        No se encontraron coincidencias para "{searchFilter}".
      </div>
    );
  }
  return filteredLines.map((item) => (
    <LogLineItem key={item.id} item={item} wrapLines={wrapLines} />
  ));
};

const LogViewerBody: React.FC<LogViewerBodyProps> = ({
  logContainerRef,
  loading,
  logsLength,
  searchFilter,
  filteredLines,
  wrapLines,
}) => (
  <div
    ref={logContainerRef}
    style={{
      flex: 1,
      width: '100%',
      backgroundColor: '#050811',
      padding: '10px 14px',
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, Menlo, monospace",
      fontSize: '11px',
      overflowY: 'auto',
      overflowX: wrapLines ? 'hidden' : 'auto',
      boxSizing: 'border-box',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(22, 160, 133, 0.35) rgba(5, 8, 17, 0.6)',
    }}
  >
    {renderLogLinesContent(loading, logsLength, filteredLines, searchFilter, wrapLines)}
  </div>
);

interface LogViewerFooterProps {
  filteredCount: number;
  totalLines: number;
  searchFilter: string;
  activeTab: 'launcher' | 'minecraft';
}

const LogViewerFooter: React.FC<LogViewerFooterProps> = ({
  filteredCount,
  totalLines,
  searchFilter,
  activeTab,
}) => (
  <div
    style={{
      padding: '8px 18px',
      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      backgroundColor: 'rgba(8, 14, 24, 0.92)',
      fontSize: '11px',
      color: '#64748b',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
    }}
  >
    <span>
      Líneas mostradas: <strong style={{ color: '#e2e8f0', fontWeight: 700 }}>{filteredCount}</strong>{' '}
      {searchFilter && `(filtradas de ${totalLines})`}
    </span>
    <span
      style={{
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        color: '#5eead4',
        fontSize: '10.5px',
        background: 'rgba(22, 160, 133, 0.1)',
        border: '1px solid rgba(22, 160, 133, 0.25)',
        padding: '2px 8px',
        borderRadius: '5px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <span>Ruta:</span>
      <span style={{ color: '#f1f5f9' }}>
        ~/.crystaltides/logs/{activeTab === 'launcher' ? 'launcher.log' : 'minecraft.log'}
      </span>
    </span>
  </div>
);

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'launcher',
}) => {
  const {
    activeTab,
    setActiveTab,
    severityFilter,
    setSeverityFilter,
    counts,
    logs,
    loading,
    copied,
    searchFilter,
    setSearchFilter,
    autoScroll,
    setAutoScroll,
    wrapLines,
    setWrapLines,
    handleDownload,
    logContainerRef,
    filteredLines,
    fetchLogs,
    handleCopy,
    handleOpenFolder,
  } = useLogViewer(isOpen, defaultTab);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 4, 10, 0.8)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px',
      }}
    >
      <button
        type="button"
        aria-label="Cerrar visor de logs"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
        onClick={onClose}
      />
      <dialog
        open
        aria-label="Log Viewer"
        className="log-viewer-dialog"
      >
        <LogViewerHeader
          onOpenFolder={handleOpenFolder}
          onCopy={handleCopy}
          copied={copied}
          onDownload={handleDownload}
          onRefresh={fetchLogs}
          loading={loading}
          onClose={onClose}
        />
        <LogViewerToolbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          severityFilter={severityFilter}
          setSeverityFilter={setSeverityFilter}
          counts={counts}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          wrapLines={wrapLines}
          setWrapLines={setWrapLines}
        />
        <LogViewerBody
          logContainerRef={logContainerRef}
          loading={loading}
          logsLength={logs.length}
          searchFilter={searchFilter}
          filteredLines={filteredLines}
          wrapLines={wrapLines}
        />
        <LogViewerFooter
          filteredCount={filteredLines.length}
          totalLines={logs.split('\n').length}
          searchFilter={searchFilter}
          activeTab={activeTab}
        />
      </dialog>
    </div>
  );
};
