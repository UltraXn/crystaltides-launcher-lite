import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState } from '../store/launcherStore';

export const GuiHintToast: React.FC = () => {
  const currentView = useLauncherStore((s: LauncherState) => s.currentView);
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const [visible, setVisible] = useState(false);
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    // Only show on home view, not editing, and haven't dismissed yet this session
    if (currentView !== 'home' || isEditingHud || hasDismissed) {
      setVisible(false);
      return;
    }

    const sessionKey = 'crystaltides_gui_hint_seen';
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    // Delay slightly after launcher renders for smooth appearance
    const showTimer = setTimeout(() => {
      setVisible(true);
    }, 1200);

    // Auto-dismiss after 6 seconds
    const hideTimer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem(sessionKey, '1');
      } catch {}
    }, 7200);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [currentView, isEditingHud, hasDismissed]);

  const handleDismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setVisible(false);
    setHasDismissed(true);
    try {
      sessionStorage.setItem('crystaltides_gui_hint_seen', '1');
    } catch {}
  };

  const handleClick = () => {
    handleDismiss();
    launcherActions.setEditingHud(true);
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: '48px',
        right: '24px',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(10, 15, 24, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        borderRadius: '12px',
        padding: '8px 12px 8px 10px',
        boxShadow: '0 12px 35px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.2)',
        color: '#f1f5f9',
        fontSize: '11.5px',
        cursor: 'pointer',
        animation: 'fadeInSlideDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '8px',
          background: 'rgba(0, 229, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00e5ff',
          flexShrink: 0,
        }}
      >
        <Sparkles size={14} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, color: '#ffffff' }}>Personalizar GUI</span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 800,
              background: 'rgba(0, 229, 255, 0.2)',
              color: '#00e5ff',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              padding: '0 4px',
              borderRadius: '4px',
            }}
          >
            F8
          </span>
        </div>
        <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>
          Haz clic o pulsa F8 para mover o redimensionar botones
        </span>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '4px',
          flexShrink: 0,
        }}
        title="Cerrar notificación"
      >
        <X size={14} />
      </button>

      {/* Shimmer / Progress indicator bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          background: 'linear-gradient(to right, #00e5ff, #3b82f6)',
          animation: 'shrinkWidth 6s linear forwards',
          width: '100%',
        }}
      />
    </div>
  );
};
