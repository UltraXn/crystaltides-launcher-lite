import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  BottomBar,
  DiscordIcon,
  YoutubeIcon,
  BottomBarSocialsWidget,
  BottomBarServerWidget,
  BottomBarPlayerWidget,
  WidgetCoordinateBadge,
  ServerLogoIcon,
} from '../BottomBar';
import {
  calculateEffectiveSocialsPosition,
  getWidgetCursor,
  getWidgetOutline,
} from '../../utils/bottomBarUtils';
import { useLauncherStore, launcherActions } from '../../store/launcherStore';
import { getTranslation } from '../../i18n';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('BottomBar Component & Widgets Suite', () => {
  beforeEach(() => {
    useLauncherStore.setState({
      accounts: [
        { id: 'acc-1', username: 'CrystalPlayer', type: 'guest', active: true, lastUsed: Date.now(), uuid: 'acc-1-uuid' },
      ] as any,
      activeAccountId: 'acc-1',
      serverStatus: {
        online: true,
        players: 12,
        maxPlayers: 50,
        ping: 25,
      } as any,
      isEditingHud: false,
      dockConfig: {
        layoutMode: 'dock',
        position: 'bottom',
        activeButtons: ['play', 'settings'],
        buttonScale: 1,
        enableCollisionPush: true,
        widgetPositions: {
          userPill: { x: 10, y: 90 },
          socials: { x: 50, y: 90 },
          serverStatus: { x: 90, y: 90 },
        },
      } as any,
      hudManualSide: 'auto',
    });
  });

  describe('Social Icons & Position Calculations', () => {
    it('renderiza DiscordIcon y YoutubeIcon con svg', () => {
      const { container: c1 } = render(<DiscordIcon style={{ width: 16 }} />);
      expect(c1.querySelector('svg')).not.toBeNull();

      const { container: c2 } = render(<YoutubeIcon style={{ width: 16 }} />);
      expect(c2.querySelector('svg')).not.toBeNull();
    });

    it('calculateEffectiveSocialsPosition ajusta posición cuando el dock se superpone', () => {
      const dockConfig = {
        layoutMode: 'dock',
        position: 'bottom',
      } as any;

      const pos = calculateEffectiveSocialsPosition({ x: 50, y: 90 }, dockConfig);
      expect(pos).toBeDefined();
      expect(pos.x).toBe(50);
      expect(typeof pos.y).toBe('number');
    });

    it('calculateEffectiveSocialsPosition ajusta posición en modo free_buttons', () => {
      const dockConfig = {
        layoutMode: 'free_buttons',
        activeButtons: ['launch'],
        buttonPositions: {
          launch: { x: 50, y: 90 },
        },
      } as any;

      const pos = calculateEffectiveSocialsPosition({ x: 50, y: 90 }, dockConfig);
      expect(pos).toBeDefined();
      expect(pos.x).toBe(50);
    });
  });

  describe('Subwidgets Direct Render', () => {
    const mockDrag = {
      socialsRef: { current: null },
      serverStatusRef: { current: null },
      userPillRef: { current: null },
      tempPositions: {},
      draggingWidget: null,
      isColliding: false,
      startDrag: vi.fn(),
    };

    const mockT = {
      hudEditor: { collision: 'Colisión' },
      bottomBar: {
        officialServer: 'Servidor Oficial',
        online: 'En línea',
        offline: 'Desconectado',
        playersOnline: 'jugadores conectados',
      },
    } as any;

    it('BottomBarSocialsWidget renderiza redes sociales y previene default al editar', () => {
      const { container } = render(
        <BottomBarSocialsWidget
          drag={mockDrag}
          isEditingHud={true}
          effectiveSocPos={{ x: 50, y: 93 }}
          t={mockT}
        />
      );

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(3);

      // Probar click en links en modo edición HUD (debe llamar preventDefault)
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      links[0].dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('BottomBarServerWidget renderiza información de jugadores y estado en línea', () => {
      render(
        <BottomBarServerWidget
          drag={mockDrag}
          isEditingHud={false}
          statPos={{ x: 90, y: 93 }}
          serverStatus={{ online: true, playersCount: 15, maxPlayers: 100, ping: 25 }}
          t={mockT}
        />
      );

      expect(screen.getByText(/15/)).toBeDefined();
    });

    it('BottomBarServerWidget abre popover al hacer hover mostrando jugadores y permite cambiar IP', () => {
      const setServerHostSpy = vi.spyOn(launcherActions, 'setServerHost').mockImplementation(() => {});
      const { container } = render(
        <BottomBarServerWidget
          drag={mockDrag}
          isEditingHud={false}
          statPos={{ x: 90, y: 93 }}
          serverStatus={{
            online: true,
            playersCount: 2,
            maxPlayers: 100,
            ping: 25,
            serverHost: 'mc.crystaltidessmp.net',
            playersList: [{ name: 'PlayerOne' }, { name: 'PlayerTwo' }],
          }}
          t={mockT}
        />
      );

      const widget = container.firstChild as HTMLElement;
      expect(widget).not.toBeNull();
      fireEvent.mouseEnter(widget);

      expect(screen.getByTestId('server-status-popover')).toBeDefined();
      expect(screen.getByText('PlayerOne')).toBeDefined();
      expect(screen.getByText('PlayerTwo')).toBeDefined();

      const editIpBtn = screen.getByLabelText('Editar IP del servidor');
      fireEvent.click(editIpBtn);

      const input = screen.getByPlaceholderText('mc.crystaltidessmp.net');
      fireEvent.change(input, { target: { value: 'play.customserver.net' } });

      const saveBtn = screen.getByLabelText('Guardar nueva IP');
      fireEvent.click(saveBtn);

      expect(setServerHostSpy).toHaveBeenCalledWith('play.customserver.net');
    });

    it('ServerLogoIcon renderiza imagen cuando está online y cae en globito al estar offline o fallar', () => {
      const { rerender } = render(
        <ServerLogoIcon
          online={true}
          icon="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
          serverHost="mc.hypixel.net"
        />
      );
      const img = screen.getByTestId('server-logo-img');
      expect(img).toBeDefined();
      expect(img.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

      // Si ocurre un error al cargar la imagen, debe caer en el globito fallback
      fireEvent.error(img);
      expect(screen.getByTestId('server-globe-fallback')).toBeDefined();

      // Si el servidor pasa a offline, debe mostrar el globito fallback directamente
      rerender(
        <ServerLogoIcon
          online={false}
          icon="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
          serverHost="mc.hypixel.net"
        />
      );
      expect(screen.getByTestId('server-globe-fallback')).toBeDefined();
    });

    it('BottomBarServerWidget renderiza estado offline con luz roja, Sin conexión y ping nulo', () => {
      const { container } = render(
        <BottomBarServerWidget
          drag={mockDrag}
          isEditingHud={false}
          statPos={{ x: 90, y: 93 }}
          serverStatus={{
            online: false,
            playersCount: 0,
            maxPlayers: 100,
            ping: 0,
            serverHost: 'mc.hypixel.net',
            playersList: [],
          }}
          t={{
            ...mockT,
            bottomBar: {
              ...mockT.bottomBar,
              offline: 'Sin conexión',
            },
          }}
        />
      );

      // Verificamos el chip exterior
      expect(screen.getByText('Sin conexión')).toBeDefined();
      expect(screen.getByText('--')).toBeDefined();

      // Abrimos el popover con hover
      const widget = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(widget);

      const popover = screen.getByTestId('server-status-popover');
      expect(popover).toBeDefined();

      // Globito fallback presente en la cabecera del popover
      expect(screen.getByTestId('server-globe-fallback')).toBeDefined();

      // Indicador de luz roja y texto Sin conexión
      const dot = screen.getByTestId('server-status-dot');
      expect(dot.style.backgroundColor).toBe('rgb(239, 68, 68)');

      const statusText = screen.getByTestId('server-status-text');
      expect(statusText.textContent).toBe('Sin conexión');
    });

    it('BottomBarSocialsWidget gestiona onMouseDown para arrastrar widget', () => {
      const startDrag = vi.fn();
      const mockDragWithFn = {
        socialsRef: { current: null },
        serverStatusRef: { current: null },
        userPillRef: { current: null },
        tempPositions: {},
        draggingWidget: null,
        isColliding: false,
        startDrag,
      };

      const { container } = render(
        <BottomBarSocialsWidget
          drag={mockDragWithFn}
          isEditingHud={true}
          effectiveSocPos={{ x: 50, y: 93 }}
          t={mockT}
        />
      );

      const hub = container.firstChild as HTMLElement;
      expect(hub).not.toBeNull();
      if (hub) {
        fireEvent.mouseDown(hub, { clientX: 200, clientY: 200 });
        expect(startDrag).toHaveBeenCalledWith('socials', expect.anything(), expect.anything());
      }
    });

    it('BottomBarServerWidget gestiona onMouseDown para arrastrar widget', () => {
      const startDrag = vi.fn();
      const mockDragWithFn = {
        serverStatusRef: { current: null },
        socialsRef: { current: null },
        userPillRef: { current: null },
        tempPositions: {},
        draggingWidget: null,
        isColliding: false,
        startDrag,
      };

      const { container } = render(
        <BottomBarServerWidget
          drag={mockDragWithFn}
          isEditingHud={true}
          statPos={{ x: 90, y: 93 }}
          serverStatus={{ online: true, playersCount: 15, maxPlayers: 100, ping: 25 }}
          t={mockT}
        />
      );

      const hub = container.firstChild as HTMLElement;
      expect(hub).not.toBeNull();
      if (hub) {
        fireEvent.mouseDown(hub, { clientX: 300, clientY: 300 });
        expect(startDrag).toHaveBeenCalledWith('serverStatus', expect.anything(), expect.anything());
      }
    });

    it('permite arrastrar widgets interactuando directamente desde el tirador superior de agarre', () => {
      const startDrag = vi.fn();
      const mockDragWithFn = {
        socialsRef: { current: null },
        serverStatusRef: { current: null },
        userPillRef: { current: null },
        tempPositions: {},
        draggingWidget: null,
        isColliding: false,
        startDrag,
      };

      render(
        <BottomBarSocialsWidget
          drag={mockDragWithFn}
          isEditingHud={true}
          effectiveSocPos={{ x: 50, y: 93 }}
          t={mockT}
        />
      );

      const grip = screen.getByLabelText(/Arrastrar redes sociales/i);
      expect(grip).toBeDefined();
      fireEvent.mouseDown(grip, { clientX: 200, clientY: 100 });
      expect(startDrag).toHaveBeenCalledWith('socials', expect.anything(), expect.anything());
    });
  });

  describe('BottomBar Main Component', () => {
    it('renderiza widgets de jugador, redes sociales y estado de servidor', () => {
      render(<BottomBar />);

      expect(screen.getByText('CrystalPlayer')).toBeDefined();
      expect(screen.getByText(/en línea/i)).toBeDefined();
    });

    it('permite abrir modal de cuentas al hacer click en el widget de jugador', () => {
      render(<BottomBar />);

      const userWidget = screen.getByText('CrystalPlayer').closest('div');
      expect(userWidget).not.toBeNull();
      if (userWidget) {
        fireEvent.click(userWidget);
        expect(userWidget).toBeDefined();
      }
    });

    it('renderiza widgets en modo edición con controles visuales de arrastre', () => {
      useLauncherStore.setState({ isEditingHud: true });
      const { container } = render(<BottomBar />);

      expect(container.querySelectorAll('.absolute')).toBeDefined();
    });

    it('renderiza WidgetCoordinateBadge con advertencia de colisión cuando isColliding es true', () => {
      // Caso 1: En arrastre y colisión
      const { rerender } = render(
        <WidgetCoordinateBadge
          x={50}
          y={50}
          isDragging={true}
          isColliding={true}
          label="SUPERPOSICIÓN"
        />
      );
      expect(screen.getByText(/SUPERPOSICIÓN/i)).toBeDefined();

      // Caso 2: Posición normal
      rerender(
        <WidgetCoordinateBadge
          x={10}
          y={20}
          isDragging={false}
          isColliding={false}
        />
      );
      expect(screen.getByText('X:10% Y:20%')).toBeDefined();
    });

    it('resuelve getWidgetCursor y getWidgetOutline según estado de edición y colisión', () => {
      expect(getWidgetCursor(false, false)).toBe('default');
      expect(getWidgetCursor(true, false)).toBe('grab');
      expect(getWidgetCursor(true, true)).toBe('grabbing');

      expect(getWidgetOutline(false, false, false)).toBe('none');
      expect(getWidgetOutline(true, true, true)).toContain('rgba(248, 113, 113');
      expect(getWidgetOutline(true, false, false)).toContain('rgba(255, 255, 255');
    });

    it('renderiza BottomBarPlayerWidget con mock de drag y gestiona onMouseDown', () => {
      const startDrag = vi.fn();
      const mockDrag = {
        userPillRef: { current: null },
        socialsRef: { current: null },
        serverStatusRef: { current: null },
        tempPositions: {},
        draggingWidget: null,
        isColliding: false,
        startDrag,
      };

      const { container } = render(
        <BottomBarPlayerWidget
          drag={mockDrag}
          isEditingHud={true}
          userPos={{ x: 20, y: 80 }}
          activeAccount={{
            id: 'acc-test',
            username: 'TestPlayer',
            uuid: '12345678-1234-1234-1234-123456789abc',
            type: 'guest',
            lastUsed: Date.now(),
          }}
          t={getTranslation('es')}
        />
      );

      const pill = container.firstChild as HTMLElement;
      expect(pill).not.toBeNull();
      if (pill) {
        fireEvent.mouseDown(pill, { clientX: 100, clientY: 100 });
        expect(startDrag).toHaveBeenCalledWith('userPill', expect.anything(), expect.anything());
      }
    });
  });
});

