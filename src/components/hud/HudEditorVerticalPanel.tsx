import React from 'react';
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
  Maximize2,
  Minimize2,
  Type,
  EyeOff,
} from 'lucide-react';
import {
  launcherActions,
  LauncherState,
  useT,
} from '../../store/launcherStore';

interface VerticalPanelProps {
  t: ReturnType<typeof useT>;
  dockConfig: LauncherState['dockConfig'];
  hudManualSide: LauncherState['hudManualSide'];
  accentColor: string;
  effectiveSide: 'left' | 'right' | 'center';
  cycleSide: () => void;
}

const VerticalHeaderControls: React.FC<VerticalPanelProps> = ({
  t,
  dockConfig,
  hudManualSide,
  accentColor,
  effectiveSide,
  cycleSide,
}) => {
  return (
    <>
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
                      ? `${accentColor}33`
                      : 'rgba(255, 255, 255, 0.06)',
                  border:
                    hudManualSide !== 'auto'
                      ? `1px solid ${accentColor}`
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: accentColor,
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
                        ? `1px solid ${accentColor}`
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    background:
                      dockConfig.layoutMode === 'dock'
                        ? `${accentColor}33`
                        : 'rgba(255, 255, 255, 0.03)',
                    color:
                      dockConfig.layoutMode === 'dock' ? accentColor : 'rgba(248, 250, 252, 0.7)',
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
                        ? `1px solid ${accentColor}`
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    background:
                      dockConfig.layoutMode === 'free_buttons'
                        ? `${accentColor}33`
                        : 'rgba(255, 255, 255, 0.03)',
                    color:
                      dockConfig.layoutMode === 'free_buttons'
                        ? accentColor
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

            
    </>
  );
};

interface VerticalPresetsProps {
  t: ReturnType<typeof useT>;
  dockConfig: LauncherState['dockConfig'];
  accentColor: string;
}

const VerticalPresetsAndSliders: React.FC<VerticalPresetsProps> = ({
  t,
  dockConfig,
  accentColor,
}) => {
  return (
    <>
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
                          ? `1px solid ${accentColor}`
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'top'
                          ? `${accentColor}33`
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'top'
                          ? accentColor
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
                          ? `1px solid ${accentColor}`
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'center'
                          ? `${accentColor}33`
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'center'
                          ? accentColor
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
                          ? `1px solid ${accentColor}`
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      background:
                        dockConfig.positionPreset === 'bottom'
                          ? `${accentColor}33`
                          : 'rgba(255, 255, 255, 0.03)',
                      color:
                        dockConfig.positionPreset === 'bottom'
                          ? accentColor
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

            {/* Dock Button Scale / Size */}
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
                {t.hudEditor.dockScale}
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ scale: 'normal' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 4px',
                    borderRadius: '6px',
                    border: 'none',
                    background:
                      dockConfig.scale !== 'compact' ? `${accentColor}33` : 'transparent',
                    color:
                      dockConfig.scale !== 'compact' ? accentColor : 'rgba(248, 250, 252, 0.6)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Maximize2 size={12} />
                  <span>{t.hudEditor.scaleNormal}</span>
                </button>
                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ scale: 'compact' })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 4px',
                    borderRadius: '6px',
                    border: 'none',
                    background:
                      dockConfig.scale === 'compact' ? `${accentColor}33` : 'transparent',
                    color:
                      dockConfig.scale === 'compact' ? accentColor : 'rgba(248, 250, 252, 0.6)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Minimize2 size={12} />
                  <span>{t.hudEditor.scaleCompact}</span>
                </button>
              </div>
            </div>

            {/* Icon Scale / Size Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: 'rgba(248, 250, 252, 0.45)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {t.hudEditor.iconScale}
                </span>
                <span style={{ fontSize: '10px', color: accentColor, fontWeight: 700 }}>
                  {((dockConfig.iconScale ?? 1) * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                aria-label={t.hudEditor.iconScale}
                min="0.6"
                max="1.8"
                step="0.05"
                value={dockConfig.iconScale ?? 1}
                onChange={(e) =>
                  launcherActions.setDockConfig({
                    iconScale: Number.parseFloat(e.target.value),
                  })
                }
                style={{
                  width: '100%',
                  accentColor,
                  cursor: 'pointer',
                  height: '4px',
                }}
              />
            </div>

            {/* Text Labels Visibility */}
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
                {t.hudEditor.textLabels}
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ showLabels: true })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 4px',
                    borderRadius: '6px',
                    border: 'none',
                    background: dockConfig.showLabels ? `${accentColor}33` : 'transparent',
                    color: dockConfig.showLabels ? accentColor : 'rgba(248, 250, 252, 0.6)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Type size={12} />
                  <span>{t.hudEditor.showText}</span>
                </button>
                <button
                  type="button"
                  onClick={() => launcherActions.setDockConfig({ showLabels: false })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '5px 4px',
                    borderRadius: '6px',
                    border: 'none',
                    background: !dockConfig.showLabels ? `${accentColor}33` : 'transparent',
                    color: !dockConfig.showLabels ? accentColor : 'rgba(248, 250, 252, 0.6)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <EyeOff size={12} />
                  <span>{t.hudEditor.hideText}</span>
                </button>
              </div>
            </div>

            {/* Opacity & Radius Sliders (Unified Dock Mode) */}
            {dockConfig.layoutMode === 'dock' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: 'rgba(248, 250, 252, 0.45)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {t.hudEditor.opacity}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Math.round(dockConfig.bgOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={dockConfig.bgOpacity}
                    aria-label={t.hudEditor.opacity}
                    onChange={(e) =>
                      launcherActions.setDockConfig({ bgOpacity: parseFloat(e.target.value) })
                    }
                    style={{ width: '100%', accentColor: accentColor, cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: 'rgba(248, 250, 252, 0.45)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {t.hudEditor.borderRadius}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#f8fafc',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {dockConfig.borderRadius}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={dockConfig.borderRadius}
                    aria-label={t.hudEditor.borderRadius}
                    onChange={(e) =>
                      launcherActions.setDockConfig({
                        borderRadius: parseInt(e.target.value, 10),
                      })
                    }
                    style={{ width: '100%', accentColor: accentColor, cursor: 'pointer' }}
                  />
                </div>
              </>
            )}

            {/* Customization Tip */}
            <div
              style={{
                background: `${accentColor}14`,
                border: `1px solid ${accentColor}33`,
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
                  color: accentColor,
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
                  border: `1px solid ${accentColor}`,
                  background: `linear-gradient(135deg, ${accentColor}, #0f766e)`,
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: `0 4px 14px ${accentColor}40`,
                }}
              >
                <Check size={14} strokeWidth={3} />
                <span>{t.hudEditor.done}</span>
              </button>
            </div>

    </>
  );
};

export const HudEditorVerticalPanel: React.FC<VerticalPanelProps> = (props) => {
  return (
    <>
      <VerticalHeaderControls {...props} />
      <VerticalPresetsAndSliders {...props} />
    </>
  );
};
