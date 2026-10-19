import { useState, useRef, useEffect } from 'react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  DockButtonId,
} from '../store/launcherStore';
import {
  getElementDimensions,
  getActiveObstacles,
  resolveCollisionAndClamp,
  HudPlacementSide,
} from '../utils/collisionSystem';
import { getSegmentLimits } from '../utils/homeDockUtils';
import type { DraggingTargetId, ResizeState, ResizeDirection } from '../components/HomeDock';

export interface UseDockDragOptions {
  dockConfig: LauncherState['dockConfig'];
  effectiveHudSide: HudPlacementSide;
  isEditingHud: boolean;
  dockRef: React.RefObject<HTMLDivElement | null>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
}

export function useDockDrag({
  dockConfig,
  effectiveHudSide,
  isEditingHud,
  dockRef,
  buttonRefs,
}: UseDockDragOptions) {
  const [draggingTarget, setDraggingTarget] = useState<DraggingTargetId>(null);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    hasMoved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!draggingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dist = Math.hypot(
        e.clientX - dragStartRef.current.clientX,
        e.clientY - dragStartRef.current.clientY,
      );

      if (!dragStartRef.current.hasMoved && dist < 5) {
        return;
      }
      dragStartRef.current.hasMoved = true;

      const currentBoxId = draggingTarget === 'dock' ? 'dock' : `btn:${draggingTarget}`;
      let dims = getElementDimensions(currentBoxId, dockConfig);

      if (draggingTarget === 'dock' && dockRef.current) {
        const rect = dockRef.current.getBoundingClientRect();
        dims = { width: rect.width, height: rect.height };
      } else if (draggingTarget !== 'dock' && buttonRefs.current[draggingTarget]) {
        const rect = buttonRefs.current[draggingTarget].getBoundingClientRect();
        dims = { width: rect.width, height: rect.height };
      }

      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const obstacles = getActiveObstacles(currentBoxId, dockConfig, winW, winH, undefined, {
        isEditing: isEditingHud,
        side: effectiveHudSide,
      });

      const proposedCenterPxX = e.clientX - dragStartRef.current.grabOffsetX;
      const proposedCenterPxY = e.clientY - dragStartRef.current.grabOffsetY;

      const resolved = resolveCollisionAndClamp(
        proposedCenterPxX,
        proposedCenterPxY,
        dims.width,
        dims.height,
        obstacles,
        { winW, winH },
      );

      setTempPos({ x: resolved.x, y: resolved.y });
      setIsColliding(resolved.isColliding);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dragInfo = dragStartRef.current;
      dragStartRef.current = null;

      if (!dragInfo?.hasMoved) {
        if (isEditingHud && draggingTarget && draggingTarget !== 'dock') {
          const isInspectorOpen = useLauncherStore.getState().isButtonInspectorOpen;
          launcherActions.setSelectedDockButtonId(draggingTarget, isInspectorOpen);
        }
        setDraggingTarget(null);
        setTempPos(null);
        setIsColliding(false);
        return;
      }

      const currentBoxId = draggingTarget === 'dock' ? 'dock' : `btn:${draggingTarget}`;
      let dims = getElementDimensions(currentBoxId, dockConfig);

      if (draggingTarget === 'dock' && dockRef.current) {
        dims = {
          width: dockRef.current.getBoundingClientRect().width,
          height: dockRef.current.getBoundingClientRect().height,
        };
      } else if (draggingTarget !== 'dock' && buttonRefs.current[draggingTarget]) {
        dims = {
          width: buttonRefs.current[draggingTarget].getBoundingClientRect().width,
          height: buttonRefs.current[draggingTarget].getBoundingClientRect().height,
        };
      }

      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const obstacles = getActiveObstacles(currentBoxId, dockConfig, winW, winH, undefined, {
        isEditing: isEditingHud,
        side: effectiveHudSide,
      });

      const proposedCenterPxX = e.clientX - dragInfo.grabOffsetX;
      const proposedCenterPxY = e.clientY - dragInfo.grabOffsetY;

      const resolved = resolveCollisionAndClamp(
        proposedCenterPxX,
        proposedCenterPxY,
        dims.width,
        dims.height,
        obstacles,
        { winW, winH },
      );

      if (draggingTarget === 'dock') {
        launcherActions.setDockConfig({
          positionPreset: 'free',
          customCoordinates: { x: resolved.x, y: resolved.y },
        });
      } else {
        launcherActions.setButtonPosition(draggingTarget, { x: resolved.x, y: resolved.y });
      }

      justDraggedRef.current = true;
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = setTimeout(() => {
        justDraggedRef.current = false;
      }, 100);

      setDraggingTarget(null);
      setTempPos(null);
      setIsColliding(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [draggingTarget, dockConfig, isEditingHud, effectiveHudSide, buttonRefs, dockRef]);

  const onStartDockDrag = (e: React.MouseEvent) => {
    if (!isEditingHud) return;
    e.preventDefault();
    const dockBox = dockRef.current?.getBoundingClientRect();
    const centerX = dockBox ? dockBox.left + dockBox.width / 2 : e.clientX;
    const centerY = dockBox ? dockBox.top + dockBox.height / 2 : e.clientY;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      grabOffsetX: e.clientX - centerX,
      grabOffsetY: e.clientY - centerY,
      hasMoved: false,
    };
    setDraggingTarget('dock');
  };

  const onStartButtonDrag = (e: React.MouseEvent, btnId: DockButtonId) => {
    if (!isEditingHud) return;
    e.preventDefault();
    const btnBox = buttonRefs.current[btnId]?.getBoundingClientRect();
    const centerX = btnBox ? btnBox.left + btnBox.width / 2 : e.clientX;
    const centerY = btnBox ? btnBox.top + btnBox.height / 2 : e.clientY;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      grabOffsetX: e.clientX - centerX,
      grabOffsetY: e.clientY - centerY,
      hasMoved: false,
    };
    setDraggingTarget(btnId);
  };

  return {
    draggingTarget,
    setDraggingTarget,
    tempPos,
    isColliding,
    justDraggedRef,
    onStartDockDrag,
    onStartButtonDrag,
  };
}

export interface UseDockResizeOptions {
  dockConfig: LauncherState['dockConfig'];
  activeButtons: DockButtonId[];
  activeModuleButtonsCount: number;
  justDraggedRef: React.RefObject<boolean>;
  dockRef: React.RefObject<HTMLDivElement | null>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
}

export function useDockResize({
  dockConfig,
  activeButtons,
  activeModuleButtonsCount,
  justDraggedRef,
  dockRef,
  buttonRefs,
}: UseDockResizeOptions) {
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [liveResizeDims, setLiveResizeDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerJustDragged = () => {
    justDraggedRef.current = true;
    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(() => {
      justDraggedRef.current = false;
    }, 100);
  };

  useEffect(() => {
    if (!resizing) return;

    let currentDims = { width: resizing.startWidth, height: resizing.startHeight };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      const isDock = resizing.btnId === 'dock';
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const isCompact = dockConfig.scale === 'compact';
      const showLabels = dockConfig.showLabels;
      const buttonCount = Math.max(1, activeButtons.length + activeModuleButtonsCount);
      const hasLaunch = activeButtons.includes('launch');
      const divisor = hasLaunch ? buttonCount - 1 + 1.15 : buttonCount;

      const { minSegmentW, maxSegmentW, minDockH, maxDockH } = getSegmentLimits(
        showLabels,
        isCompact,
      );

      const minW = isDock ? Math.round(minSegmentW * divisor) : 50;
      const maxW = isDock ? Math.min(winW - 64, Math.round(maxSegmentW * divisor)) : 320;
      const minH = isDock ? minDockH : 46;
      const maxH = isDock ? maxDockH : 200;

      let newW = resizing.startWidth;
      let newH = resizing.startHeight;

      if (resizing.direction === 'se' || resizing.direction === 'e') {
        newW = Math.max(minW, Math.min(maxW, Math.round(resizing.startWidth + deltaX)));
      }
      if (resizing.direction === 'se' || resizing.direction === 's') {
        newH = Math.max(minH, Math.min(maxH, Math.round(resizing.startHeight + deltaY)));
      }

      currentDims = { width: newW, height: newH };
      setLiveResizeDims(currentDims);
    };

    const handleMouseUp = () => {
      const finalW = currentDims.width;
      const finalH = currentDims.height;

      if (resizing.btnId === 'dock') {
        const isCompact = dockConfig.scale === 'compact';
        const showLabels = dockConfig.showLabels;
        const { minSegmentW, maxSegmentW, minDockH, maxDockH } = getSegmentLimits(
          showLabels,
          isCompact,
        );

        const buttonCount = Math.max(1, activeButtons.length + activeModuleButtonsCount);
        const hasLaunch = activeButtons.includes('launch');
        const divisor = hasLaunch ? buttonCount - 1 + 1.15 : buttonCount;
        const finalBtnW = Math.max(
          minSegmentW,
          Math.min(maxSegmentW, Math.round(finalW / divisor)),
        );
        const finalDockH = Math.max(minDockH, Math.min(maxDockH, finalH));

        launcherActions.setDockConfig({
          customDockHeight: finalDockH,
          customSegmentWidth: finalBtnW,
        });

        triggerJustDragged();
        setResizing(null);
        setLiveResizeDims(null);
        return;
      }

      const autoHide = finalH < 62 || finalW < 70;
      const currentConfig = useLauncherStore.getState().dockConfig;
      const currentBtnCustom = currentConfig.buttonCustomizations?.[resizing.btnId];

      launcherActions.setDockButtonCustomization(resizing.btnId, {
        customWidth: finalW,
        customHeight: finalH,
        ...(currentBtnCustom?.hideLabel !== autoHide ? { hideLabel: autoHide } : {}),
      });

      triggerJustDragged();
      setResizing(null);
      setLiveResizeDims(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [
    resizing,
    activeButtons,
    activeModuleButtonsCount,
    dockConfig.scale,
    dockConfig.showLabels,
    justDraggedRef,
  ]);

  const handleStartResize = (
    e: React.MouseEvent,
    targetId: DockButtonId | 'dock',
    direction: ResizeDirection,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    let curW = 0;
    let curH = 0;

    if (targetId === 'dock') {
      const dockBox = dockRef.current?.getBoundingClientRect();
      curW = dockBox ? dockBox.width : 600;
      curH = dockBox ? dockBox.height : 80;
    } else {
      const btnEl = buttonRefs.current[targetId];
      const rect = btnEl?.getBoundingClientRect();
      curW = rect ? rect.width : (dockConfig.buttonCustomizations?.[targetId]?.customWidth ?? 120);
      curH = rect ? rect.height : (dockConfig.buttonCustomizations?.[targetId]?.customHeight ?? 80);
    }

    setResizing({
      btnId: targetId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: curW,
      startHeight: curH,
      direction,
    });
    setLiveResizeDims({ width: curW, height: curH });
  };

  return {
    resizing,
    setResizing,
    liveResizeDims,
    handleStartResize,
  };
}
