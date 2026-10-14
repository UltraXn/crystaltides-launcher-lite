import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import {
  DockButtonInspectorBgTab,
  DockButtonInspectorIconTab,
  DockButtonInspectorFxTab,
  DockButtonInspectorShapeTab,
  COLOR_PRESETS,
  EFFECT_OPTIONS,
} from '../DockButtonInspectorTabs';
import { launcherActions } from '../../../store/launcherStore';

vi.mock('../../../utils/wallpaperStorage', () => ({
  saveDockPanoramaFile: vi.fn().mockResolvedValue({ url: 'file:///dock_pano.mp4', isVideo: true }),
  clearButtonMedia: vi.fn().mockResolvedValue(true),
}));

describe('DockButtonInspectorTabs Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCustomization = {
    bgType: 'color' as const,
    bgColor: 'rgba(18, 22, 30, 0.92)',
    iconType: 'default' as const,
    iconScale: 1.2,
    specialEffect: 'rainbow_rgb' as const,
    customWidth: 120,
    customHeight: 60,
    hideLabel: false,
    borderRadius: 16,
    rotation: 5,
  };

  const mockDockConfig = {
    position: 'bottom' as const,
    layoutMode: 'dock' as const,
    showLabels: true,
    panoramaButtons: ['play', 'instances'] as any,
    dockBgType: 'video' as const,
  } as any;

  describe('Presets Exportados', () => {
    it('incluye presets de color válidos', () => {
      expect(COLOR_PRESETS.length).toBeGreaterThan(0);
      expect(COLOR_PRESETS[0].label).toBe('Grafito');
    });

    it('incluye opciones de efectos visuales válidas', () => {
      expect(EFFECT_OPTIONS.length).toBeGreaterThan(0);
      expect(EFFECT_OPTIONS.some((e) => e.id === 'rainbow_rgb')).toBe(true);
    });
  });

  describe('DockButtonInspectorBgTab', () => {
    it('renderiza presets de color y permite seleccionar un preset', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      const bgRef = { current: document.createElement('input') };
      const dockBgRef = { current: document.createElement('input') };
      const setUploadStatus = vi.fn();

      render(
        <DockButtonInspectorBgTab
          buttonId="play"
          customization={mockCustomization}
          dockConfig={mockDockConfig}
          hasDockPanorama={true}
          isParticipant={true}
          bgFileInputRef={bgRef as any}
          dockBgInputRef={dockBgRef as any}
          setUploadStatus={setUploadStatus}
        />
      );

      const grafitoBtn = screen.getByText('Grafito');
      fireEvent.click(grafitoBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith(
        'play',
        expect.objectContaining({ bgType: 'color' })
      );
    });

    it('permite alternar el fondo panorámico compartido', () => {
      const togglePanoSpy = vi.spyOn(launcherActions, 'togglePanoramaButton');
      const bgRef = { current: null };
      const dockBgRef = { current: null };

      render(
        <DockButtonInspectorBgTab
          buttonId="play"
          customization={mockCustomization}
          dockConfig={mockDockConfig}
          hasDockPanorama={true}
          isParticipant={true}
          bgFileInputRef={bgRef as any}
          dockBgInputRef={dockBgRef as any}
          setUploadStatus={vi.fn()}
        />
      );

      const panoBtn = screen.getByText('Usar fondo panorámico compartido');
      fireEvent.click(panoBtn);
      expect(togglePanoSpy).toHaveBeenCalledWith('play');
    });

    it('permite quitar fondo personalizado cuando existe', async () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorBgTab
          buttonId="play"
          customization={{ ...mockCustomization, bgImage: 'file:///image.png' }}
          dockConfig={mockDockConfig}
          hasDockPanorama={false}
          isParticipant={false}
          bgFileInputRef={{ current: null } as any}
          dockBgInputRef={{ current: null } as any}
          setUploadStatus={vi.fn()}
        />
      );

      const removeBtn = screen.getByText('Quitar Fondo Personalizado');
      fireEvent.click(removeBtn);
      await waitFor(() => {
        expect(setCustomizationSpy).toHaveBeenCalledWith(
          'play',
          expect.objectContaining({ bgType: 'default' })
        );
      });
    });
  });

  describe('DockButtonInspectorIconTab', () => {
    it('permite alternar ocultar/mostrar icono y restablecer svg original', async () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      const iconRef = { current: document.createElement('input') };

      render(
        <DockButtonInspectorIconTab
          buttonId="play"
          customization={mockCustomization}
          iconFileInputRef={iconRef as any}
        />
      );

      const hideBtn = screen.getByText('Ocultar Icono');
      fireEvent.click(hideBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { iconType: 'none' });

      const resetBtn = screen.getByText('SVG Original');
      fireEvent.click(resetBtn);
      await waitFor(() => {
        expect(setCustomizationSpy).toHaveBeenCalledWith('play', {
          iconType: 'default',
          customIconUrl: undefined,
          customSvg: undefined,
        });
      });
    });

    it('permite ajustar la escala del icono mediante el slider', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorIconTab
          buttonId="play"
          customization={mockCustomization}
          iconFileInputRef={{ current: null } as any}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '1.5' } });
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { iconScale: 1.5 });
    });
  });

  describe('DockButtonInspectorFxTab', () => {
    it('permite seleccionar un efecto especial de la lista', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorFxTab
          buttonId="play"
          customization={mockCustomization}
        />
      );

      const neonBtn = screen.getByText('Pulso Luminoso');
      fireEvent.click(neonBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { specialEffect: 'neon_pulse' });
    });
  });

  describe('DockButtonInspectorShapeTab', () => {
    it('muestra dimensiones actuales y permite alternar etiqueta de texto', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorShapeTab
          buttonId="play"
          dockConfig={mockDockConfig}
          customization={mockCustomization}
        />
      );

      expect(screen.getByText('120px × 60px')).toBeDefined();

      const labelToggleBtn = screen.getByText('Ocultar');
      fireEvent.click(labelToggleBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { hideLabel: true });
    });

    it('permite alternar entre mostrar y ocultar la etiqueta', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorShapeTab
          buttonId="play"
          dockConfig={mockDockConfig}
          customization={{ ...mockCustomization, hideLabel: true }}
        />
      );

      const labelToggleBtn = screen.getByText('Mostrar');
      fireEvent.click(labelToggleBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { hideLabel: false });
    });

    it('permite restablecer tamaño original y modificar bordes y rotación', () => {
      const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
      render(
        <DockButtonInspectorShapeTab
          buttonId="play"
          dockConfig={mockDockConfig}
          customization={mockCustomization}
        />
      );

      const resetSizeBtn = screen.getByText('Restablecer Tamaño Original');
      fireEvent.click(resetSizeBtn);
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', {
        customWidth: undefined,
        customHeight: undefined,
      });

      const sliders = screen.getAllByRole('slider');
      // Borde redondeado
      fireEvent.change(sliders[0], { target: { value: '20' } });
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { borderRadius: 20 });

      // Rotación
      fireEvent.change(sliders[1], { target: { value: '-10' } });
      expect(setCustomizationSpy).toHaveBeenCalledWith('play', { rotation: -10 });
    });
  });
});
