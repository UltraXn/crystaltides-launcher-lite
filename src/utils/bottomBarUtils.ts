import type { LauncherState } from '../store/launcherStore';
import {
  getElementDimensions,
  getEffectiveDockPosition,
} from './collisionSystem';

export function calculateEffectiveSocialsPosition(
  socPos: { x: number; y: number },
  dockConfig: LauncherState['dockConfig'],
): { x: number; y: number } {
  if (dockConfig.layoutMode !== 'dock') {
    return socPos;
  }

  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
  const socDims = getElementDimensions('widget:socials', dockConfig);
  const halfSocW = socDims.width / 2;
  const halfSocH = socDims.height / 2;
  const socCenterXPx = (socPos.x / 100) * winW;
  const socCenterYPx = (socPos.y / 100) * winH;

  const currentDockPos = getEffectiveDockPosition(dockConfig);
  const dockDims = getElementDimensions('dock', dockConfig);
  const halfDockW = dockDims.width / 2;
  const halfDockH = dockDims.height / 2;
  const dockCenterXPx = (currentDockPos.x / 100) * winW;
  const dockCenterYPx = (currentDockPos.y / 100) * winH;

  const overlapsX = Math.abs(socCenterXPx - dockCenterXPx) < halfSocW + halfDockW + 4;
  const overlapsY = Math.abs(socCenterYPx - dockCenterYPx) < halfSocH + halfDockH + 4;

  if (overlapsX && overlapsY) {
    const dockBottomPx = dockCenterYPx + halfDockH;
    const safeY = Math.min(
      96,
      Math.max(94, Math.round(((dockBottomPx + halfSocH + 8) / winH) * 100 * 10) / 10),
    );
    return { x: socPos.x, y: safeY };
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
