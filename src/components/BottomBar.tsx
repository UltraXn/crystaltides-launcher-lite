import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  useLauncherStore,
  type LauncherState,
  launcherActions,
  DEFAULT_FALLBACK_ACCOUNT,
  type UserAccount,
  useT,
} from '../store/launcherStore';
import {
  Globe,
  GripHorizontal,
  AlertTriangle,
  User,
  Power,
  Pencil,
  Check,
  X,
  Users,
} from 'lucide-react';
import {
  getElementDimensions,
  resolveCollisionAndClamp,
  getActiveObstacles,
  getEffectiveHudSide,
} from '../utils/collisionSystem';
import {
  calculateEffectiveSocialsPosition,
  getWidgetCursor,
  getWidgetOutline,
} from '../utils/bottomBarUtils';

export const DiscordIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export const YoutubeIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const DEFAULT_USER_POS = { x: 8, y: 93 };
const DEFAULT_SOCIALS_POS = { x: 50, y: 93 };
const DEFAULT_SERVER_STATUS_POS = { x: 92, y: 93 };

type WidgetType = 'userPill' | 'socials' | 'serverStatus';

interface DragController {
  draggingWidget: WidgetType | null;
  tempPositions: { [k in WidgetType]?: { x: number; y: number } };
  isColliding: boolean;
  userPillRef: React.RefObject<HTMLDivElement | null>;
  socialsRef: React.RefObject<HTMLDivElement | null>;
  serverStatusRef: React.RefObject<HTMLDivElement | null>;
  startDrag: (
    widget: WidgetType,
    e: React.MouseEvent,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => void;
}

function useWidgetDrag(
  dockConfig: LauncherState['dockConfig'],
  isEditingHud: boolean,
  hudManualSide: 'auto' | 'left' | 'center' | 'right',
): DragController {
  const [draggingWidget, setDraggingWidget] = useState<WidgetType | null>(null);
  const [tempPositions, setTempPositions] = useState<{
    [k in WidgetType]?: { x: number; y: number };
  }>({});
  const [isColliding, setIsColliding] = useState(false);

  const userPillRef = useRef<HTMLDivElement | null>(null);
  const socialsRef = useRef<HTMLDivElement | null>(null);
  const serverStatusRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    grabOffsetX: number;
    grabOffsetY: number;
    hasMoved: boolean;
  } | null>(null);

  const getWidgetDims = useCallback(
    (widget: WidgetType) => {
      const currentBoxId = `widget:${widget}`;
      let dims = getElementDimensions(currentBoxId, dockConfig);
      const refMap = { userPill: userPillRef, socials: socialsRef, serverStatus: serverStatusRef };
      const el = refMap[widget].current;
      if (el) {
        dims = {
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        };
      }
      return { currentBoxId, dims };
    },
    [dockConfig],
  );

  useEffect(() => {
    if (!draggingWidget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dist = Math.hypot(
        e.clientX - dragStartRef.current.clientX,
        e.clientY - dragStartRef.current.clientY,
      );
      if (!dragStartRef.current.hasMoved && dist < 5) return;
      dragStartRef.current.hasMoved = true;

      const { currentBoxId, dims } = getWidgetDims(draggingWidget);
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
        { winW, winH },
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

      if (!dragInfo?.hasMoved) {
        setDraggingWidget(null);
        setTempPositions({});
        setIsColliding(false);
        return;
      }

      const { currentBoxId, dims } = getWidgetDims(draggingWidget);
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
        { winW, winH },
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
  }, [draggingWidget, dockConfig, isEditingHud, hudManualSide, getWidgetDims]);

  useEffect(() => {
    const handleResize = () => {
      const widgets: WidgetType[] = ['userPill', 'socials', 'serverStatus'];
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

      for (const w of widgets) {
        const pos = dockConfig.widgetPositions?.[w];
        if (!pos) continue;
        const { dims } = getWidgetDims(w);
        const halfW = dims.width / 2;
        const halfH = dims.height / 2;

        const minXPct = Math.round(((halfW + 14) / winW) * 100 * 10) / 10;
        const maxXPct = Math.round(((winW - halfW - 14) / winW) * 100 * 10) / 10;
        const minYPct = Math.round(((halfH + 64) / winH) * 100 * 10) / 10;
        const maxYPct = Math.round(((winH - halfH - 14) / winH) * 100 * 10) / 10;

        const clampedX = Math.max(minXPct, Math.min(maxXPct, pos.x));
        const clampedY = Math.max(minYPct, Math.min(maxYPct, pos.y));

        if (Math.abs(clampedX - pos.x) > 0.5 || Math.abs(clampedY - pos.y) > 0.5) {
          launcherActions.setWidgetPosition(w, { x: clampedX, y: clampedY });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dockConfig, getWidgetDims]);

  const startDrag = (
    widget: WidgetType,
    e: React.MouseEvent,
    ref: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (!isEditingHud) return;
    e.preventDefault();
    const box = ref.current?.getBoundingClientRect();
    const centerX = box ? box.left + box.width / 2 : e.clientX;
    const centerY = box ? box.top + box.height / 2 : e.clientY;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      grabOffsetX: e.clientX - centerX,
      grabOffsetY: e.clientY - centerY,
      hasMoved: false,
    };
    setDraggingWidget(widget);
  };

  return {
    draggingWidget,
    tempPositions,
    isColliding,
    userPillRef,
    socialsRef,
    serverStatusRef,
    startDrag,
  };
}

export const WidgetCoordinateBadge: React.FC<{
  x: number;
  y: number;
  isDragging: boolean;
  isColliding: boolean;
  label?: string;
}> = ({ x, y, isDragging, isColliding, label }) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: y > 10 ? 'calc(100% + 28px)' : 'auto',
        top: y <= 10 ? 'calc(100% + 28px)' : 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
        background:
          isDragging && isColliding ? 'rgba(239, 68, 68, 0.95)' : 'rgba(15, 18, 26, 0.95)',
        border:
          isDragging && isColliding
            ? '1px solid rgba(248, 113, 113, 0.85)'
            : '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '4px',
        padding: '1px 6px',
        fontSize: '9px',
        fontWeight: 600,
        fontFamily: 'ui-monospace, monospace',
        color: isDragging && isColliding ? '#ffffff' : '#e2e8f0',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow:
          isDragging && isColliding
            ? '0 0 12px rgba(239, 68, 68, 0.4)'
            : '0 4px 12px rgba(0, 0, 0, 0.65)',
      }}
    >
      {isDragging && isColliding ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={10} color="#fca5a5" />
          <span>
            {label ?? 'COLISIÓN'} | X:{x}% Y:{y}%
          </span>
        </span>
      ) : (
        `X:${x}% Y:${y}%`
      )}
    </div>
  );
};

export type WidgetDragReturn = ReturnType<typeof useWidgetDrag>;

export interface BottomBarPlayerWidgetProps {
  drag: WidgetDragReturn;
  isEditingHud: boolean;
  userPos: { x: number; y: number };
  activeAccount: UserAccount;
  t: ReturnType<typeof useT>;
}

export const BottomBarPlayerWidget: React.FC<BottomBarPlayerWidgetProps> = ({
  drag,
  isEditingHud,
  userPos,
  activeAccount,
  t,
}) => (
  <>
    {/* 1. Player Info Chip Widget */}
    <div
      ref={drag.userPillRef}
      role="toolbar"
      tabIndex={0}
      aria-label="Widget de usuario"
      onMouseDown={(e) => drag.startDrag('userPill', e, drag.userPillRef)}
      style={{
        position: 'absolute',
        left: `${userPos.x}%`,
        top: `${userPos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isEditingHud ? 950 : 30,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        userSelect: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: getWidgetCursor(isEditingHud, drag.draggingWidget === 'userPill'),
        transition:
          drag.draggingWidget === 'userPill'
            ? 'none'
            : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
        outline: getWidgetOutline(
          isEditingHud,
          drag.draggingWidget === 'userPill',
          drag.isColliding,
        ),
        outlineOffset: '4px',
        borderRadius: '9999px',
      }}
    >
      {isEditingHud && (
        <WidgetCoordinateBadge
          x={userPos.x}
          y={userPos.y}
          isDragging={drag.draggingWidget === 'userPill'}
          isColliding={drag.isColliding}
          label={t.hudEditor.collision}
        />
      )}
      {isEditingHud && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Arrastrar perfil"
          onMouseDown={(e) => {
            e.stopPropagation();
            drag.startDrag('userPill', e, drag.userPillRef);
          }}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(12, 17, 24, 0.88)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backdropFilter: 'blur(8px)',
            borderRadius: '9999px',
            padding: '3px 10px',
            color: '#38bdf8',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.25)',
            cursor: drag.draggingWidget === 'userPill' ? 'grabbing' : 'grab',
            userSelect: 'none',
            zIndex: 10,
          }}
        >
          <GripHorizontal size={14} />
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
            cursor: isEditingHud ? 'grab' : 'pointer',
          }}
        >
          <div className="player-avatar-box">
            {(() => {
              const avatar =
                activeAccount.skinUrl ??
                (activeAccount.uuid && activeAccount.uuid !== '00000000-0000-0000-0000-000000000000'
                  ? `https://mc-heads.net/avatar/${activeAccount.uuid}/32`
                  : null);
              if (avatar) {
                return (
                  <img
                    src={avatar}
                    alt={activeAccount.username}
                    className="player-avatar-img"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                );
              }
              return <User style={{ width: '16px', height: '16px', color: '#94a3b8' }} />;
            })()}
          </div>

          <span className="player-name-text">{activeAccount.username}</span>
        </button>

        {/* Divisor vertical sutil entre nombre y boton de logout */}
        <span className="player-pill-divider" aria-hidden="true" />

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
  </>
);

export interface BottomBarSocialsWidgetProps {
  drag: WidgetDragReturn;
  isEditingHud: boolean;
  effectiveSocPos: { x: number; y: number };
  t: ReturnType<typeof useT>;
}

export const BottomBarSocialsWidget: React.FC<BottomBarSocialsWidgetProps> = ({
  drag,
  isEditingHud,
  effectiveSocPos,
  t,
}) => (
  <>
    {/* 2. Social Media Hub Widget */}
    <div
      ref={drag.socialsRef}
      role="toolbar"
      tabIndex={0}
      aria-label="Widget de redes sociales"
      onMouseDown={(e) => drag.startDrag('socials', e, drag.socialsRef)}
      style={{
        position: 'absolute',
        left: `${effectiveSocPos.x}%`,
        top: `${effectiveSocPos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isEditingHud ? 950 : 30,
        cursor: getWidgetCursor(isEditingHud, drag.draggingWidget === 'socials'),
        transition:
          drag.draggingWidget === 'socials'
            ? 'none'
            : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
        outline: getWidgetOutline(
          isEditingHud,
          drag.draggingWidget === 'socials',
          drag.isColliding,
        ),
        outlineOffset: '4px',
        borderRadius: '999px',
      }}
    >
      {isEditingHud && (
        <WidgetCoordinateBadge
          x={effectiveSocPos.x}
          y={effectiveSocPos.y}
          isDragging={drag.draggingWidget === 'socials'}
          isColliding={drag.isColliding}
          label={t.hudEditor.collision}
        />
      )}
      {isEditingHud && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Arrastrar redes sociales"
          onMouseDown={(e) => {
            e.stopPropagation();
            drag.startDrag('socials', e, drag.socialsRef);
          }}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(12, 17, 24, 0.88)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backdropFilter: 'blur(8px)',
            borderRadius: '9999px',
            padding: '3px 10px',
            color: '#38bdf8',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.25)',
            cursor: drag.draggingWidget === 'socials' ? 'grabbing' : 'grab',
            userSelect: 'none',
            zIndex: 10,
          }}
        >
          <GripHorizontal size={14} />
        </div>
      )}
      <div className="papyrus-social-dock">
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
          href="https://discord.gg/TDmwYNnvyT"
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
  </>
);

export interface ServerLogoIconProps {
  online: boolean;
  icon?: string;
  serverHost: string;
}

export const ServerLogoIcon: React.FC<ServerLogoIconProps> = ({ online, icon, serverHost }) => {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [icon, serverHost, online]);

  if (!online || loadError) {
    return (
      <Globe
        size={14}
        data-testid="server-globe-fallback"
        style={{
          color: online ? '#38bdf8' : '#ef4444',
          flexShrink: 0,
        }}
      />
    );
  }

  const effectiveIcon = icon || `https://api.mcstatus.io/v2/icon/${encodeURIComponent(serverHost)}`;

  return (
    <img
      src={effectiveIcon}
      alt="Logo del servidor"
      data-testid="server-logo-img"
      width={18}
      height={18}
      onError={() => setLoadError(true)}
      style={{
        width: '18px',
        height: '18px',
        borderRadius: '3px',
        objectFit: 'contain',
        imageRendering: 'pixelated',
        flexShrink: 0,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
      }}
    />
  );
};

export interface BottomBarServerWidgetProps {
  drag: WidgetDragReturn;
  isEditingHud: boolean;
  statPos: { x: number; y: number };
  serverStatus: LauncherState['serverStatus'];
  t: ReturnType<typeof useT>;
}

export const BottomBarServerWidget: React.FC<BottomBarServerWidgetProps> = ({
  drag,
  isEditingHud,
  statPos,
  serverStatus,
  t,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [inputIp, setInputIp] = useState(serverStatus.serverHost || 'mc.crystaltidessmp.net');
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hoveredPlayerName, setHoveredPlayerName] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingIp) {
      setInputIp(serverStatus.serverHost || 'mc.crystaltidessmp.net');
    }
  }, [serverStatus.serverHost, isEditingIp]);

  const handleMouseEnter = () => {
    if (isEditingHud) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isEditingIp) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setHoveredPlayerName(null);
    }, 280);
  };

  const handleSaveIp = () => {
    const trimmed = inputIp.trim();
    if (trimmed) {
      launcherActions.setServerHost(trimmed);
    }
    setIsEditingIp(false);
  };

  const handleCancelIp = () => {
    setInputIp(serverStatus.serverHost || 'mc.crystaltidessmp.net');
    setIsEditingIp(false);
  };

  const currentHost = serverStatus.serverHost || 'mc.crystaltidessmp.net';
  const rawList = serverStatus.playersList ?? [];
  const totalReportedPlayers = Math.max(serverStatus.playersCount ?? 0, rawList.length);
  const hasPlayers = rawList.length > 0;
  const isFew = rawList.length <= 6 && totalReportedPlayers <= 6;
  const MAX_HEADS = 24;
  const visiblePlayers = isFew ? rawList : rawList.slice(0, MAX_HEADS);
  const extraCount = Math.max(0, totalReportedPlayers - visiblePlayers.length);

  return (
    <>
      {/* 3. Server Status Widget */}
      <div
        ref={drag.serverStatusRef}
        role="toolbar"
        tabIndex={0}
        aria-label="Widget de estado del servidor"
        onMouseDown={(e) => drag.startDrag('serverStatus', e, drag.serverStatusRef)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          left: `${statPos.x}%`,
          top: `${statPos.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: isEditingHud ? 950 : isHovered ? 1000 : 30,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          userSelect: 'none',
          cursor: getWidgetCursor(isEditingHud, drag.draggingWidget === 'serverStatus'),
          transition:
            drag.draggingWidget === 'serverStatus'
              ? 'none'
              : 'top 0.35s cubic-bezier(0.16, 1, 0.3, 1), left 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          outline: getWidgetOutline(
            isEditingHud,
            drag.draggingWidget === 'serverStatus',
            drag.isColliding,
          ),
          outlineOffset: '4px',
          borderRadius: '999px',
        }}
      >
        {isEditingHud && (
          <WidgetCoordinateBadge
            x={statPos.x}
            y={statPos.y}
            isDragging={drag.draggingWidget === 'serverStatus'}
            isColliding={drag.isColliding}
            label={t.hudEditor.collision}
          />
        )}
        {isEditingHud && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Arrastrar estado del servidor"
            onMouseDown={(e) => {
              e.stopPropagation();
              drag.startDrag('serverStatus', e, drag.serverStatusRef);
            }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(12, 17, 24, 0.88)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              backdropFilter: 'blur(8px)',
              borderRadius: '9999px',
              padding: '3px 10px',
              color: '#38bdf8',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.25)',
              cursor: drag.draggingWidget === 'serverStatus' ? 'grabbing' : 'grab',
              userSelect: 'none',
              zIndex: 10,
            }}
          >
            <GripHorizontal size={14} />
          </div>
        )}
        <div
          className="papyrus-server-chip"
          title={`${t.bottomBar?.officialServer ?? 'Servidor'}: ${currentHost} • Ping: ${serverStatus.online ? `${serverStatus.ping}ms` : '--'}`}
        >
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
              color: serverStatus.online ? '#f8fafc' : '#f87171',
              whiteSpace: 'nowrap',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {serverStatus.online
              ? `${serverStatus.playersCount} ${t.bottomBar?.online ?? 'en línea'}`
              : (t.bottomBar?.offline ?? 'Sin conexión')}
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
            {serverStatus.online ? `${serverStatus.ping}ms` : '--'}
          </span>
        </div>

        {/* Hover Popover with connected players & custom IP */}
        {!isEditingHud && isHovered && (
          <div
            data-testid="server-status-popover"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              right: 0,
              minWidth: '270px',
              maxWidth: '320px',
              background: 'rgba(10, 14, 22, 0.96)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.12)',
              color: '#f8fafc',
              zIndex: 1050,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header: Server Hostname & Edit IP */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                gap: '8px',
              }}
            >
              {!isEditingIp ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden',
                    }}
                  >
                    <ServerLogoIcon
                      online={serverStatus.online}
                      icon={serverStatus.icon}
                      serverHost={currentHost}
                    />
                    <span
                      title={currentHost}
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentHost}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingIp(true)}
                    title={t.bottomBar?.changeServerIp ?? 'Cambiar IP del servidor'}
                    aria-label="Editar IP del servidor"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '3px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    <Pencil size={11} />
                    <span>IP</span>
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                  <input
                    type="text"
                    value={inputIp}
                    onChange={(e) => setInputIp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveIp();
                      if (e.key === 'Escape') handleCancelIp();
                    }}
                    autoFocus
                    placeholder="mc.crystaltidessmp.net"
                    style={{
                      flex: 1,
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(56, 189, 248, 0.5)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: '#ffffff',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveIp}
                    title="Guardar"
                    aria-label="Guardar nueva IP"
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      color: '#4ade80',
                      borderRadius: '6px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelIp}
                    title="Cancelar"
                    aria-label="Cancelar cambio de IP"
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      borderRadius: '6px',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Status & Stats info row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#94a3b8',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  data-testid="server-status-dot"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: serverStatus.online ? '#22c55e' : '#ef4444',
                    boxShadow: serverStatus.online
                      ? '0 0 6px rgba(34, 197, 94, 0.7)'
                      : '0 0 6px rgba(239, 68, 68, 0.7)',
                    display: 'inline-block',
                  }}
                />
                <span
                  data-testid="server-status-text"
                  style={{ fontWeight: 600, color: serverStatus.online ? '#4ade80' : '#f87171' }}
                >
                  {serverStatus.online
                    ? (t.bottomBar?.online ?? 'En línea')
                    : (t.bottomBar?.offline ?? 'Sin conexión')}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>Ping: {serverStatus.online ? `${serverStatus.ping}ms` : '--'}</span>
                <span>•</span>
                <span>
                  {serverStatus.playersCount} / {serverStatus.maxPlayers}
                </span>
              </div>
            </div>

            {/* Connected Players / Heads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: '#94a3b8',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users size={12} style={{ color: '#cbd5e1' }} />
                  <span>
                    {hoveredPlayerName
                      ? `Jugador: ${hoveredPlayerName}`
                      : (t.bottomBar?.connectedPlayers ?? 'Jugadores Conectados')}
                  </span>
                </div>
                {!isFew && hasPlayers && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      color: '#64748b',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {totalReportedPlayers} en línea
                  </span>
                )}
              </div>

              {hasPlayers ? (
                isFew ? (
                  /* Modo Pocos Jugadores: Cabezas + Nombres */
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '6px',
                      maxHeight: '130px',
                      overflowY: 'auto',
                      paddingRight: '2px',
                    }}
                  >
                    {visiblePlayers.map((p, idx) => (
                      <div
                        key={p.uuid || `${p.name}-${idx}`}
                        title={p.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          padding: '3px 6px',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={`https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/24`}
                          alt={p.name}
                          width={18}
                          height={18}
                          style={{
                            borderRadius: '3px',
                            flexShrink: 0,
                            backgroundColor: '#1e293b',
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 600,
                            color: '#e2e8f0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Modo Muchos / Demasiados Jugadores: Solo Cabezas con tooltip y contador extra */
                  <div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: '6px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        paddingRight: '2px',
                        alignItems: 'center',
                      }}
                    >
                      {visiblePlayers.map((p, idx) => {
                        const isPlayerHovered = hoveredPlayerName === p.name;
                        return (
                          <div
                            key={p.uuid || `${p.name}-${idx}`}
                            title={p.name}
                            onMouseEnter={() => setHoveredPlayerName(p.name)}
                            onMouseLeave={() => setHoveredPlayerName(null)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: isPlayerHovered
                                ? '1px solid #38bdf8'
                                : '1px solid rgba(255, 255, 255, 0.12)',
                              boxShadow: isPlayerHovered ? '0 0 8px rgba(56, 189, 248, 0.5)' : 'none',
                              transform: isPlayerHovered ? 'scale(1.15)' : 'scale(1)',
                              transition: 'all 0.15s ease',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              backgroundColor: '#1e293b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={`https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/28`}
                              alt={p.name}
                              width={28}
                              height={28}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        );
                      })}

                      {extraCount > 0 && (
                        <div
                          title={`+${extraCount} jugadores más conectados`}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            background: 'rgba(56, 189, 248, 0.14)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            color: '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            cursor: 'default',
                            flexShrink: 0,
                          }}
                        >
                          +{extraCount > 99 ? '99+' : extraCount}
                        </div>
                      )}
                    </div>

                    {extraCount > 0 && (
                      <div
                        style={{
                          fontSize: '9.5px',
                          color: '#94a3b8',
                          textAlign: 'center',
                          marginTop: '6px',
                        }}
                      >
                        {t.bottomBar.morePlayersOnServer.replace('{count}', String(extraCount))}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed rgba(255, 255, 255, 0.08)',
                    borderRadius: '6px',
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: '10.5px',
                    color: '#64748b',
                  }}
                >
                  {!serverStatus.online
                    ? (t.bottomBar?.offline ?? 'Sin conexión')
                    : serverStatus.playersCount === 0
                      ? (t.bottomBar?.noPlayersConnected ?? 'No hay jugadores conectados.')
                      : `${serverStatus.playersCount} ${t.bottomBar?.playersListHidden ?? 'jugadores conectados (lista oculta por el servidor).'}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export const BottomBar: React.FC = () => {
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);
  const serverStatus = useLauncherStore((s: LauncherState) => s.serverStatus);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);
  const t = useT();

  const activeAccount =
    accounts.find((a: UserAccount) => a.id === activeAccountId) ?? DEFAULT_FALLBACK_ACCOUNT;

  const drag = useWidgetDrag(dockConfig, isEditingHud, hudManualSide);

  const userPos =
    drag.tempPositions.userPill ?? dockConfig.widgetPositions?.userPill ?? DEFAULT_USER_POS;
  const rawSocPos =
    drag.tempPositions.socials ?? dockConfig.widgetPositions?.socials ?? DEFAULT_SOCIALS_POS;
  const statPos =
    drag.tempPositions.serverStatus ??
    dockConfig.widgetPositions?.serverStatus ??
    DEFAULT_SERVER_STATUS_POS;

  const effectiveSocPos =
    drag.draggingWidget === 'socials'
      ? rawSocPos
      : calculateEffectiveSocialsPosition(rawSocPos, dockConfig);

  return (
    <>
      <BottomBarPlayerWidget
        drag={drag}
        isEditingHud={isEditingHud}
        userPos={userPos}
        activeAccount={activeAccount}
        t={t}
      />
      <BottomBarSocialsWidget
        drag={drag}
        isEditingHud={isEditingHud}
        effectiveSocPos={effectiveSocPos}
        t={t}
      />
      <BottomBarServerWidget
        drag={drag}
        isEditingHud={isEditingHud}
        statPos={statPos}
        serverStatus={serverStatus}
        t={t}
      />
    </>
  );
};
