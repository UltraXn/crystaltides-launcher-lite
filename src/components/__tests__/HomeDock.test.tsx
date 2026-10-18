import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HomeDock, FreeButtonCoordBadge, FreeButtonInspectorPopup } from '../HomeDock';
import {
  resolveButtonBg,
  resolveStatusClass,
  resolveButtonCursor,
  resolveButtonZIndex,
  resolveAccountAvatarSrc,
  resolveButtonColor,
  resolveButtonBorder,
  getEffectClassName,
  resolveFreeButtonBorder,
  resolveFreeButtonShadow,
} from '../../utils/homeDockUtils';
import { useLauncherStore } from '../../store/launcherStore';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('HomeDock Component & Helpers Suite', () => {
  describe('HomeDock Helper Functions', () => {
    it('resolveButtonBg resuelve fondos de color, imagen, launch y color personalizado', () => {
      // Color
      expect(
        resolveButtonBg({
          btnCustom: { bgType: 'color', bgColor: '#112233' },
          isLaunch: false,
          isRunning: false,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
        }),
      ).toBe('#112233');

      // Imagen
      expect(
        resolveButtonBg({
          btnCustom: { bgType: 'image', bgImage: 'file:///pic.png' },
          isLaunch: false,
          isRunning: false,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
        }),
      ).toContain('url(file:///pic.png)');

      // Launch running
      expect(
        resolveButtonBg({
          isLaunch: true,
          isRunning: true,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
        }),
      ).toBe('#22c55e');

      // Launch idle
      expect(
        resolveButtonBg({
          isLaunch: true,
          isRunning: false,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
        }),
      ).toBe('#15803d');

      // Custom color
      expect(
        resolveButtonBg({
          isLaunch: false,
          isRunning: false,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
          customBtnColor: '#38bdf8',
        }),
      ).toBe('#38bdf818');

      // Fallback
      expect(
        resolveButtonBg({
          isLaunch: false,
          isRunning: false,
          isLaunching: false,
          startHoverBg: '#22c55e',
          startSubtleBg: '#15803d',
          fallbackBg: '#rgba(0,0,0,0.5)',
        }),
      ).toBe('#rgba(0,0,0,0.5)');
    });

    it('resolveStatusClass retorna la clase css adecuada según estado', () => {
      expect(resolveStatusClass(true, false)).toBe('running');
      expect(resolveStatusClass(false, true)).toBe('launching');
      expect(resolveStatusClass(false, false)).toBe('');
    });

    it('resolveButtonCursor gestiona cursores de arrastre en modo HUD', () => {
      expect(resolveButtonCursor(false, false)).toBe('pointer');
      expect(resolveButtonCursor(true, true)).toBe('grabbing');
      expect(resolveButtonCursor(true, false)).toBe('grab');
    });

    it('resolveButtonZIndex asigna el zIndex correcto según el contexto', () => {
      expect(resolveButtonZIndex(true, true)).toBe(990);
      expect(resolveButtonZIndex(false, true, true)).toBe(980);
      expect(resolveButtonZIndex(false, true)).toBe(940);
      expect(resolveButtonZIndex(false, false)).toBe(25);
    });

    it('resolveAccountAvatarSrc genera la URL del avatar de Minecraft o fallback nulo', () => {
      expect(resolveAccountAvatarSrc({ skinUrl: 'https://skin.png' } as any)).toBe(
        'https://skin.png',
      );
      expect(
        resolveAccountAvatarSrc({
          uuid: '11111111-2222-3333-4444-555555555555',
        } as any),
      ).toBe('https://mc-heads.net/avatar/11111111-2222-3333-4444-555555555555/48');
      expect(
        resolveAccountAvatarSrc({
          uuid: '00000000-0000-0000-0000-000000000000',
        } as any),
      ).toBeNull();
      expect(resolveAccountAvatarSrc(null)).toBeNull();
    });

    it('resolveButtonColor resuelve el color de contenido, launch o acento', () => {
      expect(resolveButtonColor({ contentColor: '#f43f5e' }, false, '#22c55e')).toBe('#f43f5e');
      expect(resolveButtonColor(null, true, '#22c55e')).toBe('#22c55e');
      expect(resolveButtonColor(null, false, '#22c55e', '#38bdf8')).toBe('#38bdf8');
      expect(resolveButtonColor(null, false, '#22c55e')).toBe('#cbd5e1');
    });

    it('resolveButtonBorder maneja bordes con color, imagen, acento y borde normal', () => {
      expect(resolveButtonBorder({ bgType: 'color', bgColor: '#112233' })).toBe(
        '1px solid #11223380',
      );
      expect(resolveButtonBorder({ bgType: 'image', bgImage: 'file:///pic.png' })).toBe(
        '1px solid rgba(255, 255, 255, 0.16)',
      );
      expect(resolveButtonBorder(null, '#38bdf8')).toBe('1px solid #38bdf880');
      expect(resolveButtonBorder(null, null, 'accent')).toContain('var(--border-accent');
      expect(resolveButtonBorder(null)).toBe('1px solid rgba(255, 255, 255, 0.1)');
    });

    it('getEffectClassName mapea efectos a clases CSS', () => {
      expect(getEffectClassName('rainbow_rgb')).toBe('btn-fx-rainbow-rgb');
      expect(getEffectClassName('neon_pulse')).toBe('btn-fx-neon-pulse');
      expect(getEffectClassName('glitch')).toBe('btn-fx-glitch');
      expect(getEffectClassName('hologram')).toBe('btn-fx-hologram');
      expect(getEffectClassName('fire')).toBe('btn-fx-fire');
      expect(getEffectClassName('')).toBe('');
    });

    it('FreeButtonCoordBadge renderiza estado normal y de colisión', () => {
      const { container, rerender } = render(
        <FreeButtonCoordBadge
          isDraggingThis={true}
          isColliding={false}
          pos={{ x: 50, y: 80 }}
          collisionLabel="Colisión detectada"
        />,
      );
      expect(container.firstChild).not.toBeNull();

      rerender(
        <FreeButtonCoordBadge
          isDraggingThis={true}
          isColliding={true}
          pos={{ x: 50, y: 30 }}
          collisionLabel="Colisión detectada"
        />,
      );
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe('HomeDock Component Render & Interactions', () => {
    beforeEach(() => {
      useLauncherStore.setState({
        currentView: 'home',
        isEditingHud: false,
        activeModal: 'none',
        selectedDockButtonId: null,
        dockConfig: {
          layoutMode: 'dock',
          position: 'bottom',
          activeButtons: ['launch', 'settings', 'instances', 'mods', 'accounts', 'about'],
          buttonOrder: ['launch', 'settings', 'instances', 'mods', 'accounts', 'about'],
          visibleButtons: ['launch', 'settings', 'instances', 'mods', 'accounts', 'about'],
          buttonScale: 1,
          showLabels: true,
          enableCollisionPush: true,
          buttonPositions: {
            launch: { x: 50, y: 85 },
            settings: { x: 30, y: 85 },
            instances: { x: 70, y: 85 },
          },
          customColors: {
            settings: '#38bdf8',
          },
          buttonCustomizations: {
            launch: {
              bgType: 'color',
              bgColor: '#22c55e',
              specialEffect: 'rainbow_rgb',
              customIconUrl: 'file:///icon.png',
            },
            settings: {
              bgType: 'image',
              bgImage: 'file:///btn.png',
              customSvg: '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>',
            },
          },
        } as any,
        accentColor: '#00e5ff',
        accounts: [
          {
            id: 'acc-1',
            username: 'Hero',
            active: true,
            uuid: '12345678-1234-1234-1234-123456789abc',
          },
        ] as any,
        activeAccountId: 'acc-1',
        launch: {
          status: 'IDLE',
          progress: 0,
          message: 'Listo para jugar',
        },
      });
    });

    it('renderiza la barra Dock con los botones activos en modo dock', () => {
      const { container } = render(<HomeDock />);
      expect(container.firstChild).not.toBeNull();
    });

    it('permite hacer click en los botones del dock', () => {
      render(<HomeDock />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      for (const btn of buttons) {
        fireEvent.click(btn);
      }
    });

    it('renderiza handles de redimensionado y arrastre en modo de edición HUD con accentColor', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        selectedDockButtonId: 'settings',
        accentColor: '#16A085',
      });
      const { container } = render(<HomeDock />);

      expect(container.firstChild).not.toBeNull();
      const selectionFrame =
        container.querySelector('div[style*="border: 2px solid rgb(22, 160, 133)"]') ||
        container.querySelector('div[style*="border: 2px solid #16A085"]');
      expect(selectionFrame).not.toBeNull();
    });

    it('oculta la etiqueta del botón cuando se redimensiona a dimensiones compactas en modo free_buttons', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'free_buttons',
          showLabels: true,
          buttonCustomizations: {
            settings: { customHeight: 50, customWidth: 50 },
          },
        },
      });

      render(<HomeDock />);
      expect(screen.queryByText(/Ajustes/i)).toBeNull();
    });

    it('muestra la etiqueta en modo dock unificado incluso si buttonCustomizations tiene dimensiones compactas de modo libre', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'dock',
          showLabels: true,
          buttonCustomizations: {
            settings: { customHeight: 50, customWidth: 50 },
          },
        },
      });

      render(<HomeDock />);
      expect(screen.queryByText(/Ajustes/i)).not.toBeNull();
    });

    it('renderiza en modo free_buttons flotante con posiciones individuales', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'free_buttons',
        },
      });

      const { container } = render(<HomeDock />);
      expect(container.firstChild).not.toBeNull();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      fireEvent.click(buttons[0]);
    });

    it('maneja eventos de mousedown, arrastre y click derecho para abrir inspector', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'free_buttons',
        },
      });

      render(<HomeDock />);
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.contextMenu(buttons[0]);
        fireEvent.mouseDown(buttons[0], { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });
        fireEvent.mouseUp(window);
      }
      expect(useLauncherStore.getState().isEditingHud).toBe(true);
    });

    it('renderiza diferentes estados de ejecución del juego', () => {
      useLauncherStore.setState({
        launch: {
          status: 'RUNNING',
          progress: 100,
          message: '¡Minecraft en ejecución!',
        },
      });

      const { container } = render(<HomeDock />);
      expect(container.firstChild).not.toBeNull();

      useLauncherStore.setState({
        launch: {
          status: 'DOWNLOADING',
          progress: 45,
          message: 'Descargando librerías...',
        },
      });

      expect(container.firstChild).not.toBeNull();
    });

    it('renderiza customSvg y customIconUrl y gestiona clicks y redimensionamiento en modo edición HUD', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        selectedDockButtonId: 'launch',
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          buttonCustomizations: {
            launch: {
              iconType: 'custom_svg',
              customSvg: '<svg data-testid="launch-svg"><path d="M0 0"/></svg>',
              customWidth: 110,
              customHeight: 55,
            },
            instances: {
              iconType: 'custom_image',
              customIconUrl: 'file:///custom_instance_icon.png',
            },
          },
        },
      });

      const { container } = render(<HomeDock />);
      const customSvgBtn = container.querySelector('.dock-custom-svg');
      expect(customSvgBtn).not.toBeNull();
      if (customSvgBtn) {
        fireEvent.click(customSvgBtn);
      }

      const imgEl = container.querySelector('img[src="file:///custom_instance_icon.png"]');
      expect(imgEl).not.toBeNull();
      if (imgEl && imgEl.parentElement) {
        fireEvent.click(imgEl.parentElement);
      }

      // Probar corner resize handle (SE)
      const seHandle =
        container.querySelector('.dock-resize-handle-se') ||
        container.querySelector('[title*="arrastra para cambiar ancho y alto"]');
      expect(seHandle).not.toBeNull();
      if (seHandle) {
        fireEvent.mouseDown(seHandle, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(window, { clientX: 160, clientY: 150 });
        fireEvent.mouseUp(window);
      }
    });

    it('renderiza FreeButtonInspectorPopup alternando posicionamiento vertical según posY', () => {
      const onClose = vi.fn();
      // Caso 1: posY > 55 (coloca el popup en bottom)
      const { rerender } = render(
        <FreeButtonInspectorPopup posY={70} btnId="settings" inspectorTab="bg" onClose={onClose} />,
      );
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();

      // Caso 2: posY <= 55 (coloca el popup en top)
      rerender(
        <FreeButtonInspectorPopup posY={30} btnId="launch" inspectorTab="icon" onClose={onClose} />,
      );
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();
    });

    it('evalúa correctamente resolveFreeButtonBorder y resolveFreeButtonShadow bajo colisiones y edición', () => {
      // Borde en edición con colisión
      expect(resolveFreeButtonBorder(true, true, true, null, null, 'accent')).toBe(
        '2px dashed #ef4444',
      );
      // Borde en edición sin colisión
      expect(resolveFreeButtonBorder(true, true, false, null, null, 'accent')).toBe(
        '2px dashed #38bdf8',
      );
      // Borde normal
      expect(resolveFreeButtonBorder(false, false, false, null, '#00e5ff', 'accent')).toBeDefined();

      // Sombra en edición con colisión
      expect(resolveFreeButtonShadow(true, true, true, null)).toBe(
        '0 0 20px rgba(239, 68, 68, 0.65)',
      );
      // Sombra en edición sin colisión
      expect(resolveFreeButtonShadow(true, true, false, null)).toBe(
        '0 0 16px rgba(56, 189, 248, 0.4)',
      );
      // Sombra con color personalizado
      expect(resolveFreeButtonShadow(false, false, false, '#22c55e')).toContain('#22c55e33');
      // Sombra por defecto
      expect(resolveFreeButtonShadow(false, false, false, null)).toBe(
        '0 20px 50px rgba(0, 0, 0, 0.8)',
      );
    });

    it('muestra dinámicamente el logo del loader según la instancia activa seleccionada', () => {
      useLauncherStore.setState({
        instances: [
          {
            id: 'inst-neoforge',
            name: 'Instancia NeoForge',
            mcVersion: '1.21.1',
            loaderType: 'neoforge',
            icon: 'crystal',
            createdAt: 1000,
          },
          {
            id: 'inst-fabric',
            name: 'Instancia Fabric',
            mcVersion: '1.21.1',
            loaderType: 'fabric',
            icon: 'sword',
            createdAt: 2000,
          },
        ],
        activeInstanceId: 'inst-neoforge',
      });

      const { rerender } = render(<HomeDock />);
      expect(screen.getByLabelText('NeoForge Logo')).toBeDefined();

      // Cambiar a instancia con Fabric
      useLauncherStore.setState({ activeInstanceId: 'inst-fabric' });
      rerender(<HomeDock />);
      expect(screen.getByLabelText('Fabric Logo')).toBeDefined();
    });

    it('selecciona el botón con un clic simple y abre el inspector con doble clic o clic derecho', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        selectedDockButtonId: null,
        isButtonInspectorOpen: false,
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'dock',
          showLabels: true,
        },
      });

      const { container } = render(<HomeDock />);

      // Verificar que no existen botones anidados (HTML estricto y válido)
      expect(container.querySelectorAll('button button').length).toBe(0);

      const settingsLabel = screen.getByText(/Ajustes/i);

      // 1. Clic simple -> Selecciona el botón, pero NO abre el inspector
      fireEvent.click(settingsLabel);
      expect(useLauncherStore.getState().selectedDockButtonId).toBe('settings');
      expect(useLauncherStore.getState().isButtonInspectorOpen).toBe(false);
      expect(screen.queryByRole('dialog', { name: /Inspector de Botón/i })).toBeNull();

      // 2. Doble clic en el icono de Ajustes -> Abre inspector en pestaña "icon"
      const settingsButton = settingsLabel.closest('button');
      const settingsIcon = settingsButton?.querySelector('[data-dock-icon="true"]');
      expect(settingsIcon).not.toBeNull();
      if (settingsIcon) {
        fireEvent.doubleClick(settingsIcon);
      }

      expect(useLauncherStore.getState().selectedDockButtonId).toBe('settings');
      expect(useLauncherStore.getState().isButtonInspectorOpen).toBe(true);
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();
      expect(screen.getByText(/Escala del Icono/i)).toBeDefined();

      // Cerrar inspector
      useLauncherStore.setState({ isButtonInspectorOpen: false, selectedDockButtonId: null });

      // 3. Clic derecho en el botón -> Abre directamente el inspector en pestaña "bg"
      fireEvent.contextMenu(settingsLabel);

      expect(useLauncherStore.getState().selectedDockButtonId).toBe('settings');
      expect(useLauncherStore.getState().isButtonInspectorOpen).toBe(true);
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();
      expect(screen.getByText(/Color o tinte del fondo/i)).toBeDefined();

      // Verificar nuevamente que no existen botones anidados
      expect(container.querySelectorAll('button button').length).toBe(0);
    });

    it('restringe las dimensiones del dock en modo barra para que los botones nunca superen el límite permitido', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'dock',
          scale: 'normal',
          showLabels: true,
          customSegmentWidth: 500, // Valor desmedido fuera de límites
          customDockHeight: 400, // Valor desmedido fuera de límites
        },
      });

      const { container } = render(<HomeDock />);
      const dock = container.querySelector('.home-unified-dock') as HTMLElement;
      expect(dock).not.toBeNull();

      // Los botones deben estar acotados al tope permitido (180px para normales y 130px de alto)
      const firstButton = dock.querySelector('.dock-segment') as HTMLElement;
      expect(firstButton).not.toBeNull();
      expect(parseInt(firstButton.style.width, 10)).toBeLessThanOrEqual(207); // 180px * 1.15 = 207px para start
      expect(parseInt(firstButton.style.height, 10)).toBeLessThanOrEqual(130);
    });

    it('mantiene el inspector abierto tras mover la barra o hacer clic mientras se edita', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        selectedDockButtonId: 'settings',
        isButtonInspectorOpen: true,
      });

      const { container } = render(<HomeDock />);

      expect(useLauncherStore.getState().isButtonInspectorOpen).toBe(true);
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();

      const dockLabels = container.querySelectorAll('.dock-label');
      expect(dockLabels.length).toBeGreaterThan(0);
      fireEvent.click(dockLabels[3]); // Botón de Ajustes

      // El inspector debe permanecer abierto
      expect(useLauncherStore.getState().isButtonInspectorOpen).toBe(true);
      expect(screen.getByRole('dialog', { name: /Inspector de Botón/i })).toBeDefined();
    });

    it('oculta automáticamente el texto de un botón si su icono escala a un tamaño que cortaría las letras', () => {
      useLauncherStore.setState({
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'dock',
          scale: 'normal',
          showLabels: true,
          buttonCustomizations: {
            launch: {
              iconScale: 3.9,
            },
            instances: {
              iconScale: 1.0,
            },
          },
        },
      });

      render(<HomeDock />);

      // El botón de instances (escala 1.0) debe mostrarse
      const instancesLabel = screen.queryByText(/Instancias/i);
      expect(instancesLabel).not.toBeNull();

      // El botón de launch (escala 3.9) debe ocultar su texto automáticamente
      const launchLabel = screen.queryByText(/Iniciar Juego|Lanzar/i);
      expect(launchLabel).toBeNull();
    });

    it('renderiza insignia de coordenadas sobre la barra unificada en modo edición HUD', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'dock',
          positionPreset: 'free',
          customCoordinates: { x: 50, y: 88 },
        },
      });

      render(<HomeDock />);

      const dockCoords = screen.getByLabelText(/Coordenadas del dock/i);
      expect(dockCoords).toBeDefined();
      expect(dockCoords.textContent).toContain('X:50% Y:88%');
    });

    it('renderiza insignia de coordenadas sobre los botones individuales en modo free_buttons', () => {
      useLauncherStore.setState({
        isEditingHud: true,
        dockConfig: {
          ...useLauncherStore.getState().dockConfig,
          layoutMode: 'free_buttons',
          buttonPositions: {
            instances: { x: 25, y: 40 },
            launch: { x: 75, y: 60 },
          },
        },
      });

      render(<HomeDock />);

      expect(screen.getByText('X:25% Y:40%')).toBeDefined();
      expect(screen.getByText('X:75% Y:60%')).toBeDefined();
    });
  });
});
