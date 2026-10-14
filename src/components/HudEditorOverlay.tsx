import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (!isEditingHud) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const selected = getLauncherState().selectedDockButtonId;
        if (selected) {
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
        target.closest('[data-inspector]')
      ) {
        return;
      }
      const selected = getLauncherState().selectedDockButtonId;
      if (selected) {
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
        top: '16px',
        right: '16px',
        bottom: '16px',
        transform: 'none',
      };
    }
    if (effectiveSide === 'left') {
      return {
        top: '16px',
        left: '16px',
        bottom: '16px',
        transform: 'none',
      };
    }
    return {
      top: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
    };
  };

  const getNextSide = (side: 'auto' | 'left' | 'right' | 'center'): 'auto' | 'left' | 'right' | 'center' => {
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
          gap: '8px',
          width: isVertical ? '204px' : 'auto',
          maxHeight: isVertical ? 'calc(100vh - 32px)' : undefined,
          background: 'rgba(15, 18, 26, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: isVertical ? '16px' : '14px',
          padding: isVertical ? '12px 10px' : '6px 14px',
          boxShadow:
            dockConfig.positionPreset === 'top'
              ? '0 16px 45px rgba(0, 0, 0, 0.92), 0 0 26px rgba(56, 189, 248, 0.35)'
              : '0 12px 40px rgba(0, 0, 0, 0.85), 0 0 20px rgba(56, 189, 248, 0.2)',
          color: '#f8fafc',
          userSelect: 'none',
          transition:
            'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s ease, padding 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease',
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
          />
        )}
      </div>
    </div>
  );
};
