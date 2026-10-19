import React, { useState, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Info,
  Settings,
  Rocket,
  Loader2,
  CheckCircle2,
  User,
  Layers,
  GripHorizontal,
  Sliders,
  AlertTriangle,
  Square,
} from 'lucide-react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  UserAccount,
  DockButtonId,
  DockButtonCustomization,
  useT,
} from '../store/launcherStore';
import { useModuleStore, getModuleContext, type LauncherModule } from '../modules';
import {
  getElementDimensions,
  getEffectiveDockPosition,
  getEffectiveHudSide,
} from '../utils/collisionSystem';
import { useDockDrag, useDockResize } from '../hooks/useDockInteractions';
import { DockButtonInspector, InspectorTab } from './DockButtonInspector';
import { LoaderLogo } from './common/LoaderIcons';
import {
  resolveButtonBg,
  resolveDockBorder,
  resolveDockBoxShadow,
  resolveDockCursor,
  resolveStatusClass,
  resolveButtonCursor,
  resolveButtonZIndex,
  resolveAccountAvatarSrc,
  resolveButtonColor,
  getEffectClassName,
  resolveFreeButtonBorder,
  resolveFreeButtonShadow,
  clampCoordinates,
  shouldUpdateClampedPos,
  resolveStartButtonColors,
  computeDockDimensions,
  isDockButtonLabelVisible,
} from '../utils/homeDockUtils';

export type DraggingTargetId = 'dock' | DockButtonId | null;
export type ResizeDirection = 'se' | 's' | 'e';

export interface ResizeState {
  btnId: DockButtonId | 'dock';
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  direction: ResizeDirection;
}

const TRANSLATE_X_50 = 'translateX(-50%)';

interface FreeButtonElementProps {
  btnId: DockButtonId;
  pos: { x: number; y: number };
  isDraggingThis: boolean;
  isColliding: boolean;
  isEditingHud: boolean;
  scale: number;
  rotation: number;
  btnW: string;
  btnH: string;
  radius: string;
  effectClass: string;
  btnCustom: DockButtonCustomization | null | undefined;
  isLaunch: boolean;
  isRunning: boolean;
  isLaunching: boolean;
  startHoverBg: string;
  startSubtleBg: string;
  customBtnColor?: string | null;
  startColor: string;
  dockConfig: LauncherState['dockConfig'];
  t: ReturnType<typeof useT>;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  buttonContent: React.ReactNode;
  resizeHandles: React.ReactNode;
  isSelected: boolean;
  isInspectorOpen: boolean;
  isResizing?: boolean;
  inspectorTab: InspectorTab;
  onCloseInspector: () => void;
  accentColor?: string;
  isLaunchHovered?: boolean;
  onLaunchHover?: (h: boolean) => void;
}

interface FreeButtonCoordBadgeProps {
  isDraggingThis: boolean;
  isColliding: boolean;
  pos: { x: number; y: number };
  collisionLabel: string;
  accentColor?: string;
}

export const FreeButtonCoordBadge: React.FC<FreeButtonCoordBadgeProps> = ({
  isDraggingThis,
  isColliding,
  pos,
  collisionLabel,
  accentColor,
}) => {
  const isDanger = isDraggingThis && isColliding;
  const badgeColor = accentColor || '#38bdf8';
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: '50%',
        transform: TRANSLATE_X_50,
        background: isDanger ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 18, 26, 0.95)',
        border: isDanger ? '1px solid #f87171' : '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '9px',
        fontWeight: 600,
        fontFamily: 'ui-monospace, monospace',
        color: isDanger ? '#ffffff' : badgeColor,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: isDanger ? '0 0 12px rgba(239, 68, 68, 0.6)' : '0 4px 12px rgba(0, 0, 0, 0.65)',
        zIndex: 20,
      }}
    >
      {isDanger ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={10} color="#fca5a5" />
          <span>
            {collisionLabel} | X:{pos.x}% Y:{pos.y}%
          </span>
        </span>
      ) : (
        `X:${pos.x}% Y:${pos.y}%`
      )}
    </div>
  );
};

export interface FreeButtonInspectorPopupProps {
  posY: number;
  btnId: DockButtonId;
  inspectorTab: 'bg' | 'icon' | 'fx' | 'shape';
  onClose: () => void;
}

export const FreeButtonInspectorPopup: React.FC<FreeButtonInspectorPopupProps> = ({
  posY,
  btnId,
  inspectorTab,
  onClose,
}) => (
  <div
    style={{
      position: 'absolute',
      bottom: posY > 55 ? 'calc(100% + 14px)' : 'auto',
      top: posY <= 55 ? 'calc(100% + 14px)' : 'auto',
      left: '50%',
      transform: TRANSLATE_X_50,
      zIndex: 1000,
    }}
  >
    <DockButtonInspector
      key={`${btnId}-${inspectorTab}`}
      buttonId={btnId}
      initialTab={inspectorTab}
      onClose={onClose}
    />
  </div>
);

interface AnimatedDockLabelProps {
  show: boolean;
  children: React.ReactNode;
  fontSize: string;
  color?: string;
  fontWeight?: number | string;
  transition?: string;
}

export const AnimatedDockLabel: React.FC<AnimatedDockLabelProps> = ({
  show,
  children,
  fontSize,
  color,
  fontWeight,
  transition,
}) => {
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 330);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      className={`dock-label-wrapper ${isVisible ? 'label-visible' : 'label-hidden'}`}
      aria-hidden={!isVisible}
    >
      <span className="dock-label" style={{ fontSize, color, fontWeight, transition }}>
        {children}
      </span>
    </div>
  );
};

const resolveFreeButtonClasses = (
  isLaunch: boolean,
  isRunning: boolean,
  isLaunching: boolean,
  effectClass: string,
): string => {
  const launchClass = isLaunch ? 'start-game' : '';
  const statusClass = resolveStatusClass(isRunning, isLaunching);
  return `dock-segment ${launchClass} ${statusClass} ${effectClass}`.trim();
};

interface FreeButtonBackgroundVideoProps {
  btnCustom?: DockButtonCustomization | null;
}

const FreeButtonBackgroundVideo: React.FC<FreeButtonBackgroundVideoProps> = ({ btnCustom }) => {
  if (btnCustom?.bgType !== 'video' || !btnCustom.bgVideo) return null;
  return (
    <video
      src={btnCustom.bgVideo}
      autoPlay
      loop
      muted
      playsInline
      className="dock-button-video-bg"
      style={{ opacity: btnCustom.bgVideoOpacity ?? 0.85 }}
    />
  );
};

interface FreeButtonInspectorSlotProps {
  isEditingHud: boolean;
  isSelected?: boolean;
  isInspectorOpen: boolean;
  posY: number;
  btnId: DockButtonId;
  inspectorTab: InspectorTab;
  onClose: () => void;
}

const FreeButtonInspectorSlot: React.FC<FreeButtonInspectorSlotProps> = ({
  isEditingHud,
  isSelected,
  isInspectorOpen,
  posY,
  btnId,
  inspectorTab,
  onClose,
}) => {
  if (!isEditingHud || !isSelected || !isInspectorOpen) return null;
  return (
    <FreeButtonInspectorPopup
      posY={posY}
      btnId={btnId}
      inspectorTab={inspectorTab}
      onClose={onClose}
    />
  );
};

const getLaunchColors = (
  isLaunch: boolean,
  isRunning: boolean,
  isLaunchHovered: boolean | undefined,
  startHoverBg: string,
  startColor: string,
) => {
  if (isLaunch && isRunning && isLaunchHovered) {
    return { hoverBg: 'rgba(239, 68, 68, 0.25)', contentColor: '#ef4444' };
  }
  return { hoverBg: startHoverBg, contentColor: startColor };
};

const FreeButtonElement: React.FC<FreeButtonElementProps> = ({
  btnId,
  pos,
  isDraggingThis,
  isColliding,
  isEditingHud,
  scale,
  rotation,
  btnW,
  btnH,
  radius,
  effectClass,
  btnCustom,
  isLaunch,
  isRunning,
  isLaunching,
  startHoverBg,
  startSubtleBg,
  customBtnColor,
  startColor,
  dockConfig,
  t,
  buttonRef,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseDown,
  buttonContent,
  resizeHandles,
  isSelected,
  isInspectorOpen,
  isResizing,
  inspectorTab,
  onCloseInspector,
  accentColor,
  isLaunchHovered,
  onLaunchHover,
}) => {
  const buttonClasses = resolveFreeButtonClasses(isLaunch, isRunning, isLaunching, effectClass);
  const borderStyle = resolveFreeButtonBorder(
    isEditingHud,
    isDraggingThis,
    isColliding,
    btnCustom,
    customBtnColor,
    dockConfig.dockBorderColorMode,
    accentColor,
  );
  const shadowStyle = resolveFreeButtonShadow(
    isEditingHud,
    isDraggingThis,
    isColliding,
    customBtnColor,
    accentColor,
  );
  const cursorStyle = resolveButtonCursor(isEditingHud, isDraggingThis);
  const launchColors = getLaunchColors(
    isLaunch,
    isRunning,
    isLaunchHovered,
    startHoverBg,
    startColor,
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: resolveButtonZIndex(isDraggingThis, isEditingHud, isSelected, Boolean(isResizing)),
        transition: isDraggingThis
          ? 'none'
          : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, transform 0.2s ease',
      }}
    >
      {isEditingHud && (
        <FreeButtonCoordBadge
          isDraggingThis={isDraggingThis}
          isColliding={isColliding}
          pos={pos}
          collisionLabel={t.hudEditor.collision}
          accentColor={accentColor}
        />
      )}

      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
        onMouseEnter={() => {
          if (isLaunch) onLaunchHover?.(true);
        }}
        onMouseLeave={() => {
          if (isLaunch) onLaunchHover?.(false);
        }}
        title={isLaunch && isRunning ? t.dock.runningTooltip : undefined}
        className={buttonClasses}
        style={{
          width: btnW,
          height: btnH,
          borderRadius: radius,
          background: resolveButtonBg({
            btnCustom,
            isLaunch,
            isRunning,
            isLaunching,
            startHoverBg: launchColors.hoverBg,
            startSubtleBg,
            customBtnColor,
            fallbackBg: `rgba(12, 17, 24, ${dockConfig.bgOpacity})`,
          }),
          color: resolveButtonColor(
            btnCustom,
            isLaunch,
            launchColors.contentColor,
            customBtnColor,
          ),
          border: borderStyle,
          boxShadow: shadowStyle,
          backdropFilter: 'blur(20px)',
          cursor: cursorStyle,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <FreeButtonBackgroundVideo btnCustom={btnCustom} />

        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            width: '100%',
            height: '100%',
            pointerEvents: isEditingHud ? 'auto' : 'none',
          }}
        >
          {buttonContent}
        </div>
      </button>

      {resizeHandles}

      <FreeButtonInspectorSlot
        isEditingHud={isEditingHud}
        isSelected={isSelected}
        isInspectorOpen={isInspectorOpen}
        posY={pos.y}
        btnId={btnId}
        inspectorTab={inspectorTab}
        onClose={onCloseInspector}
      />
    </div>
  );
};

interface FreeButtonsLayoutProps {
  activeButtons: DockButtonId[];
  activeModuleButtons?: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>;
  dockConfig: LauncherState['dockConfig'];
  draggingTarget: DraggingTargetId;
  tempPos: { x: number; y: number } | null;
  isEditingHud: boolean;
  isColliding: boolean;
  t: ReturnType<typeof useT>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onButtonClick: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonDoubleClick?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonContextMenu?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonMouseDown: (e: React.MouseEvent, btnId: DockButtonId) => void;
  renderButtonContent: (btnId: DockButtonId) => React.ReactNode;
  renderResizeHandles: (btnId: DockButtonId) => React.ReactNode;
  selectedDockButtonId: DockButtonId | null;
  isInspectorOpen: boolean;
  isResizing?: boolean;
  resizing?: ResizeState | null;
  liveResizeDims?: { width: number; height: number } | null;
  inspectorTab: InspectorTab;
  onCloseInspector: () => void;
  isRunning: boolean;
  isLaunching: boolean;
  startSegmentWidth: string;
  segmentWidth: string;
  segmentHeight: string;
  startHoverBg: string;
  startSubtleBg: string;
  startColor: string;
  getButtonCustomColor: (btnId: DockButtonId) => string | null | undefined;
  accentColor?: string;
  isLaunchHovered?: boolean;
  onLaunchHover?: (h: boolean) => void;
}

const resolveDimensionString = (
  liveDim?: number,
  customDim?: number,
  defaultDim?: string,
): string => {
  if (liveDim !== undefined && liveDim !== null) return `${liveDim}px`;
  if (customDim !== undefined && customDim !== null) return `${customDim}px`;
  return defaultDim || 'auto';
};

const FreeButtonsLayout: React.FC<FreeButtonsLayoutProps> = ({
  activeButtons,
  activeModuleButtons,
  dockConfig,
  draggingTarget,
  tempPos,
  isEditingHud,
  isColliding,
  t,
  buttonRefs,
  onButtonClick,
  onButtonDoubleClick,
  onButtonContextMenu,
  onButtonMouseDown,
  renderButtonContent,
  renderResizeHandles,
  selectedDockButtonId,
  isInspectorOpen,
  resizing,
  liveResizeDims,
  inspectorTab,
  onCloseInspector,
  isRunning,
  isLaunching,
  startSegmentWidth,
  segmentWidth,
  segmentHeight,
  startHoverBg,
  startSubtleBg,
  startColor,
  getButtonCustomColor,
  accentColor,
  isLaunchHovered,
  onLaunchHover,
}) => {
  const allFreeButtons = useMemo(() => {
    const modButtonIds = (activeModuleButtons || []).map(
      ({ module: mod }) => `mod:${mod.id}` as DockButtonId,
    );
    return [...activeButtons, ...modButtonIds];
  }, [activeButtons, activeModuleButtons]);

  return (
    <>
      {allFreeButtons.map((btnId) => {
        const isDraggingThis = draggingTarget === btnId;
        const pos =
          isDraggingThis && tempPos
            ? tempPos
            : dockConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };

        const isLaunch = btnId === 'launch';
        const btnCustom = dockConfig.buttonCustomizations?.[btnId];
        const customBtnColor = getButtonCustomColor(btnId);

        const defaultBtnW = isLaunch ? startSegmentWidth : segmentWidth;
        const defaultBtnH = segmentHeight;
        const isCurrentResizing = resizing?.btnId === btnId;
        const liveDims = isCurrentResizing && liveResizeDims ? liveResizeDims : null;
        const btnW = resolveDimensionString(liveDims?.width, btnCustom?.customWidth, defaultBtnW);
        const btnH = resolveDimensionString(liveDims?.height, btnCustom?.customHeight, defaultBtnH);
        const scale = btnCustom?.scale ?? 1;
        const rotation = btnCustom?.rotation ?? 0;
        const radius =
          btnCustom?.borderRadius !== undefined
            ? `${btnCustom.borderRadius}px`
            : `${dockConfig.borderRadius}px`;
        const effectClass = getEffectClassName(btnCustom?.specialEffect);

        return (
          <FreeButtonElement
            key={btnId}
            btnId={btnId}
            pos={pos}
            isDraggingThis={isDraggingThis}
            isColliding={isColliding}
            isEditingHud={isEditingHud}
            scale={scale}
            rotation={rotation}
            btnW={btnW}
            btnH={btnH}
            radius={radius}
            effectClass={effectClass}
            btnCustom={btnCustom}
            isLaunch={isLaunch}
            isRunning={isRunning}
            isLaunching={isLaunching}
            startHoverBg={startHoverBg}
            startSubtleBg={startSubtleBg}
            customBtnColor={customBtnColor}
            startColor={startColor}
            dockConfig={dockConfig}
            t={t}
            buttonRef={(el) => {
              buttonRefs.current[btnId] = el;
            }}
            onClick={(e) => onButtonClick(btnId, e)}
            onDoubleClick={(e) => onButtonDoubleClick?.(btnId, e)}
            onContextMenu={(e) => onButtonContextMenu?.(btnId, e)}
            onMouseDown={(e) => onButtonMouseDown(e, btnId)}
            buttonContent={renderButtonContent(btnId)}
            resizeHandles={renderResizeHandles(btnId)}
            isSelected={selectedDockButtonId === btnId}
            isInspectorOpen={isInspectorOpen}
            isResizing={isCurrentResizing}
            inspectorTab={inspectorTab}
            onCloseInspector={onCloseInspector}
            accentColor={accentColor}
            isLaunchHovered={isLaunchHovered}
            onLaunchHover={onLaunchHover}
          />
        );
      })}
    </>
  );
};

interface GroupedDockLayoutProps {
  dockConfig: LauncherState['dockConfig'];
  dockPos: { x: number; y: number };
  draggingTarget: DraggingTargetId;
  isEditingHud: boolean;
  isHovered: boolean;
  setIsHovered: (h: boolean) => void;
  dockRef: React.RefObject<HTMLDivElement | null>;
  onDockMouseDown: (e: React.MouseEvent) => void;
  selectedDockButtonId: DockButtonId | null;
  isInspectorOpen: boolean;
  inspectorTab: InspectorTab;
  onCloseInspector: () => void;
  t: ReturnType<typeof useT>;
  activeButtons: DockButtonId[];
  activeModuleButtons: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onButtonClick: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonDoubleClick?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonContextMenu?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  renderButtonContent: (btnId: DockButtonId) => React.ReactNode;
  renderDockResizeHandles: () => React.ReactNode;
  isRunning: boolean;
  isLaunching: boolean;
  startSegmentWidth: string;
  segmentWidth: string;
  segmentHeight: string;
  startHoverBg: string;
  startSubtleBg: string;
  startColor: string;
  getButtonCustomColor: (btnId: DockButtonId) => string | null | undefined;
  accentColor: string;
  showLabels: boolean;
  labelFontSize: string;
  isButtonLabelVisible?: (btnId: DockButtonId) => boolean;
  isLaunchHovered?: boolean;
  onLaunchHover?: (h: boolean) => void;
  isColliding?: boolean;
}

interface DockCoordinateBadgeProps {
  isEditingHud: boolean;
  dockPos: { x: number; y: number };
  isDraggingDock: boolean;
  isColliding?: boolean;
  accentColor?: string;
  collisionLabel: string;
}

const DockCoordinateBadge: React.FC<DockCoordinateBadgeProps> = ({
  isEditingHud,
  dockPos,
  isDraggingDock,
  isColliding,
  accentColor,
  collisionLabel,
}) => {
  if (!isEditingHud) return null;
  const isDanger = isDraggingDock && isColliding;
  return (
    <div
      aria-label="Coordenadas del dock"
      style={{
        position: 'absolute',
        bottom: dockPos.y > 10 ? 'calc(100% + 8px)' : 'auto',
        top: dockPos.y <= 10 ? 'calc(100% + 8px)' : 'auto',
        left: '50%',
        transform: TRANSLATE_X_50,
        background: isDanger ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 18, 26, 0.95)',
        border: isDanger ? '1px solid rgba(248, 113, 113, 0.85)' : '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '9px',
        fontWeight: 600,
        fontFamily: 'ui-monospace, monospace',
        color: isDanger ? '#ffffff' : accentColor || '#38bdf8',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: isDanger ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.65)',
        zIndex: 40,
      }}
    >
      {isDanger ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={10} color="#fca5a5" />
          <span>
            {collisionLabel} | X:{dockPos.x}% Y:{dockPos.y}%
          </span>
        </span>
      ) : (
        `X:${dockPos.x}% Y:${dockPos.y}%`
      )}
    </div>
  );
};

interface DockQuickAccessBarProps {
  isEditingHud: boolean;
  isHovered: boolean;
  accentColor?: string;
  t: ReturnType<typeof useT>;
}

const DockQuickAccessBar: React.FC<DockQuickAccessBarProps> = ({
  isEditingHud,
  isHovered,
  accentColor,
  t,
}) => {
  if (isEditingHud || !isHovered) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: TRANSLATE_X_50,
        paddingBottom: '8px',
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(10, 14, 22, 0.94)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '20px',
          padding: '4px 10px',
          boxShadow: `0 8px 30px rgba(0, 0, 0, 0.7), 0 0 16px ${accentColor}25`,
          animation: 'fadeInUpPill 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          whiteSpace: 'nowrap',
        }}
      >
        <button
          type="button"
          onClick={() => launcherActions.setEditingHud(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: accentColor,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <GripHorizontal size={13} />
          <span>{t.hoverBar.editGui}</span>
        </button>
        <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.15)' }} />
        <button
          type="button"
          onClick={() => launcherActions.openModal('settings')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(248, 250, 252, 0.65)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
          }}
        >
          <Sliders size={12} />
          <span>{t.hoverBar.settings}</span>
        </button>
      </div>
    </div>
  );
};

interface DockInspectorSlotProps {
  isEditingHud: boolean;
  isInspectorOpen: boolean;
  selectedDockButtonId: DockButtonId | null;
  inspectorTab: InspectorTab;
  onClose: () => void;
}

const DockInspectorSlot: React.FC<DockInspectorSlotProps> = ({
  isEditingHud,
  isInspectorOpen,
  selectedDockButtonId,
  inspectorTab,
  onClose,
}) => {
  if (!isEditingHud || !isInspectorOpen || !selectedDockButtonId) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 14px)',
        left: '50%',
        transform: TRANSLATE_X_50,
        zIndex: 1000,
      }}
    >
      <DockButtonInspector
        key={`${selectedDockButtonId}-${inspectorTab}`}
        buttonId={selectedDockButtonId}
        initialTab={inspectorTab}
        onClose={onClose}
      />
    </div>
  );
};

interface DockSharedBackgroundLayerProps {
  dockConfig: LauncherState['dockConfig'];
}

const DockSharedBackgroundLayer: React.FC<DockSharedBackgroundLayerProps> = ({ dockConfig }) => {
  if (dockConfig.dockBgType === 'image' && dockConfig.dockBgImage) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${dockConfig.dockBgImage})`,
          backgroundPosition: `${dockConfig.dockBgPosX ?? 50}% ${dockConfig.dockBgPosY ?? 50}%`,
          backgroundSize: `${dockConfig.dockBgScale ?? 100}%`,
          backgroundRepeat: 'no-repeat',
          opacity: dockConfig.dockBgOpacity ?? 1,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }
  if (dockConfig.dockBgType === 'video' && dockConfig.dockBgVideo) {
    return (
      <video
        src={dockConfig.dockBgVideo}
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${dockConfig.dockBgPosX ?? 50}% ${dockConfig.dockBgPosY ?? 50}%`,
          transform: `scale(${(dockConfig.dockBgScale ?? 100) / 100})`,
          opacity: (dockConfig.dockBgOpacity ?? 1) * (dockConfig.dockBgVideoOpacity ?? 0.85),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }
  return null;
};

interface DockStandardButtonsListProps {
  activeButtons: DockButtonId[];
  activeModuleButtonsLength: number;
  dockConfig: LauncherState['dockConfig'];
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onButtonClick: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonDoubleClick?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonContextMenu?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onLaunchHover?: (h: boolean) => void;
  isLaunchHovered?: boolean;
  isRunning: boolean;
  isLaunching: boolean;
  t: ReturnType<typeof useT>;
  startSegmentWidth: string;
  segmentWidth: string;
  segmentHeight: string;
  startHoverBg: string;
  startSubtleBg: string;
  startColor: string;
  getButtonCustomColor: (btnId: DockButtonId) => string | null | undefined;
  isEditingHud: boolean;
  isDraggingDock: boolean;
  renderButtonContent: (btnId: DockButtonId) => React.ReactNode;
}

const DockStandardButtonsList: React.FC<DockStandardButtonsListProps> = ({
  activeButtons,
  activeModuleButtonsLength,
  dockConfig,
  buttonRefs,
  onButtonClick,
  onButtonDoubleClick,
  onButtonContextMenu,
  onLaunchHover,
  isLaunchHovered,
  isRunning,
  isLaunching,
  t,
  startSegmentWidth,
  segmentWidth,
  segmentHeight,
  startHoverBg,
  startSubtleBg,
  startColor,
  getButtonCustomColor,
  isEditingHud,
  isDraggingDock,
  renderButtonContent,
}) => {
  return (
    <>
      {activeButtons.map((btnId, idx) => {
        const isLaunch = btnId === 'launch';
        const btnCustom = dockConfig.buttonCustomizations?.[btnId];
        const customBtnColor = getButtonCustomColor(btnId);
        const isLast = idx === activeButtons.length - 1 && activeModuleButtonsLength === 0;
        const borderRightStyle = isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)';

        const defaultBtnW = isLaunch ? startSegmentWidth : segmentWidth;
        const defaultBtnH = segmentHeight;
        const btnW = defaultBtnW;
        const btnH = defaultBtnH;
        const scale = btnCustom?.scale ?? 1;
        const effectClass = getEffectClassName(btnCustom?.specialEffect);

        return (
          <div
            key={btnId}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'inline-flex',
            }}
          >
            <button
              ref={(el) => {
                buttonRefs.current[btnId] = el;
              }}
              type="button"
              onClick={(e) => onButtonClick(btnId, e)}
              onDoubleClick={(e) => onButtonDoubleClick?.(btnId, e)}
              onContextMenu={(e) => onButtonContextMenu?.(btnId, e)}
              onMouseEnter={() => {
                if (isLaunch) onLaunchHover?.(true);
              }}
              onMouseLeave={() => {
                if (isLaunch) onLaunchHover?.(false);
              }}
              title={isLaunch && isRunning ? t.dock.runningTooltip : undefined}
              className={`dock-segment ${isLaunch ? 'start-game' : ''} ${resolveStatusClass(
                isRunning,
                isLaunching,
              )} ${effectClass}`}
              style={{
                width: btnW,
                height: btnH,
                borderRight: borderRightStyle,
                transform: scale !== 1 ? `scale(${scale})` : undefined,
                transformOrigin: 'center center',
                background: resolveButtonBg({
                  btnCustom,
                  isLaunch,
                  isRunning,
                  isLaunching,
                  startHoverBg:
                    isRunning && isLaunchHovered ? 'rgba(239, 68, 68, 0.25)' : startHoverBg,
                  startSubtleBg,
                  customBtnColor,
                  fallbackBg: 'transparent',
                }),
                color: (() => {
                  if (btnCustom?.contentColor) return btnCustom.contentColor;
                  if (isLaunch && isRunning && isLaunchHovered) return '#ef4444';
                  return isLaunch ? startColor : (customBtnColor ?? '#cbd5e1');
                })(),
                cursor: isEditingHud && isDraggingDock ? 'grabbing' : 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {btnCustom?.bgType === 'video' && btnCustom.bgVideo && (
                <video
                  src={btnCustom.bgVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="dock-button-video-bg"
                  style={{ opacity: btnCustom.bgVideoOpacity ?? 0.85 }}
                />
              )}

              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  width: '100%',
                  height: '100%',
                  pointerEvents: isEditingHud ? 'auto' : 'none',
                }}
              >
                {renderButtonContent(btnId)}
              </div>
            </button>
          </div>
        );
      })}
    </>
  );
};

interface DockModuleButtonsListProps {
  activeModuleButtons: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>;
  dockConfig: LauncherState['dockConfig'];
  accentColor: string;
  isEditingHud: boolean;
  onButtonClick: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonDoubleClick?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  onButtonContextMenu?: (btnId: DockButtonId, e?: React.MouseEvent) => void;
  segmentWidth: string;
  segmentHeight: string;
  isButtonLabelVisible?: (btnId: DockButtonId) => boolean;
  showLabels: boolean;
  labelFontSize: string;
}

const DockModuleButtonsList: React.FC<DockModuleButtonsListProps> = ({
  activeModuleButtons,
  dockConfig,
  accentColor,
  isEditingHud,
  onButtonClick,
  onButtonDoubleClick,
  onButtonContextMenu,
  segmentWidth,
  segmentHeight,
  isButtonLabelVisible,
  showLabels,
  labelFontSize,
}) => {
  return (
    <>
      {activeModuleButtons.map(({ module: mod, slot }, idx) => {
        const modCustomColor =
          dockConfig.customButtonColors?.[`mod:${mod.id}` as unknown as DockButtonId] ||
          slot.defaultColor ||
          accentColor;
        const isLast = idx === activeModuleButtons.length - 1;

        return (
          <button
            key={mod.id}
            type="button"
            onClick={(e) => {
              if (isEditingHud) {
                onButtonClick(`mod:${mod.id}` as DockButtonId, e);
                return;
              }
              slot.onClick(getModuleContext(mod.id));
            }}
            onDoubleClick={(e) => {
              if (isEditingHud) {
                onButtonDoubleClick?.(`mod:${mod.id}` as DockButtonId, e);
              }
            }}
            onContextMenu={(e) => {
              onButtonContextMenu?.(`mod:${mod.id}` as DockButtonId, e);
            }}
            title={slot.tooltip || slot.label}
            className="dock-segment"
            style={{
              width: segmentWidth,
              height: segmentHeight,
              borderRight: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
              background: `${modCustomColor}14`,
              color: modCustomColor,
              cursor: 'pointer',
            }}
          >
            <div className="dock-icon-wrapper" style={{ color: modCustomColor }}>
              {slot.icon}
            </div>
            {(isButtonLabelVisible
              ? isButtonLabelVisible(`mod:${mod.id}` as unknown as DockButtonId)
              : showLabels) && (
              <span
                className="dock-label"
                style={{
                  fontSize: labelFontSize,
                  color: modCustomColor,
                }}
              >
                {slot.label}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
};

const GroupedDockLayout: React.FC<GroupedDockLayoutProps> = ({
  dockConfig,
  dockPos,
  draggingTarget,
  isEditingHud,
  isColliding,
  isHovered,
  setIsHovered,
  dockRef,
  onDockMouseDown,
  selectedDockButtonId,
  isInspectorOpen,
  inspectorTab,
  onCloseInspector,
  t,
  activeButtons,
  activeModuleButtons,
  buttonRefs,
  onButtonClick,
  onButtonDoubleClick,
  onButtonContextMenu,
  renderButtonContent,
  renderDockResizeHandles,
  isRunning,
  isLaunching,
  startSegmentWidth,
  segmentWidth,
  segmentHeight,
  startHoverBg,
  startSubtleBg,
  startColor,
  getButtonCustomColor,
  accentColor,
  showLabels,
  labelFontSize,
  isButtonLabelVisible,
  isLaunchHovered,
  onLaunchHover,
}) => {
  const isDraggingDock = draggingTarget === 'dock';
  const dockZIndex = resolveButtonZIndex(isDraggingDock, isEditingHud);
  const dockBorder = resolveDockBorder(isEditingHud, dockConfig.dockBorderColorMode);
  const dockBoxShadow = resolveDockBoxShadow(isEditingHud, dockConfig.dockBorderColorMode);
  const dockCursor = resolveDockCursor(isEditingHud, isDraggingDock);

  return (
    <section
      aria-label="Unified Dock"
      style={{
        position: 'absolute',
        left: `${dockPos.x}%`,
        top: `${dockPos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: dockZIndex,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transition: isDraggingDock
          ? 'none'
          : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <DockCoordinateBadge
        isEditingHud={isEditingHud}
        dockPos={dockPos}
        isDraggingDock={isDraggingDock}
        isColliding={isColliding}
        accentColor={accentColor}
        collisionLabel={t.hudEditor.collision}
      />

      <DockQuickAccessBar
        isEditingHud={isEditingHud}
        isHovered={isHovered}
        accentColor={accentColor}
        t={t}
      />

      <DockInspectorSlot
        isEditingHud={isEditingHud}
        isInspectorOpen={isInspectorOpen}
        selectedDockButtonId={selectedDockButtonId}
        inspectorTab={inspectorTab}
        onClose={onCloseInspector}
      />

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div
          ref={dockRef}
          role="toolbar"
          aria-label="Barra de botones del dock"
          className="home-unified-dock"
          onMouseDown={onDockMouseDown}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: `rgba(12, 17, 24, ${dockConfig.bgOpacity})`,
            borderRadius: `${dockConfig.borderRadius}px`,
            border: dockBorder,
            boxShadow: dockBoxShadow,
            cursor: dockCursor,
          }}
        >
          <DockSharedBackgroundLayer dockConfig={dockConfig} />

          <DockStandardButtonsList
            activeButtons={activeButtons}
            activeModuleButtonsLength={activeModuleButtons.length}
            dockConfig={dockConfig}
            buttonRefs={buttonRefs}
            onButtonClick={onButtonClick}
            onButtonDoubleClick={onButtonDoubleClick}
            onButtonContextMenu={onButtonContextMenu}
            onLaunchHover={onLaunchHover}
            isLaunchHovered={isLaunchHovered}
            isRunning={isRunning}
            isLaunching={isLaunching}
            t={t}
            startSegmentWidth={startSegmentWidth}
            segmentWidth={segmentWidth}
            segmentHeight={segmentHeight}
            startHoverBg={startHoverBg}
            startSubtleBg={startSubtleBg}
            startColor={startColor}
            getButtonCustomColor={getButtonCustomColor}
            isEditingHud={isEditingHud}
            isDraggingDock={isDraggingDock}
            renderButtonContent={renderButtonContent}
          />

          <DockModuleButtonsList
            activeModuleButtons={activeModuleButtons}
            dockConfig={dockConfig}
            accentColor={accentColor}
            isEditingHud={isEditingHud}
            onButtonClick={onButtonClick}
            onButtonDoubleClick={onButtonDoubleClick}
            onButtonContextMenu={onButtonContextMenu}
            segmentWidth={segmentWidth}
            segmentHeight={segmentHeight}
            isButtonLabelVisible={isButtonLabelVisible}
            showLabels={showLabels}
            labelFontSize={labelFontSize}
          />
        </div>

        {renderDockResizeHandles()}
      </div>
    </section>
  );
};

const clampDockPosition = (
  customCoordinates: { x: number; y: number } | undefined,
  dockEl: HTMLDivElement | null,
  dockConfig: LauncherState['dockConfig'],
  winW: number,
  winH: number,
) => {
  if (!customCoordinates) return;
  let dims = getElementDimensions('dock', dockConfig);
  if (dockEl) {
    const rect = dockEl.getBoundingClientRect();
    dims = { width: rect.width, height: rect.height };
  }
  const clamped = clampCoordinates(customCoordinates, dims, winW, winH);
  if (shouldUpdateClampedPos(customCoordinates, clamped)) {
    launcherActions.setDockConfig({ customCoordinates: clamped });
  }
};

const clampFreeButtonPositions = (
  dockConfig: LauncherState['dockConfig'],
  buttonEls: Record<string, HTMLButtonElement | null>,
  winW: number,
  winH: number,
) => {
  const buttons: DockButtonId[] = ['launch', 'instances', 'accounts', 'settings', 'about'];
  for (const btnId of buttons) {
    const pos = dockConfig.buttonPositions?.[btnId];
    if (!pos) continue;
    let dims = getElementDimensions(`btn:${btnId}`, dockConfig);
    const btnEl = buttonEls[btnId];
    if (btnEl) {
      const rect = btnEl.getBoundingClientRect();
      dims = { width: rect.width, height: rect.height };
    }
    const clamped = clampCoordinates(pos, dims, winW, winH);
    if (shouldUpdateClampedPos(pos, clamped)) {
      launcherActions.setButtonPosition(btnId, clamped);
    }
  }
};

const renderCustomSvgIcon = (
  sanitized: string,
  effectiveSize: number,
  effectiveColor?: string,
) => (
  <div
    className="dock-icon-wrapper dock-custom-svg"
    data-dock-icon="true"
    style={{
      width: `${effectiveSize}px`,
      height: `${effectiveSize}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: effectiveColor,
      background: 'transparent',
      border: 'none',
      padding: 0,
    }}
    dangerouslySetInnerHTML={{ __html: sanitized }}
  />
);

const renderCustomImageIcon = (url: string, effectiveSize: number) => (
  <div
    className="dock-icon-wrapper"
    data-dock-icon="true"
    style={{
      background: 'transparent',
      border: 'none',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <img
      src={url}
      alt=""
      style={{
        width: `${effectiveSize}px`,
        height: `${effectiveSize}px`,
        objectFit: 'contain',
      }}
    />
  </div>
);

const renderDefaultIconWrapper = (icon: React.ReactNode, scale: number, btnId?: DockButtonId) => (
  <div
    className="dock-icon-wrapper"
    data-dock-icon="true"
    data-testid={btnId ? `dock-icon-${btnId}` : undefined}
    style={{
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: 'none',
      padding: 0,
    }}
  >
    {icon}
  </div>
);

const renderIconWithCustomization = (
  btnId: DockButtonId,
  defaultIcon: React.ReactNode,
  effectiveColor: string | undefined,
  dockConfig: LauncherState['dockConfig'],
  iconSize: number,
) => {
  const btnCustom = dockConfig.buttonCustomizations?.[btnId];
  if (btnCustom?.iconType === 'none') {
    return null;
  }
  const globalScale = dockConfig.iconScale ?? 1;
  const btnScale = btnCustom?.iconScale ?? 1;
  const scale = Math.round(globalScale * btnScale * 100) / 100;
  const effectiveSize = Math.round(iconSize * scale);

  if (btnCustom?.iconType === 'custom_svg' && btnCustom.customSvg) {
    const sanitized = DOMPurify.sanitize(btnCustom.customSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    return renderCustomSvgIcon(sanitized, effectiveSize, effectiveColor);
  }
  if (btnCustom?.iconType === 'custom_image' && btnCustom.customIconUrl) {
    return renderCustomImageIcon(btnCustom.customIconUrl, effectiveSize);
  }
  return renderDefaultIconWrapper(defaultIcon, scale, btnId);
};

export interface DockButtonResizeHandlesProps {
  btnId: DockButtonId;
  isEditingHud: boolean;
  selectedDockButtonId: DockButtonId | null;
  resizing: ResizeState | null;
  liveResizeDims: { width: number; height: number } | null;
  accentColor: string;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  onStartResize: (
    e: React.MouseEvent,
    targetId: DockButtonId | 'dock',
    direction: ResizeDirection,
  ) => void;
}

export const DockButtonResizeHandles: React.FC<DockButtonResizeHandlesProps> = ({
  btnId,
  isEditingHud,
  selectedDockButtonId,
  resizing,
  liveResizeDims,
  accentColor,
  isButtonLabelVisible,
  onStartResize,
}) => {
  if (!isEditingHud || selectedDockButtonId !== btnId) return null;

  const isCurrentResizing = resizing?.btnId === btnId;
  const currentDims = isCurrentResizing && liveResizeDims ? liveResizeDims : null;
  const handleColor = accentColor || '#16A085';

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: '-3px',
          border: `2px solid ${handleColor}`,
          borderRadius: 'inherit',
          boxShadow: `0 0 14px ${handleColor}80`,
          pointerEvents: 'none',
          zIndex: 1100,
        }}
      />

      {currentDims && (
        <div
          style={{
            position: 'absolute',
            bottom: '-30px',
            left: '50%',
            transform: TRANSLATE_X_50,
            background: 'rgba(10, 14, 23, 0.95)',
            border: `1px solid ${handleColor}`,
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 800,
            color: handleColor,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.85)',
            pointerEvents: 'none',
            zIndex: 1200,
          }}
        >
          {currentDims.width} × {currentDims.height} px
          {(currentDims.height < 62 ||
            currentDims.width < 70 ||
            !isButtonLabelVisible(btnId)) && (
            <span style={{ opacity: 0.8, fontWeight: 500 }}> • Sin texto</span>
          )}
        </div>
      )}

      <button
        type="button"
        aria-label="Pescar esquina: arrastra para cambiar ancho y alto libremente"
        title="Pescar esquina: arrastra para cambiar ancho y alto libremente"
        onMouseDown={(e) => onStartResize(e, btnId, 'se')}
        className="dock-resize-handle dock-resize-handle-se"
        style={{
          position: 'absolute',
          right: '-6px',
          bottom: '-6px',
          width: '14px',
          height: '14px',
          cursor: 'nwse-resize',
          zIndex: 1150,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '4px', height: '4px' }} />
      </button>

      <button
        type="button"
        aria-label="Arrastra para cambiar ancho"
        title="Arrastra para cambiar ancho"
        onMouseDown={(e) => onStartResize(e, btnId, 'e')}
        className="dock-resize-handle dock-resize-handle-e"
        style={{
          position: 'absolute',
          right: '-5px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '10px',
          height: '22px',
          cursor: 'ew-resize',
          zIndex: 1140,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '2px', height: '10px' }} />
      </button>

      <button
        type="button"
        aria-label="Arrastra para cambiar alto"
        title="Arrastra para cambiar alto"
        onMouseDown={(e) => onStartResize(e, btnId, 's')}
        className="dock-resize-handle dock-resize-handle-s"
        style={{
          position: 'absolute',
          bottom: '-5px',
          left: '50%',
          transform: TRANSLATE_X_50,
          width: '22px',
          height: '10px',
          cursor: 'ns-resize',
          zIndex: 1140,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '10px', height: '2px' }} />
      </button>
    </>
  );
};

export interface DockBarResizeHandlesProps {
  isEditingHud: boolean;
  resizing: ResizeState | null;
  liveResizeDims: { width: number; height: number } | null;
  accentColor: string;
  borderRadius?: number;
  onStartResize: (
    e: React.MouseEvent,
    targetId: DockButtonId | 'dock',
    direction: ResizeDirection,
  ) => void;
}

export type UnifiedDockResizeHandlesProps = DockBarResizeHandlesProps;

export const DockBarResizeHandles: React.FC<DockBarResizeHandlesProps> = ({
  isEditingHud,
  resizing,
  liveResizeDims,
  accentColor,
  borderRadius = 14,
  onStartResize,
}) => {
  if (!isEditingHud) return null;

  const isCurrentResizing = resizing?.btnId === 'dock';
  const currentDims = isCurrentResizing && liveResizeDims ? liveResizeDims : null;
  const handleColor = accentColor || '#16A085';

  return (
    <>
      <div
        data-testid="dock-selection-frame"
        style={{
          position: 'absolute',
          inset: '-3px',
          border: `2px solid ${handleColor}`,
          borderRadius: `${borderRadius + 3}px`,
          boxShadow: `0 0 16px ${handleColor}80`,
          pointerEvents: 'none',
          zIndex: 1100,
        }}
      />

      {currentDims && (
        <div
          style={{
            position: 'absolute',
            bottom: '-32px',
            left: '50%',
            transform: TRANSLATE_X_50,
            background: 'rgba(10, 14, 23, 0.95)',
            border: `1px solid ${handleColor}`,
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 800,
            color: handleColor,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.85)',
            pointerEvents: 'none',
            zIndex: 1200,
          }}
        >
          {currentDims.width} × {currentDims.height} px • Barra Dock
        </div>
      )}

      <button
        type="button"
        aria-label="Arrastra para cambiar ancho y alto de la barra"
        title="Arrastra para cambiar ancho y alto de la barra"
        onMouseDown={(e) => onStartResize(e, 'dock', 'se')}
        className="dock-resize-handle dock-resize-handle-se"
        style={{
          position: 'absolute',
          right: '-6px',
          bottom: '-6px',
          width: '14px',
          height: '14px',
          cursor: 'nwse-resize',
          zIndex: 1150,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '4px', height: '4px' }} />
      </button>

      <button
        type="button"
        aria-label="Arrastra para cambiar ancho de la barra"
        title="Arrastra para cambiar ancho de la barra"
        onMouseDown={(e) => onStartResize(e, 'dock', 'e')}
        className="dock-resize-handle dock-resize-handle-e"
        style={{
          position: 'absolute',
          right: '-5px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '10px',
          height: '24px',
          cursor: 'ew-resize',
          zIndex: 1140,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '2px', height: '10px' }} />
      </button>

      <button
        type="button"
        aria-label="Arrastra para cambiar alto de la barra"
        title="Arrastra para cambiar alto de la barra"
        onMouseDown={(e) => onStartResize(e, 'dock', 's')}
        className="dock-resize-handle dock-resize-handle-s"
        style={{
          position: 'absolute',
          bottom: '-5px',
          left: '50%',
          transform: TRANSLATE_X_50,
          width: '24px',
          height: '10px',
          cursor: 'ns-resize',
          zIndex: 1140,
        }}
      >
        <div className="dock-resize-handle-notch" style={{ width: '10px', height: '2px' }} />
      </button>
    </>
  );
};

export const UnifiedDockResizeHandles = DockBarResizeHandles;

const getLaunchIcon = (
  isRunning: boolean,
  isLaunchHovered: boolean,
  isLaunching: boolean,
  iconSize: number,
) => {
  if (isRunning) {
    if (isLaunchHovered) {
      return <Square size={iconSize - 2} fill="currentColor" />;
    }
    return <CheckCircle2 size={iconSize + 2} />;
  }
  if (isLaunching) {
    return <Loader2 size={iconSize + 2} style={{ animation: 'spin 1s linear infinite' }} />;
  }
  return <Rocket size={iconSize + 2} style={{ transform: 'rotate(45deg)' }} />;
};

const getLaunchLabel = (
  isRunning: boolean,
  isLaunchHovered: boolean,
  isLaunching: boolean,
  launchProgress: number,
  t: ReturnType<typeof useT>,
) => {
  if (isRunning) {
    return isLaunchHovered ? t.dock.stopGame : t.dock.running;
  }
  if (isLaunching) return `${launchProgress}%`;
  return t.dock.launch;
};

export interface DockButtonContentProps {
  btnId: DockButtonId;
  dockConfig: LauncherState['dockConfig'];
  accentColor: string;
  startColor: string;
  iconSize: number;
  labelFontSize: string;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  activeAccount?: UserAccount;
  activeInstance?: LauncherState['instances'][number];
  activeModuleButtons: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>;
  isRunning: boolean;
  isLaunching: boolean;
  launchProgress: number;
  isLaunchHovered: boolean;
  t: ReturnType<typeof useT>;
  customColor?: string | null;
}

const InstancesButtonContent: React.FC<{
  customColor?: string | null;
  activeInstance?: LauncherState['instances'][number];
  accentColor: string;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  dockConfig: LauncherState['dockConfig'];
  iconSize: number;
  labelFontSize: string;
  t: ReturnType<typeof useT>;
}> = ({
  customColor,
  activeInstance,
  accentColor,
  isButtonLabelVisible,
  dockConfig,
  iconSize,
  labelFontSize,
  t,
}) => {
  const iconColor = customColor ?? (activeInstance?.isOfficial ? accentColor : '#22c55e');
  const shouldShowLabel = isButtonLabelVisible('instances');
  const defaultIcon = activeInstance?.loaderType ? (
    <LoaderLogo
      type={activeInstance.loaderType}
      size={iconSize}
      style={{
        filter: customColor
          ? `drop-shadow(0 0 6px ${customColor}80)`
          : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.45))',
        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    />
  ) : (
    <Layers
      size={iconSize}
      style={{
        color: iconColor,
        filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
      }}
    />
  );
  return (
    <>
      {renderIconWithCustomization('instances', defaultIcon, iconColor, dockConfig, iconSize)}
      <AnimatedDockLabel
        show={shouldShowLabel}
        fontSize={labelFontSize}
        color={customColor ?? undefined}
      >
        {t.dock.instances}
      </AnimatedDockLabel>
    </>
  );
};

const AboutButtonContent: React.FC<{
  customColor?: string | null;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  dockConfig: LauncherState['dockConfig'];
  iconSize: number;
  labelFontSize: string;
  t: ReturnType<typeof useT>;
}> = ({ customColor, isButtonLabelVisible, dockConfig, iconSize, labelFontSize, t }) => {
  const shouldShowLabel = isButtonLabelVisible('about');
  return (
    <>
      {renderIconWithCustomization(
        'about',
        <Info
          size={iconSize}
          style={{
            color: customColor ?? undefined,
            filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
          }}
        />,
        customColor ?? undefined,
        dockConfig,
        iconSize,
      )}
      <AnimatedDockLabel
        show={shouldShowLabel}
        fontSize={labelFontSize}
        color={customColor ?? undefined}
      >
        {t.dock.about}
      </AnimatedDockLabel>
    </>
  );
};

const AccountsButtonContent: React.FC<{
  customColor?: string | null;
  activeAccount?: UserAccount;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  dockConfig: LauncherState['dockConfig'];
  iconSize: number;
  labelFontSize: string;
  t: ReturnType<typeof useT>;
}> = ({
  customColor,
  activeAccount,
  isButtonLabelVisible,
  dockConfig,
  iconSize,
  labelFontSize,
  t,
}) => {
  const avatarSrc = resolveAccountAvatarSrc(activeAccount);
  const shouldShowLabel = isButtonLabelVisible('accounts');
  const defaultAvatar = (
    <div
      className="dock-icon-wrapper avatar-box"
      style={{
        width: `${iconSize + 4}px`,
        height: `${iconSize + 4}px`,
        borderColor: customColor ?? undefined,
        boxShadow: customColor ? `0 0 10px ${customColor}66` : undefined,
      }}
    >
      {avatarSrc ? (
        <img src={avatarSrc} alt="Skin" className="dock-player-head" />
      ) : (
        <User size={iconSize - 2} style={{ color: customColor ?? undefined }} />
      )}
    </div>
  );
  return (
    <>
      {renderIconWithCustomization(
        'accounts',
        defaultAvatar,
        customColor ?? undefined,
        dockConfig,
        iconSize,
      )}
      <AnimatedDockLabel
        show={shouldShowLabel}
        fontSize={labelFontSize}
        color={customColor ?? undefined}
      >
        {t.dock.accounts}
      </AnimatedDockLabel>
    </>
  );
};

const SettingsButtonContent: React.FC<{
  customColor?: string | null;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  dockConfig: LauncherState['dockConfig'];
  iconSize: number;
  labelFontSize: string;
  t: ReturnType<typeof useT>;
}> = ({ customColor, isButtonLabelVisible, dockConfig, iconSize, labelFontSize, t }) => {
  const shouldShowLabel = isButtonLabelVisible('settings');
  return (
    <>
      {renderIconWithCustomization(
        'settings',
        <Settings
          size={iconSize}
          style={{
            color: customColor ?? undefined,
            filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
          }}
        />,
        customColor ?? undefined,
        dockConfig,
        iconSize,
      )}
      <AnimatedDockLabel
        show={shouldShowLabel}
        fontSize={labelFontSize}
        color={customColor ?? undefined}
      >
        {t.dock.settings}
      </AnimatedDockLabel>
    </>
  );
};

const LaunchButtonContent: React.FC<{
  isRunning: boolean;
  isLaunchHovered: boolean;
  isLaunching: boolean;
  launchProgress: number;
  customColor?: string | null;
  startColor: string;
  accentColor: string;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  dockConfig: LauncherState['dockConfig'];
  iconSize: number;
  labelFontSize: string;
  t: ReturnType<typeof useT>;
}> = ({
  isRunning,
  isLaunchHovered,
  isLaunching,
  launchProgress,
  customColor,
  startColor,
  accentColor,
  isButtonLabelVisible,
  dockConfig,
  iconSize,
  labelFontSize,
  t,
}) => {
  const isStopping = isRunning && isLaunchHovered;
  const launchIconColor = isStopping ? '#ef4444' : (customColor ?? startColor);
  const launchLabelColor = isStopping ? '#ef4444' : startColor;
  const shouldShowLabel = isButtonLabelVisible('launch');
  return (
    <>
      {renderIconWithCustomization(
        'launch',
        <div
          style={{
            color: launchIconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease',
          }}
        >
          {getLaunchIcon(isRunning, isLaunchHovered, isLaunching, iconSize)}
        </div>,
        launchIconColor,
        dockConfig,
        iconSize,
      )}
      <AnimatedDockLabel
        show={shouldShowLabel}
        fontSize={labelFontSize}
        color={launchLabelColor}
        fontWeight={800}
        transition="color 0.15s ease"
      >
        {getLaunchLabel(isRunning, isLaunchHovered, isLaunching, launchProgress, t)}
      </AnimatedDockLabel>

      {isLaunching && (
        <div className="dock-launch-progress">
          <div
            className="dock-launch-fill"
            style={{
              width: `${launchProgress}%`,
              background: `linear-gradient(to right, ${startColor}, ${accentColor})`,
            }}
          />
        </div>
      )}
    </>
  );
};

const ModuleButtonContent: React.FC<{
  customColor?: string | null;
  dockConfig: LauncherState['dockConfig'];
  accentColor: string;
  isButtonLabelVisible: (btnId: DockButtonId) => boolean;
  labelFontSize: string;
  btnId: DockButtonId;
  modItem: {
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  };
}> = ({
  customColor,
  dockConfig,
  accentColor,
  isButtonLabelVisible,
  labelFontSize,
  btnId,
  modItem,
}) => {
  const { slot } = modItem;
  const modCustomColor =
    customColor || dockConfig.customButtonColors?.[btnId] || slot.defaultColor || accentColor;
  const shouldShowLabel = isButtonLabelVisible(btnId);
  return (
    <>
      <div className="dock-icon-wrapper" data-dock-icon="true" style={{ color: modCustomColor }}>
        {slot.icon}
      </div>
      <AnimatedDockLabel show={shouldShowLabel} fontSize={labelFontSize} color={modCustomColor}>
        {slot.label}
      </AnimatedDockLabel>
    </>
  );
};

export const DockButtonContent: React.FC<DockButtonContentProps> = (props) => {
  const { btnId, activeModuleButtons } = props;
  if (btnId === 'instances') return <InstancesButtonContent {...props} />;
  if (btnId === 'about') return <AboutButtonContent {...props} />;
  if (btnId === 'accounts') return <AccountsButtonContent {...props} />;
  if (btnId === 'settings') return <SettingsButtonContent {...props} />;
  if (btnId === 'launch') return <LaunchButtonContent {...props} />;
  if (btnId.startsWith('mod:')) {
    const modId = btnId.slice(4);
    const modItem = activeModuleButtons.find((m) => m.module.id === modId);
    if (modItem) return <ModuleButtonContent {...props} modItem={modItem} />;
  }
  return null;
};

const executeDockButtonClick = (
  btnId: DockButtonId,
  isEditingHud: boolean,
  isRunning: boolean,
  isLaunching: boolean,
  activeModuleButtons: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>,
) => {
  if (isEditingHud) {
    const isInspectorOpen = useLauncherStore.getState().isButtonInspectorOpen;
    launcherActions.setSelectedDockButtonId(btnId, isInspectorOpen);
    return;
  }
  if (btnId === 'instances') launcherActions.openModal('instances');
  else if (btnId === 'about') launcherActions.openModal('about');
  else if (btnId === 'accounts') launcherActions.openModal('accounts');
  else if (btnId === 'settings') launcherActions.openModal('settings');
  else if (btnId === 'launch') {
    if (isRunning) launcherActions.killGameFlow();
    else if (!isLaunching) launcherActions.startLaunchFlow();
  } else if (btnId.startsWith('mod:')) {
    const modId = btnId.slice(4);
    const modItem = activeModuleButtons.find((m) => m.module.id === modId);
    if (modItem) {
      modItem.slot.onClick(getModuleContext(modItem.module.id));
    }
  }
};

const handleDockButtonDoubleClick = (
  btnId: DockButtonId,
  isEditingHud: boolean,
  setInspectorTab: (tab: 'bg' | 'icon') => void,
  e?: React.MouseEvent,
) => {
  if (isEditingHud) {
    e?.preventDefault();
    const targetEl = e?.target as HTMLElement | null;
    const isIconClick = Boolean(targetEl?.closest?.('[data-dock-icon="true"], .dock-icon-wrapper'));
    setInspectorTab(isIconClick ? 'icon' : 'bg');
    launcherActions.setSelectedDockButtonId(btnId, true);
  }
};

const handleDockButtonContextMenu = (
  btnId: DockButtonId,
  isEditingHud: boolean,
  setInspectorTab: (tab: 'bg' | 'icon') => void,
  e?: React.MouseEvent,
) => {
  e?.preventDefault();
  const targetEl = e?.target as HTMLElement | null;
  const isIconClick = Boolean(targetEl?.closest?.('[data-dock-icon="true"], .dock-icon-wrapper'));
  setInspectorTab(isIconClick ? 'icon' : 'bg');
  if (!isEditingHud) {
    launcherActions.setEditingHud(true);
  }
  launcherActions.setSelectedDockButtonId(btnId, true);
};

const useDockWindowResize = (
  dockConfig: LauncherState['dockConfig'],
  dockRef: React.RefObject<HTMLDivElement | null>,
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>,
) => {
  useEffect(() => {
    const handleResize = () => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

      if (dockConfig.positionPreset === 'free') {
        clampDockPosition(dockConfig.customCoordinates, dockRef.current, dockConfig, winW, winH);
      }
      if (dockConfig.layoutMode === 'free_buttons') {
        clampFreeButtonPositions(dockConfig, buttonRefs.current, winW, winH);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dockConfig, dockRef, buttonRefs]);
};

export const HomeDock: React.FC = () => {
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);
  const instances = useLauncherStore((s: LauncherState) => s.instances);
  const activeInstanceId = useLauncherStore((s: LauncherState) => s.activeInstanceId);
  const launch = useLauncherStore((s: LauncherState) => s.launch);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);
  const selectedDockButtonId = useLauncherStore((s: LauncherState) => s.selectedDockButtonId);
  const isButtonInspectorOpen = useLauncherStore((s: LauncherState) => s.isButtonInspectorOpen);
  const t = useT();
  const effectiveHudSide = getEffectiveHudSide(dockConfig, hudManualSide);

  const modules = useModuleStore((s) => s.modules);
  const enabledModuleIds = useModuleStore((s) => s.enabledModuleIds);

  const activeModuleButtons = useMemo(() => {
    const enabledSet = new Set(enabledModuleIds);
    return modules
      .filter((m) => enabledSet.has(m.id) && Boolean(m.slots.dockButton))
      .map((m) => ({
        module: m,
        slot: m.slots.dockButton!,
      }));
  }, [modules, enabledModuleIds]);

  const visibleButtonsSet = useMemo(
    () => new Set(dockConfig.visibleButtons),
    [dockConfig.visibleButtons],
  );
  const activeButtons = useMemo(
    () => dockConfig.buttonOrder.filter((id) => visibleButtonsSet.has(id)),
    [dockConfig.buttonOrder, visibleButtonsSet],
  );

  const [isHovered, setIsHovered] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'bg' | 'icon' | 'fx' | 'shape'>('bg');
  const [isLaunchHovered, setIsLaunchHovered] = useState(false);

  const dockRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeAccount = accounts.find((a: UserAccount) => a.id === activeAccountId);
  const activeInstance = instances.find((i) => i.id === activeInstanceId) || instances[0];
  const isLaunching = launch.status !== 'IDLE' && launch.status !== 'RUNNING';
  const isRunning = launch.status === 'RUNNING';

  const {
    draggingTarget,
    tempPos,
    isColliding,
    justDraggedRef,
    onStartDockDrag,
    onStartButtonDrag,
  } = useDockDrag({
    dockConfig,
    effectiveHudSide,
    isEditingHud,
    dockRef,
    buttonRefs,
  });

  const { resizing, liveResizeDims, handleStartResize } = useDockResize({
    dockConfig,
    activeButtons,
    activeModuleButtonsCount: activeModuleButtons.length,
    justDraggedRef,
    dockRef,
    buttonRefs,
  });

  useDockWindowResize(dockConfig, dockRef, buttonRefs);

  const buttonCount = Math.max(1, activeButtons.length + activeModuleButtons.length);
  const hasLaunch = activeButtons.includes('launch');
  const isDockResizing = resizing?.btnId === 'dock';
  const liveDockDims = isDockResizing && liveResizeDims ? liveResizeDims : null;

  const {
    showLabels,
    segmentWidth,
    segmentHeight,
    startSegmentWidth,
    iconSize,
    labelFontSize,
    effectiveSegmentWidthPx,
    effectiveSegmentHeightPx,
  } = computeDockDimensions({
    dockConfig,
    liveDockDims,
    buttonCount,
    hasLaunch,
  });

  const { startColor, startSubtleBg, startHoverBg } = resolveStartButtonColors(
    dockConfig,
    accentColor,
  );

  const getButtonCustomColor = (btnId: DockButtonId): string | null => {
    return dockConfig.customButtonColors?.[btnId] ?? null;
  };

  const isButtonLabelVisible = (btnId: DockButtonId) =>
    isDockButtonLabelVisible({
      btnId,
      showLabels,
      layoutMode: dockConfig.layoutMode,
      effectiveSegmentHeightPx,
      effectiveSegmentWidthPx,
      btnCustom: dockConfig.buttonCustomizations?.[btnId],
      isResizingThis: resizing?.btnId === btnId,
      liveResizeDims,
      iconScale: dockConfig.iconScale,
      iconSize,
      isCompact: dockConfig.scale === 'compact',
    });

  const renderButtonContent = (btnId: DockButtonId) => (
    <DockButtonContent
      btnId={btnId}
      dockConfig={dockConfig}
      accentColor={accentColor}
      startColor={startColor}
      iconSize={iconSize}
      labelFontSize={labelFontSize}
      isButtonLabelVisible={isButtonLabelVisible}
      activeAccount={activeAccount}
      activeInstance={activeInstance}
      activeModuleButtons={activeModuleButtons}
      isRunning={isRunning}
      isLaunching={isLaunching}
      launchProgress={launch.progress}
      isLaunchHovered={isLaunchHovered}
      t={t}
      customColor={
        dockConfig.buttonCustomizations?.[btnId]?.contentColor ?? getButtonCustomColor(btnId)
      }
    />
  );

  const renderResizeHandles = (btnId: DockButtonId) => (
    <DockButtonResizeHandles
      btnId={btnId}
      isEditingHud={isEditingHud}
      selectedDockButtonId={selectedDockButtonId}
      resizing={resizing}
      liveResizeDims={liveResizeDims}
      accentColor={accentColor}
      isButtonLabelVisible={isButtonLabelVisible}
      onStartResize={handleStartResize}
    />
  );

  const renderDockResizeHandles = () => (
    <DockBarResizeHandles
      isEditingHud={isEditingHud}
      resizing={resizing}
      liveResizeDims={liveResizeDims}
      accentColor={accentColor}
      borderRadius={dockConfig.borderRadius}
      onStartResize={handleStartResize}
    />
  );

  const handleButtonClick = (btnId: DockButtonId) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    executeDockButtonClick(btnId, isEditingHud, isRunning, isLaunching, activeModuleButtons);
  };

  const handleDoubleClick = (btnId: DockButtonId, e?: React.MouseEvent) => {
    handleDockButtonDoubleClick(btnId, isEditingHud, setInspectorTab, e);
  };

  const handleContextMenu = (btnId: DockButtonId, e?: React.MouseEvent) => {
    handleDockButtonContextMenu(btnId, isEditingHud, setInspectorTab, e);
  };

  if (dockConfig.layoutMode === 'free_buttons') {
    return (
      <FreeButtonsLayout
        activeButtons={activeButtons}
        activeModuleButtons={activeModuleButtons}
        dockConfig={dockConfig}
        draggingTarget={draggingTarget}
        tempPos={tempPos}
        isEditingHud={isEditingHud}
        isColliding={isColliding}
        t={t}
        buttonRefs={buttonRefs}
        onButtonClick={handleButtonClick}
        onButtonDoubleClick={handleDoubleClick}
        onButtonContextMenu={handleContextMenu}
        onButtonMouseDown={onStartButtonDrag}
        renderButtonContent={renderButtonContent}
        renderResizeHandles={renderResizeHandles}
        selectedDockButtonId={selectedDockButtonId}
        isInspectorOpen={isButtonInspectorOpen}
        isResizing={Boolean(resizing)}
        resizing={resizing}
        liveResizeDims={liveResizeDims}
        inspectorTab={inspectorTab}
        onCloseInspector={() => launcherActions.setSelectedDockButtonId(null)}
        isRunning={isRunning}
        isLaunching={isLaunching}
        startSegmentWidth={startSegmentWidth}
        segmentWidth={segmentWidth}
        segmentHeight={segmentHeight}
        startHoverBg={startHoverBg}
        startSubtleBg={startSubtleBg}
        startColor={startColor}
        getButtonCustomColor={getButtonCustomColor}
        accentColor={accentColor}
        isLaunchHovered={isLaunchHovered}
        onLaunchHover={setIsLaunchHovered}
      />
    );
  }

  let dockPos = tempPos;
  if (draggingTarget !== 'dock' || !dockPos) {
    dockPos = getEffectiveDockPosition(
      dockConfig,
      { isEditing: isEditingHud, side: effectiveHudSide },
      typeof window !== 'undefined' ? window.innerHeight : 720,
    );
  }

  return (
    <GroupedDockLayout
      dockConfig={dockConfig}
      dockPos={dockPos}
      draggingTarget={draggingTarget}
      isEditingHud={isEditingHud}
      isColliding={isColliding}
      isHovered={isHovered}
      setIsHovered={setIsHovered}
      dockRef={dockRef}
      onDockMouseDown={onStartDockDrag}
      selectedDockButtonId={selectedDockButtonId}
      isInspectorOpen={isButtonInspectorOpen}
      inspectorTab={inspectorTab}
      onCloseInspector={() => launcherActions.setSelectedDockButtonId(null)}
      t={t}
      activeButtons={activeButtons}
      activeModuleButtons={activeModuleButtons}
      buttonRefs={buttonRefs}
      onButtonClick={handleButtonClick}
      onButtonDoubleClick={handleDoubleClick}
      onButtonContextMenu={handleContextMenu}
      renderButtonContent={renderButtonContent}
      renderDockResizeHandles={renderDockResizeHandles}
      isRunning={isRunning}
      isLaunching={isLaunching}
      startSegmentWidth={startSegmentWidth}
      segmentWidth={segmentWidth}
      segmentHeight={segmentHeight}
      startHoverBg={startHoverBg}
      startSubtleBg={startSubtleBg}
      startColor={startColor}
      getButtonCustomColor={getButtonCustomColor}
      accentColor={accentColor}
      showLabels={showLabels}
      labelFontSize={labelFontSize}
      isButtonLabelVisible={isButtonLabelVisible}
      isLaunchHovered={isLaunchHovered}
      onLaunchHover={setIsLaunchHovered}
    />
  );
};
