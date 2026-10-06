import React, { useState, useEffect, useRef } from 'react';
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
  useT,
} from '../store/launcherStore';
import {
  getActiveObstacles,
  resolveCollisionAndClamp,
  getElementDimensions,
  getEffectiveDockPosition,
  getEffectiveHudSide,
  getSafeYBelowHudBar,
} from '../utils/collisionSystem';

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
  const t = useT();
  const effectiveHudSide = getEffectiveHudSide(dockConfig, hudManualSide);

  const [draggingTarget, setDraggingTarget] = useState<'dock' | DockButtonId | null>(null);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [isColliding, setIsColliding] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
        const rect = buttonRefs.current[draggingTarget]!.getBoundingClientRect();
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
        14,
        64,
        10,
      );

      setTempPos({ x: resolved.x, y: resolved.y });
      setIsColliding(resolved.isColliding);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dragInfo = dragStartRef.current;
      dragStartRef.current = null;

      // If user simply clicked without intentional dragging, NEVER displace the element!
      if (!dragInfo || !dragInfo.hasMoved) {
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
          width: buttonRefs.current[draggingTarget]!.getBoundingClientRect().width,
          height: buttonRefs.current[draggingTarget]!.getBoundingClientRect().height,
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
        14,
        64,
        10,
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
    return dockConfig.customButtonColors?.[btnId] || null;
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
  const r = parseInt(hex.substring(0, 2), 16) || 34;
  const g = parseInt(hex.substring(2, 4), 16) || 197;
  const b = parseInt(hex.substring(4, 6), 16) || 94;
  const startSubtleBg = `rgba(${r}, ${g}, ${b}, 0.16)`;
  const startHoverBg = `rgba(${r}, ${g}, ${b}, 0.28)`;

  const visibleButtonsSet = new Set(dockConfig.visibleButtons);
  const activeButtons = dockConfig.buttonOrder.filter((id) => visibleButtonsSet.has(id));

  // Render individual button content
  const renderButtonContent = (btnId: DockButtonId) => {
    const customColor = getButtonCustomColor(btnId);

    if (btnId === 'instances') {
      const iconColor = customColor || (activeInstance?.isOfficial ? accentColor : '#22c55e');
      return (
        <>
          <div className="dock-icon-wrapper">
            <Layers
              size={iconSize}
              style={{
                color: iconColor,
                filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
              }}
            />
          </div>
          {showLabels && (
            <span
              className="dock-label"
              style={{
                fontSize: labelFontSize,
                color: customColor || undefined,
              }}
            >
              {t.dock.instances}
            </span>
          )}
        </>
      );
    }

    if (btnId === 'about') {
      return (
        <>
          <div className="dock-icon-wrapper">
            <Info
              size={iconSize}
              style={{
                color: customColor || undefined,
                filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
              }}
            />
          </div>
          {showLabels && (
            <span
              className="dock-label"
              style={{
                fontSize: labelFontSize,
                color: customColor || undefined,
              }}
            >
              {t.dock.about}
            </span>
          )}
        </>
      );
    }

    if (btnId === 'accounts') {
      return (
        <>
          <div
            className="dock-icon-wrapper avatar-box"
            style={{
              width: `${iconSize + 4}px`,
              height: `${iconSize + 4}px`,
              borderColor: customColor || undefined,
              boxShadow: customColor ? `0 0 10px ${customColor}66` : undefined,
            }}
          >
            {activeAccount?.skinUrl ? (
              <img src={activeAccount.skinUrl} alt="Skin" className="dock-player-head" />
            ) : activeAccount?.uuid &&
              activeAccount.uuid !== '00000000-0000-0000-0000-000000000000' ? (
              <img
                src={`https://mc-heads.net/avatar/${activeAccount.uuid}/48`}
                alt="Skin"
                className="dock-player-head"
              />
            ) : (
              <User size={iconSize - 2} style={{ color: customColor || undefined }} />
            )}
          </div>
          {showLabels && (
            <span
              className="dock-label"
              style={{
                fontSize: labelFontSize,
                color: customColor || undefined,
              }}
            >
              {t.dock.accounts}
            </span>
          )}
        </>
      );
    }

    if (btnId === 'settings') {
      return (
        <>
          <div className="dock-icon-wrapper">
            <Settings
              size={iconSize}
              style={{
                color: customColor || undefined,
                filter: customColor ? `drop-shadow(0 0 6px ${customColor}80)` : 'none',
              }}
            />
          </div>
          {showLabels && (
            <span
              className="dock-label"
              style={{
                fontSize: labelFontSize,
                color: customColor || undefined,
              }}
            >
              {t.dock.settings}
            </span>
          )}
        </>
      );
    }

    if (btnId === 'launch') {
      return (
        <>
          <div className="dock-icon-wrapper" style={{ color: startColor }}>
            {isRunning ? (
              <CheckCircle2 size={iconSize + 2} />
            ) : isLaunching ? (
              <Loader2 size={iconSize + 2} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Rocket size={iconSize + 2} style={{ transform: 'rotate(45deg)' }} />
            )}
          </div>
          {showLabels && (
            <span
              className="dock-label"
              style={{
                color: startColor,
                fontSize: labelFontSize,
                fontWeight: 800,
              }}
            >
              {isRunning ? t.dock.running : isLaunching ? `${launch.progress}%` : t.dock.launch}
            </span>
          )}

          {isLaunching && (
            <div className="dock-launch-progress">
              <div
                className="dock-launch-fill"
                style={{
                  width: `${launch.progress}%`,
                  background: `linear-gradient(to right, ${startColor}, #38bdf8)`,
                }}
              />
            </div>
          )}
        </>
      );
    }

    return null;
  };

  const handleButtonClick = (btnId: DockButtonId) => {
    if (isEditingHud) return; // In edit mode, clicking doesn't trigger actions
    if (btnId === 'instances') launcherActions.openModal('instances');
    else if (btnId === 'about') launcherActions.openModal('about');
    else if (btnId === 'accounts') launcherActions.openModal('accounts');
    else if (btnId === 'settings') launcherActions.openModal('settings');
    else if (btnId === 'launch') {
      if (isRunning) launcherActions.killGameFlow();
      else if (!isLaunching) launcherActions.startLaunchFlow();
    }
  };

  // ═════════════════════════════════════════════
  // MODE A: INDIVIDUAL / FREE BUTTONS
  // ═════════════════════════════════════════════
  if (dockConfig.layoutMode === 'free_buttons') {
    return (
      <>
        {activeButtons.map((btnId) => {
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
          const customBtnColor = getButtonCustomColor(btnId);
          const btnW = isLaunch ? startSegmentWidth : segmentWidth;
          const btnH = segmentHeight;

          return (
            <div
              key={btnId}
              style={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isDraggingThis ? 960 : isEditingHud ? 940 : 25,
                transition: isDraggingThis
                  ? 'none'
                  : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
              }}
            >
              <button
                ref={(el) => {
                  buttonRefs.current[btnId] = el;
                }}
                type="button"
                onClick={() => handleButtonClick(btnId)}
                onMouseDown={(e) => {
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
                className={`dock-segment ${isLaunch ? 'start-game' : ''} ${
                  isRunning ? 'running' : isLaunching ? 'launching' : ''
                }`}
                style={{
                  width: btnW,
                  height: btnH,
                  borderRadius: `${dockConfig.borderRadius}px`,
                  background: isLaunch
                    ? isRunning || isLaunching
                      ? startHoverBg
                      : startSubtleBg
                    : customBtnColor
                      ? `${customBtnColor}18`
                      : `rgba(12, 17, 24, ${dockConfig.bgOpacity})`,
                  color: isLaunch ? startColor : customBtnColor || '#cbd5e1',
                  border: isEditingHud
                    ? isDraggingThis && isColliding
                      ? '2px dashed #ef4444'
                      : '2px dashed #38bdf8'
                    : customBtnColor
                      ? `1px solid ${customBtnColor}80`
                      : dockConfig.dockBorderColorMode === 'accent'
                        ? '1px solid var(--border-accent, rgba(0, 229, 255, 0.4))'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: isEditingHud
                    ? isDraggingThis && isColliding
                      ? '0 0 20px rgba(239, 68, 68, 0.65)'
                      : '0 0 16px rgba(56, 189, 248, 0.4)'
                    : customBtnColor
                      ? `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px ${customBtnColor}33`
                      : '0 20px 50px rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(20px)',
                  cursor: isEditingHud ? (isDraggingThis ? 'grabbing' : 'grab') : 'pointer',
                  position: 'relative',
                }}
              >
                {isEditingHud && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-18px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background:
                        isDraggingThis && isColliding
                          ? 'rgba(239, 68, 68, 0.95)'
                          : 'rgba(10, 14, 22, 0.9)',
                      border:
                        isDraggingThis && isColliding ? '1px solid #f87171' : '1px solid #38bdf8',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: isDraggingThis && isColliding ? '#ffffff' : '#38bdf8',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      boxShadow:
                        isDraggingThis && isColliding ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none',
                    }}
                  >
                    {isDraggingThis && isColliding ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={10} color="#fca5a5" />
                        <span>
                          {t.hudEditor.collision} | X:{pos.x}% Y:{pos.y}%
                        </span>
                      </span>
                    ) : (
                      `X:${pos.x}% Y:${pos.y}%`
                    )}
                  </div>
                )}
                {renderButtonContent(btnId)}
              </button>
            </div>
          );
        })}
      </>
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
    <div
      style={{
        position: 'absolute',
        left: `${dockPos.x}%`,
        top: `${dockPos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: draggingTarget === 'dock' ? 960 : isEditingHud ? 940 : 25,
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
      {/* Quick Access Bar (Floating pill pinned above dock, without shifting dock layout) */}
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
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 229, 255, 0.12)',
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
                color: '#38bdf8',
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

      {/* Main Unified Dock Container */}
      <div
        ref={dockRef}
        role="presentation"
        className="home-unified-dock"
        onMouseDown={(e) => {
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
        style={{
          background: `rgba(12, 17, 24, ${dockConfig.bgOpacity})`,
          borderRadius: `${dockConfig.borderRadius}px`,
          border: isEditingHud
            ? '2px dashed #38bdf8'
            : dockConfig.dockBorderColorMode === 'accent'
              ? '1px solid var(--border-accent, rgba(0, 229, 255, 0.4))'
              : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: isEditingHud
            ? '0 0 25px rgba(56, 189, 248, 0.5), 0 25px 65px rgba(0, 0, 0, 0.9)'
            : dockConfig.dockBorderColorMode === 'accent'
              ? '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 25px var(--accent-glow, rgba(0, 229, 255, 0.25))'
              : '0 25px 65px rgba(0, 0, 0, 0.9), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
          cursor: isEditingHud ? (draggingTarget === 'dock' ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {activeButtons.map((btnId, idx) => {
          const isLaunch = btnId === 'launch';
          const customBtnColor = getButtonCustomColor(btnId);
          const isLast = idx === activeButtons.length - 1;
          const borderRightStyle = isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.06)';
          const btnW = isLaunch ? startSegmentWidth : segmentWidth;
          const btnH = segmentHeight;

          return (
            <button
              key={btnId}
              type="button"
              onClick={() => handleButtonClick(btnId)}
              className={`dock-segment ${isLaunch ? 'start-game' : ''} ${
                isRunning ? 'running' : isLaunching ? 'launching' : ''
              }`}
              style={{
                width: btnW,
                height: btnH,
                borderRight: borderRightStyle,
                background: isLaunch
                  ? isRunning || isLaunching
                    ? startHoverBg
                    : startSubtleBg
                  : customBtnColor
                    ? `${customBtnColor}14`
                    : 'transparent',
                color: isLaunch ? startColor : customBtnColor || '#cbd5e1',
                cursor: isEditingHud
                  ? draggingTarget === 'dock'
                    ? 'grabbing'
                    : 'grab'
                  : 'pointer',
              }}
            >
              {renderButtonContent(btnId)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
