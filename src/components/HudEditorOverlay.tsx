import React, { useEffect } from 'react';
import {
  Move,
  RotateCcw,
  Check,
  Columns,
  Grid,
  ArrowUpToLine,
  ArrowDownToLine,
  Minus,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState, useT } from '../store/launcherStore';
import { getEffectiveHudSide } from '../utils/collisionSystem';

export const HudEditorOverlay: React.FC = () => {
  const isEditingHud = useLauncherStore((s: LauncherState) => s.isEditingHud);
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const hudManualSide = useLauncherStore((s: LauncherState) => s.hudManualSide);
  const accentColor = useLauncherStore((s: LauncherState) => s.accentColor);
  const t = useT();

  // Exit on ESC key
  useEffect(() => {
    if (!isEditingHud) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        launcherActions.setEditingHud(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditingHud]);

  if (!isEditingHud) return null;

  // Effective side for the toolbar calculated dynamically
  const effectiveSide: 'left' | 'center' | 'right' = getEffectiveHudSide(dockConfig, hudManualSide);

  // Whether the toolbar is in vertical panel form on the side
  const isVertical = effectiveSide === 'right' || effectiveSide === 'left';

  const getPositionStyles = (): React.CSSProperties => {
    if (effectiveSide === 'right') {
      return {
        left: 'calc(100% - 24px - 186px)',
        top: '50%',
        transform: 'translate(0, -50%)',
      };
    }
    if (effectiveSide === 'left') {
      return {
        left: '24px',
        top: '50%',
        transform: 'translate(0, -50%)',
      };
    }
    return {
      left: '50%',
      top: '46px',
      transform: 'translate(-50%, 0)',
    };
  };

  const cycleSide = () => {
    let next: 'auto' | 'left' | 'center' | 'right' = 'auto';
    if (hudManualSide === 'auto') next = 'right';
    else if (hudManualSide === 'right') next = 'left';
    else if (hudManualSide === 'left') next = 'center';
    else next = 'auto';
    launcherActions.setHudManualSide(next);
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
      {/* Blueprint Grid Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(rgba(56, 189, 248, 0.18) 1px, transparent 1px), linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '24px 24px, 120px 120px, 120px 120px',
          pointerEvents: 'none',
        }}
      />

      {/* Floating HUD Control Bar (Smoothly morphs into a vertical sidebar on sides when top is occupied) */}
      <div
        style={{
          position: 'absolute',
          ...getPositionStyles(),
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: isVertical ? 'stretch' : 'center',
          gap: isVertical ? '10px' : '8px',
          width: isVertical ? '186px' : 'auto',
          background: 'rgba(10, 14, 22, 0.94)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border:
            effectiveSide !== 'center' && hudManualSide === 'auto'
              ? '1px solid #38bdf8'
              : '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: isVertical ? '16px' : '14px',
          padding: isVertical ? '14px 12px' : '6px 14px',
          boxShadow:
            effectiveSide !== 'center' && hudManualSide === 'auto'
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
          /* ═══════════════════════════════════════════════════════════
             VERTICAL PANEL LAYOUT (When on Right or Left Side)
             ═══════════════════════════════════════════════════════════ */
          <>
            {/* Header: Title + Switch Side Button */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Move size={15} style={{ color: accentColor }} />
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.2px' }}>
                  {t.hudEditor.title}
                </span>
              </div>
              <button
                type="button"
                onClick={cycleSide}
                title={
                  effectiveSide === 'right' ? t.hudEditor.posMenuLeft : t.hudEditor.posMenuRight
                }
                style={{
                  background:
                    hudManualSide !== 'auto'
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'rgba(255, 255, 255, 0.06)',
                  border:
                    hudManualSide !== 'auto'
                      ? '1px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowLeftRight size={13} />
              </button>
            </div>

            {/* Layout Mode Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: 'rgba(248, 250, 252, 0.45)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {t.hudEditor.barMode}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => launcherActions.setLayoutMode('dock')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border:
                      dockConfig.layoutMode === 'dock'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    background:
                      dockConfig.layoutMode === 'dock'
                        ? 'rgba(56, 189, 248, 0.18)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color:
                      dockConfig.layoutMode === 'dock' ? '#38bdf8' : 'rgba(248, 250, 252, 0.7)',
                    fontWeight: 600,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Columns size={13} />
                  <span>{t.hudEditor.unifiedDock}</span>
                </button>
                <button
                  type="button"
                  onClick={() => launcherActions.setLayoutMode('free_buttons')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border:
                      dockConfig.layoutMode === 'free_buttons'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    background:
                      dockConfig.layoutMode === 'free_buttons'
                        ? 'rgba(56, 189, 248, 0.18)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color:
                      dockConfig.layoutMode === 'free_buttons'
                        ? '#38bdf8'
                        : 'rgba(248, 250, 252, 0.7)',
                    fontWeight: 600,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Grid size={13} />
                  <span>{t.hudEditor.freeButtons}</span>
                </button>
              </div>
            </div>

            {/* Position Presets (When in Unified Dock Mode) */}
            {dockConfig.layoutMode === 'dock' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: 'rgba(248, 250, 252, 0.45)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {t.hudEditor.quickPosition}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      launcherActions.setDockConfig({
                        positionPreset: 'top',
                        customCoordinates: {
                          x: 50,
                          y: dockConfig.showLabels && dockConfig.scale !== 'compact' ? 17 : 14,
                        },
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border:
                        dockConfig.positionPreset === 'top'
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'top'
                          ? 'rgba(56, 189, 248, 0.22)'
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'top'
                          ? '#38bdf8'
                          : 'rgba(248, 250, 252, 0.7)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ArrowUpToLine size={13} />
                    <span>{t.hudEditor.top}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      launcherActions.setDockConfig({
                        positionPreset: 'center',
                        customCoordinates: { x: 50, y: 50 },
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border:
                        dockConfig.positionPreset === 'center'
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'center'
                          ? 'rgba(56, 189, 248, 0.22)'
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'center'
                          ? '#38bdf8'
                          : 'rgba(248, 250, 252, 0.7)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Minus size={13} />
                    <span>{t.hudEditor.center}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      launcherActions.setDockConfig({
                        positionPreset: 'bottom',
                        customCoordinates: { x: 50, y: 76 },
                      })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border:
                        dockConfig.positionPreset === 'bottom'
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'bottom'
                          ? 'rgba(56, 189, 248, 0.22)'
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'bottom'
                          ? '#38bdf8'
                          : 'rgba(248, 250, 252, 0.7)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ArrowDownToLine size={13} />
                    <span>{t.hudEditor.bottom}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Customization Tip */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.22)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: '#38bdf8',
                  fontSize: '10.5px',
                  fontWeight: 700,
                }}
              >
                <Sparkles size={12} />
                <span>Personalizar Botón</span>
              </div>
              <span
                style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.35 }}
              >
                Haz clic en cualquier botón del Dock para editar su fondo, vídeo, tamaño, SVG y
                efectos.
              </span>
            </div>

            {/* Actions: Reset & Done */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                marginTop: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => launcherActions.resetAllPositions()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  background: 'rgba(244, 63, 94, 0.06)',
                  color: '#fb7185',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
                <span>{t.hudEditor.reset}</span>
              </button>
              <button
                type="button"
                onClick={() => launcherActions.setEditingHud(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
                }}
              >
                <Check size={14} strokeWidth={3} />
                <span>{t.hudEditor.done}</span>
              </button>
            </div>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════
             HORIZONTAL TOP BAR LAYOUT (When centered with space at top)
             ═══════════════════════════════════════════════════════════ */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '4px' }}>
              <Move size={15} style={{ color: accentColor }} />
              <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.2px' }}>
                {t.hudEditor.title}
              </span>
            </div>

            {/* Position side toggle button */}
            <button
              type="button"
              onClick={cycleSide}
              title={t.hudEditor.togglePosTitle}
              style={{
                background:
                  hudManualSide !== 'auto'
                    ? 'rgba(56, 189, 248, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  hudManualSide !== 'auto'
                    ? '1px solid #38bdf8'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: hudManualSide !== 'auto' ? '#38bdf8' : 'rgba(248, 250, 252, 0.7)',
                padding: '4px 7px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                transition: 'all 0.15s ease',
              }}
            >
              <ArrowLeftRight size={12} />
            </button>

            <div
              style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }}
            />

            {/* Grouped vs Individual Buttons Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => launcherActions.setLayoutMode('dock')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    dockConfig.layoutMode === 'dock' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: dockConfig.layoutMode === 'dock' ? '#38bdf8' : 'rgba(248, 250, 252, 0.6)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Columns size={12} />
                <span>{t.hudEditor.unifiedDock}</span>
              </button>

              <button
                type="button"
                onClick={() => launcherActions.setLayoutMode('free_buttons')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background:
                    dockConfig.layoutMode === 'free_buttons'
                      ? 'rgba(56, 189, 248, 0.2)'
                      : 'transparent',
                  color:
                    dockConfig.layoutMode === 'free_buttons'
                      ? '#38bdf8'
                      : 'rgba(248, 250, 252, 0.6)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Grid size={12} />
                <span>{t.hudEditor.freeButtons}</span>
              </button>
            </div>

            {/* Presets (when in dock mode) */}
            {dockConfig.layoutMode === 'dock' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'top',
                      customCoordinates: {
                        x: 50,
                        y: dockConfig.showLabels && dockConfig.scale !== 'compact' ? 17 : 14,
                      },
                    })
                  }
                  title="Alinear arriba"
                  style={{
                    background:
                      dockConfig.positionPreset === 'top'
                        ? 'rgba(56, 189, 248, 0.25)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      dockConfig.positionPreset === 'top'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color:
                      dockConfig.positionPreset === 'top' ? '#38bdf8' : 'rgba(248, 250, 252, 0.7)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                  }}
                >
                  <ArrowUpToLine size={12} />
                  <span>{t.hudEditor.top}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'center',
                      customCoordinates: { x: 50, y: 50 },
                    })
                  }
                  title="Alinear centro"
                  style={{
                    background:
                      dockConfig.positionPreset === 'center'
                        ? 'rgba(56, 189, 248, 0.25)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      dockConfig.positionPreset === 'center'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color:
                      dockConfig.positionPreset === 'center'
                        ? '#38bdf8'
                        : 'rgba(248, 250, 252, 0.7)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                  }}
                >
                  <Minus size={12} />
                  <span>{t.hudEditor.center}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    launcherActions.setDockConfig({
                      positionPreset: 'bottom',
                      customCoordinates: { x: 50, y: 76 },
                    })
                  }
                  title="Alinear abajo"
                  style={{
                    background:
                      dockConfig.positionPreset === 'bottom'
                        ? 'rgba(56, 189, 248, 0.25)'
                        : 'rgba(255, 255, 255, 0.05)',
                    border:
                      dockConfig.positionPreset === 'bottom'
                        ? '1px solid #38bdf8'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color:
                      dockConfig.positionPreset === 'bottom'
                        ? '#38bdf8'
                        : 'rgba(248, 250, 252, 0.7)',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '11px',
                  }}
                >
                  <ArrowDownToLine size={12} />
                  <span>{t.hudEditor.bottom}</span>
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '10.5px',
                color: '#38bdf8',
                fontWeight: 600,
              }}
              title="Haz clic en cualquier botón del Dock para personalizarlo a fondo"
            >
              <Sparkles size={12} />
              <span>Clic en botón para personalizar</span>
            </div>

            <div
              style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }}
            />

            {/* Reset */}
            <button
              type="button"
              onClick={() => launcherActions.resetAllPositions()}
              title="Restablecer todas las posiciones originales"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                padding: '4px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <RotateCcw size={12} />
              <span>{t.hudEditor.reset}</span>
            </button>

            {/* Save & Exit */}
            <button
              type="button"
              onClick={() => launcherActions.setEditingHud(false)}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
                border: '1px solid #38bdf8',
                color: '#ffffff',
                padding: '5px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                fontWeight: 700,
                boxShadow: '0 2px 10px rgba(14, 165, 233, 0.4)',
              }}
            >
              <Check size={13} strokeWidth={3} />
              <span>{t.hudEditor.done}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
