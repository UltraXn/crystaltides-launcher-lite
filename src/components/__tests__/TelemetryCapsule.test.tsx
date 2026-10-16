import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TelemetryCapsule } from '../TelemetryCapsule';
import type { LiveBenchmarkMetrics } from '../../services/agentIpcService';

const fetchLiveBenchmarkMetrics = vi.fn();

vi.mock('../../services/agentIpcService', () => ({
  fetchLiveBenchmarkMetrics: () => fetchLiveBenchmarkMetrics(),
  subscribeGameIpcEvents: () => Promise.resolve(() => {}),
}));

const linked = (overrides: Partial<LiveBenchmarkMetrics>): LiveBenchmarkMetrics => ({
  average_fps: null,
  frametime_p99_ms: null,
  gc_pause_time_ms: 0,
  swapchain_backend: 'OpenGL/LWJGL',
  integrity_status: 'ONLINE_LINKED',
  memory_used_mb: null,
  memory_total_mb: null,
  ...overrides,
});

describe('TelemetryCapsule', () => {
  beforeEach(() => {
    fetchLiveBenchmarkMetrics.mockReset();
  });

  it('muestra "—" en vez de valores inventados cuando no hay FPS ni RAM (instancia sin crystaltides-boost)', async () => {
    fetchLiveBenchmarkMetrics.mockResolvedValue(linked({ gc_pause_time_ms: 3 }));
    render(<TelemetryCapsule />);

    expect(await screen.findByText('— FPS')).toBeTruthy();
    expect(screen.getByText('RAM: —GB')).toBeTruthy();
    expect(screen.queryByText(/144/)).toBeNull();
    expect(screen.queryByText(/3\.8/)).toBeNull();
  });

  it('muestra 0 FPS como dato real (ventana minimizada)', async () => {
    fetchLiveBenchmarkMetrics.mockResolvedValue(linked({ average_fps: 0, memory_used_mb: 0 }));
    render(<TelemetryCapsule />);

    expect(await screen.findByText('0 FPS')).toBeTruthy();
    expect(screen.getByText('RAM: 0.0GB')).toBeTruthy();
  });

  it('muestra las métricas reportadas por el agente', async () => {
    fetchLiveBenchmarkMetrics.mockResolvedValue(
      linked({ average_fps: 114.8, gc_pause_time_ms: 12.4, memory_used_mb: 3072 }),
    );
    render(<TelemetryCapsule />);

    expect(await screen.findByText('115 FPS')).toBeTruthy();
    expect(screen.getByText('GC: 12ms')).toBeTruthy();
    expect(screen.getByText('RAM: 3.0GB')).toBeTruthy();
  });
});
