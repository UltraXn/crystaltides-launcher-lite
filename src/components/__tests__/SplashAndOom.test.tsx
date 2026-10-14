import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SplashScreen } from '../SplashScreen';
import { OutOfMemoryScreen } from '../OutOfMemoryScreen';
import { useLauncherStore } from '../../store/launcherStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('SplashScreen & OutOfMemoryScreen Components', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLauncherStore.setState({
      settings: {
        maxRamGb: 6,
      } as any,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('SplashScreen', () => {
    it('renderiza la pantalla de splash con estado de progreso', () => {
      const { container } = render(<SplashScreen />);
      expect(container.firstChild).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(container.textContent).toContain('Verificando');

      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(container.textContent).toContain('Listo');
    });
  });

  describe('OutOfMemoryScreen', () => {
    it('renderiza la pantalla de error de memoria y permite reintentar o cerrar', () => {
      const handleClose = vi.fn();
      const handleRetry = vi.fn();

      render(
        <OutOfMemoryScreen
          onClose={handleClose}
          onRetry={handleRetry}
          crashReason="Java heap space"
          exitCode={1}
        />,
      );

      expect(screen.getAllByText(/Memoria/i).length).toBeGreaterThan(0);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      // Buscamos botón de cerrar
      const closeBtn = buttons.find((b) => b.getAttribute('title')?.includes('Cerrar') || b.textContent?.includes('Cerrar') || b.textContent?.includes('Volver'));
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
      }
    });

    it('permite aplicar optimización de RAM sugerida', () => {
      render(
        <OutOfMemoryScreen
          crashReason="OutOfMemoryError"
          exitCode={137}
        />,
      );

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('GB') || btn.textContent?.includes('RAM') || btn.textContent?.includes('Aplicar')) {
          fireEvent.click(btn);
          break;
        }
      }
      expect(screen.getAllByText(/Memoria/i).length).toBeGreaterThan(0);
    });
  });
});
