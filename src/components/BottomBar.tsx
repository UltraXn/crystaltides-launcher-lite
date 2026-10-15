import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  useLauncherStore,
  type LauncherState,
  launcherActions,
  DEFAULT_FALLBACK_ACCOUNT,
  type UserAccount,
  useT,
} from '../store/launcherStore';
import { Globe, GripHorizontal, AlertTriangle, User, Power } from 'lucide-react';
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



import { DiscordIcon } from './icons/DiscordIcon';
import { YoutubeIcon } from './icons/YoutubeIcon';

export { DiscordIcon, YoutubeIcon };

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
      const effectiveHudSide = getEffectiveHudSide(dockConfig, hudManualSide);

      for (const w of widgets) {
        const pos = dockConfig.widgetPositions?.[w];
        if (!pos) continue;
        const { currentBoxId, dims } = getWidgetDims(w);
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
          launcherActions.setWidgetPosition(w, { x: resolved.x, y: resolved.y });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dockConfig, hudManualSide, isEditingHud, getWidgetDims]);

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
        bottom: y > 10 ? 'calc(100% + 8px)' : 'auto',
        top: y <= 10 ? 'calc(100% + 8px)' : 'auto',
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
          {isEditingHud && (
            <GripHorizontal size={14} color="#38bdf8" style={{ marginRight: '4px', flexShrink: 0 }} />
          )}

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
  </>
);

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
}) => (
  <>
    {/* 3. Server Status Widget */}
    <div
      ref={drag.serverStatusRef}
      role="toolbar"
      tabIndex={0}
      aria-label="Widget de estado del servidor"
      onMouseDown={(e) => drag.startDrag('serverStatus', e, drag.serverStatusRef)}
      style={{
        position: 'absolute',
        left: `${statPos.x}%`,
        top: `${statPos.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isEditingHud ? 950 : 30,
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
      <div
        className="papyrus-server-chip"
        title={`${t.bottomBar.officialServer} • Ping: ${serverStatus.ping}ms`}
      >
        {isEditingHud && (
          <GripHorizontal size={14} color="#38bdf8" style={{ marginRight: '2px', flexShrink: 0 }} />
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
