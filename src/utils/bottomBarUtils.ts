import type { LauncherState } from '../store/launcherStore';
import {
  getElementDimensions,
  getEffectiveDockPosition,
  getEffectiveActiveButtons,
} from './collisionSystem';

export function calculateEffectiveSocialsPosition(
  socPos: { x: number; y: number },
  dockConfig: LauncherState['dockConfig'],
): { x: number; y: number } {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
  const socDims = getElementDimensions('widget:socials', dockConfig);
  const halfSocH = socDims.height / 2;
  const socTopPx = (socPos.y / 100) * winH - halfSocH;
  const socCenterXPx = (socPos.x / 100) * winW;

  if (dockConfig.layoutMode === 'dock') {
    const currentDockPos = getEffectiveDockPosition(dockConfig);
    const dockDims = getElementDimensions('dock', dockConfig);
    const dockBottomPx = (currentDockPos.y / 100) * winH + dockDims.height / 2;
    const dockLeftPx = (currentDockPos.x / 100) * winW - dockDims.width / 2;
    const dockRightPx = (currentDockPos.x / 100) * winW + dockDims.width / 2;

    if (dockBottomPx > socTopPx - 4 && socCenterXPx >= dockLeftPx && socCenterXPx <= dockRightPx) {
      const safeY = Math.min(
        96,
        Math.max(94, Math.round(((dockBottomPx + halfSocH + 10) / winH) * 100 * 10) / 10),
      );
      return { x: socPos.x, y: safeY };
    }
  } else {
    const activeButtons = getEffectiveActiveButtons(dockConfig);
    for (const btnId of activeButtons) {
      const bPos = dockConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };
      const bDims = getElementDimensions(`btn:${btnId}`, dockConfig);
      const bBottomPx = (bPos.y / 100) * winH + bDims.height / 2;
      const bLeftPx = (bPos.x / 100) * winW - bDims.width / 2;
      const bRightPx = (bPos.x / 100) * winW + bDims.width / 2;

      if (bBottomPx > socTopPx - 4 && socCenterXPx >= bLeftPx && socCenterXPx <= bRightPx) {
        return { x: socPos.x, y: 96 };
      }
    }
  }
  return socPos;
}

export function getWidgetCursor(isEditingHud: boolean, isDragging: boolean): string {
  if (!isEditingHud) return 'default';
  return isDragging ? 'grabbing' : 'grab';
}

export function getWidgetOutline(
  isEditingHud: boolean,
  isDragging: boolean,
  isColliding: boolean,
): string {
  if (!isEditingHud) return 'none';
  if (isDragging && isColliding) {
    return '1.5px dashed rgba(248, 113, 113, 0.85)';
  }
  return '1.5px dashed rgba(255, 255, 255, 0.28)';
}
