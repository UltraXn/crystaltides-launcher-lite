import { describe, it, expect } from 'vitest';
import {
  checkAABBOverlap,
  getEffectiveActiveButtons,
  calculateDefaultButtonPositions,
  getDockHeight,
  resolveCollisionAndClamp,
  sanitizeAllPositions,
  getElementDimensions,
  getSafeYBelowHudBar,
  getEffectiveDockPosition,
  choosePrimarySeparation,
  chooseAlternativeSeparation,
  radialSearchFreeSlot,
  getActiveObstacles,
  type Box,
} from './collisionSystem';
import { secureRandom, secureRandomInt } from './random';
import type { DockConfig } from '../store/launcherStore';

describe('collisionSystem', () => {
  describe('checkAABBOverlap', () => {
    it('detects overlapping boxes', () => {
      const a: Box = { id: 'a', x: 100, y: 100, width: 50, height: 50 };
      const b: Box = { id: 'b', x: 110, y: 110, width: 50, height: 50 };
      expect(checkAABBOverlap(a, b, 8)).toBe(true);
    });

    it('detects separated boxes', () => {
      const a: Box = { id: 'a', x: 50, y: 50, width: 20, height: 20 };
      const b: Box = { id: 'b', x: 200, y: 200, width: 20, height: 20 };
      expect(checkAABBOverlap(a, b, 8)).toBe(false);
    });

    it('factors safety gap into consideration', () => {
      const a: Box = { id: 'a', x: 50, y: 50, width: 20, height: 20 };
      // a right edge is at 60. b left edge is at 65. Distance is 5.
      // Gap 8 means b is expanded by 8 on all sides, so it overlaps.
      const b: Box = { id: 'b', x: 75, y: 50, width: 20, height: 20 };
      expect(checkAABBOverlap(a, b, 8)).toBe(true);
      expect(checkAABBOverlap(a, b, 0)).toBe(false);
    });
  });

  describe('getEffectiveActiveButtons', () => {
    it('returns empty array when no buttons are defined', () => {
      const config = {} as DockConfig;
      expect(getEffectiveActiveButtons(config)).toEqual([]);
    });

    it('preserves order from buttonOrder for visible and module buttons', () => {
      const config: DockConfig = {
        buttonOrder: ['launch', 'mod:stats', 'settings'],
        visibleButtons: ['launch', 'settings', 'news'],
      } as unknown as DockConfig;

      const result = getEffectiveActiveButtons(config);
      expect(result).toEqual(['launch', 'mod:stats', 'settings', 'news']);
    });

    it('includes module buttons registered in buttonPositions', () => {
      const config: DockConfig = {
        buttonOrder: ['launch'],
        visibleButtons: ['launch'],
        buttonPositions: {
          'mod:custom': { x: 50, y: 50 },
        },
      } as unknown as DockConfig;

      const result = getEffectiveActiveButtons(config);
      expect(result).toContain('launch');
      expect(result).toContain('mod:custom');
    });
  });

  describe('calculateDefaultButtonPositions', () => {
    it('returns empty object for empty list', () => {
      expect(calculateDefaultButtonPositions([])).toEqual({});
    });

    it('centers a single button at 50%, 50%', () => {
      const positions = calculateDefaultButtonPositions(['launch']);
      expect(positions.launch).toEqual({ x: 50, y: 50 });
    });

    it('symmetrically distributes multiple buttons', () => {
      const positions = calculateDefaultButtonPositions(['launch', 'news', 'settings']);
      expect(positions.launch.y).toBe(50);
      expect(positions.news.y).toBe(50);
      expect(positions.settings.y).toBe(50);
      // Middle button is centered
      expect(positions.news.x).toBe(50);
      expect(positions.launch.x).toBeLessThan(50);
      expect(positions.settings.x).toBeGreaterThan(50);
    });
  });

  describe('getDockHeight', () => {
    it('returns 74 for compact mode with labels', () => {
      expect(getDockHeight(true, true)).toBe(74);
    });
    it('returns 108 for standard mode with labels', () => {
      expect(getDockHeight(false, true)).toBe(108);
    });
    it('returns 52 for compact mode without labels', () => {
      expect(getDockHeight(true, false)).toBe(52);
    });
    it('returns 62 for standard mode without labels', () => {
      expect(getDockHeight(false, false)).toBe(62);
    });
  });

  describe('resolveCollisionAndClamp', () => {
    it('returns same coordinates when there is no collision', () => {
      const res = resolveCollisionAndClamp(500, 300, 100, 50, []);
      expect(res.isColliding).toBe(false);
      const expectedX = (500 / (typeof window !== 'undefined' ? window.innerWidth : 1280)) * 100;
      const expectedY = (300 / (typeof window !== 'undefined' ? window.innerHeight : 720)) * 100;
      expect(res.x).toBeCloseTo(expectedX, 0);
      expect(res.y).toBeCloseTo(expectedY, 0);
    });

    it('clamps coordinates that exceed screen boundaries', () => {
      const res = resolveCollisionAndClamp(-50, -50, 100, 50, []);
      expect(res.x).toBeGreaterThan(0);
      expect(res.y).toBeGreaterThan(0);
    });

    it('flags initial collision and separates box from obstacle', () => {
      const obstacle: Box = { id: 'obs1', x: 200, y: 200, width: 100, height: 100 };
      const res = resolveCollisionAndClamp(200, 200, 80, 80, [obstacle]);
      expect(res.isColliding).toBe(true);
      // Box should have moved away from center (200, 200)
      const resPxX = (res.x / 100) * 1280;
      const resPxY = (res.y / 100) * 720;
      const moved = Math.abs(resPxX - 200) > 10 || Math.abs(resPxY - 200) > 10;
      expect(moved).toBe(true);
    });
  });

  describe('sanitizeAllPositions', () => {
    it('sanitizes dock customCoordinates and widget positions', () => {
      const config = {
        layoutMode: 'standard',
        customCoordinates: { x: 50, y: 50 },
        widgetPositions: {
          userPill: { x: 10, y: 90 },
          socials: { x: 50, y: 90 },
          serverStatus: { x: 90, y: 90 },
        },
      } as unknown as DockConfig;

      const result = sanitizeAllPositions(config, 1280, 720);
      expect(result.customCoordinates).toBeDefined();
      expect(result.widgetPositions?.userPill).toBeDefined();
      expect(result.widgetPositions?.socials).toBeDefined();
      expect(result.widgetPositions?.serverStatus).toBeDefined();
    });

    it('sanitizes buttons in free_buttons layout mode', () => {
      const config = {
        layoutMode: 'free_buttons',
        buttonOrder: ['launch', 'settings'],
        visibleButtons: ['launch', 'settings'],
        buttonPositions: {
          launch: { x: 50, y: 50 },
          settings: { x: 50, y: 50 },
        },
      } as unknown as DockConfig;

      const result = sanitizeAllPositions(config, 1280, 720);
      expect(result.buttonPositions).toBeDefined();
      expect(result.buttonPositions?.launch).toBeDefined();
      expect(result.buttonPositions?.settings).toBeDefined();
    });

    it('does not eject bottom widgets upwards when buttons or dock exist', () => {
      const config = {
        layoutMode: 'free_buttons',
        buttonOrder: ['instances', 'about', 'accounts', 'settings', 'launch'],
        visibleButtons: ['instances', 'about', 'accounts', 'settings', 'launch'],
        buttonPositions: {
          instances: { x: 20, y: 50 },
          about: { x: 35, y: 50 },
          accounts: { x: 50, y: 50 },
          settings: { x: 65, y: 50 },
          launch: { x: 80, y: 50 },
        },
        widgetPositions: {
          userPill: { x: 8, y: 93 },
          socials: { x: 50, y: 93 },
          serverStatus: { x: 92, y: 93 },
        },
      } as unknown as DockConfig;

      const result = sanitizeAllPositions(config, 1280, 720);
      expect(result.widgetPositions.userPill.y).toBeGreaterThanOrEqual(88);
      expect(result.widgetPositions.socials.y).toBeGreaterThanOrEqual(88);
      expect(result.widgetPositions.serverStatus.y).toBeGreaterThanOrEqual(88);
    });

    it('does not include static:hudBar when evaluating obstacles for bottom widgets', () => {
      const config = { layoutMode: 'free_buttons' } as any;
      const obstacles = getActiveObstacles('widget:serverStatus', config, 1280, 720, undefined, {
        isEditing: true,
        side: 'right',
      });
      expect(obstacles.some((o) => o.id === 'static:hudBar')).toBe(false);
    });
  });

  describe('getElementDimensions', () => {
    const baseConfig: DockConfig = {
      scale: 'standard',
      showLabels: true,
      buttonOrder: ['launch'],
      visibleButtons: ['launch'],
    } as unknown as DockConfig;

    it('calculates dock dimensions', () => {
      const dims = getElementDimensions('dock', baseConfig);
      expect(dims.width).toBeGreaterThanOrEqual(280);
      expect(dims.height).toBe(108);

      const compactDims = getElementDimensions('dock', {
        ...baseConfig,
        scale: 'compact',
        showLabels: false,
      } as unknown as DockConfig);
      expect(compactDims.height).toBe(52);
    });

    it('calculates button dimensions including custom scale', () => {
      const configWithCustom: DockConfig = {
        ...baseConfig,
        buttonCustomizations: {
          launch: { scale: 1.5, customWidth: 80, customHeight: 80 },
        },
      } as unknown as DockConfig;

      const dims = getElementDimensions('btn:launch', configWithCustom);
      expect(dims.width).toBe(120);
      expect(dims.height).toBe(120);

      const compactLaunchDims = getElementDimensions('btn:launch', {
        ...baseConfig,
        scale: 'compact',
        showLabels: false,
      } as unknown as DockConfig);
      expect(compactLaunchDims.width).toBeGreaterThan(0);
      expect(compactLaunchDims.height).toBeGreaterThan(0);
    });

    it('calculates known widget dimensions and falls back for unknown', () => {
      expect(getElementDimensions('widget:userPill', baseConfig)).toEqual({ width: 175, height: 48 });
      expect(getElementDimensions('widget:socials', baseConfig)).toEqual({ width: 155, height: 48 });
      expect(getElementDimensions('widget:serverStatus', baseConfig)).toEqual({ width: 165, height: 48 });
      expect(getElementDimensions('unknown_widget', baseConfig)).toEqual({ width: 120, height: 60 });
    });
  });

  describe('getSafeYBelowHudBar', () => {
    it('calculates safe Y coordinate based on element height and window height', () => {
      const config: DockConfig = { scale: 'standard', showLabels: false } as unknown as DockConfig;
      const safeY = getSafeYBelowHudBar('dock', config, 720);
      expect(safeY).toBeGreaterThan(15);
      expect(safeY).toBeLessThan(35);
    });
  });

  describe('getEffectiveDockPosition', () => {
    it('handles top, bottom, and center presets', () => {
      const topConfig = { positionPreset: 'top', showLabels: false, scale: 'compact' } as unknown as DockConfig;
      expect(getEffectiveDockPosition(topConfig).y).toBe(14);

      const bottomConfig = { positionPreset: 'bottom' } as unknown as DockConfig;
      expect(getEffectiveDockPosition(bottomConfig).y).toBe(76);

      const centerConfig = { positionPreset: 'center' } as unknown as DockConfig;
      expect(getEffectiveDockPosition(centerConfig)).toEqual({ x: 50, y: 50 });
    });

    it('handles customCoordinates preset', () => {
      const customConfig = {
        positionPreset: 'custom',
        customCoordinates: { x: 30, y: 40 },
      } as unknown as DockConfig;
      expect(getEffectiveDockPosition(customConfig)).toEqual({ x: 30, y: 40 });
    });

    it('adjusts position if HUD editing is active at center and top overlap occurs', () => {
      const topConfig = { positionPreset: 'top', showLabels: true, scale: 'standard' } as unknown as DockConfig;
      const pos = getEffectiveDockPosition(topConfig, { isEditing: true, side: 'center' }, 720);
      expect(pos.y).toBeGreaterThanOrEqual(17);
    });
  });

  describe('Separation & Radial Search Helpers', () => {
    it('choosePrimarySeparation evalúa candidatos en X e Y', () => {
      // ambos válidos: menor distancia
      expect(choosePrimarySeparation(100, 100, 20, 50, true, true)).toEqual({ nextX: 120, nextY: 100 });
      expect(choosePrimarySeparation(100, 100, 60, 30, true, true)).toEqual({ nextX: 100, nextY: 130 });
      // solo X
      expect(choosePrimarySeparation(100, 100, 25, 50, true, false)).toEqual({ nextX: 125, nextY: 100 });
      // solo Y
      expect(choosePrimarySeparation(100, 100, 25, 40, false, true)).toEqual({ nextX: 100, nextY: 140 });
      // ninguno
      expect(choosePrimarySeparation(100, 100, 25, 40, false, false)).toBeNull();
    });

    it('chooseAlternativeSeparation busca alternativa válida dentro de márgenes', () => {
      const bounds = { padding: 14, topPadding: 64, winW: 1280, winH: 720 };
      const pushes = {
        pushLeft: -50,
        pushRight: 50,
        pushUp: -40,
        pushDown: 40,
        candX: -50,
        candY: -40,
      };

      const res = chooseAlternativeSeparation(100, 100, 30, 20, pushes, bounds);
      expect(res).toBeDefined();
      expect(typeof res.nextX).toBe('number');
      expect(typeof res.nextY).toBe('number');
    });

    it('radialSearchFreeSlot encuentra posición libre o retorna posición actual si está bloqueado', () => {
      const bounds = { padding: 14, topPadding: 64, winW: 1280, winH: 720 };
      const search = {
        curX: 500,
        curY: 300,
        halfW: 30,
        halfH: 20,
        width: 60,
        height: 40,
      };

      const result = radialSearchFreeSlot(search, [], 8, bounds);
      expect(result.foundX).toBeDefined();
      expect(result.foundY).toBeDefined();
      expect(result.isColliding).toBe(false);
    });

    it('getActiveObstacles incluye dock cuando layoutMode es dock y currentId es un widget', () => {
      const config = {
        layoutMode: 'dock',
        positionPreset: 'bottom',
      } as any;

      const obstacles = getActiveObstacles('widget:socials', config, 1280, 720);
      expect(obstacles.some((o) => o.id === 'dock')).toBe(true);
    });
  });
});

describe('random utility', () => {
  it('generates float numbers between 0 and 1', () => {
    for (let i = 0; i < 20; i++) {
      const val = secureRandom();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('generates integers within specified bounds', () => {
    for (let i = 0; i < 20; i++) {
      const val = secureRandomInt(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
      expect(Number.isInteger(val)).toBe(true);
    }
  });
});
