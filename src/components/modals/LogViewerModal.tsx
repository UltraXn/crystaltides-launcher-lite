import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'launcher' | 'minecraft';
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'launcher',
}) => {
  const [activeTab, setActiveTab] = useState<'launcher' | 'minecraft'>(defaultTab);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 'launcher') {
        const data = await invoke<string>('get_launcher_logs', { maxLines: 800 });
        setLogs(data || 'No hay registros disponibles en launcher.log.');
      } else {
        const data = await invoke<string>('get_minecraft_logs', { maxLines: 800 });
        setLogs(data || 'No hay registros de juego disponibles aún en minecraft.log.');
      }
    } catch (e) {
      setLogs(`Error al obtener registros: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  if (!isOpen) return null;

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

  const filteredLines = logs.split('\n').filter((line) => {
    if (!searchFilter.trim()) return true;
    return line.toLowerCase().includes(searchFilter.toLowerCase());
  });

  const renderColoredLine = (line: string, index: number) => {
    const isError = /error|fatal|exception|crash|failed/i.test(line);
    const isWarn = /warn|warning/i.test(line);
    const isInfo = /info/i.test(line);

    let textColor = '#e2e8f0';
    if (isError) textColor = '#f87171';
    else if (isWarn) textColor = '#fbbf24';
    else if (isInfo) textColor = '#94a3b8';

    return (
      <div
        key={index}
        style={{
          color: textColor,
          lineHeight: '1.45',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {line}
      </div>
    );
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '880px',
          height: '85vh',
          maxHeight: '720px',
          backgroundColor: '#131118',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.08)',
          color: '#F8FAFC',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={20} color="#38bdf8" />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                Registros y Diagnóstico
              </h2>
              <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.5)' }}>
                Inspección de eventos del sistema, instaladores y Minecraft
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleOpenFolder}
              title="Abrir carpeta en el Explorador"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '12px',
                padding: '6px 12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FolderOpen size={14} />
              Abrir Carpeta
            </button>

            <button
              type="button"
              onClick={handleCopy}
              title="Copiar contenido al portapapeles"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: copied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                border: copied
                  ? '1px solid rgba(34, 197, 94, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: copied ? '#4ade80' : '#e2e8f0',
                fontSize: '12px',
                padding: '6px 12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>

            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Actualizar registros"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                color: '#38bdf8',
                fontSize: '12px',
                padding: '6px 12px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw
                size={14}
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
              />
              Actualizar
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(248, 250, 252, 0.5)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                marginLeft: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-header: Tabs & Search Filter */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('launcher')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'launcher' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border:
                  activeTab === 'launcher'
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : '1px solid transparent',
                borderRadius: '6px',
                color: activeTab === 'launcher' ? '#38bdf8' : 'rgba(248, 250, 252, 0.6)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={14} />
              Launcher (launcher.log)
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('minecraft')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === 'minecraft' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                border:
                  activeTab === 'minecraft'
                    ? '1px solid rgba(56, 189, 248, 0.35)'
                    : '1px solid transparent',
                borderRadius: '6px',
                color: activeTab === 'minecraft' ? '#38bdf8' : 'rgba(248, 250, 252, 0.6)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={14} />
              Minecraft (minecraft.log)
            </button>
          </div>

          {/* Search Box and Auto-scroll */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '4px 10px',
              }}
            >
              <Search size={13} color="rgba(248, 250, 252, 0.4)" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por texto..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#F8FAFC',
                  fontSize: '11px',
                  width: '160px',
                }}
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(248, 250, 252, 0.4)',
                    cursor: 'pointer',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                backgroundColor: autoScroll
                  ? 'var(--accent-subtle, rgba(56, 189, 248, 0.14))'
                  : 'rgba(255, 255, 255, 0.03)',
                border: autoScroll
                  ? '1px solid var(--accent-primary, rgba(56, 189, 248, 0.35))'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: autoScroll
                  ? 'var(--accent-primary, #38bdf8)'
                  : 'rgba(248, 250, 252, 0.55)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                boxShadow: autoScroll
                  ? '0 0 12px var(--accent-subtle, rgba(56, 189, 248, 0.2))'
                  : 'none',
              }}
              onMouseEnter={(e) => {
                if (!autoScroll) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.07)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.color = 'rgba(248, 250, 252, 0.85)';
                } else {
                  e.currentTarget.style.boxShadow =
                    '0 0 16px var(--accent-subtle, rgba(56, 189, 248, 0.35))';
                }
              }}
              onMouseLeave={(e) => {
                if (!autoScroll) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = 'rgba(248, 250, 252, 0.55)';
                } else {
                  e.currentTarget.style.boxShadow =
                    '0 0 12px var(--accent-subtle, rgba(56, 189, 248, 0.2))';
                }
              }}
            >
              <ArrowDownToLine
                size={13}
                style={{
                  color: autoScroll
                    ? 'var(--accent-primary, #38bdf8)'
                    : 'rgba(248, 250, 252, 0.45)',
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.18s ease',
                  transform: autoScroll ? 'translateY(0)' : 'translateY(-1px)',
                }}
              />
              <span>Auto-scroll</span>
              <span
                aria-hidden="true"
                style={{
                  width: '18px',
                  height: '10px',
                  borderRadius: '999px',
                  backgroundColor: autoScroll
                    ? 'var(--accent-primary, #38bdf8)'
                    : 'rgba(255, 255, 255, 0.16)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1.5px',
                  transition: 'background-color 0.2s ease',
                  marginLeft: '2px',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: autoScroll ? '#090d16' : 'rgba(255, 255, 255, 0.65)',
                    transform: autoScroll ? 'translateX(8px)' : 'translateX(0)',
                    transition:
                      'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease',
                  }}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Log Stream Output View */}
        <div
          ref={logContainerRef}
          className="papyrus-settings-card"
          style={{
            flex: 1,
            backgroundColor: '#0d0b10',
            padding: '16px 20px',
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: '11.5px',
            overflowY: 'auto',
            overflowX: 'auto',
          }}
        >
          {loading && logs.length === 0 ? (
            <div
              style={{ color: 'rgba(248, 250, 252, 0.4)', textAlign: 'center', padding: '40px' }}
            >
              Cargando registros...
            </div>
          ) : filteredLines.length === 0 ? (
            <div
              style={{ color: 'rgba(248, 250, 252, 0.4)', textAlign: 'center', padding: '40px' }}
            >
              No se encontraron coincidencias para "{searchFilter}".
            </div>
          ) : (
            filteredLines.map((line, idx) => renderColoredLine(line, idx))
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '8px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            fontSize: '11px',
            color: 'rgba(248, 250, 252, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            Líneas mostradas: {filteredLines.length}{' '}
            {searchFilter && `(filtradas de ${logs.split('\n').length})`}
          </span>
          <span>
            Ruta: ~/.crystaltides/logs/{activeTab === 'launcher' ? 'launcher.log' : 'minecraft.log'}
          </span>
        </div>
      </div>
    </div>
  );
};
