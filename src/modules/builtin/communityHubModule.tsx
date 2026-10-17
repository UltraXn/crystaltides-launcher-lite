import React from 'react';
import { Globe, ShoppingBag, BookOpen, MessageSquare, ExternalLink, Play } from 'lucide-react';
import type { LauncherModule, LauncherModuleContext } from '../types';

const CommunityHubModalContent: React.FC<{ ctx: LauncherModuleContext; onClose: () => void }> = ({
  ctx,
  onClose,
}) => {
  const { serverStatus, launchGame } = ctx;

  const links = [
    {
      title: 'Discord de la Comunidad',
      desc: 'Comunidad, canales de voz y anuncios oficiales.',
      url: 'https://discord.gg/TDmwYNnvyT',
      icon: <MessageSquare size={16} color="#38bdf8" />,
    },
    {
      title: 'Tienda Oficial CrystalTides',
      desc: 'Rangos cosméticos, capas y soporte para el servidor.',
      url: 'https://store.crystaltides.net',
      icon: <ShoppingBag size={16} color="#f59e0b" />,
    },
    {
      title: 'Wiki & Normativa del Servidor',
      desc: 'Guías de inicio, reglas de supervivencia y comandos.',
      url: 'https://wiki.crystaltides.net',
      icon: <BookOpen size={16} color="#22c55e" />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Live Server Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.12), rgba(56, 189, 248, 0.05))',
          borderRadius: '12px',
          padding: '14px',
          border: '1px solid rgba(0, 229, 255, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: serverStatus.online ? '#22c55e' : '#ef4444',
              boxShadow: serverStatus.online ? '0 0 8px #22c55e' : 'none',
            }}
          />
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'block' }}>
              play.crystaltides.net
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {serverStatus.online
                ? `${serverStatus.playersCount} jugadores conectados | Ping: ${serverStatus.ping}ms`
                : 'Servidor fuera de línea'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            launchGame();
          }}
          className="dock-preset-pill active"
          style={{
            padding: '6px 14px',
            background: '#22c55e',
            borderColor: '#22c55e',
            color: '#ffffff',
            fontWeight: 700,
          }}
        >
          <Play size={12} fill="#ffffff" />
          <span>Jugar Ahora</span>
        </button>
      </div>

      {/* Community Links List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {links.map((link) => (
          <a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {link.icon}
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#f8fafc',
                    display: 'block',
                  }}
                >
                  {link.title}
                </span>
                <span style={{ fontSize: '10.5px', color: 'rgba(248, 250, 252, 0.5)' }}>
                  {link.desc}
                </span>
              </div>
            </div>
            <ExternalLink size={14} color="rgba(248, 250, 252, 0.4)" />
          </a>
        ))}
      </div>
    </div>
  );
};

export const CommunityHubModule: LauncherModule = {
  id: 'ct.community-hub',
  name: 'Hub Comunitario & Enlaces',
  version: '1.0.0',
  description: 'Acceso directo a la comunidad, tienda oficial, reglas y estado en vivo del servidor.',
  author: 'CrystalTides Core',
  category: 'social',
  slots: {
    dockButton: {
      id: 'community-hub-btn',
      icon: <Globe size={22} color="#00e5ff" />,
      label: 'Comunidad',
      tooltip: 'Hub de la Comunidad CrystalTides',
      defaultColor: '#00e5ff',
      onClick: (ctx) => {
        ctx.openModuleModal('ct.community-hub');
      },
    },
    modal: {
      id: 'community-hub-modal',
      title: 'Hub de la Comunidad CrystalTides',
      width: '440px',
      component: CommunityHubModalContent,
    },
  },
};
