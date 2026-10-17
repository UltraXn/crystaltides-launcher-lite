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
import { DockButtonInspector } from '../../DockButtonInspector';
import { launcherActions } from '../../../store/launcherStore';

vi.mock('../../../utils/wallpaperStorage', () => ({
  saveDockPanoramaFile: vi.fn().mockResolvedValue({ url: 'file:///dock_pano.mp4', isVideo: true }),
  clearButtonMedia: vi.fn().mockResolvedValue(true),
  clearDockPanorama: vi.fn().mockResolvedValue(true),
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
    borderRadius: 14,
    buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
  } as any;

  const mockFreeDockConfig = {
    ...mockDockConfig,
    layoutMode: 'free_buttons' as const,
  };

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

    it('permite quitar el fondo panorámico de la barra', async () => {
      const clearDockBgSpy = vi.spyOn(launcherActions, 'clearDockBackground');
      const resetTransformSpy = vi.spyOn(launcherActions, 'resetDockBackgroundTransform');
      const setUploadStatus = vi.fn();

      render(
        <DockButtonInspectorBgTab
          buttonId="play"
          customization={mockCustomization}
          dockConfig={mockDockConfig}
          hasDockPanorama={true}
          isParticipant={true}
          bgFileInputRef={{ current: null } as any}
          dockBgInputRef={{ current: null } as any}
          setUploadStatus={setUploadStatus}
        />
      );

      const removePanoBtn = screen.getByText('Quitar Fondo de Barra');
      fireEvent.click(removePanoBtn);

      await waitFor(() => {
        expect(clearDockBgSpy).toHaveBeenCalled();
        expect(resetTransformSpy).toHaveBeenCalled();
        expect(setUploadStatus).toHaveBeenCalledWith('¡Fondo eliminado!');
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
    describe('Modo Barra Unificada (dock)', () => {
      it('detecta modo barra unificada, muestra banner, tamaño total de barra y actualiza borde de barra', () => {
        const setDockConfigSpy = vi.spyOn(launcherActions, 'setDockConfig');
        render(
          <DockButtonInspectorShapeTab
            buttonId="play"
            dockConfig={mockDockConfig}
            customization={mockCustomization}
          />
        );

        // Banner informativo
        expect(screen.getByText('Barra Unificada (Forma Compartida)')).toBeDefined();
        expect(
          screen.getByText('La forma, dimensiones y bordes aplican a la barra completa como un solo elemento.')
        ).toBeDefined();

        // Tamaño total de la barra (5 botones * 136px = 680px)
        expect(screen.getByText(/680px × 108px/)).toBeDefined();

        // Rotación bloqueada
        expect(screen.getByText('0° (Bloqueada)')).toBeDefined();

        // Borde redondeado actualiza la barra completa
        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: '24' } });
        expect(setDockConfigSpy).toHaveBeenCalledWith({ borderRadius: 24 });
      });

      it('permite restablecer tamaño de barra cuando existen dimensiones personalizadas', () => {
        const setDockConfigSpy = vi.spyOn(launcherActions, 'setDockConfig');
        render(
          <DockButtonInspectorShapeTab
            buttonId="play"
            dockConfig={{
              ...mockDockConfig,
              customSegmentWidth: 160,
              customDockHeight: 90,
            }}
            customization={mockCustomization}
          />
        );

        expect(screen.getByText(/800px × 90px/)).toBeDefined();
        const resetBarSizeBtn = screen.getByText('Restablecer Tamaño de Barra');
        fireEvent.click(resetBarSizeBtn);
        expect(setDockConfigSpy).toHaveBeenCalledWith({
          customSegmentWidth: undefined,
          customDockHeight: undefined,
        });
      });

      it('permite restablecer forma completa de la barra', () => {
        const setDockConfigSpy = vi.spyOn(launcherActions, 'setDockConfig');
        render(
          <DockButtonInspectorShapeTab
            buttonId="play"
            dockConfig={{
              ...mockDockConfig,
              borderRadius: 30,
              customSegmentWidth: 150,
            }}
            customization={mockCustomization}
          />
        );

        const resetBarShapeBtn = screen.getByText('Restablecer Forma de la Barra');
        fireEvent.click(resetBarShapeBtn);
        expect(setDockConfigSpy).toHaveBeenCalledWith({
          borderRadius: 14,
          customSegmentWidth: undefined,
          customDockHeight: undefined,
        });
      });
    });

    describe('Modo Botones Libres (free_buttons)', () => {
      it('muestra dimensiones individuales y permite alternar etiqueta de texto', () => {
        const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
        render(
          <DockButtonInspectorShapeTab
            buttonId="play"
            dockConfig={mockFreeDockConfig}
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
            dockConfig={mockFreeDockConfig}
            customization={{ ...mockCustomization, hideLabel: true }}
          />
        );

        const labelToggleBtn = screen.getByText('Mostrar');
        fireEvent.click(labelToggleBtn);
        expect(setCustomizationSpy).toHaveBeenCalledWith('play', { hideLabel: false });
      });

      it('permite restablecer tamaño original y modificar bordes y rotación por botón', () => {
        const setCustomizationSpy = vi.spyOn(launcherActions, 'setDockButtonCustomization');
        render(
          <DockButtonInspectorShapeTab
            buttonId="play"
            dockConfig={mockFreeDockConfig}
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
        // Borde redondeado individual
        fireEvent.change(sliders[0], { target: { value: '20' } });
        expect(setCustomizationSpy).toHaveBeenCalledWith('play', { borderRadius: 20 });

        // Rotación individual
        fireEvent.change(sliders[1], { target: { value: '-10' } });
        expect(setCustomizationSpy).toHaveBeenCalledWith('play', { rotation: -10 });
      });
    });
  });

  it('renderiza DockButtonInspector con overflow hidden en dialog y overscroll-behavior contain', () => {
    const { container } = render(
      <DockButtonInspector buttonId="play" onClose={vi.fn()} />
    );

    const dialog = container.querySelector<HTMLElement>('dialog[data-inspector="true"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.style.overflow).toBe('hidden');
    expect(dialog?.style.margin).toBe('0px');

    const scrollBody = container.querySelector<HTMLElement>('.hud-custom-scrollbar');
    expect(scrollBody).not.toBeNull();
    expect(scrollBody?.style.overscrollBehavior).toBe('contain');
  });
});
