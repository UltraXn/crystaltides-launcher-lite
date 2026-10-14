import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DockBackgroundAdjuster } from '../DockBackgroundAdjuster';
import { HudEditorHorizontalPanel } from '../HudEditorHorizontalPanel';
import { HudEditorVerticalPanel } from '../HudEditorVerticalPanel';
import { useLauncherStore } from '../../../store/launcherStore';

describe('HUD Panels Suite', () => {
  const mockT = {
    hudEditor: {
      title: 'Editor HUD',
      togglePosTitle: 'Cambiar orientación',
      center: 'Centro',
      bottom: 'Abajo',
      top: 'Arriba',
      reset: 'Restablecer',
      done: 'Guardar y Salir',
      scaleLabel: 'Escala',
      radiusLabel: 'Radio',
      gapLabel: 'Separación',
      labelsToggle: 'Etiquetas',
    },
  };

  const dummyDockConfig = {
    layoutMode: 'dock',
    position: 'bottom',
    positionPreset: 'bottom',
    scale: 1,
    borderRadius: 14,
    gap: 8,
    showLabels: true,
    dockBgPosX: 50,
    dockBgPosY: 50,
    dockBgScale: 100,
    dockBgOpacity: 1,
  } as any;

  describe('DockBackgroundAdjuster', () => {
    it('renderiza controles de ajuste y sliders de fondo', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...dummyDockConfig,
          dockBgPosX: 60,
          dockBgPosY: 40,
        },
      });

      const { container } = render(<DockBackgroundAdjuster />);
      expect(container.firstChild).not.toBeNull();

      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBeGreaterThan(0);
      fireEvent.change(sliders[0], { target: { value: '70' } });

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
      }
    });
  });

  describe('HudEditorHorizontalPanel', () => {
    it('renderiza panel horizontal y botones de acción', () => {
      const cycleSide = vi.fn();
      render(
        <HudEditorHorizontalPanel
          t={mockT}
          dockConfig={dummyDockConfig}
          hudManualSide="auto"
          accentColor="#38bdf8"
          cycleSide={cycleSide}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      for (const btn of buttons) {
        fireEvent.click(btn);
      }
    });
  });

  describe('HudEditorVerticalPanel', () => {
    it('renderiza panel vertical y permite manipular sliders y botones', () => {
      const cycleSide = vi.fn();
      render(
        <HudEditorVerticalPanel
          t={mockT}
          dockConfig={dummyDockConfig}
          hudManualSide="left"
          accentColor="#38bdf8"
          cycleSide={cycleSide}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      for (const btn of buttons.slice(0, 5)) {
        fireEvent.click(btn);
      }

      const sliders = screen.queryAllByRole('slider');
      if (sliders.length > 0) {
        fireEvent.change(sliders[0], { target: { value: '1.2' } });
      }
    });
  });
});
