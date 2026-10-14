import type { DockConfig, DockButtonId, WidgetPositions } from '../store/launcherStore';

export interface Box {
  id: string;
  x: number; // center x in px
  y: number; // center y in px
  width: number;
  height: number;
}

export interface CollisionResult {
  x: number; // percentage (0..100)
  y: number; // percentage (0..100)
  isColliding: boolean;
}

export type HudPlacementSide = 'center' | 'left' | 'right';

export const DEFAULT_WIDGET_COORDS: Record<keyof WidgetPositions, { x: number; y: number }> = {
  userPill: { x: 8, y: 93 },
  socials: { x: 50, y: 93 },
  serverStatus: { x: 92, y: 93 },
};

/**
 * Returns true if box A and box B overlap factoring in safety gap in pixels.
 */
export const checkAABBOverlap = (a: Box, b: Box, gap: number = 8): boolean => {
  const aLeft = a.x - a.width / 2;
  const aRight = a.x + a.width / 2;
  const aTop = a.y - a.height / 2;
  const aBottom = a.y + a.height / 2;

  const bLeft = b.x - b.width / 2 - gap;
  const bRight = b.x + b.width / 2 + gap;
  const bTop = b.y - b.height / 2 - gap;
  const bBottom = b.y + b.height / 2 + gap;

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
};

/**
 * Resolves the complete list of active button IDs, taking into account
 * buttonOrder, visibleButtons, and any dynamically registered module buttons
 * in buttonPositions or starting with mod:.
 */
export const getEffectiveActiveButtons = (dockConfig: DockConfig): DockButtonId[] => {
  const visibleButtonsSet = new Set(dockConfig.visibleButtons ?? []);
  const result: DockButtonId[] = [];
  const seen = new Set<string>();

  const tryAdd = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id as DockButtonId);
    }
  };

  const buttonOrder = dockConfig.buttonOrder ?? [];
  for (const id of buttonOrder) {
    if (id.startsWith('mod:') || visibleButtonsSet.has(id)) {
      tryAdd(id);
    }
  }

  const visibleButtons = dockConfig.visibleButtons ?? [];
  for (const id of visibleButtons) {
    tryAdd(id);
  }

  const positionKeys = Object.keys(dockConfig.buttonPositions ?? {});
  for (const id of positionKeys) {
    if (id.startsWith('mod:') || visibleButtonsSet.has(id)) {
      tryAdd(id);
    }
  }

  return result;
};

/**
 * Computes non-overlapping default positions for a given list of buttons,
 * symmetrically centered horizontally at y: 50%.
 */
export const calculateDefaultButtonPositions = (
  buttonIds: DockButtonId[],
): Record<string, { x: number; y: number }> => {
  const total = buttonIds.length;
  const positions: Record<string, { x: number; y: number }> = {};
  if (total === 0) return positions;

  if (total === 1) {
    positions[buttonIds[0]] = { x: 50, y: 50 };
    return positions;
  }

  // Step between button centers as percentage of screen width.
  // For 5 standard buttons, total span is 48% (step 12%), yielding 26, 38, 50, 62, 74.
  // For more buttons (e.g. 7), total span is ~69% (step 11.5%), yielding 15.5, 27, 38.5, 50, 61.5, 73, 84.5.
  // Clamped so buttons stay nicely centered and within screen margins without any overlap.
  const maxSpan = Math.min(84, Math.max(48, (total - 1) * 11.5));
  const stepX = Math.round((maxSpan / (total - 1)) * 10) / 10;
  const centerIdx = (total - 1) / 2;

  buttonIds.forEach((id, idx) => {
    const xPct = Math.round((50 + (idx - centerIdx) * stepX) * 10) / 10;
    positions[id] = {
      x: Math.max(6, Math.min(94, xPct)),
      y: 50,
    };
  });

  return positions;
};

/**
 * Calculates standard dimensions for buttons and widgets based on dock configuration.
 */
const BUTTON_DIMENSION_TABLE: Record<string, { width: number; height: number }> = {
  'labels:launch:compact': { width: 114, height: 74 },
  'labels:launch:normal': { width: 152, height: 108 },
  'labels:normal:compact': { width: 96, height: 74 },
  'labels:normal:normal': { width: 136, height: 108 },
  'nolabels:launch:compact': { width: 58, height: 52 },
  'nolabels:launch:normal': { width: 68, height: 62 },
  'nolabels:normal:compact': { width: 52, height: 52 },
  'nolabels:normal:normal': { width: 62, height: 62 },
};

const getBaseButtonDimensions = (
  isLaunch: boolean,
  isCompact: boolean,
  showLabels: boolean,
): { width: number; height: number } => {
  const labelKey = showLabels ? 'labels' : 'nolabels';
  const typeKey = isLaunch ? 'launch' : 'normal';
  const sizeKey = isCompact ? 'compact' : 'normal';
  return BUTTON_DIMENSION_TABLE[`${labelKey}:${typeKey}:${sizeKey}`];
};

const getSegmentWidth = (
  btnId: DockButtonId,
  dockConfig: DockConfig,
  isCompact: boolean,
  showLabels: boolean,
): number => {
  const customW = dockConfig.buttonCustomizations?.[btnId]?.customWidth;
  if (customW) return customW;
  return getBaseButtonDimensions(btnId === 'launch', isCompact, showLabels).width;
};

export const getDockHeight = (isCompact: boolean, showLabels: boolean): number => {
  if (showLabels) {
    return isCompact ? 74 : 108;
  }
  return isCompact ? 52 : 62;
};

const calculateDockDimensions = (
  dockConfig: DockConfig,
  isCompact: boolean,
  showLabels: boolean,
): { width: number; height: number } => {
  const activeBtns = getEffectiveActiveButtons(dockConfig);
  const width = activeBtns.reduce(
    (sum, btnId) => sum + getSegmentWidth(btnId, dockConfig, isCompact, showLabels),
    8,
  );
  const height = getDockHeight(isCompact, showLabels);
  return { width: Math.max(280, width), height: Math.max(50, height) };
};

const calculateButtonDimensions = (
  btnId: DockButtonId,
  dockConfig: DockConfig,
  isCompact: boolean,
  showLabels: boolean,
): { width: number; height: number } => {
  let { width, height } = getBaseButtonDimensions(btnId === 'launch', isCompact, showLabels);
  const btnCustom = dockConfig.buttonCustomizations?.[btnId];
  if (btnCustom?.customWidth) width = btnCustom.customWidth;
  if (btnCustom?.customHeight) height = btnCustom.customHeight;
  if (btnCustom?.scale && btnCustom.scale > 0) {
    width = Math.round(width * btnCustom.scale);
    height = Math.round(height * btnCustom.scale);
  }
  return { width, height };
};

const calculateWidgetDimensions = (id: string): { width: number; height: number } | null => {
  if (id === 'widget:userPill') return { width: 175, height: 48 };
  if (id === 'widget:socials') return { width: 155, height: 48 };
  if (id === 'widget:serverStatus') return { width: 165, height: 48 };
  return null;
};

export const getElementDimensions = (
  id: string,
  dockConfig: DockConfig,
): { width: number; height: number } => {
  const isCompact = dockConfig.scale === 'compact';
  const showLabels = dockConfig.showLabels;

  if (id === 'dock') {
    return calculateDockDimensions(dockConfig, isCompact, showLabels);
  }

  if (id.startsWith('btn:')) {
    const btnId = id.replace('btn:', '') as DockButtonId;
    return calculateButtonDimensions(btnId, dockConfig, isCompact, showLabels);
  }

  const widgetDims = calculateWidgetDimensions(id);
  if (widgetDims) {
    return widgetDims;
  }

  return { width: 120, height: 60 };
};

/**
 * Calculates the safe Y percentage coordinate for an element to sit cleanly below
 * the HUD edit bar when it is positioned at the top center.
 */
export const getSafeYBelowHudBar = (
  elementId: string,
  dockConfig: DockConfig,
  winH: number = typeof window !== 'undefined' ? window.innerHeight : 720,
): number => {
  const dims = getElementDimensions(elementId, dockConfig);
  // HUD Edit Bar bottom is ~103px + 12px clearance gap = 115px
  const safePxY = 115 + dims.height / 2;
  return Math.round((safePxY / winH) * 100 * 10) / 10;
};

/**
 * Returns the effective screen coordinates for the dock, taking into account
 * presets and custom coordinates without collision overlap.
 * If HUD editing is active and the HUD bar is at center, automatically lowers
 * the dock so it never collides or overlaps underneath.
 */
export const getEffectiveDockPosition = (
  dockConfig: DockConfig,
  hudContext?: { isEditing: boolean; side: HudPlacementSide },
  winH: number = typeof window !== 'undefined' ? window.innerHeight : 720,
): { x: number; y: number } => {
  let pos = { x: 50, y: 50 };

  if (dockConfig.positionPreset === 'top') {
    const isCompact = dockConfig.scale === 'compact';
    const showLabels = dockConfig.showLabels;
    pos = { x: 50, y: showLabels && !isCompact ? 17 : 14 };
  } else if (dockConfig.positionPreset === 'bottom') {
    pos = { x: 50, y: 76 };
  } else if (dockConfig.positionPreset === 'center') {
    pos = { x: 50, y: 50 };
  } else if (dockConfig.customCoordinates) {
    pos = dockConfig.customCoordinates;
  }

  // If HUD edit bar is active and at top center, auto-lower dock below it!
  if (hudContext?.isEditing && hudContext.side === 'center') {
    const safeY = getSafeYBelowHudBar('dock', dockConfig, winH);
    if (pos.y < safeY && pos.x > 15 && pos.x < 85) {
      return { x: pos.x, y: safeY };
    }
  }

  return pos;
};

/**
 * Returns the effective screen placement of the HUD edit bar ('center' | 'left' | 'right')
 * based on manual override and dock positions.
 */
export const getEffectiveHudSide = (
  dockConfig: DockConfig,
  manualSide: 'auto' | HudPlacementSide = 'auto',
): HudPlacementSide => {
  if (manualSide !== 'auto') return manualSide;

  if (dockConfig.layoutMode === 'dock') {
    if (dockConfig.positionPreset === 'top') return 'right';
    const coords = dockConfig.customCoordinates;
    if (coords && coords.y < 35 && coords.x > 20 && coords.x < 80) {
      return coords.x <= 50 ? 'right' : 'left';
    }
  } else {
    const positions = Object.values(dockConfig.buttonPositions || {});
    const hasTopCenter = positions.some((pos) => pos && pos.y < 35 && pos.x > 20 && pos.x < 80);
    if (hasTopCenter) return 'right';
  }

  return 'center';
};

/**
 * Returns all active obstacles in the scene, excluding current dragging item.
 */
const getStaticWindowObstacles = (
  winW: number,
  winH: number,
  hudContext?: { isEditing: boolean; side: HudPlacementSide },
): Box[] => {
  const obstacles: Box[] = [
    {
      id: 'static:branding',
      x: 160,
      y: 28,
      width: 320,
      height: 56,
    },
    {
      id: 'static:winControls',
      x: winW - 70,
      y: 28,
      width: 140,
      height: 56,
    },
  ];

  if (hudContext?.isEditing) {
    if (hudContext.side === 'right') {
      obstacles.push({
        id: 'static:hudBar',
        x: winW - 122,
        y: winH / 2,
        width: 216,
        height: Math.min(winH - 32, 780),
      });
    } else if (hudContext.side === 'left') {
      obstacles.push({
        id: 'static:hudBar',
        x: 122,
        y: winH / 2,
        width: 216,
        height: Math.min(winH - 32, 780),
      });
    } else {
      obstacles.push({
        id: 'static:hudBar',
        x: winW / 2,
        y: 74,
        width: Math.min(winW - 60, 760),
        height: 58,
      });
    }
  }

  return obstacles;
};

const getWidgetObstacles = (
  currentId: string,
  dockConfig: DockConfig,
  winW: number,
  winH: number,
  currentOverrides?: Record<string, { x: number; y: number }>,
): Box[] => {
  const obstacles: Box[] = [];
  const widgets: (keyof WidgetPositions)[] = ['userPill', 'socials', 'serverStatus'];
  for (const wKey of widgets) {
    const boxId = `widget:${wKey}`;
    if (boxId === currentId) continue;

    const defaultPos = DEFAULT_WIDGET_COORDS[wKey];

    const pos = currentOverrides?.[boxId] || dockConfig.widgetPositions?.[wKey] || defaultPos;
    const dims = getElementDimensions(boxId, dockConfig);

    obstacles.push({
      id: boxId,
      x: (pos.x / 100) * winW,
      y: (pos.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }
  return obstacles;
};

const getButtonObstacles = (
  currentId: string,
  dockConfig: DockConfig,
  winW: number,
  winH: number,
  currentOverrides?: Record<string, { x: number; y: number }>,
): Box[] => {
  const obstacles: Box[] = [];
  const activeButtons = getEffectiveActiveButtons(dockConfig);
  for (const btnId of activeButtons) {
    const boxId = `btn:${btnId}`;
    if (boxId === currentId) continue;

    const pos = currentOverrides?.[boxId] ||
      dockConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };
    const dims = getElementDimensions(boxId, dockConfig);

    obstacles.push({
      id: boxId,
      x: (pos.x / 100) * winW,
      y: (pos.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }
  return obstacles;
};

export const getActiveObstacles = (
  currentId: string,
  dockConfig: DockConfig,
  winW: number,
  winH: number,
  currentOverrides?: Record<string, { x: number; y: number }>,
  hudContext?: { isEditing: boolean; side: HudPlacementSide },
): Box[] => {
  const obstacles: Box[] = getStaticWindowObstacles(winW, winH, hudContext);

  if (dockConfig.layoutMode === 'dock') {
    if (currentId !== 'dock') {
      const pos = currentOverrides?.['dock'] || getEffectiveDockPosition(dockConfig);
      const dims = getElementDimensions('dock', dockConfig);
      obstacles.push({
        id: 'dock',
        x: (pos.x / 100) * winW,
        y: (pos.y / 100) * winH,
        width: dims.width,
        height: dims.height,
      });
    }
  } else {
    obstacles.push(...getButtonObstacles(currentId, dockConfig, winW, winH, currentOverrides));
  }

  obstacles.push(...getWidgetObstacles(currentId, dockConfig, winW, winH, currentOverrides));

  return obstacles;
};

/**
 * Resolves collisions against all obstacles and clamps within viewport boundaries.
 * Prevents any stacking or overlap between GUI elements.
 */
export const choosePrimarySeparation = (
  curX: number,
  curY: number,
  candX: number,
  candY: number,
  canUseX: boolean,
  canUseY: boolean,
): { nextX: number; nextY: number } | null => {
  if (canUseX && canUseY) {
    return Math.abs(candX) <= Math.abs(candY)
      ? { nextX: curX + candX, nextY: curY }
      : { nextX: curX, nextY: curY + candY };
  }
  if (canUseX) {
    return { nextX: curX + candX, nextY: curY };
  }
  if (canUseY) {
    return { nextX: curX, nextY: curY + candY };
  }
  return null;
};

interface BoundaryConstraints {
  padding: number;
  topPadding: number;
  winW: number;
  winH: number;
}

interface PushCandidates {
  pushLeft: number;
  pushRight: number;
  pushUp: number;
  pushDown: number;
  candX: number;
  candY: number;
}

export const chooseAlternativeSeparation = (
  curX: number,
  curY: number,
  halfW: number,
  halfH: number,
  pushes: PushCandidates,
  bounds: BoundaryConstraints,
): { nextX: number; nextY: number } => {
  const altX = pushes.candX === pushes.pushLeft ? pushes.pushRight : pushes.pushLeft;
  const altY = pushes.candY === pushes.pushUp ? pushes.pushDown : pushes.pushUp;
  if (curX + altX - halfW >= bounds.padding && curX + altX + halfW <= bounds.winW - bounds.padding) {
    return { nextX: curX + altX, nextY: curY };
  }
  if (curY + altY - halfH >= bounds.topPadding && curY + altY + halfH <= bounds.winH - bounds.padding) {
    return { nextX: curX, nextY: curY + altY };
  }
  return { nextX: curX, nextY: curY };
};

interface SeparationPos {
  curX: number;
  curY: number;
  halfW: number;
  halfH: number;
}

const separateAgainstObstacle = (
  pos: SeparationPos,
  obs: Box,
  gap: number,
  bounds: BoundaryConstraints,
): { nextX: number; nextY: number } => {
  const { curX, curY, halfW, halfH } = pos;
  const aLeft = curX - halfW;
  const aRight = curX + halfW;
  const aTop = curY - halfH;
  const aBottom = curY + halfH;

  const bLeft = obs.x - obs.width / 2 - gap;
  const bRight = obs.x + obs.width / 2 + gap;
  const bTop = obs.y - obs.height / 2 - gap;
  const bBottom = obs.y + obs.height / 2 + gap;

  const pushLeft = bLeft - aRight;
  const pushRight = bRight - aLeft;
  const pushUp = bTop - aBottom;
  const pushDown = bBottom - aTop;

  const candX = curX < obs.x ? pushLeft : pushRight;
  const candY = curY < obs.y ? pushUp : pushDown;

  const canUseX = curX + candX - halfW >= bounds.padding && curX + candX + halfW <= bounds.winW - bounds.padding;
  const canUseY = curY + candY - halfH >= bounds.topPadding && curY + candY + halfH <= bounds.winH - bounds.padding;

  const primary = choosePrimarySeparation(curX, curY, candX, candY, canUseX, canUseY);
  if (primary) return primary;

  return chooseAlternativeSeparation(
    curX,
    curY,
    halfW,
    halfH,
    { pushLeft, pushRight, pushUp, pushDown, candX, candY },
    bounds,
  );
};

interface RadialSearchParams {
  curX: number;
  curY: number;
  halfW: number;
  halfH: number;
  width: number;
  height: number;
}

export const radialSearchFreeSlot = (
  search: RadialSearchParams,
  obstacles: Box[],
  gap: number,
  bounds: BoundaryConstraints,
): { foundX: number; foundY: number; isColliding: boolean } => {
  const { curX, curY, halfW, halfH, width, height } = search;
  const step = 14;
  for (let r = step; r <= 420; r += step) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const testX = Math.round(curX + Math.cos(angle) * r);
      const testY = Math.round(curY + Math.sin(angle) * r);

      if (testX - halfW < bounds.padding || testX + halfW > bounds.winW - bounds.padding) continue;
      if (testY - halfH < bounds.topPadding || testY + halfH > bounds.winH - bounds.padding) continue;

      const testBox: Box = {
        id: 'test',
        x: testX,
        y: testY,
        width,
        height,
      };
      if (!obstacles.some((obs) => checkAABBOverlap(testBox, obs, gap))) {
        return { foundX: testX, foundY: testY, isColliding: false };
      }
    }
  }
  return { foundX: curX, foundY: curY, isColliding: true };
};

export interface CollisionOptions {
  padding?: number;
  topPadding?: number;
  gap?: number;
}

export const resolveCollisionAndClamp = (
  proposedPxX: number,
  proposedPxY: number,
  elementWidth: number,
  elementHeight: number,
  obstacles: Box[],
  options?: CollisionOptions,
): CollisionResult => {
  const padding = options?.padding ?? 14;
  const topPadding = options?.topPadding ?? 64;
  const gap = options?.gap ?? 10;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

  const halfW = elementWidth / 2;
  const halfH = elementHeight / 2;

  const minX = halfW + padding;
  const maxX = Math.max(minX, winW - halfW - padding);
  const minY = halfH + topPadding;
  const maxY = Math.max(minY, winH - halfH - padding);

  let curX = Math.max(minX, Math.min(maxX, proposedPxX));
  let curY = Math.max(minY, Math.min(maxY, proposedPxY));

  const initialBox: Box = {
    id: 'temp',
    x: curX,
    y: curY,
    width: elementWidth,
    height: elementHeight,
  };
  const hasInitialCollision = obstacles.some((obs) => checkAABBOverlap(initialBox, obs, gap));

  if (!hasInitialCollision) {
    return {
      x: Math.round((curX / winW) * 100 * 10) / 10,
      y: Math.round((curY / winH) * 100 * 10) / 10,
      isColliding: false,
    };
  }

  let isStillColliding = true;
  const bounds: BoundaryConstraints = { padding, topPadding, winW, winH };

  for (let iter = 0; iter < 6; iter++) {
    let anyCollisionInPass = false;

    for (const obs of obstacles) {
      const currentBox: Box = {
        id: 'temp',
        x: curX,
        y: curY,
        width: elementWidth,
        height: elementHeight,
      };
      if (!checkAABBOverlap(currentBox, obs, gap)) continue;

      anyCollisionInPass = true;
      const separated = separateAgainstObstacle(
        { curX, curY, halfW, halfH },
        obs,
        gap,
        bounds,
      );
      curX = Math.max(minX, Math.min(maxX, separated.nextX));
      curY = Math.max(minY, Math.min(maxY, separated.nextY));
    }

    if (!anyCollisionInPass) {
      isStillColliding = false;
      break;
    }
  }

  if (isStillColliding) {
    const radial = radialSearchFreeSlot(
      { curX, curY, halfW, halfH, width: elementWidth, height: elementHeight },
      obstacles,
      gap,
      bounds,
    );
    curX = radial.foundX;
    curY = radial.foundY;
  }

  return {
    x: Math.round((curX / winW) * 100 * 10) / 10,
    y: Math.round((curY / winH) * 100 * 10) / 10,
    isColliding: hasInitialCollision,
  };
};

const sanitizeButtonsLayout = (
  newConfig: DockConfig,
  placedBoxes: Box[],
  winW: number,
  winH: number,
): void => {
  const activeButtons = getEffectiveActiveButtons(newConfig);
  if (!newConfig.buttonPositions) {
    newConfig.buttonPositions = {};
  }

  for (const btnId of activeButtons) {
    const boxId = `btn:${btnId}`;
    const pos = newConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };
    const dims = getElementDimensions(boxId, newConfig);

    const pxX = (pos.x / 100) * winW;
    const pxY = (pos.y / 100) * winH;

    const resolved = resolveCollisionAndClamp(
      pxX,
      pxY,
      dims.width,
      dims.height,
      placedBoxes,
    );

    newConfig.buttonPositions[btnId] = { x: resolved.x, y: resolved.y };

    placedBoxes.push({
      id: boxId,
      x: (resolved.x / 100) * winW,
      y: (resolved.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }
};

const sanitizeWidgetsLayout = (
  newConfig: DockConfig,
  placedBoxes: Box[],
  winW: number,
  winH: number,
): void => {
  const widgetKeys: (keyof WidgetPositions)[] = ['userPill', 'socials', 'serverStatus'];
  for (const wKey of widgetKeys) {
    const boxId = `widget:${wKey}`;
    const defaultPos = DEFAULT_WIDGET_COORDS[wKey];

    const pos = newConfig.widgetPositions?.[wKey] || defaultPos;
    const dims = getElementDimensions(boxId, newConfig);

    const pxX = (pos.x / 100) * winW;
    const pxY = (pos.y / 100) * winH;

    const resolved = resolveCollisionAndClamp(
      pxX,
      pxY,
      dims.width,
      dims.height,
      placedBoxes,
    );

    if (!newConfig.widgetPositions) {
      newConfig.widgetPositions = {
        userPill: { x: 8, y: 93 },
        socials: { x: 50, y: 93 },
        serverStatus: { x: 92, y: 93 },
      };
    }
    newConfig.widgetPositions[wKey] = { x: resolved.x, y: resolved.y };

    placedBoxes.push({
      id: boxId,
      x: (resolved.x / 100) * winW,
      y: (resolved.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }
};

export const sanitizeAllPositions = (
  config: DockConfig,
  winW: number = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280,
  winH: number = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 720,
): DockConfig => {
  const newConfig: DockConfig = structuredClone(config);
  const placedBoxes: Box[] = [
    { id: 'static:branding', x: 160, y: 28, width: 320, height: 56 },
    { id: 'static:winControls', x: winW - 70, y: 28, width: 140, height: 56 },
    { id: 'static:topBar', x: winW / 2, y: 72, width: Math.min(winW - 100, 560), height: 52 },
  ];

  if (newConfig.layoutMode === 'free_buttons') {
    sanitizeButtonsLayout(newConfig, placedBoxes, winW, winH);
  } else if (newConfig.customCoordinates) {
    const dims = getElementDimensions('dock', newConfig);
    const pxX = (newConfig.customCoordinates.x / 100) * winW;
    const pxY = (newConfig.customCoordinates.y / 100) * winH;

    const resolved = resolveCollisionAndClamp(
      pxX,
      pxY,
      dims.width,
      dims.height,
      placedBoxes,
    );

    newConfig.customCoordinates = { x: resolved.x, y: resolved.y };

    placedBoxes.push({
      id: 'dock',
      x: (resolved.x / 100) * winW,
      y: (resolved.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }

  sanitizeWidgetsLayout(newConfig, placedBoxes, winW, winH);

  return newConfig;
};
