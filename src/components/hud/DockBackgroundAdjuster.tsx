import React from 'react';
import { Sliders, RotateCcw } from 'lucide-react';
import { useLauncherStore, launcherActions, LauncherState } from '../../store/launcherStore';

export const DockBackgroundAdjuster: React.FC = () => {
  const dockConfig = useLauncherStore((s: LauncherState) => s.dockConfig);
  const posX = dockConfig.dockBgPosX ?? 50;
  const posY = dockConfig.dockBgPosY ?? 50;
  const scale = dockConfig.dockBgScale ?? 100;
  const opacity = Math.round((dockConfig.dockBgOpacity ?? 1) * 100);

  const presetBtnStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '3px 4px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    cursor: 'pointer',
    background: isActive ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
    border: isActive ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
    color: isActive ? '#ffffff' : '#94a3b8',
    transition: 'all 0.12s ease',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        padding: '8px 10px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        marginTop: '2px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#e2e8f0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Sliders size={11} /> Ajuste y Encuadre
        </span>
        {(posX !== 50 || posY !== 50 || scale !== 100 || opacity !== 100) && (
          <button
            type="button"
            onClick={() => launcherActions.resetDockBackgroundTransform()}
            title="Restablecer posición y zoom del fondo"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '9px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
          >
            <RotateCcw size={9} /> Restablecer Encuadre
          </button>
        )}
      </div>

      {/* 1. Posición Vertical (Y) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
            Posición Vertical (Y)
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: '#f8fafc',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {posY}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={posY}
          onChange={(e) =>
            launcherActions.updateDockBackgroundTransform({ posY: Number(e.target.value) })
          }
          style={{ width: '100%', accentColor: '#cbd5e1', cursor: 'pointer' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posY: 15 })}
            style={presetBtnStyle(posY === 15)}
          >
            Arriba (15%)
          </button>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posY: 50 })}
            style={presetBtnStyle(posY === 50)}
          >
            Centro (50%)
          </button>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posY: 85 })}
            style={presetBtnStyle(posY === 85)}
          >
            Abajo (85%)
          </button>
        </div>
      </div>

      {/* 2. Posición Horizontal (X) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
            Posición Horizontal (X)
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: '#f8fafc',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {posX}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={posX}
          onChange={(e) =>
            launcherActions.updateDockBackgroundTransform({ posX: Number(e.target.value) })
          }
          style={{ width: '100%', accentColor: '#cbd5e1', cursor: 'pointer' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posX: 15 })}
            style={presetBtnStyle(posX === 15)}
          >
            Izq (15%)
          </button>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posX: 50 })}
            style={presetBtnStyle(posX === 50)}
          >
            Centro (50%)
          </button>
          <button
            type="button"
            onClick={() => launcherActions.updateDockBackgroundTransform({ posX: 85 })}
            style={presetBtnStyle(posX === 85)}
          >
            Der (85%)
          </button>
        </div>
      </div>

      {/* 3. Zoom / Escala */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
            Zoom / Escala
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: '#f8fafc',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scale}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="range"
            min="100"
            max="250"
            value={scale}
            onChange={(e) =>
              launcherActions.updateDockBackgroundTransform({ scale: Number(e.target.value) })
            }
            style={{ flex: 1, accentColor: '#cbd5e1', cursor: 'pointer' }}
          />
          {scale !== 100 && (
            <button
              type="button"
              onClick={() => launcherActions.updateDockBackgroundTransform({ scale: 100 })}
              style={{
                fontSize: '8.5px',
                padding: '2px 5px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              100%
            </button>
          )}
        </div>
      </div>

      {/* 4. Opacidad de Fondo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600 }}>
            Opacidad de Fondo
          </span>
          <span
            style={{
              fontSize: '9.5px',
              color: '#f8fafc',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {opacity}%
          </span>
        </div>
        <input
          type="range"
          min="15"
          max="100"
          value={opacity}
          onChange={(e) =>
            launcherActions.updateDockBackgroundTransform({
              opacity: Number(e.target.value) / 100,
            })
          }
          style={{ width: '100%', accentColor: '#cbd5e1', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};
