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
import { launcherActions, LauncherState, useT } from '../../store/launcherStore';

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
          background: hudManualSide !== 'auto' ? `${accentColor}33` : 'rgba(255, 255, 255, 0.05)',
          border:
            hudManualSide !== 'auto'
              ? `1px solid ${accentColor}`
              : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
          color: hudManualSide !== 'auto' ? accentColor : 'rgba(248, 250, 252, 0.7)',
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

      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }} />

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
            background: dockConfig.layoutMode === 'dock' ? `${accentColor}33` : 'transparent',
            color: dockConfig.layoutMode === 'dock' ? accentColor : 'rgba(248, 250, 252, 0.6)',
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
              dockConfig.layoutMode === 'free_buttons' ? `${accentColor}33` : 'transparent',
            color:
              dockConfig.layoutMode === 'free_buttons' ? accentColor : 'rgba(248, 250, 252, 0.6)',
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
  accentColor: string;
}

const HorizontalPresetAndActionControls: React.FC<HorizontalPresetProps> = ({
  t,
  dockConfig,
  accentColor,
}) => {
  return (
    <>
      {/* Button Scale / Compact Mode Toggle */}
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
          onClick={() => launcherActions.setDockConfig({ scale: 'normal' })}
          title="Tamaño normal de botones (136x108px)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: 'none',
            background: dockConfig.scale !== 'compact' ? `${accentColor}33` : 'transparent',
            color: dockConfig.scale !== 'compact' ? accentColor : 'rgba(248, 250, 252, 0.6)',
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
          title="Modo compacto (botones reducidos a 96x74px)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: '6px',
            border: 'none',
            background: dockConfig.scale === 'compact' ? `${accentColor}33` : 'transparent',
            color: dockConfig.scale === 'compact' ? accentColor : 'rgba(248, 250, 252, 0.6)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Minimize2 size={12} />
          <span>{t.hudEditor.scaleCompact}</span>
        </button>
      </div>

      {/* Text Labels Toggle */}
      <button
        type="button"
        onClick={() => launcherActions.setDockConfig({ showLabels: !dockConfig.showLabels })}
        title={
          dockConfig.showLabels
            ? 'Ocultar texto de los botones (solo iconos)'
            : 'Mostrar nombres y etiquetas de botones'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '7px',
          border: dockConfig.showLabels
            ? `1px solid ${accentColor}`
            : '1px solid rgba(255, 255, 255, 0.1)',
          background: dockConfig.showLabels ? `${accentColor}33` : 'rgba(255, 255, 255, 0.05)',
          color: dockConfig.showLabels ? accentColor : 'rgba(248, 250, 252, 0.7)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {dockConfig.showLabels ? <Type size={12} /> : <EyeOff size={12} />}
        <span>{dockConfig.showLabels ? t.hudEditor.showText : t.hudEditor.hideText}</span>
      </button>

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
                  ? `${accentColor}40`
                  : 'rgba(255, 255, 255, 0.05)',
              border:
                dockConfig.positionPreset === 'top'
                  ? `1px solid ${accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: dockConfig.positionPreset === 'top' ? accentColor : 'rgba(248, 250, 252, 0.7)',
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
                  ? `${accentColor}40`
                  : 'rgba(255, 255, 255, 0.05)',
              border:
                dockConfig.positionPreset === 'center'
                  ? `1px solid ${accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color:
                dockConfig.positionPreset === 'center' ? accentColor : 'rgba(248, 250, 252, 0.7)',
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
                  ? `${accentColor}40`
                  : 'rgba(255, 255, 255, 0.05)',
              border:
                dockConfig.positionPreset === 'bottom'
                  ? `1px solid ${accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color:
                dockConfig.positionPreset === 'bottom' ? accentColor : 'rgba(248, 250, 252, 0.7)',
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
          background: `${accentColor}18`,
          border: `1px solid ${accentColor}40`,
          borderRadius: '6px',
          padding: '4px 8px',
          fontSize: '10.5px',
          color: accentColor,
          fontWeight: 600,
        }}
        title="Haz doble clic en cualquier botón del Dock para personalizarlo a fondo"
      >
        <Sparkles size={12} />
        <span>Doble clic en botón para personalizar</span>
      </div>

      <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)' }} />

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
          background: `linear-gradient(135deg, ${accentColor}, #0f766e)`,
          border: `1px solid ${accentColor}`,
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
