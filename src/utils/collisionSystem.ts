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
 * Calculates standard dimensions for buttons and widgets based on dock configuration.
 */
export const getElementDimensions = (
  id: string,
  dockConfig: DockConfig,
): { width: number; height: number } => {
  const isCompact = dockConfig.scale === 'compact';
  const showLabels = dockConfig.showLabels;

  if (id === 'dock') {
    const visibleCount = dockConfig.visibleButtons.length;
    const baseWidth = isCompact ? 96 : 136;
    const launchWidth = isCompact ? 114 : 152;
    const noLabelWidth = isCompact ? 52 : 62;
    const noLabelLaunch = isCompact ? 58 : 68;

    const width = showLabels
      ? (visibleCount - 1) * baseWidth + launchWidth + 8
      : (visibleCount - 1) * noLabelWidth + noLabelLaunch + 8;
    const height = showLabels ? (isCompact ? 74 : 108) : isCompact ? 52 : 62;
    return { width: Math.max(280, width), height: Math.max(50, height) };
  }

  if (id.startsWith('btn:')) {
    const btnId = id.replace('btn:', '') as DockButtonId;
    const isLaunch = btnId === 'launch';

    let width = isCompact ? 96 : 136;
    let height = isCompact ? 74 : 108;

    if (isLaunch) {
      width = isCompact ? 114 : 152;
    }

    if (!showLabels) {
      width = isCompact ? 52 : 62;
      height = isCompact ? 52 : 62;
      if (isLaunch) {
        width = isCompact ? 58 : 68;
      }
    }

    return { width, height };
  }

  if (id === 'widget:userPill') {
    return { width: 175, height: 48 };
  }
  if (id === 'widget:socials') {
    return { width: 155, height: 48 };
  }
  if (id === 'widget:serverStatus') {
    return { width: 165, height: 48 };
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
  hudContext?: { isEditing: boolean; side: 'center' | 'left' | 'right' },
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
  manualSide: 'auto' | 'left' | 'center' | 'right' = 'auto',
): 'center' | 'left' | 'right' => {
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
export const getActiveObstacles = (
  currentId: string,
  dockConfig: DockConfig,
  winW: number,
  winH: number,
  currentOverrides?: Record<string, { x: number; y: number }>,
  hudContext?: { isEditing: boolean; side: 'center' | 'left' | 'right' },
): Box[] => {
  const obstacles: Box[] = [];

  // Top window branding zone (top left: Logo + CrystalTidesSMP Launcher + LITE badge)
  obstacles.push({
    id: 'static:branding',
    x: 160,
    y: 28,
    width: 320,
    height: 56,
  });

  // Top window controls zone (top right: min, max, close)
  obstacles.push({
    id: 'static:winControls',
    x: winW - 70,
    y: 28,
    width: 140,
    height: 56,
  });

  // Dynamic HUD Edit Bar obstacle: ONLY exists when editing HUD!
  // Dynamically places the obstacle boundary exactly where the GUI moved (top, left, or right)
  if (hudContext?.isEditing) {
    if (hudContext.side === 'right') {
      obstacles.push({
        id: 'static:hudBar',
        x: winW - 117,
        y: winH / 2,
        width: 196,
        height: 380,
      });
    } else if (hudContext.side === 'left') {
      obstacles.push({
        id: 'static:hudBar',
        x: 117,
        y: winH / 2,
        width: 196,
        height: 380,
      });
    } else {
      // 'center' (top horizontal toolbar)
      obstacles.push({
        id: 'static:hudBar',
        x: winW / 2,
        y: 74,
        width: Math.min(winW - 60, 760),
        height: 58,
      });
    }
  }

  // 1. Unified Dock obstacle (if in dock layout mode)
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
    // 2. Individual buttons (if in free_buttons mode)
    const visibleButtonsSet = new Set(dockConfig.visibleButtons);
    const activeButtons = dockConfig.buttonOrder.filter((id) =>
      visibleButtonsSet.has(id),
    );

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
  }

  // 3. Bottom Widgets
  const widgets: (keyof WidgetPositions)[] = ['userPill', 'socials', 'serverStatus'];
  for (const wKey of widgets) {
    const boxId = `widget:${wKey}`;
    if (boxId === currentId) continue;

    const defaultPos =
      wKey === 'userPill'
        ? { x: 8, y: 93 }
        : wKey === 'socials'
          ? { x: 50, y: 93 }
          : { x: 92, y: 93 };

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

/**
 * Resolves collisions against all obstacles and clamps within viewport boundaries.
 * Prevents any stacking or overlap between GUI elements.
 */
export const resolveCollisionAndClamp = (
  proposedPxX: number,
  proposedPxY: number,
  elementWidth: number,
  elementHeight: number,
  obstacles: Box[],
  padding: number = 14,
  topPadding: number = 64,
  gap: number = 10,
): CollisionResult => {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

  const halfW = elementWidth / 2;
  const halfH = elementHeight / 2;

  // Viewport bounds
  const minX = halfW + padding;
  const maxX = Math.max(minX, winW - halfW - padding);
  const minY = halfH + topPadding;
  const maxY = Math.max(minY, winH - halfH - padding);

  let curX = Math.max(minX, Math.min(maxX, proposedPxX));
  let curY = Math.max(minY, Math.min(maxY, proposedPxY));

  // Check if initial clamped position collides
  const initialBox: Box = {
    id: 'temp',
    x: curX,
    y: curY,
    width: elementWidth,
    height: elementHeight,
  };
  const hasInitialCollision = obstacles.some((obs) => checkAABBOverlap(initialBox, obs, gap));

  if (!hasInitialCollision) {
    const xPct = Math.round((curX / winW) * 100 * 10) / 10;
    const yPct = Math.round((curY / winH) * 100 * 10) / 10;
    return { x: xPct, y: yPct, isColliding: false };
  }

  // Iterative AABB separation (push along minimum penetration axis)
  let isStillColliding = true;

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

      const aLeft = curX - halfW;
      const aRight = curX + halfW;
      const aTop = curY - halfH;
      const aBottom = curY + halfH;

      const bLeft = obs.x - obs.width / 2 - gap;
      const bRight = obs.x + obs.width / 2 + gap;
      const bTop = obs.y - obs.height / 2 - gap;
      const bBottom = obs.y + obs.height / 2 + gap;

      const pushLeft = bLeft - aRight; // negative
      const pushRight = bRight - aLeft; // positive
      const pushUp = bTop - aBottom; // negative
      const pushDown = bBottom - aTop; // positive

      const candX = curX < obs.x ? pushLeft : pushRight;
      const candY = curY < obs.y ? pushUp : pushDown;

      const canUseX = curX + candX - halfW >= padding && curX + candX + halfW <= winW - padding;
      const canUseY = curY + candY - halfH >= topPadding && curY + candY + halfH <= winH - padding;

      if (canUseX && canUseY) {
        if (Math.abs(candX) <= Math.abs(candY)) {
          curX += candX;
        } else {
          curY += candY;
        }
      } else if (canUseX) {
        curX += candX;
      } else if (canUseY) {
        curY += candY;
      } else {
        const altX = candX === pushLeft ? pushRight : pushLeft;
        const altY = candY === pushUp ? pushDown : pushUp;
        if (curX + altX - halfW >= padding && curX + altX + halfW <= winW - padding) {
          curX += altX;
        } else if (curY + altY - halfH >= topPadding && curY + altY + halfH <= winH - padding) {
          curY += altY;
        }
      }

      // Re-clamp to screen borders
      curX = Math.max(minX, Math.min(maxX, curX));
      curY = Math.max(minY, Math.min(maxY, curY));
    }

    if (!anyCollisionInPass) {
      isStillColliding = false;
      break;
    }
  }

  // If still colliding after physics relaxation, perform radial search to find nearest free slot
  if (isStillColliding) {
    const step = 14;
    let foundX = curX;
    let foundY = curY;

    outerSearch: for (let r = step; r <= 420; r += step) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const testX = Math.round(curX + Math.cos(angle) * r);
        const testY = Math.round(curY + Math.sin(angle) * r);

        if (testX - halfW < padding || testX + halfW > winW - padding) continue;
        if (testY - halfH < topPadding || testY + halfH > winH - padding) continue;

        const testBox: Box = {
          id: 'test',
          x: testX,
          y: testY,
          width: elementWidth,
          height: elementHeight,
        };
        const hasCollision = obstacles.some((obs) => checkAABBOverlap(testBox, obs, gap));

        if (!hasCollision) {
          foundX = testX;
          foundY = testY;
          isStillColliding = false;
          break outerSearch;
        }
      }
    }

    curX = foundX;
    curY = foundY;
  }

  const finalXPct = Math.round((curX / winW) * 100 * 10) / 10;
  const finalYPct = Math.round((curY / winH) * 100 * 10) / 10;

  return {
    x: finalXPct,
    y: finalYPct,
    isColliding: hasInitialCollision,
  };
};

/**
 * Sanitizes all button and widget positions in dockConfig.
 * If any pair of elements are currently stacked or overlapping, pushes them apart.
 */
export const sanitizeAllPositions = (
  config: DockConfig,
  winW: number = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280,
  winH: number = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 720,
): DockConfig => {
  const newConfig: DockConfig = structuredClone(config);
  const placedBoxes: Box[] = [];

  // Top window branding zone (top left: Logo + CrystalTidesSMP Launcher + LITE badge)
  placedBoxes.push({
    id: 'static:branding',
    x: 160,
    y: 28,
    width: 320,
    height: 56,
  });

  // Top window controls zone (top right: min, max, close)
  placedBoxes.push({
    id: 'static:winControls',
    x: winW - 70,
    y: 28,
    width: 140,
    height: 56,
  });

  // Top bar obstacle
  placedBoxes.push({
    id: 'static:topBar',
    x: winW / 2,
    y: 72,
    width: Math.min(winW - 100, 560),
    height: 52,
  });

  // 1. Process dock or buttons
  if (newConfig.layoutMode === 'free_buttons') {
    const visibleButtonsSet = new Set(newConfig.visibleButtons);
    const activeButtons = newConfig.buttonOrder.filter((id) =>
      visibleButtonsSet.has(id),
    );

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
        14,
        64,
        10,
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
      14,
      64,
      10,
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

  // 2. Process widgets
  const widgetKeys: (keyof WidgetPositions)[] = ['userPill', 'socials', 'serverStatus'];
  for (const wKey of widgetKeys) {
    const boxId = `widget:${wKey}`;
    const defaultPos =
      wKey === 'userPill'
        ? { x: 8, y: 93 }
        : wKey === 'socials'
          ? { x: 50, y: 93 }
          : { x: 92, y: 93 };

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
      14,
      64,
      10,
    );

    newConfig.widgetPositions[wKey] = { x: resolved.x, y: resolved.y };

    placedBoxes.push({
      id: boxId,
      x: (resolved.x / 100) * winW,
      y: (resolved.y / 100) * winH,
      width: dims.width,
      height: dims.height,
    });
  }

  return newConfig;
};
