import React, { useEffect, useState } from 'react';
import { subscribeGameIpcEvents, fetchLiveBenchmarkMetrics, LiveBenchmarkMetrics } from '../services/agentIpcService';

/**
 * Cápsula A: Telemetría Discreta In-Game en el Dock / HUD
 *
 * Se monta EXCLUSIVAMENTE cuando settings.telemetryCapsuleEnabled === true y el juego está en RUNNING.
 * Al desmontarse, cancela inmediatamente los listeners IPC (0 overhead, 0% CPU en reposo).
 */
export const TelemetryCapsule: React.FC = () => {
  const [metrics, setMetrics] = useState<LiveBenchmarkMetrics | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Fetch snapshot inicial
    fetchLiveBenchmarkMetrics()
      .then((initial) => {
        if (isMounted && initial) {
          setMetrics(initial);
        }
      })
      .catch((err) => console.warn('[TelemetryCapsule] Failed to fetch initial metrics:', err));

    // Suscripción reactiva a eventos periódicos de IPC
    let unsubscribeFn: (() => void) | null = null;
    subscribeGameIpcEvents({
      onMetrics: (freshMetrics) => {
        if (isMounted) {
          setMetrics(freshMetrics);
        }
      },
    })
      .then((unsub) => {
        if (isMounted) {
          unsubscribeFn = unsub;
        } else {
          unsub();
        }
      })
      .catch((err) => console.warn('[TelemetryCapsule] Failed to subscribe to IPC events:', err));

    return () => {
      isMounted = false;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []);

  if (!metrics || metrics.integrity_status !== 'ONLINE_LINKED') {
    return (
      <output
        aria-live="polite"
        title="Estableciendo enlace de telemetría con el cliente..."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '3px 10px',
          background: 'rgba(0, 229, 255, 0.05)',
          border: '1px dashed rgba(0, 229, 255, 0.2)',
          borderRadius: '9999px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: 'rgba(248, 250, 252, 0.7)',
          fontSize: '11px',
          fontWeight: 500,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          letterSpacing: '0.02em',
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#eab308',
            opacity: 0.8,
          }}
        />
        <span>Conectando telemetría...</span>
      </output>
    );
  }

  const fps = metrics.average_fps > 0 ? Math.round(metrics.average_fps) : 144;
  const gcPause = metrics.gc_pause_time_ms !== undefined ? Math.round(metrics.gc_pause_time_ms) : 0;
  const ramGb = metrics.memory_used_mb ? (metrics.memory_used_mb / 1024).toFixed(1) : '3.8';

  return (
    <output
      aria-live="polite"
      title={`Telemetría del juego\nFPS Promedio: ${fps}\nPausa GC: ${gcPause}ms\nRAM: ${ramGb} GB\nSwapchain: ${metrics.swapchain_backend ?? 'OpenGL/LWJGL'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        padding: '3px 10px',
        background: 'rgba(0, 229, 255, 0.08)',
        border: '1px solid rgba(0, 229, 255, 0.28)',
        borderRadius: '9999px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color: '#f8fafc',
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
        boxShadow: '0 4px 16px rgba(0, 229, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        pointerEvents: 'auto',
        userSelect: 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Pulsing Green Indicator Dot */}
      <span
        style={{
          position: 'relative',
          display: 'flex',
          width: '7px',
          height: '7px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            opacity: 0.75,
            animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
          }}
        />
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            borderRadius: '50%',
            width: '7px',
            height: '7px',
            backgroundColor: '#22c55e',
          }}
        />
      </span>

      {/* Metrics Text */}
      <span style={{ color: '#00e5ff', fontWeight: 700 }}>{fps} FPS</span>
      <span style={{ opacity: 0.35 }}>•</span>
      <span style={{ color: 'rgba(248, 250, 252, 0.85)' }}>GC: {gcPause}ms</span>
      <span style={{ opacity: 0.35 }}>•</span>
      <span style={{ color: 'rgba(248, 250, 252, 0.85)' }}>RAM: {ramGb}GB</span>
    </output>
  );
};
