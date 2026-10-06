import React, { useState, useEffect, useRef } from 'react';
import { User, Power, Globe, GripHorizontal, AlertTriangle } from 'lucide-react';
import { DiscordIcon } from './icons/DiscordIcon';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  UserAccount,
  DEFAULT_FALLBACK_ACCOUNT,
  useT,
} from '../store/launcherStore';
import {
  getActiveObstacles,
  resolveCollisionAndClamp,
  getElementDimensions,
  getEffectiveDockPosition,
  getEffectiveHudSide,
} from '../utils/collisionSystem';

const YoutubeIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const DEFAULT_USER_POS = { x: 8, y: 93 };
const DEFAULT_SOCIALS_POS = { x: 50, y: 93 };
const DEFAULT_SERVER_STATUS_POS = { x: 92, y: 93 };

export const BottomBar: React.FC = () => {
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);
  const serverStatus = useLauncherStore((s: LauncherState) => s.serverStatus);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);
  const t = useT();

  const activeAccount =
    accounts.find((a: UserAccount) => a.id === activeAccountId) || DEFAULT_FALLBACK_ACCOUNT;

  // Drag states for the 3 individual widgets
  const [draggingWidget, setDraggingWidget] = useState<
    'userPill' | 'socials' | 'serverStatus' | null
  >(null);
  const [tempPositions, setTempPositions] = useState<{
    userPill?: { x: number; y: number };
    socials?: { x: number; y: number };
    serverStatus?: { x: number; y: number };
  }>({});
  const [isColliding, setIsColliding] = useState(false);

  const userPillRef = useRef<HTMLDivElement>(null);
  const socialsRef = useRef<HTMLDivElement>(null);
  const serverStatusRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    hasMoved: boolean;
  } | null>(null);

  // Global drag listener for widgets with collision and grabOffset
  useEffect(() => {
    if (!draggingWidget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dist = Math.hypot(
        e.clientX - dragStartRef.current.clientX,
        e.clientY - dragStartRef.current.clientY,
      );

      // Distance threshold: ignore clicks/jitter < 5px
      if (!dragStartRef.current.hasMoved && dist < 5) {
        return;
      }
      dragStartRef.current.hasMoved = true;

      const currentBoxId = `widget:${draggingWidget}`;
      let dims = getElementDimensions(currentBoxId, dockConfig);

      if (draggingWidget === 'userPill' && userPillRef.current) {
        dims = {
          width: userPillRef.current.getBoundingClientRect().width,
          height: userPillRef.current.getBoundingClientRect().height,
        };
      } else if (draggingWidget === 'socials' && socialsRef.current) {
        dims = {
          width: socialsRef.current.getBoundingClientRect().width,
          height: socialsRef.current.getBoundingClientRect().height,
        };
      } else if (draggingWidget === 'serverStatus' && serverStatusRef.current) {
        dims = {
          width: serverStatusRef.current.getBoundingClientRect().width,
          height: serverStatusRef.current.getBoundingClientRect().height,
        };
      }

      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const effectiveHudSide = getEffectiveHudSide(dockConfig, hudManualSide);
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

      setTempPositions((prev) => ({
        ...prev,
        [draggingWidget]: { x: resolved.x, y: resolved.y },
      }));
      setIsColliding(resolved.isColliding);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dragInfo = dragStartRef.current;
      dragStartRef.current = null;

      // Click detection: if user just clicked without dragging, DO NOT MOVE PIECE!
      if (!dragInfo || !dragInfo.hasMoved) {
        setDraggingWidget(null);
        setTempPositions({});
        setIsColliding(false);
        return;
      }

      const currentBoxId = `widget:${draggingWidget}`;
      let dims = getElementDimensions(currentBoxId, dockConfig);

      if (draggingWidget === 'userPill' && userPillRef.current) {
        dims = {
          width: userPillRef.current.getBoundingClientRect().width,
          height: userPillRef.current.getBoundingClientRect().height,
        };
      } else if (draggingWidget === 'socials' && socialsRef.current) {
        dims = {
          width: socialsRef.current.getBoundingClientRect().width,
          height: socialsRef.current.getBoundingClientRect().height,
        };
      } else if (draggingWidget === 'serverStatus' && serverStatusRef.current) {
        dims = {
          width: serverStatusRef.current.getBoundingClientRect().width,
          height: serverStatusRef.current.getBoundingClientRect().height,
        };
      }

      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
      const effectiveHudSide = getEffectiveHudSide(dockConfig, hudManualSide);
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

      launcherActions.setWidgetPosition(draggingWidget, { x: resolved.x, y: resolved.y });
      setDraggingWidget(null);
      setTempPositions({});
      setIsColliding(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingWidget, dockConfig, isEditingHud, hudManualSide]);

  // Coordinates
  const userPos =
    tempPositions.userPill || dockConfig.widgetPositions?.userPill || DEFAULT_USER_POS;
  const socPos =
    tempPositions.socials || dockConfig.widgetPositions?.socials || DEFAULT_SOCIALS_POS;
  const statPos =
    tempPositions.serverStatus ||
    dockConfig.widgetPositions?.serverStatus ||
    DEFAULT_SERVER_STATUS_POS;

  // Dynamic auto-reaccommodation: Detect if Unified Dock or free buttons collide with Socials capsule
  let effectiveSocPos = socPos;
  if (draggingWidget === 'socials') {
    effectiveSocPos = tempPositions.socials || socPos;
  } else {
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

      // If dock penetrates into socials top zone and horizontally overlaps
      if (
        dockBottomPx > socTopPx - 4 &&
        socCenterXPx >= dockLeftPx &&
        socCenterXPx <= dockRightPx
      ) {
        // Dock is overlapping: re-accommodate socials safely to bottom margin
        const safeY = Math.min(
          96,
          Math.max(94, Math.round(((dockBottomPx + halfSocH + 10) / winH) * 100 * 10) / 10),
        );
        effectiveSocPos = { x: socPos.x, y: safeY };
      }
    } else {
      // In free buttons mode, check if any button overlaps socials
      const visibleSet = new Set(dockConfig.visibleButtons);
      const activeButtons = dockConfig.buttonOrder.filter((id) => visibleSet.has(id));
      for (const btnId of activeButtons) {
        const bPos = dockConfig.buttonPositions?.[btnId] || { x: 50, y: 50 };
        const bDims = getElementDimensions(`btn:${btnId}`, dockConfig);
        const bBottomPx = (bPos.y / 100) * winH + bDims.height / 2;
        const bLeftPx = (bPos.x / 100) * winW - bDims.width / 2;
        const bRightPx = (bPos.x / 100) * winW + bDims.width / 2;

        if (bBottomPx > socTopPx - 4 && socCenterXPx >= bLeftPx && socCenterXPx <= bRightPx) {
          effectiveSocPos = { x: socPos.x, y: 96 };
          break;
        }
      }
    }
  }

  return (
    <>
      {/* 1. Player Info Chip Widget */}
      <div
        ref={userPillRef}
        role="presentation"
        style={{
          position: 'absolute',
          left: `${userPos.x}%`,
          top: `${userPos.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: isEditingHud ? 950 : 30,
          cursor: isEditingHud ? (draggingWidget === 'userPill' ? 'grabbing' : 'grab') : 'default',
          transition:
            draggingWidget === 'userPill'
              ? 'none'
              : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          outline: isEditingHud
            ? draggingWidget === 'userPill' && isColliding
              ? '2px dashed #ef4444'
              : '2px dashed #38bdf8'
            : 'none',
          outlineOffset: '4px',
          borderRadius: '10px',
        }}
        onMouseDown={(e) => {
          if (isEditingHud) {
            e.preventDefault();
            const box = userPillRef.current?.getBoundingClientRect();
            const centerX = box ? box.left + box.width / 2 : e.clientX;
            const centerY = box ? box.top + box.height / 2 : e.clientY;
            dragStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              grabOffsetX: e.clientX - centerX,
              grabOffsetY: e.clientY - centerY,
              hasMoved: false,
            };
            setDraggingWidget('userPill');
          }
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
                draggingWidget === 'userPill' && isColliding
                  ? 'rgba(239, 68, 68, 0.95)'
                  : 'rgba(10, 14, 22, 0.9)',
              border:
                draggingWidget === 'userPill' && isColliding
                  ? '1px solid #f87171'
                  : '1px solid #38bdf8',
              borderRadius: '4px',
              padding: '1px 6px',
              fontSize: '9px',
              fontWeight: 700,
              color: draggingWidget === 'userPill' && isColliding ? '#ffffff' : '#38bdf8',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow:
                draggingWidget === 'userPill' && isColliding
                  ? '0 0 12px rgba(239, 68, 68, 0.6)'
                  : 'none',
            }}
          >
            {draggingWidget === 'userPill' && isColliding ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={10} color="#fca5a5" />
                <span>
                  {t.hudEditor.collision} | X:{userPos.x}% Y:{userPos.y}%
                </span>
              </span>
            ) : (
              `X:${userPos.x}% Y:${userPos.y}%`
            )}
          </div>
        )}
        <div className="papyrus-player-pill">
          <button
            type="button"
            className="player-account-btn"
            onClick={() => {
              if (!isEditingHud) launcherActions.openModal('accounts');
            }}
            aria-label={t.bottomBar.openAccounts}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: isEditingHud ? 'grab' : 'pointer',
              color: 'inherit',
            }}
          >
            {isEditingHud && (
              <GripHorizontal size={14} color="#38bdf8" style={{ marginRight: '4px' }} />
            )}

            <div className="player-avatar-box">
              {activeAccount.skinUrl ? (
                <img
                  src={activeAccount.skinUrl}
                  alt={activeAccount.username}
                  className="player-avatar-img"
                />
              ) : activeAccount.uuid &&
                activeAccount.uuid !== '00000000-0000-0000-0000-000000000000' ? (
                <img
                  src={`https://mc-heads.net/avatar/${activeAccount.uuid}/32`}
                  alt={activeAccount.username}
                  className="player-avatar-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <User style={{ width: '16px', height: '16px', color: '#94a3b8' }} />
              )}
            </div>

            <span className="player-name-text">{activeAccount.username}</span>
          </button>

          {/* Red Logout/Power Button */}
          <button
            type="button"
            onClick={(e) => {
              if (isEditingHud) return;
              e.stopPropagation();
              launcherActions.logout();
            }}
            className="player-power-btn"
            title="Cerrar sesión / Ir a Login"
            aria-label="Cerrar sesión / Ir a Login"
          >
            <Power style={{ width: '12px', height: '12px' }} />
          </button>
        </div>
      </div>

      {/* 2. Social Icons Capsule Widget */}
      <div
        ref={socialsRef}
        role="presentation"
        style={{
          position: 'absolute',
          left: `${effectiveSocPos.x}%`,
          top: `${effectiveSocPos.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: isEditingHud ? 950 : 30,
          cursor: isEditingHud ? (draggingWidget === 'socials' ? 'grabbing' : 'grab') : 'default',
          transition:
            draggingWidget === 'socials'
              ? 'none'
              : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          outline: isEditingHud
            ? draggingWidget === 'socials' && isColliding
              ? '2px dashed #ef4444'
              : '2px dashed #38bdf8'
            : 'none',
          outlineOffset: '4px',
          borderRadius: '999px',
        }}
        onMouseDown={(e) => {
          if (isEditingHud) {
            e.preventDefault();
            const box = socialsRef.current?.getBoundingClientRect();
            const centerX = box ? box.left + box.width / 2 : e.clientX;
            const centerY = box ? box.top + box.height / 2 : e.clientY;
            dragStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              grabOffsetX: e.clientX - centerX,
              grabOffsetY: e.clientY - centerY,
              hasMoved: false,
            };
            setDraggingWidget('socials');
          }
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
                draggingWidget === 'socials' && isColliding
                  ? 'rgba(239, 68, 68, 0.95)'
                  : 'rgba(10, 14, 22, 0.9)',
              border:
                draggingWidget === 'socials' && isColliding
                  ? '1px solid #f87171'
                  : '1px solid #38bdf8',
              borderRadius: '4px',
              padding: '1px 6px',
              fontSize: '9px',
              fontWeight: 700,
              color: draggingWidget === 'socials' && isColliding ? '#ffffff' : '#38bdf8',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow:
                draggingWidget === 'socials' && isColliding
                  ? '0 0 12px rgba(239, 68, 68, 0.6)'
                  : 'none',
            }}
          >
            {draggingWidget === 'socials' && isColliding ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={10} color="#fca5a5" />
                <span>
                  {t.hudEditor.collision} | X:{effectiveSocPos.x}% Y:{effectiveSocPos.y}%
                </span>
              </span>
            ) : (
              `X:${effectiveSocPos.x}% Y:${effectiveSocPos.y}%`
            )}
          </div>
        )}
        <div className="papyrus-social-dock">
          {isEditingHud && (
            <GripHorizontal size={14} color="#38bdf8" style={{ marginRight: '2px' }} />
          )}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noreferrer"
            className="papyrus-social-btn"
            title="YouTube"
            onClick={(e) => isEditingHud && e.preventDefault()}
          >
            <YoutubeIcon style={{ width: '16px', height: '16px' }} />
          </a>
          <a
            href="https://discord.gg/crystaltides"
            target="_blank"
            rel="noreferrer"
            className="papyrus-social-btn"
            title="Discord"
            onClick={(e) => isEditingHud && e.preventDefault()}
          >
            <DiscordIcon style={{ width: '16px', height: '16px' }} />
          </a>
          <a
            href="https://crystaltidessmp.net"
            target="_blank"
            rel="noreferrer"
            className="papyrus-social-btn"
            title="Website"
            onClick={(e) => isEditingHud && e.preventDefault()}
          >
            <Globe style={{ width: '16px', height: '16px' }} />
          </a>
        </div>
      </div>

      {/* 3. Server Status Widget */}
      <div
        ref={serverStatusRef}
        role="presentation"
        style={{
          position: 'absolute',
          left: `${statPos.x}%`,
          top: `${statPos.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: isEditingHud ? 950 : 30,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          userSelect: 'none',
          cursor: isEditingHud
            ? draggingWidget === 'serverStatus'
              ? 'grabbing'
              : 'grab'
            : 'default',
          transition:
            draggingWidget === 'serverStatus'
              ? 'none'
              : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          outline: isEditingHud
            ? draggingWidget === 'serverStatus' && isColliding
              ? '2px dashed #ef4444'
              : '2px dashed #38bdf8'
            : 'none',
          outlineOffset: '4px',
          borderRadius: '999px',
        }}
        onMouseDown={(e) => {
          if (isEditingHud) {
            e.preventDefault();
            const box = serverStatusRef.current?.getBoundingClientRect();
            const centerX = box ? box.left + box.width / 2 : e.clientX;
            const centerY = box ? box.top + box.height / 2 : e.clientY;
            dragStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              grabOffsetX: e.clientX - centerX,
              grabOffsetY: e.clientY - centerY,
              hasMoved: false,
            };
            setDraggingWidget('serverStatus');
          }
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
                draggingWidget === 'serverStatus' && isColliding
                  ? 'rgba(239, 68, 68, 0.95)'
                  : 'rgba(10, 14, 22, 0.9)',
              border:
                draggingWidget === 'serverStatus' && isColliding
                  ? '1px solid #f87171'
                  : '1px solid #38bdf8',
              borderRadius: '4px',
              padding: '1px 6px',
              fontSize: '9px',
              fontWeight: 700,
              color: draggingWidget === 'serverStatus' && isColliding ? '#ffffff' : '#38bdf8',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow:
                draggingWidget === 'serverStatus' && isColliding
                  ? '0 0 12px rgba(239, 68, 68, 0.6)'
                  : 'none',
            }}
          >
            {draggingWidget === 'serverStatus' && isColliding ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={10} color="#fca5a5" />
                <span>
                  {t.hudEditor.collision} | X:{statPos.x}% Y:{statPos.y}%
                </span>
              </span>
            ) : (
              `X:${statPos.x}% Y:${statPos.y}%`
            )}
          </div>
        )}
        <div
          className="papyrus-server-chip"
          title={`${t.bottomBar.officialServer} • Ping: ${serverStatus.ping}ms`}
        >
          {isEditingHud && (
            <GripHorizontal
              size={14}
              color="#38bdf8"
              style={{ marginRight: '2px', flexShrink: 0 }}
            />
          )}
          <span
            style={{
              width: '8px',
              height: '8px',
              minWidth: '8px',
              minHeight: '8px',
              borderRadius: '50%',
              backgroundColor: serverStatus.online ? '#22c55e' : '#ef4444',
              boxShadow: serverStatus.online
                ? '0 0 8px rgba(34, 197, 94, 0.7)'
                : '0 0 8px rgba(239, 68, 68, 0.7)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              color: '#f8fafc',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {serverStatus.online
              ? `${serverStatus.playersCount} ${t.bottomBar.online}`
              : t.bottomBar.offline}
          </span>
          <span style={{ color: '#64748b', flexShrink: 0 }}>•</span>
          <span
            style={{
              color: '#94a3b8',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {serverStatus.ping}ms
          </span>
        </div>
      </div>
    </>
  );
};
