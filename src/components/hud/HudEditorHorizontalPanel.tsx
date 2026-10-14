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
} from 'lucide-react';
import {
  launcherActions,
  LauncherState,
  useT,
} from '../../store/launcherStore';

interface HorizontalPanelProps {
  t: ReturnType<typeof useT>;
  dockConfig: LauncherState['dockConfig'];
  hudManualSide: LauncherState['hudManualSide'];
  accentColor: string;
  cycleSide: () => void;
}

const HorizontalHeaderControls: React.FC<HorizontalPanelProps> = ({
  t,
  dockConfig,
  hudManualSide,
  accentColor,
  cycleSide,
}) => {
  return (
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

            
    </>
  );
};

interface HorizontalPresetProps {
  t: ReturnType<typeof useT>;
  dockConfig: LauncherState['dockConfig'];
}

const HorizontalPresetAndActionControls: React.FC<HorizontalPresetProps> = ({
  t,
  dockConfig,
}) => {
  return (
    <>
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
  );
};

export const HudEditorHorizontalPanel: React.FC<HorizontalPanelProps> = (props) => {
  return (
    <>
      <HorizontalHeaderControls {...props} />
      <HorizontalPresetAndActionControls {...props} />
    </>
  );
};
