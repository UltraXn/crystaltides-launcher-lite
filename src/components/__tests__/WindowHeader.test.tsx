import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { mockWindows, mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { WindowHeader } from '../WindowHeader';
import { useLauncherStore } from '../../store/launcherStore';

describe('WindowHeader Component', () => {
  let isMax = false;
  let minimizeCalled = false;
  let toggleMaximizeCalled = false;
  let closeCalled = false;

  beforeEach(() => {
    isMax = false;
    minimizeCalled = false;
    toggleMaximizeCalled = false;
    closeCalled = false;

    (window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener: vi.fn(),
    };
    mockWindows('main');
    mockIPC(
      (cmd) => {
        if (cmd === 'plugin:window|is_maximized') {
          return isMax;
        }
        if (cmd === 'plugin:window|toggle_maximize') {
          toggleMaximizeCalled = true;
          isMax = !isMax;
          return undefined;
        }
        if (cmd === 'plugin:window|minimize') {
          minimizeCalled = true;
          return undefined;
        }
        if (cmd === 'plugin:window|close') {
          closeCalled = true;
          return undefined;
        }
        return undefined;
      },
      { shouldMockEvents: true },
    );

    useLauncherStore.setState({
      currentView: 'home',
      isEditingHud: false,
      launch: { status: 'IDLE' } as any,
      settings: {
        telemetryCapsuleEnabled: false,
      } as any,
    });
  });

  afterEach(() => {
    clearMocks();
  });

  it('renderiza la marca del launcher y el badge Lite', () => {
    render(<WindowHeader />);
    expect(screen.getByText('CrystalTides')).toBeInTheDocument();
    expect(screen.getByText('Launcher')).toBeInTheDocument();
    expect(screen.getByText('LITE')).toBeInTheDocument();
  });

  it('permite minimizar la ventana', async () => {
    render(<WindowHeader />);
    const minBtn = screen.getByTitle('Minimizar');
    await act(async () => {
      fireEvent.click(minBtn);
    });
    expect(minimizeCalled).toBe(true);
  });

  it('permite maximizar y alternar el estado de la ventana', async () => {
    render(<WindowHeader />);
    const maxBtn = screen.getByTitle('Maximizar');

    await act(async () => {
      fireEvent.click(maxBtn);
    });

    expect(toggleMaximizeCalled).toBe(true);
    await waitFor(() => {
      expect(screen.getByTitle('Restaurar')).toBeInTheDocument();
    });
  });

  it('permite cerrar la ventana', async () => {
    render(<WindowHeader />);
    const closeBtn = screen.getByTitle('Cerrar');
    await act(async () => {
      fireEvent.click(closeBtn);
    });
    expect(closeCalled).toBe(true);
  });
});
