import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { GuiHintToast } from '../GuiHintToast';
import { useLauncherStore } from '../../store/launcherStore';

describe('GuiHintToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLauncherStore.setState({
      currentView: 'home',
      isEditingHud: false,
      dockConfig: {
        layoutMode: 'dock',
        position: 'bottom',
        activeButtons: ['play', 'settings'],
        buttonScale: 1,
        enableCollisionPush: true,
      } as any,
      hudManualSide: 'center',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('no renderiza nada si currentView no es home', () => {
    useLauncherStore.setState({ currentView: 'login' });
    const { container } = render(<GuiHintToast />);
    expect(container.firstChild).toBeNull();
  });

  it('suprime la notificación toast durante la edición activa de la GUI para no obstruir controles', async () => {
    const { container } = render(<GuiHintToast />);

    // Activamos modo edición en store
    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Mientras se edita, no debe haber pill flotante redundante obstruyendo
    expect(container.querySelector('output')).toBeNull();
  });

  it('renderiza notificación de guardado al salir del modo de edición', () => {
    const { container } = render(<GuiHintToast />);

    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });
    act(() => {
      useLauncherStore.setState({ isEditingHud: false });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const output = container.querySelector('output');
    expect(output).not.toBeNull();
    expect(output?.getAttribute('aria-live')).toBe('polite');
    expect(container.textContent).toContain('Disposición Guardada');
  });

  it('permite cerrar la notificación manualmente pulsando el botón cerrar', () => {
    const { container } = render(<GuiHintToast />);

    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });
    act(() => {
      useLauncherStore.setState({ isEditingHud: false });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const closeBtn = container.querySelector('.capsule-close-btn');
    expect(closeBtn).not.toBeNull();
    if (closeBtn) {
      fireEvent.click(closeBtn);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(container.querySelector('output')).toBeNull();
    }
  });

  it('pausa y reanuda el timer al pasar el mouse por encima', () => {
    const { container } = render(<GuiHintToast />);

    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });
    act(() => {
      useLauncherStore.setState({ isEditingHud: false });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const output = container.querySelector('output');
    expect(output).not.toBeNull();
    if (output) {
      fireEvent.mouseEnter(output);
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      // Sigue presente porque el mouse está encima
      expect(container.querySelector('output')).not.toBeNull();

      fireEvent.mouseLeave(output);
      act(() => {
        // El tiempo restante se reanuda y desaparece tras completar el ciclo
        vi.advanceTimersByTime(3600);
      });
      expect(container.querySelector('output')).toBeNull();
    }
  });

  it('desaparece automáticamente tras el tiempo de auto-desaparición investigado (3200ms + animación)', () => {
    const { container } = render(<GuiHintToast />);

    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });
    act(() => {
      useLauncherStore.setState({ isEditingHud: false });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // En 2500ms aún debe estar visible
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(container.querySelector('output')).not.toBeNull();
    expect(container.querySelector('.capsule-timer-bar')).not.toBeNull();

    // Tras completar los 3200ms + 240ms de fade-out, debe removerse del DOM
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelector('output')).toBeNull();
  });
});
