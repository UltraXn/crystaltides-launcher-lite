import React, { useEffect, useState } from 'react';
import {
  useLauncherStore,
  launcherActions,
  LauncherState,
  getLauncherState,
  useT,
} from '../store/launcherStore';
import { getEffectiveHudSide } from '../utils/collisionSystem';
import { HudEditorVerticalPanel } from './hud/HudEditorVerticalPanel';
import { HudEditorHorizontalPanel } from './hud/HudEditorHorizontalPanel';

export const HudEditorOverlay: React.FC = () => {
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);
  const t = useT();

  const [winDimensions, setWinDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    let unlistenTauri: (() => void) | undefined;
    const handleResize = () => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const h = typeof window !== 'undefined' ? window.innerHeight : 720;
      setWinDimensions((prev) => {
        if (prev.width === w && prev.height === h) return prev;
        return { width: w, height: h };
      });
    };

    window.addEventListener('resize', handleResize);

    const setupTauri = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        unlistenTauri = await appWindow.onResized(() => {
          handleResize();
        });
      } catch {
        // Browser / dev preview
      }
    };
    void setupTauri();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (unlistenTauri) unlistenTauri();
    };
  }, []);

  useEffect(() => {
    if (!isEditingHud) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        e.key === 'F8' ||
        e.key === 'f8' ||
        e.code === 'F8' ||
        e.keyCode === 119 ||
        e.which === 119
      ) {
        e.preventDefault();
        e.stopPropagation();
        launcherActions.setEditingHud(false);
        return;
      }
      if (e.key === 'Escape') {
        const state = getLauncherState();
        if (state.isButtonInspectorOpen) {
          launcherActions.setButtonInspectorOpen(false);
        } else if (state.selectedDockButtonId) {
          launcherActions.setSelectedDockButtonId(null);
        } else {
          launcherActions.setEditingHud(false);
        }
      }
    };

    const handleWindowMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('.dock-segment') ||
        target.closest('.home-unified-dock') ||
        target.closest('[data-inspector]') ||
        target.closest('.dock-resize-handle')
      ) {
        return;
      }
      const state = getLauncherState();
      if (state.isButtonInspectorOpen) {
        launcherActions.setButtonInspectorOpen(false);
      }
      if (state.selectedDockButtonId) {
        launcherActions.setSelectedDockButtonId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleWindowMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleWindowMouseDown);
    };
  }, [isEditingHud]);

  if (!isEditingHud) return null;

  const effectiveSide = getEffectiveHudSide(dockConfig, hudManualSide);
  const isVertical = effectiveSide === 'left' || effectiveSide === 'right';

  const getPositionStyles = (): React.CSSProperties => {
    if (effectiveSide === 'right') {
      return {
        top: '64px',
        right: '16px',
        bottom: '16px',
        transform: 'none',
      };
    }
    if (effectiveSide === 'left') {
      return {
        top: '64px',
        left: '16px',
        bottom: '16px',
        transform: 'none',
      };
    }

    // Barra de edición horizontal (arriba):
    // Redimensionado dinámico junto a la ventana para adaptarse a la escala mínima
    const availableWidth = winDimensions.width - 32;
    const targetWidth = winDimensions.width < 1200 ? 860 : 1160;
    const scale =
      availableWidth < targetWidth
        ? Math.max(0.68, Math.min(1, Math.round((availableWidth / targetWidth) * 100) / 100))
        : 1;

    return {
      top: '60px',
      left: '50%',
      transform: scale < 1 ? `translateX(-50%) scale(${scale})` : 'translateX(-50%)',
      transformOrigin: 'top center',
    };
  };

  const getNextSide = (
    side: 'auto' | 'left' | 'right' | 'center',
  ): 'auto' | 'left' | 'right' | 'center' => {
    if (side === 'auto') return 'right';
    if (side === 'right') return 'left';
    if (side === 'left') return 'center';
    return 'auto';
  };

  const cycleSide = () => {
    launcherActions.setHudManualSide(getNextSide(hudManualSide));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '24px 24px, 120px 120px, 120px 120px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          ...getPositionStyles(),
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: isVertical ? 'stretch' : 'center',
          gap: isVertical ? '8px' : winDimensions.width < 1200 ? '5px' : '8px',
          width: isVertical ? '204px' : 'max-content',
          boxSizing: 'border-box',
          maxHeight: isVertical ? 'calc(100vh - 32px)' : undefined,
          background: 'rgba(15, 18, 26, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: isVertical ? '16px' : '14px',
          padding: isVertical ? '12px 10px' : winDimensions.width < 1200 ? '4px 10px' : '6px 14px',
          boxShadow:
            dockConfig.positionPreset === 'top'
              ? '0 16px 45px rgba(0, 0, 0, 0.92), 0 0 26px rgba(56, 189, 248, 0.35)'
              : '0 12px 40px rgba(0, 0, 0, 0.85), 0 0 20px rgba(56, 189, 248, 0.2)',
          color: '#f8fafc',
          userSelect: 'none',
          transition:
            'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s ease, width 0.35s ease, padding 0.2s ease, box-shadow 0.35s ease, border-color 0.35s ease',
          zIndex: 10000,
        }}
      >
        {isVertical ? (
          <HudEditorVerticalPanel
            t={t}
            dockConfig={dockConfig}
            hudManualSide={hudManualSide}
            accentColor={accentColor}
            effectiveSide={effectiveSide}
            cycleSide={cycleSide}
          />
        ) : (
          <HudEditorHorizontalPanel
            t={t}
            dockConfig={dockConfig}
            hudManualSide={hudManualSide}
            accentColor={accentColor}
            cycleSide={cycleSide}
            winW={winDimensions.width}
          />
        )}
      </div>
    </div>
  );
};
