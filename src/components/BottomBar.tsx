import React from 'react';
import { User, Power, Globe } from 'lucide-react';
import { DiscordIcon } from './icons/DiscordIcon';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  UserAccount,
} from '../store/launcherStore';

const YoutubeIcon: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <svg style={style} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const DEFAULT_FALLBACK_ACCOUNT: UserAccount = {
  id: 'default',
  username: 'Haume',
  uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
  type: 'guest',
  lastUsed: 0,
};

export const BottomBar: React.FC = () => {
  const accounts = useLauncherStore((s: LauncherState) => s.accounts);
  const activeAccountId = useLauncherStore((s: LauncherState) => s.activeAccountId);

  const activeAccount =
    accounts.find((a: UserAccount) => a.id === activeAccountId) || DEFAULT_FALLBACK_ACCOUNT;

  return (
    <footer className="papyrus-home-footer">
      {/* Bottom-Left: Player Info Chip with Red Logout Button */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Abrir gestión de cuentas"
        className="papyrus-player-pill"
        onClick={() => launcherActions.openModal('accounts')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            launcherActions.openModal('accounts');
          }
        }}
      >
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

        {/* Red Logout/Power Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            launcherActions.logout();
          }}
          className="player-power-btn"
          title="Cerrar sesión / Ir a Login"
        >
          <Power style={{ width: '12px', height: '12px' }} />
        </button>
      </div>

      {/* Bottom-Center: 3 Social Icons (YouTube, Discord SVG, Website) */}
      <div className="papyrus-social-dock">
        <a
          href="https://youtube.com"
          target="_blank"
          rel="noreferrer"
          className="papyrus-social-btn"
          title="YouTube"
        >
          <YoutubeIcon style={{ width: '16px', height: '16px' }} />
        </a>
        <a
          href="https://discord.gg/crystaltides"
          target="_blank"
          rel="noreferrer"
          className="papyrus-social-btn"
          title="Discord"
        >
          <DiscordIcon style={{ width: '16px', height: '16px' }} />
        </a>
        <a
          href="https://crystaltidessmp.net"
          target="_blank"
          rel="noreferrer"
          className="papyrus-social-btn"
          title="Website"
        >
          <Globe style={{ width: '16px', height: '16px' }} />
        </a>
      </div>

      {/* Spacer on right to balance flex layout */}
      <div style={{ width: '160px' }} />
    </footer>
  );
};
