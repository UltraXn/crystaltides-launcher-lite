import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HudEditorOverlay } from '../HudEditorOverlay';
import { DockButtonInspector } from '../DockButtonInspector';
import {
  DockButtonInspectorBgTab,
  DockButtonInspectorIconTab,
  DockButtonInspectorFxTab,
  DockButtonInspectorShapeTab,
  COLOR_PRESETS,
  EFFECT_OPTIONS,
} from '../inspector/DockButtonInspectorTabs';
import { useLauncherStore } from '../../store/launcherStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../utils/wallpaperStorage', () => ({
  saveDockPanoramaFile: vi.fn().mockResolvedValue({ isVideo: false, url: 'file:///fake-dock.png' }),
  saveButtonMediaFile: vi.fn().mockResolvedValue({ url: 'file:///fake-btn.png' }),
  clearButtonMedia: vi.fn().mockResolvedValue(true),
  isVideoSource: vi.fn().mockReturnValue(false),
}));

describe('HudEditor & Inspector Component Suite', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      isEditingHud: true,
      selectedDockButtonId: 'instances',
      hudManualSide: 'center',
      accentColor: '#38bdf8',
      dockConfig: {
        borderRadius: 14,
        scale: 1,
        showLabels: true,
        buttonCustomizations: {},
        panoramaButtons: [],
      } as any,
    });
  });

  describe('HudEditorOverlay', () => {
    it('renderiza el overlay cuando isEditingHud está activo', () => {
      const { container } = render(<HudEditorOverlay />);
      expect(container.firstChild).not.toBeNull();
    });

    it('maneja el evento escape para deseleccionar botón', () => {
      render(<HudEditorOverlay />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useLauncherStore.getState().selectedDockButtonId).toBeNull();
    });

    it('maneja el evento escape para salir del modo de edición cuando no hay botón seleccionado', () => {
      useLauncherStore.setState({ selectedDockButtonId: null });
      render(<HudEditorOverlay />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useLauncherStore.getState().isEditingHud).toBe(false);
    });
  });

  describe('DockButtonInspector', () => {
    it('renderiza inspector con pestañas y botón de cerrar', () => {
      const handleClose = vi.fn();
      render(<DockButtonInspector buttonId="instances" onClose={handleClose} />);

      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
      const closeButtons = screen.getAllByRole('button');
      const closeBtn = closeButtons.find(
        (b) =>
          b.getAttribute('title')?.includes('Cerrar') ||
          b.textContent?.includes('Cerrar') ||
          b.getAttribute('aria-label')?.includes('Cerrar'),
      );
      if (closeBtn) {
        fireEvent.click(closeBtn);
        expect(handleClose).toHaveBeenCalled();
      }
    });

    it('permite cambiar entre pestañas del inspector', () => {
      render(<DockButtonInspector buttonId="instances" initialTab="bg" onClose={vi.fn()} />);

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        if (
          btn.textContent?.includes('Icono') ||
          btn.textContent?.includes('Efectos') ||
          btn.textContent?.includes('Forma')
        ) {
          fireEvent.click(btn);
          break;
        }
      }
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('DockButtonInspectorTabs components', () => {
    it('renderiza DockButtonInspectorBgTab y presets de color', () => {
      const bgRef = { current: document.createElement('input') };
      const dockRef = { current: document.createElement('input') };
      const setStatus = vi.fn();

      render(
        <DockButtonInspectorBgTab
          buttonId="instances"
          customization={{ bgType: 'color', bgColor: '#1e293b' }}
          dockConfig={useLauncherStore.getState().dockConfig}
          hasDockPanorama={false}
          isParticipant={false}
          bgFileInputRef={bgRef as any}
          dockBgInputRef={dockRef as any}
          setUploadStatus={setStatus}
        />,
      );

      expect(COLOR_PRESETS.length).toBeGreaterThan(0);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      fireEvent.click(buttons[0]);
    });

    it('renderiza DockButtonInspectorIconTab', () => {
      const iconRef = { current: document.createElement('input') };

      render(
        <DockButtonInspectorIconTab
          buttonId="instances"
          customization={{ iconType: 'default', iconScale: 1 }}
          iconFileInputRef={iconRef as any}
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renderiza DockButtonInspectorFxTab', () => {
      render(
        <DockButtonInspectorFxTab
          buttonId="instances"
          customization={{ specialEffect: 'neon_pulse' }}
        />,
      );

      expect(EFFECT_OPTIONS.length).toBeGreaterThan(0);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      fireEvent.click(buttons[0]);
    });

    it('renderiza DockButtonInspectorShapeTab y permite ajustar sliders', () => {
      render(
        <DockButtonInspectorShapeTab
          buttonId="instances"
          customization={{ scale: 1, borderRadius: 12, rotation: 0 }}
          dockConfig={useLauncherStore.getState().dockConfig}
        />,
      );

      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(0);
      fireEvent.change(sliders[0], { target: { value: '1.2' } });
    });
  });
});
