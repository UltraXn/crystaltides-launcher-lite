import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { LogViewerModal, getLineSeverity, MAX_LOG_LINES, MAX_RENDERED_LINES } from '../LogViewerModal';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_launcher_logs') {
      return Promise.resolve('[2026-10-15 12:00:00] [INFO] Starting launcher\n[2026-10-15 12:00:01] [WARN] Low disk space\n[2026-10-15 12:00:02] [ERROR] Connection failed');
    }
    if (cmd === 'get_minecraft_logs') {
      return Promise.resolve('No hay registros de juego disponibles aún en minecraft.log.');
    }
    return Promise.resolve('');
  }),
}));

const mockListeners: Record<string, (event: any) => void> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((eventName: string, handler: (event: any) => void) => {
    mockListeners[eventName] = handler;
    return Promise.resolve(() => {
      delete mockListeners[eventName];
    });
  }),
}));

describe('LogViewerModal Component & Performance Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getLineSeverity helper', () => {
    it('detecta severidades error, warn e info correctamente', () => {
      expect(getLineSeverity('FATAL: Out of memory')).toBe('error');
      expect(getLineSeverity('Crash report saved')).toBe('error');
      expect(getLineSeverity('WARN: deprecated setting')).toBe('warn');
      expect(getLineSeverity('INFO: Game loaded in 2.3s')).toBe('info');
      expect(getLineSeverity('Random text output')).toBe('other');
    });
  });

  describe('LogViewerModal rendering', () => {
    it('renderiza logs y cuenta severidades precalculadas', async () => {
      const handleClose = vi.fn();
      render(<LogViewerModal isOpen={true} onClose={handleClose} defaultTab="launcher" />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('Registros y Diagnóstico')).toBeDefined();
      expect(screen.getByText(/Launcher \(launcher\.log\)/)).toBeDefined();
      expect(screen.getByText(/Minecraft \(minecraft\.log\)/)).toBeDefined();
    });

    it('acumula eventos game-log en búfer y los vuelca tras 100ms', async () => {
      render(<LogViewerModal isOpen={true} onClose={vi.fn()} defaultTab="minecraft" />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockListeners['game-log']).toBeDefined();

      // Emitir eventos game-log
      act(() => {
        mockListeners['game-log']({ payload: { line: '[12:01:00] [INFO] Loading world', level: 'INFO' } });
        mockListeners['game-log']({ payload: { line: '[12:01:01] [ERROR] Failed to load block entity', level: 'ERROR' } });
      });

      // Antes del flush de 100ms no deberían haberse renderizado
      expect(screen.queryByText(/Failed to load block entity/)).toBeNull();

      // Avanzar timers 100ms para disparar el batch flush
      act(() => {
        vi.advanceTimersByTime(110);
      });

      expect(screen.getByText(/Failed to load block entity/)).toBeDefined();
    });

    it('soporta eventos game-log-batch con múltiples líneas', async () => {
      render(<LogViewerModal isOpen={true} onClose={vi.fn()} defaultTab="minecraft" />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockListeners['game-log-batch']).toBeDefined();

      act(() => {
        mockListeners['game-log-batch']({
          payload: {
            lines: [
              { line: '[12:02:00] [INFO] Batch line 1', level: 'INFO' },
              { line: '[12:02:01] [WARN] Batch line 2 warning', level: 'WARN' },
              { line: '[12:02:02] [ERROR] Batch line 3 error', level: 'ERROR' },
            ],
          },
        });
      });

      act(() => {
        vi.advanceTimersByTime(110);
      });

      expect(screen.getByText(/Batch line 1/)).toBeDefined();
      expect(screen.getByText(/Batch line 2 warning/)).toBeDefined();
      expect(screen.getByText(/Batch line 3 error/)).toBeDefined();
    });

    it('respeta las constantes de tope MAX_LOG_LINES y MAX_RENDERED_LINES', () => {
      expect(MAX_LOG_LINES).toBe(5000);
      expect(MAX_RENDERED_LINES).toBe(1000);
    });
  });
});
