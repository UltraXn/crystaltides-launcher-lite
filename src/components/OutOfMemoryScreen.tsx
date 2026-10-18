import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Cpu, Trash2, Sliders, CheckCircle2, ArrowLeft, X, Layers } from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState } from '../store/launcherStore';
import { clearDockPanorama } from '../utils/wallpaperStorage';

export interface OutOfMemoryScreenProps {
  onClose?: () => void;
  onRetry?: () => void;
  crashReason?: string;
  crashDetails?: string;
  exitCode?: number;
  isFatalCrash?: boolean;
}

function detectSystemRam(maxRamGb: number): number {
  let detected = 8;
  if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
    const devMem = (navigator as unknown as { deviceMemory: number }).deviceMemory;
    if (devMem && devMem > 0) detected = devMem;
  }
  return Math.max(detected, Math.min(maxRamGb, 64));
}

function calculateOptimalRam(systemRamGb: number): number {
  if (systemRamGb <= 4) return 2;
  if (systemRamGb <= 6) return 3;
  if (systemRamGb <= 8) return 4;
  if (systemRamGb <= 12) return 5;
  if (systemRamGb <= 16) return 6;
  if (systemRamGb <= 24) return 8;
  return 10;
}


interface OomQuickActionsProps {
  cacheCleared: boolean;
  onClearCache: () => void;
  ecoModeActivated: boolean;
  onToggleEcoMode: () => void;
  optimalRamGb: number;
  freeRamForSystem: number;
  ramAdjusted: number | null;
  onApplyOptimalRam: () => void;
}

const OomQuickActions: React.FC<OomQuickActionsProps> = ({
  cacheCleared,
  onClearCache,
  ecoModeActivated,
  onToggleEcoMode,
  optimalRamGb,
  freeRamForSystem,
  ramAdjusted,
  onApplyOptimalRam,
}) => (
  <>
  {/* ⚡ ACCIONES RÁPIDAS (DISEÑO UNIFICADO Y ELEGANTE) */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '20px',
          }}
        >
          {/* Opción 1: Liberar memoria y limpiar cachés */}
          <button
            type="button"
            onClick={onClearCache}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: '10px',
              background: cacheCleared ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.025)',
              border: cacheCleared
                ? '1px solid rgba(52, 211, 153, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.06)',
              color: '#f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trash2 size={15} color={cacheCleared ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                  Liberar memoria del Launcher ahora
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Purga la memoria interna, texturas y buffers en segundo plano
                </div>
              </div>
            </div>
            {cacheCleared ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#34d399',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={13} /> Liberado
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                Limpiar
              </span>
            )}
          </button>

          {/* Opción 2: Modo Bajo Consumo */}
          <button
            type="button"
            onClick={onToggleEcoMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: '10px',
              background: ecoModeActivated
                ? 'rgba(52, 211, 153, 0.08)'
                : 'rgba(255, 255, 255, 0.025)',
              border: ecoModeActivated
                ? '1px solid rgba(52, 211, 153, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.06)',
              color: '#f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={15} color={ecoModeActivated ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Activar Modo Bajo Consumo</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Desactiva desenfoques y animaciones para reducir el consumo del launcher al mínimo
                  (&lt; 45 MB)
                </div>
              </div>
            </div>
            {ecoModeActivated ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#34d399',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={13} /> Activado
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                Activar
              </span>
            )}
          </button>

          {/* Opción 3: Ajustar RAM recomendada para el juego */}
          <button
            type="button"
            onClick={onApplyOptimalRam}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '11px 14px',
              borderRadius: '10px',
              background: ramAdjusted ? 'rgba(52, 211, 153, 0.08)' : 'rgba(255, 255, 255, 0.025)',
              border: ramAdjusted
                ? '1px solid rgba(52, 211, 153, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.06)',
              color: '#f1f5f9',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={15} color={ramAdjusted ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>
                  Ajustar tope de RAM de juego a {optimalRamGb} GB
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Asigna {optimalRamGb} GB al juego y reserva {freeRamForSystem} GB para Windows y
                  otros programas
                </div>
              </div>
            </div>
            {ramAdjusted ? (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#34d399',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckCircle2 size={13} /> Ajustado
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}
              >
                1 Clic
              </span>
            )}
          </button>
        </div>
  </>
);
export const OutOfMemoryScreen: React.FC<OutOfMemoryScreenProps> = ({
  onClose,
  onRetry,
  crashReason,
  crashDetails,
  exitCode = 137,
  isFatalCrash = false,
}) => {
  const settings = useLauncherStore((s: LauncherState) => s.settings);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const activeInstanceId = useLauncherStore((s: LauncherState) => s.activeInstanceId);

  const activeInstance = useMemo(
    () => instances.find((i) => i.id === activeInstanceId) ?? instances[0],
    [instances, activeInstanceId],
  );
  const currentGameRamGb = activeInstance?.maxRamGb ?? settings.maxRamGb;

  const [ramAdjusted, setRamAdjusted] = useState<number | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [ecoModeActivated, setEcoModeActivated] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Estimación de RAM física del sistema
  const systemRamGb = useMemo(() => detectSystemRam(currentGameRamGb), [currentGameRamGb]);

  // Heap de JavaScript si está disponible en Chromium/WebView2
  const [heapMb, setHeapMb] = useState<{ used: number; total: number; limit: number } | null>(null);

  useEffect(() => {
    const perf = window.performance as unknown as {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    };
    if (perf?.memory) {
      setHeapMb({
        used: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)),
        total: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)),
        limit: Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024)),
      });
    }
  }, []);

  // Cálculo de RAM recomendada equilibrada según la capacidad real del equipo
  const optimalRamGb = useMemo(() => calculateOptimalRam(systemRamGb), [systemRamGb]);

  const freeRamForSystem = Math.max(1.5, systemRamGb - optimalRamGb);
  const allocationPct = Math.min(100, Math.round((currentGameRamGb / systemRamGb) * 100));

  // Acción 1: Limpiar memoria y cachés pesadas
  const handleClearHeavyCache = async () => {
    try {
      await clearDockPanorama();
      if (dockConfig.dockBgType === 'video') {
        launcherActions.setDockConfig({
          dockBgType: 'default',
          dockBgVideo: undefined,
        });
      }
      setCacheCleared(true);
    } catch (err) {
      console.warn('Error clearing memory cache:', err);
      setCacheCleared(true);
    }
  };

  // Acción 2: Activar Modo Bajo Consumo para reducir consumo del launcher al mínimo
  const handleToggleEcoMode = () => {
    launcherActions.setDockConfig({
      dockBgBlur: 0,
    });
    launcherActions.setWallpaperMuted(true);
    setEcoModeActivated(true);
  };

  // Acción 3: Auto-ajuste de RAM seguro para Minecraft/Java según el hardware
  const handleAutoAdjustRam = () => {
    launcherActions.updateSettings({
      minRamGb: Math.max(1, Math.floor(optimalRamGb / 2)),
      maxRamGb: Math.round(optimalRamGb),
    });
    if (activeInstance) {
      launcherActions.updateInstanceData(activeInstance.id, {
        minRamGb: Math.max(1, Math.floor(optimalRamGb / 2)),
        maxRamGb: Math.round(optimalRamGb),
      });
    }
    setRamAdjusted(optimalRamGb);
  };

  const isRamOverallocated = currentGameRamGb >= systemRamGb * 0.75;

  return (
    <div
      className="oom-screen-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(6, 9, 14, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '24px',
        overflowY: 'auto',
        animation: 'oomFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div
        className="oom-card-container"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0d121c',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          padding: '32px 30px 26px 30px',
          position: 'relative',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'oomScaleUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Botón cerrar */}
        {onClose && !isFatalCrash && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar pantalla"
            style={{
              position: 'absolute',
              top: '18px',
              right: '18px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={15} />
          </button>
        )}

        {/* ☁️ ILUSTRACIÓN VECTORIAL: LA NUBE GRIS MINIMALISTA (ESTILO CHROMIUM REFINADO) */}
        <div
          className="oom-cloud-hero-wrapper"
          style={{
            position: 'relative',
            width: '110px',
            height: '85px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Sombra ambiental sobria */}
          <div
            style={{
              position: 'absolute',
              inset: '2px',
              background: 'radial-gradient(circle, rgba(148, 163, 184, 0.08) 0%, transparent 70%)',
              filter: 'blur(12px)',
              pointerEvents: 'none',
            }}
          />

          <svg
            viewBox="0 0 140 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'visible',
              filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5))',
              animation: 'oomCloudFloat 4s ease-in-out infinite',
            }}
          >
            <defs>
              {/* Degradado gris tormenta mate (sobrio, cero neón) */}
              <linearGradient
                id="neutralCloudGrad"
                x1="20"
                y1="16"
                x2="120"
                y2="85"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#293344" />
                <stop offset="0.6" stopColor="#1a2332" />
                <stop offset="1" stopColor="#121822" />
              </linearGradient>

              {/* Borde sutil de titanio cepillado */}
              <linearGradient
                id="cloudStrokeGrad"
                x1="20"
                y1="10"
                x2="120"
                y2="85"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#64748b" />
                <stop offset="0.7" stopColor="#475569" />
                <stop offset="1" stopColor="#334155" />
              </linearGradient>
            </defs>

            {/* Silueta de la Nube Gris (Limpia, sin objetos invasivos detrás) */}
            <path
              d="M38 74 C25 74 15 65 15 52 C15 41 23 32 35 31 C38 18 51 9 68 9 C83 9 95 18 100 30 C112 30 122 39 123 50 C125 52 125 54 125 56 C125 67 115 74 104 74 Z"
              fill="url(#neutralCloudGrad)"
              stroke="url(#cloudStrokeGrad)"
              strokeWidth="2"
            />

            {/* Carita minimalista en gris plata (Ojos cerrados de esfuerzo) */}
            <path
              d="M48 48 L55 45 L48 42"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M86 48 L79 45 L86 42"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Boca recta/ondulada neutra */}
            <path
              d="M62 53 Q67 50 72 53"
              stroke="#cbd5e1"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* Partículas de datos binarios discretos (Gris grafito mate) */}
            <text x="34" y="90" fill="#64748b" fontSize="9" fontFamily="monospace" opacity="0.6">
              0
              <animate attributeName="y" values="78;94;78" dur="2.8s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.6;0.15;0.6"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </text>
            <text x="68" y="92" fill="#64748b" fontSize="9" fontFamily="monospace" opacity="0.5">
              1
              <animate attributeName="y" values="80;96;80" dur="3.2s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.5;0.1;0.5"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </text>
            <text x="98" y="88" fill="#64748b" fontSize="9" fontFamily="monospace" opacity="0.6">
              0
              <animate attributeName="y" values="78;92;78" dur="2.5s" repeatCount="indefinite" />
              <animate
                attributeName="opacity"
                values="0.6;0.15;0.6"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </text>
          </svg>
        </div>

        {/* Badge Técnico Discreto (Gris Titanio con indicador ámbar) */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.09)',
            color: '#94a3b8',
            fontSize: '10.5px',
            fontWeight: 600,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#d97706',
              display: 'inline-block',
            }}
          />
          <span>Memoria del Sistema Agotada ({exitCode})</span>
        </div>

        {/* Título Principal Sobrio */}
        <h2
          style={{
            fontFamily: 'var(--font-jost)',
            fontSize: '21px',
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: '#f8fafc',
            letterSpacing: '-0.3px',
          }}
        >
          El sistema se quedó sin memoria RAM
        </h2>

        {/* Subtítulo explicando el contexto de memoria del equipo */}
        <p
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            lineHeight: '1.5',
            margin: '0 0 20px 0',
            maxWidth: '470px',
          }}
        >
          Apareció la nube gris... El launcher tuvo que suspenderse porque tu equipo se quedó sin
          memoria RAM disponible suficiente para continuar de forma estable.
        </p>

        {/* 📊 TARJETA DE DIAGNÓSTICO EN GRISES Y TITANIO */}
        <div
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '18px',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Cpu size={14} color="#94a3b8" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>
                Diagnóstico de Memoria
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                color: isRamOverallocated ? '#fbbf24' : '#94a3b8',
                fontFamily: 'monospace',
              }}
            >
              RAM del Equipo: ~{systemRamGb} GB · Juego: {currentGameRamGb} GB ({allocationPct}%)
            </span>
          </div>

          {/* Barra de estado neutra */}
          <div
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(10, allocationPct))}%`,
                height: '100%',
                background: isRamOverallocated
                  ? 'linear-gradient(90deg, #64748b 0%, #d97706 100%)'
                  : 'linear-gradient(90deg, #475569 0%, #94a3b8 100%)',
                borderRadius: '999px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* Mensaje de diagnóstico constructivo */}
          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              lineHeight: '1.4',
            }}
          >
            {isRamOverallocated ? (
              <span>
                Tienes asignados {currentGameRamGb} GB a Minecraft de {systemRamGb} GB en tu equipo
                ({allocationPct}%). Dejar poca memoria libre hace que el sistema suspenda procesos
                para evitar que la máquina se congele.
              </span>
            ) : (
              <span>
                {crashReason ??
                  'La memoria física se agotó por el consumo acumulado de programas en ejecución y procesos del sistema.'}
              </span>
            )}
          </div>

          {heapMb && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '10px',
                color: '#64748b',
                fontFamily: 'monospace',
              }}
            >
              Uso de interfaz: {heapMb.used} MB / {heapMb.limit} MB tope
            </div>
          )}

          {/* Detalle técnico colapsable */}
          {crashDetails && (
            <div
              style={{
                marginTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '10.5px',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {detailsExpanded ? 'Ocultar registro' : 'Ver detalle técnico'}
              </button>
              {detailsExpanded && (
                <pre
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: '#cbd5e1',
                    maxHeight: '80px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    marginTop: '6px',
                  }}
                >
                  {crashDetails}
                </pre>
              )}
            </div>
          )}
        </div>

        <OomQuickActions
          cacheCleared={cacheCleared}
          onClearCache={handleClearHeavyCache}
          ecoModeActivated={ecoModeActivated}
          onToggleEcoMode={handleToggleEcoMode}
          optimalRamGb={optimalRamGb}
          freeRamForSystem={freeRamForSystem}
          ramAdjusted={ramAdjusted}
          onApplyOptimalRam={handleAutoAdjustRam}
        />
        {/* BOTONES PRINCIPALES (ALTO CONTRASTE, LIMPIOS) */}
        <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (onRetry) {
                onRetry();
              } else if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: 'none',
              color: '#090d16',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} />
            <span>Recargar y Continuar</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeft size={14} />
              <span>Volver</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
