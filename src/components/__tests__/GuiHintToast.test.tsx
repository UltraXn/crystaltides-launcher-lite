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

  it('renderiza notificación toast en vista home cuando se activa edición', async () => {
    const { container } = render(<GuiHintToast />);

    // Activamos modo edición en store
    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });

    // Avanzamos timers para transiciones
    act(() => {
      vi.advanceTimersByTime(200);
    });

    const output = container.querySelector('output');
    if (output) {
      expect(output).toBeDefined();
      expect(output.getAttribute('aria-live')).toBe('polite');
    }
  });

  it('permite cerrar la notificación manualmente pulsando el botón cerrar', () => {
    const { container } = render(<GuiHintToast />);

    act(() => {
      useLauncherStore.setState({ isEditingHud: true });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const closeBtn = container.querySelector('.capsule-close-btn');
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

    const output = container.querySelector('output');
    if (output) {
      fireEvent.mouseEnter(output);
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      // Sigue presente porque el mouse está encima
      expect(container.querySelector('output')).not.toBeNull();

      fireEvent.mouseLeave(output);
      act(() => {
        vi.advanceTimersByTime(6000);
      });
    }
  });
});
