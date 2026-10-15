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
  getActiveObstacles,
  resolveCollisionAndClamp,
  getElementDimensions,
  getEffectiveDockPosition,
  getEffectiveHudSide,
  getSafeYBelowHudBar,
} from '../utils/collisionSystem';
import { DockButtonInspector, InspectorTab } from './DockButtonInspector';
import { LoaderLogo } from './common/LoaderIcons';

export type DraggingTargetId = 'dock' | DockButtonId | null;

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
} from '../utils/homeDockUtils';

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
  onClick: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  buttonContent: React.ReactNode;
  resizeHandles: React.ReactNode;
  isSelected: boolean;
  inspectorTab: InspectorTab;
  onCloseInspector: () => void;
  accentColor?: string;
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
  const badgeColor = accentColor || '#16A085';
  return (
    <div
      style={{
        position: 'absolute',
        top: '-18px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: isDanger ? 'rgba(239, 68, 68, 0.95)' : 'rgba(10, 14, 22, 0.9)',
        border: isDanger ? '1px solid #f87171' : `1px solid ${badgeColor}`,
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '9px',
        fontWeight: 700,
        color: isDanger ? '#ffffff' : badgeColor,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: isDanger ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
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
      transform: 'translateX(-50%)',
      zIndex: 1000,
    }}
  >
    <DockButtonInspector buttonId={btnId} initialTab={inspectorTab} onClose={onClose} />
  </div>
);

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
  onMouseDown,
  buttonContent,
  resizeHandles,
  isSelected,
  inspectorTab,
  onCloseInspector,
  accentColor,
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

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
        transformOrigin: 'center center',
        zIndex: resolveButtonZIndex(isDraggingThis, isEditingHud),
        transition: isDraggingThis
          ? 'none'
          : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, transform 0.2s ease',
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onMouseDown={onMouseDown}
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
            startHoverBg,
            startSubtleBg,
            customBtnColor,
            fallbackBg: `rgba(12, 17, 24, ${dockConfig.bgOpacity})`,
          }),
          color: resolveButtonColor(btnCustom, isLaunch, startColor, customBtnColor),
          border: borderStyle,
          boxShadow: shadowStyle,
          backdropFilter: 'blur(20px)',
          cursor: cursorStyle,
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

        {isEditingHud && (
          <FreeButtonCoordBadge
            isDraggingThis={isDraggingThis}
            isColliding={isColliding}
            pos={pos}
            collisionLabel={t.hudEditor.collision}
            accentColor={accentColor}
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
          {buttonContent}
        </div>
      </button>

      {resizeHandles}

      {isEditingHud && isSelected && (
        <FreeButtonInspectorPopup
          posY={pos.y}
          btnId={btnId}
          inspectorTab={inspectorTab}
          onClose={onCloseInspector}
        />
      )}
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
  effectiveHudSide: string;
  isColliding: boolean;
  t: ReturnType<typeof useT>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onButtonClick: (btnId: DockButtonId) => void;
  onButtonMouseDown: (e: React.MouseEvent, btnId: DockButtonId) => void;
  renderButtonContent: (btnId: DockButtonId) => React.ReactNode;
  renderResizeHandles: (btnId: DockButtonId) => React.ReactNode;
  selectedDockButtonId: DockButtonId | null;
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
}

const FreeButtonsLayout: React.FC<FreeButtonsLayoutProps> = ({
  activeButtons,
  activeModuleButtons,
  dockConfig,
  draggingTarget,
  tempPos,
  isEditingHud,
  effectiveHudSide,
  isColliding,
  t,
  buttonRefs,
  onButtonClick,
  onButtonMouseDown,
  renderButtonContent,
  renderResizeHandles,
  selectedDockButtonId,
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
        let pos =
          isDraggingThis && tempPos
            ? tempPos
            : dockConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };

        if (!isDraggingThis && isEditingHud && effectiveHudSide === 'center') {
          const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
          const safeY = getSafeYBelowHudBar(`btn:${btnId}`, dockConfig, winH);
          if (pos.y < safeY && pos.x > 15 && pos.x < 85) {
            pos = { x: pos.x, y: safeY };
          }
        }

        const isLaunch = btnId === 'launch';
        const btnCustom = dockConfig.buttonCustomizations?.[btnId];
        const customBtnColor = getButtonCustomColor(btnId);

        const defaultBtnW = isLaunch ? startSegmentWidth : segmentWidth;
        const defaultBtnH = segmentHeight;
        const btnW = btnCustom?.customWidth ? `${btnCustom.customWidth}px` : defaultBtnW;
        const btnH = btnCustom?.customHeight ? `${btnCustom.customHeight}px` : defaultBtnH;
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
            onClick={() => onButtonClick(btnId)}
            onMouseDown={(e) => onButtonMouseDown(e, btnId)}
            buttonContent={renderButtonContent(btnId)}
            resizeHandles={renderResizeHandles(btnId)}
            isSelected={selectedDockButtonId === btnId}
            inspectorTab={inspectorTab}
            onCloseInspector={onCloseInspector}
            accentColor={accentColor}
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
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: 'bg' | 'icon' | 'fx' | 'shape') => void;
  onCloseInspector: () => void;
  t: ReturnType<typeof useT>;
  activeButtons: DockButtonId[];
  activeModuleButtons: Array<{
    module: LauncherModule;
    slot: NonNullable<LauncherModule['slots']['dockButton']>;
  }>;
  buttonRefs: React.RefObject<Record<string, HTMLButtonElement | null>>;
  onButtonClick: (btnId: DockButtonId) => void;
  renderButtonContent: (btnId: DockButtonId) => React.ReactNode;
  renderResizeHandles: (btnId: DockButtonId) => React.ReactNode;
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
}

const GroupedDockLayout: React.FC<GroupedDockLayoutProps> = ({
  dockConfig,
  dockPos,
  draggingTarget,
  isEditingHud,
  isHovered,
  setIsHovered,
  dockRef,
  onDockMouseDown,
  selectedDockButtonId,
  inspectorTab,
  setInspectorTab,
  onCloseInspector,
  t,
  activeButtons,
  activeModuleButtons,
  buttonRefs,
  onButtonClick,
  renderButtonContent,
  renderResizeHandles,
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
}) => {
  const dockZIndex = resolveButtonZIndex(draggingTarget === 'dock', isEditingHud);
  const dockBorder = resolveDockBorder(isEditingHud, dockConfig.dockBorderColorMode);
  const dockBoxShadow = resolveDockBoxShadow(isEditingHud, dockConfig.dockBorderColorMode);
  const dockCursor = resolveDockCursor(isEditingHud, draggingTarget === 'dock');

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
        transition:
          draggingTarget === 'dock'
            ? 'none'
            : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Quick Access Bar */}
      {!isEditingHud && isHovered && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
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
            <div
              style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.15)' }}
            />
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
      )}

      {/* Floating In-Place Inspector for Selected Button in Unified Dock */}
      {isEditingHud && selectedDockButtonId && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 14px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <DockButtonInspector
            buttonId={selectedDockButtonId}
            initialTab={inspectorTab}
            onClose={onCloseInspector}
          />
        </div>
      )}

      {/* Main Unified Dock Container */}
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
        {/* Dock Panoramic / Shared Background Layer */}
        {dockConfig.dockBgType === 'image' && dockConfig.dockBgImage && (
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
        )}
        {dockConfig.dockBgType === 'video' && dockConfig.dockBgVideo && (
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
        )}
        {activeButtons.map((btnId, idx) => {
          const isLaunch = btnId === 'launch';
          const btnCustom = dockConfig.buttonCustomizations?.[btnId];
          const customBtnColor = getButtonCustomColor(btnId);
          const isLast = idx === activeButtons.length - 1 && activeModuleButtons.length === 0;
          const borderRightStyle = isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)';

          const defaultBtnW = isLaunch ? startSegmentWidth : segmentWidth;
          const defaultBtnH = segmentHeight;
          const btnW = btnCustom?.customWidth ? `${btnCustom.customWidth}px` : defaultBtnW;
          const btnH = btnCustom?.customHeight ? `${btnCustom.customHeight}px` : defaultBtnH;
          const scale = btnCustom?.scale ?? 1;
          const rotation = btnCustom?.rotation ?? 0;
          const radius =
            btnCustom?.borderRadius !== undefined ? `${btnCustom.borderRadius}px` : undefined;
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
                onClick={() => onButtonClick(btnId)}
                className={`dock-segment ${isLaunch ? 'start-game' : ''} ${resolveStatusClass(
                  isRunning,
                  isLaunching,
                )} ${effectClass}`}
                style={{
                  width: btnW,
                  height: btnH,
                  borderRight: borderRightStyle,
                  borderRadius: radius,
                  transform:
                    scale !== 1 || rotation !== 0
                      ? `scale(${scale}) rotate(${rotation}deg)`
                      : undefined,
                  transformOrigin: 'center center',
                  background: resolveButtonBg({
                    btnCustom,
                    isLaunch,
                    isRunning,
                    isLaunching,
                    startHoverBg,
                    startSubtleBg,
                    customBtnColor,
                    fallbackBg: 'transparent',
                  }),
                  color: (() => {
                    if (btnCustom?.contentColor) return btnCustom.contentColor;
                    return isLaunch ? startColor : (customBtnColor ?? '#cbd5e1');
                  })(),
                  cursor: isEditingHud && draggingTarget === 'dock' ? 'grabbing' : 'pointer',
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

              {renderResizeHandles(btnId)}
            </div>
          );
        })}

        {/* Dynamic Plugin / Module Dock Buttons */}
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
              onClick={() => {
                if (isEditingHud) {
                  launcherActions.setSelectedDockButtonId(`mod:${mod.id}` as DockButtonId);
                  setInspectorTab('bg');
                  return;
                }
                slot.onClick(getModuleContext(mod.id));
              }}
              title={slot.tooltip || slot.label}
              className="dock-segment"
              style={{
                width: segmentWidth,
                height: segmentHeight,
                borderRight: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)',
                background: `${modCustomColor}14`,
                color: modCustomColor,
                cursor: isEditingHud ? 'pointer' : 'pointer',
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
      </div>
    </section>
  );
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

  const [draggingTarget, setDraggingTarget] = useState<'dock' | DockButtonId | null>(null);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // In-canvas button resize state (WYSIWYG corner dragging)
  const [resizing, setResizing] = useState<{
    btnId: DockButtonId;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    direction: 'se' | 's' | 'e';
  } | null>(null);
  const [liveResizeDims, setLiveResizeDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [inspectorTab, setInspectorTab] = useState<'bg' | 'icon' | 'fx' | 'shape'>('bg');

  const dockRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    hasMoved: boolean;
  } | null>(null);

  const activeAccount = accounts.find((a: UserAccount) => a.id === activeAccountId);
  const activeInstance = instances.find((i) => i.id === activeInstanceId) || instances[0];
  const isLaunching = launch.status !== 'IDLE' && launch.status !== 'RUNNING';
  const isRunning = launch.status === 'RUNNING';

  // Dragging with Anti-Stacking Collision System & Click-Threshold Isolation
  useEffect(() => {
    if (!draggingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dist = Math.hypot(
        e.clientX - dragStartRef.current.clientX,
        e.clientY - dragStartRef.current.clientY,
      );

      // Threshold: Ignore jitter/clicks < 5px
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
      );

      setTempPos({ x: resolved.x, y: resolved.y });
      setIsColliding(resolved.isColliding);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dragInfo = dragStartRef.current;
      dragStartRef.current = null;

      // If user simply clicked without intentional dragging, NEVER displace the element!
      if (!dragInfo?.hasMoved) {
        if (isEditingHud && draggingTarget && draggingTarget !== 'dock') {
          launcherActions.setSelectedDockButtonId(draggingTarget);
          setInspectorTab('bg');
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
      );

      if (draggingTarget === 'dock') {
        launcherActions.setDockConfig({
          positionPreset: 'free',
          customCoordinates: { x: resolved.x, y: resolved.y },
        });
      } else {
        launcherActions.setButtonPosition(draggingTarget, { x: resolved.x, y: resolved.y });
      }

      setDraggingTarget(null);
      setTempPos(null);
      setIsColliding(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTarget, dockConfig, isEditingHud, effectiveHudSide]);

  // Interactive corner resizing (WYSIWYG on-canvas drag)
  useEffect(() => {
    if (!resizing) return;

    let currentDims = { width: resizing.startWidth, height: resizing.startHeight };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      let newW = resizing.startWidth;
      let newH = resizing.startHeight;

      if (resizing.direction === 'se' || resizing.direction === 'e') {
        newW = Math.max(50, Math.min(420, Math.round(resizing.startWidth + deltaX)));
      }
      if (resizing.direction === 'se' || resizing.direction === 's') {
        newH = Math.max(46, Math.min(280, Math.round(resizing.startHeight + deltaY)));
      }

      currentDims = { width: newW, height: newH };
      setLiveResizeDims(currentDims);
    };

    const handleMouseUp = () => {
      const finalW = currentDims.width;
      const finalH = currentDims.height;
      const autoHide = finalH < 62 || finalW < 70;
      const currentConfig = useLauncherStore.getState().dockConfig;
      const currentBtnCustom = currentConfig.buttonCustomizations?.[resizing.btnId];

      launcherActions.setDockButtonCustomization(resizing.btnId, {
        customWidth: finalW,
        customHeight: finalH,
        ...(currentBtnCustom?.hideLabel !== autoHide ? { hideLabel: autoHide } : {}),
      });

      setResizing(null);
      setLiveResizeDims(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Window resize listener to recalculate limits and bounds
  useEffect(() => {
    const handleResize = () => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

      if (dockConfig.positionPreset === 'free' && dockConfig.customCoordinates) {
        const currentBoxId = 'dock';
        let dims = getElementDimensions(currentBoxId, dockConfig);
        if (dockRef.current) {
          dims = {
            width: dockRef.current.getBoundingClientRect().width,
            height: dockRef.current.getBoundingClientRect().height,
          };
        }
        const obstacles = getActiveObstacles(currentBoxId, dockConfig, winW, winH, undefined, {
          isEditing: isEditingHud,
          side: effectiveHudSide,
        });
        const currentCenterPxX = (dockConfig.customCoordinates.x / 100) * winW;
        const currentCenterPxY = (dockConfig.customCoordinates.y / 100) * winH;
        const resolved = resolveCollisionAndClamp(
          currentCenterPxX,
          currentCenterPxY,
          dims.width,
          dims.height,
          obstacles,
        );
        if (
          Math.abs(resolved.x - dockConfig.customCoordinates.x) > 0.5 ||
          Math.abs(resolved.y - dockConfig.customCoordinates.y) > 0.5
        ) {
          launcherActions.setDockConfig({
            customCoordinates: { x: resolved.x, y: resolved.y },
          });
        }
      }

      if (dockConfig.layoutMode === 'free_buttons') {
        const buttons: DockButtonId[] = ['launch', 'instances', 'accounts', 'settings', 'about'];
        for (const btnId of buttons) {
          const pos = dockConfig.buttonPositions?.[btnId];
          if (!pos) continue;
          const currentBoxId = `btn:${btnId}`;
          let dims = getElementDimensions(currentBoxId, dockConfig);
          const btnEl = buttonRefs.current[btnId];
          if (btnEl) {
            dims = {
              width: btnEl.getBoundingClientRect().width,
              height: btnEl.getBoundingClientRect().height,
            };
          }
          const obstacles = getActiveObstacles(currentBoxId, dockConfig, winW, winH, undefined, {
            isEditing: isEditingHud,
            side: effectiveHudSide,
          });
          const currentCenterPxX = (pos.x / 100) * winW;
          const currentCenterPxY = (pos.y / 100) * winH;
          const resolved = resolveCollisionAndClamp(
            currentCenterPxX,
            currentCenterPxY,
            dims.width,
            dims.height,
            obstacles,
          );
          if (Math.abs(resolved.x - pos.x) > 0.5 || Math.abs(resolved.y - pos.y) > 0.5) {
            launcherActions.setButtonPosition(btnId, { x: resolved.x, y: resolved.y });
          }
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dockConfig, isEditingHud, effectiveHudSide]);

  const handleStartResize = (
    e: React.MouseEvent,
    btnId: DockButtonId,
    direction: 'se' | 's' | 'e',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const btnEl = buttonRefs.current[btnId];
    const rect = btnEl?.getBoundingClientRect();
    const curW = rect ? rect.width : (dockConfig.buttonCustomizations?.[btnId]?.customWidth ?? 120);
    const curH = rect
      ? rect.height
      : (dockConfig.buttonCustomizations?.[btnId]?.customHeight ?? 80);

    setResizing({
      btnId,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: curW,
      startHeight: curH,
      direction,
    });
    setLiveResizeDims({ width: curW, height: curH });
  };

  // Dimension measurements
  const isCompact = dockConfig.scale === 'compact';
  const showLabels = dockConfig.showLabels;

  let segmentWidth = isCompact ? '96px' : '136px';
  let segmentHeight = isCompact ? '74px' : '108px';
  let startSegmentWidth = isCompact ? '114px' : '152px';
  const iconSize = isCompact ? 20 : 24;
  const labelFontSize = isCompact ? '12px' : '13.5px';

  if (!showLabels) {
    segmentWidth = isCompact ? '52px' : '62px';
    segmentHeight = isCompact ? '52px' : '62px';
    startSegmentWidth = isCompact ? '58px' : '68px';
  }

  // Helper to get custom button color if configured
  const getButtonCustomColor = (btnId: DockButtonId): string | null => {
    return dockConfig.customButtonColors?.[btnId] ?? null;
  };

  // Start button color
  const getStartButtonColor = () => {
    if (dockConfig.customButtonColors?.launch) {
      return dockConfig.customButtonColors.launch;
    }
    if (dockConfig.startBtnColorMode === 'accent') {
      return accentColor;
    }
    if (dockConfig.startBtnColorMode === 'custom' && dockConfig.customStartBtnColor) {
      return dockConfig.customStartBtnColor;
    }
    return '#22c55e';
  };

  const startColor = getStartButtonColor();
  const hex = startColor.replace('#', '');
  const parsedR = Number.parseInt(hex.substring(0, 2), 16);
  const r = Number.isNaN(parsedR) ? 34 : parsedR;
  const parsedG = Number.parseInt(hex.substring(2, 4), 16);
  const g = Number.isNaN(parsedG) ? 197 : parsedG;
  const parsedB = Number.parseInt(hex.substring(4, 6), 16);
  const b = Number.isNaN(parsedB) ? 94 : parsedB;
  const startSubtleBg = `rgba(${r}, ${g}, ${b}, 0.16)`;
  const startHoverBg = `rgba(${r}, ${g}, ${b}, 0.28)`;

  const visibleButtonsSet = new Set(dockConfig.visibleButtons);
  const activeButtons = dockConfig.buttonOrder.filter((id) => visibleButtonsSet.has(id));

  const renderCustomSvgIcon = (
    sanitized: string,
    effectiveSize: number,
    effectiveColor?: string,
    onClick?: (e: React.MouseEvent) => void,
  ) => {
    const style: React.CSSProperties = {
      width: `${effectiveSize}px`,
      height: `${effectiveSize}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: effectiveColor,
      cursor: isEditingHud ? 'pointer' : undefined,
      pointerEvents: isEditingHud ? 'auto' : undefined,
      background: 'transparent',
      border: 'none',
      padding: 0,
    };
    if (onClick) {
      return (
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
              e.preventDefault();
              e.stopPropagation();
              onClick(e as unknown as React.MouseEvent);
            }
          }}
          className="dock-icon-wrapper dock-custom-svg"
          aria-label="Icono personalizado"
          style={style}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }
    return (
      <div
        className="dock-icon-wrapper dock-custom-svg"
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  };

  const renderCustomImageIcon = (
    url: string,
    effectiveSize: number,
    onClick?: (e: React.MouseEvent) => void,
  ) => {
    const style: React.CSSProperties = {
      cursor: isEditingHud ? 'pointer' : undefined,
      pointerEvents: isEditingHud ? 'auto' : undefined,
      background: 'transparent',
      border: 'none',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    };
    const imgEl = (
      <img
        src={url}
        alt=""
        style={{ width: `${effectiveSize}px`, height: `${effectiveSize}px`, objectFit: 'contain' }}
      />
    );
    if (onClick) {
      return (
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
              e.preventDefault();
              e.stopPropagation();
              onClick(e as unknown as React.MouseEvent);
            }
          }}
          className="dock-icon-wrapper"
          aria-label="Icono personalizado"
          style={style}
        >
          {imgEl}
        </span>
      );
    }
    return (
      <div className="dock-icon-wrapper" style={style}>
        {imgEl}
      </div>
    );
  };

  const renderDefaultIconWrapper = (
    icon: React.ReactNode,
    scale: number,
    onClick?: (e: React.MouseEvent) => void,
  ) => {
    const style: React.CSSProperties = {
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: isEditingHud ? 'pointer' : undefined,
      pointerEvents: isEditingHud ? 'auto' : undefined,
      background: 'transparent',
      border: 'none',
      padding: 0,
    };
    if (onClick) {
      return (
        <span
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onClick) {
              e.preventDefault();
              e.stopPropagation();
              onClick(e as unknown as React.MouseEvent);
            }
          }}
          className="dock-icon-wrapper"
          style={style}
        >
          {icon}
        </span>
      );
    }
    return (
      <div className="dock-icon-wrapper" style={style}>
        {icon}
      </div>
    );
  };

  // Helper to render icon respecting custom SVG, custom image, or none
  const renderIconWithCustomization = (
    btnId: DockButtonId,
    defaultIcon: React.ReactNode,
    effectiveColor: string | undefined,
  ) => {
    const btnCustom = dockConfig.buttonCustomizations?.[btnId];
    if (btnCustom?.iconType === 'none') {
      return null;
    }
    const scale = btnCustom?.iconScale ?? 1;
    const effectiveSize = Math.round(iconSize * scale);

    const handleIconLayerClick = isEditingHud
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          launcherActions.setSelectedDockButtonId(btnId);
          setInspectorTab('icon');
        }
      : undefined;

    if (btnCustom?.iconType === 'custom_svg' && btnCustom.customSvg) {
      const sanitized = DOMPurify.sanitize(btnCustom.customSvg, {
        USE_PROFILES: { svg: true, svgFilters: true },
      });
      return renderCustomSvgIcon(sanitized, effectiveSize, effectiveColor, handleIconLayerClick);
    }
    if (btnCustom?.iconType === 'custom_image' && btnCustom.customIconUrl) {
      return renderCustomImageIcon(btnCustom.customIconUrl, effectiveSize, handleIconLayerClick);
    }
    return renderDefaultIconWrapper(defaultIcon, scale, handleIconLayerClick);
  };

  const isButtonLabelVisible = (btnId: DockButtonId) => {
    if (!showLabels) return false;
    const btnCustom = dockConfig.buttonCustomizations?.[btnId];
    if (btnCustom?.hideLabel) return false;
    if (btnCustom?.customHeight !== undefined && btnCustom.customHeight < 62) return false;
    if (btnCustom?.customWidth !== undefined && btnCustom.customWidth < 70) return false;
    return true;
  };

  // Helper to render interactive corner resize handles and selection frame
  const renderResizeHandles = (btnId: DockButtonId) => {
    if (!isEditingHud || selectedDockButtonId !== btnId) return null;

    const isCurrentResizing = resizing?.btnId === btnId;
    const currentDims = isCurrentResizing && liveResizeDims ? liveResizeDims : null;
    const handleColor = accentColor || '#16A085';

    return (
      <>
        {/* Selection Bounding Frame */}
        <div
          style={{
            position: 'absolute',
            inset: '-3px',
            border: `2px solid ${handleColor}`,
            borderRadius: 'inherit',
            boxShadow: `0 0 14px ${handleColor}80`,
            pointerEvents: 'none',
            zIndex: 40,
          }}
        />

        {/* Live Size Pill Tooltip while dragging */}
        {currentDims && (
          <div
            style={{
              position: 'absolute',
              bottom: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
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
              zIndex: 60,
            }}
          >
            {currentDims.width} × {currentDims.height} px
            {(currentDims.height < 62 || currentDims.width < 70) && (
              <span style={{ opacity: 0.8, fontWeight: 500 }}> • Sin texto</span>
            )}
          </div>
        )}

        {/* Corner Handle: Bottom-Right (SE) */}
        <button
          type="button"
          aria-label="Pescar esquina: arrastra para cambiar ancho y alto libremente"
          title="Pescar esquina: arrastra para cambiar ancho y alto libremente"
          onMouseDown={(e) => handleStartResize(e, btnId, 'se')}
          style={{
            position: 'absolute',
            right: '-6px',
            bottom: '-6px',
            width: '14px',
            height: '14px',
            background: handleColor,
            border: '2px solid #0a0f18',
            borderRadius: '3px',
            cursor: 'nwse-resize',
            zIndex: 50,
            boxShadow: `0 0 8px ${handleColor}`,
            padding: 0,
          }}
        />

        {/* Edge Handle: Right (E) */}
        <button
          type="button"
          aria-label="Arrastra para cambiar ancho"
          title="Arrastra para cambiar ancho"
          onMouseDown={(e) => handleStartResize(e, btnId, 'e')}
          style={{
            position: 'absolute',
            right: '-5px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '10px',
            height: '22px',
            background: handleColor,
            border: '2px solid #0a0f18',
            borderRadius: '3px',
            cursor: 'ew-resize',
            zIndex: 49,
            padding: 0,
          }}
        />

        {/* Edge Handle: Bottom (S) */}
        <button
          type="button"
          aria-label="Arrastra para cambiar alto"
          title="Arrastra para cambiar alto"
          onMouseDown={(e) => handleStartResize(e, btnId, 's')}
          style={{
            position: 'absolute',
            bottom: '-5px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '22px',
            height: '10px',
            background: handleColor,
            border: '2px solid #0a0f18',
            borderRadius: '3px',
            cursor: 'ns-resize',
            zIndex: 49,
            padding: 0,
          }}
        />
      </>
    );
  };

  const renderInstancesButton = (customColor?: string | null) => {
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
        {renderIconWithCustomization('instances', defaultIcon, iconColor)}
        {shouldShowLabel && (
          <span
            className="dock-label"
            style={{
              fontSize: labelFontSize,
              color: customColor ?? undefined,
            }}
          >
            {t.dock.instances}
          </span>
        )}
      </>
    );
  };

  const renderAboutButton = (customColor?: string | null) => {
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
        )}
        {shouldShowLabel && (
          <span
            className="dock-label"
            style={{
              fontSize: labelFontSize,
              color: customColor ?? undefined,
            }}
          >
            {t.dock.about}
          </span>
        )}
      </>
    );
  };

  const renderAccountsButton = (customColor?: string | null) => {
    const avatarSrc = resolveAccountAvatarSrc(activeAccount);
    const shouldShowLabel = isButtonLabelVisible('accounts');
    const accountsCustom = dockConfig.buttonCustomizations?.accounts;
    const hasCustomIcon =
      accountsCustom?.iconType === 'custom_svg' ||
      accountsCustom?.iconType === 'custom_image' ||
      accountsCustom?.iconType === 'none';

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
        {hasCustomIcon
          ? renderIconWithCustomization('accounts', defaultAvatar, customColor ?? undefined)
          : defaultAvatar}
        {shouldShowLabel && (
          <span
            className="dock-label"
            style={{
              fontSize: labelFontSize,
              color: customColor ?? undefined,
            }}
          >
            {t.dock.accounts}
          </span>
        )}
      </>
    );
  };

  const renderSettingsButton = (customColor?: string | null) => {
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
        )}
        {shouldShowLabel && (
          <span
            className="dock-label"
            style={{
              fontSize: labelFontSize,
              color: customColor ?? undefined,
            }}
          >
            {t.dock.settings}
          </span>
        )}
      </>
    );
  };

  const getLaunchIcon = () => {
    if (isRunning) {
      return <CheckCircle2 size={iconSize + 2} />;
    }
    if (isLaunching) {
      return <Loader2 size={iconSize + 2} style={{ animation: 'spin 1s linear infinite' }} />;
    }
    return <Rocket size={iconSize + 2} style={{ transform: 'rotate(45deg)' }} />;
  };

  const getLaunchLabel = () => {
    if (isRunning) return t.dock.running;
    if (isLaunching) return `${launch.progress}%`;
    return t.dock.launch;
  };

  const renderLaunchButton = (customColor?: string | null) => {
    const launchIconColor = customColor ?? startColor;
    const shouldShowLabel = isButtonLabelVisible('launch');
    return (
      <>
        {renderIconWithCustomization(
          'launch',
          <div style={{ color: launchIconColor }}>{getLaunchIcon()}</div>,
          launchIconColor,
        )}
        {shouldShowLabel && (
          <span
            className="dock-label"
            style={{
              color: startColor,
              fontSize: labelFontSize,
              fontWeight: 800,
            }}
          >
            {getLaunchLabel()}
          </span>
        )}

        {isLaunching && (
          <div className="dock-launch-progress">
            <div
              className="dock-launch-fill"
              style={{
                width: `${launch.progress}%`,
                background: `linear-gradient(to right, ${startColor}, ${accentColor})`,
              }}
            />
          </div>
        )}
      </>
    );
  };

  // Render individual button content
  const renderButtonContent = (btnId: DockButtonId) => {
    const btnCustom = dockConfig.buttonCustomizations?.[btnId];
    const customColor = btnCustom?.contentColor ?? getButtonCustomColor(btnId);

    if (btnId === 'instances') return renderInstancesButton(customColor);
    if (btnId === 'about') return renderAboutButton(customColor);
    if (btnId === 'accounts') return renderAccountsButton(customColor);
    if (btnId === 'settings') return renderSettingsButton(customColor);
    if (btnId === 'launch') return renderLaunchButton(customColor);
    if (btnId.startsWith('mod:')) {
      const modId = btnId.slice(4);
      const modItem = activeModuleButtons.find((m) => m.module.id === modId);
      if (modItem) {
        const { slot } = modItem;
        const modCustomColor =
          customColor || dockConfig.customButtonColors?.[btnId] || slot.defaultColor || accentColor;
        const shouldShowLabel = isButtonLabelVisible(btnId);
        return (
          <>
            <div className="dock-icon-wrapper" style={{ color: modCustomColor }}>
              {slot.icon}
            </div>
            {shouldShowLabel && (
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
          </>
        );
      }
    }
    return null;
  };

  const handleButtonClick = (btnId: DockButtonId) => {
    if (isEditingHud) {
      launcherActions.setSelectedDockButtonId(btnId);
      setInspectorTab('bg');
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

  // ═════════════════════════════════════════════
  // MODE A: INDIVIDUAL / FREE BUTTONS
  // ═════════════════════════════════════════════
  if (dockConfig.layoutMode === 'free_buttons') {
    return (
      <FreeButtonsLayout
        activeButtons={activeButtons}
        activeModuleButtons={activeModuleButtons}
        dockConfig={dockConfig}
        draggingTarget={draggingTarget}
        tempPos={tempPos}
        isEditingHud={isEditingHud}
        effectiveHudSide={effectiveHudSide}
        isColliding={isColliding}
        t={t}
        buttonRefs={buttonRefs}
        onButtonClick={handleButtonClick}
        onButtonMouseDown={(e, btnId) => {
          if (isEditingHud) {
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
          }
        }}
        renderButtonContent={renderButtonContent}
        renderResizeHandles={renderResizeHandles}
        selectedDockButtonId={selectedDockButtonId}
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
      />
    );
  }

  // ═════════════════════════════════════════════
  // MODE B: UNIFIED DOCK (GROUPED)
  // ═════════════════════════════════════════════
  const getDockPosition = (): { x: number; y: number } => {
    if (draggingTarget === 'dock' && tempPos) return tempPos;
    return getEffectiveDockPosition(
      dockConfig,
      { isEditing: isEditingHud, side: effectiveHudSide },
      typeof window !== 'undefined' ? window.innerHeight : 720,
    );
  };

  const dockPos = getDockPosition();

  return (
    <GroupedDockLayout
      dockConfig={dockConfig}
      dockPos={dockPos}
      draggingTarget={draggingTarget}
      isEditingHud={isEditingHud}
      isHovered={isHovered}
      setIsHovered={setIsHovered}
      dockRef={dockRef}
      onDockMouseDown={(e) => {
        if (isEditingHud) {
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
        }
      }}
      selectedDockButtonId={selectedDockButtonId}
      inspectorTab={inspectorTab}
      setInspectorTab={setInspectorTab}
      onCloseInspector={() => launcherActions.setSelectedDockButtonId(null)}
      t={t}
      activeButtons={activeButtons}
      activeModuleButtons={activeModuleButtons}
      buttonRefs={buttonRefs}
      onButtonClick={handleButtonClick}
      renderButtonContent={renderButtonContent}
      renderResizeHandles={renderResizeHandles}
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
    />
  );
};
