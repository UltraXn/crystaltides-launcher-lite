import React, { useState } from 'react';
import { Compass, ArrowRightLeft, Copy, Check, Flame } from 'lucide-react';
import type { LauncherModule } from '../types';

const NetherPortalModalContent: React.FC = () => {
  const [mode, setMode] = useState<'overworld_to_nether' | 'nether_to_overworld'>(
    'overworld_to_nether'
  );
  const [x, setX] = useState<string>('1000');
  const [y, setY] = useState<string>('64');
  const [z, setZ] = useState<string>('1000');
  const [copied, setCopied] = useState(false);

  const numX = parseFloat(x) || 0;
  const numY = parseFloat(y) || 64;
  const numZ = parseFloat(z) || 0;

  const targetX =
    mode === 'overworld_to_nether'
      ? Math.floor(numX / 8)
      : Math.floor(numX * 8);

  const targetY = numY;

  const targetZ =
    mode === 'overworld_to_nether'
      ? Math.floor(numZ / 8)
      : Math.floor(numZ * 8);

  const handleCopy = () => {
    navigator.clipboard.writeText(`/tp @s ${targetX} ${targetY} ${targetZ}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMode = () => {
    setMode((prev) =>
      prev === 'overworld_to_nether' ? 'nether_to_overworld' : 'overworld_to_nether'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Mode Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.4)',
          borderRadius: '10px',
          padding: '6px 12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Flame size={16} color="#d946ef" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
            {mode === 'overworld_to_nether'
              ? 'Overworld ➔ Nether (÷ 8)'
              : 'Nether ➔ Overworld (× 8)'}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleMode}
          className="dock-preset-pill"
          style={{ padding: '4px 10px', fontSize: '11px', margin: 0 }}
        >
          <ArrowRightLeft size={12} />
          <span>Invertir Conversión</span>
        </button>
      </div>

      {/* Grid Inputs & Result */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}
      >
        {/* Source Coordinates */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#38bdf8',
              display: 'block',
              marginBottom: '10px',
            }}
          >
            {mode === 'overworld_to_nether' ? 'Coordenadas Overworld' : 'Coordenadas Nether'}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="portal-coord-x" style={{ fontSize: '11px', width: '16px', color: '#94a3b8' }}>X:</label>
              <input
                id="portal-coord-x"
                aria-label="Coordenada X"
                type="number"
                value={x}
                onChange={(e) => setX(e.target.value)}
                className="login-text-input"
                style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="portal-coord-y" style={{ fontSize: '11px', width: '16px', color: '#94a3b8' }}>Y:</label>
              <input
                id="portal-coord-y"
                aria-label="Coordenada Y"
                type="number"
                value={y}
                onChange={(e) => setY(e.target.value)}
                className="login-text-input"
                style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="portal-coord-z" style={{ fontSize: '11px', width: '16px', color: '#94a3b8' }}>Z:</label>
              <input
                id="portal-coord-z"
                aria-label="Coordenada Z"
                type="number"
                value={z}
                onChange={(e) => setZ(e.target.value)}
                className="login-text-input"
                style={{ height: '32px', fontSize: '12px', padding: '0 8px' }}
              />
            </div>
          </div>
        </div>

        {/* Target Result */}
        <div
          style={{
            background: 'rgba(168, 85, 247, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#d946ef',
                display: 'block',
                marginBottom: '10px',
              }}
            >
              Portal Enlazado en {mode === 'overworld_to_nether' ? 'Nether' : 'Overworld'}
            </span>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontFamily: 'var(--font-fira, monospace)',
                fontSize: '13px',
                fontWeight: 700,
                color: '#f8fafc',
              }}
            >
              <div>X: <span style={{ color: '#d946ef' }}>{targetX}</span></div>
              <div>Y: <span style={{ color: '#d946ef' }}>{targetY}</span></div>
              <div>Z: <span style={{ color: '#d946ef' }}>{targetZ}</span></div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="dock-preset-pill active"
            style={{
              marginTop: '12px',
              padding: '6px 10px',
              justifyContent: 'center',
              backgroundColor: copied ? '#22c55e' : 'rgba(168, 85, 247, 0.25)',
              borderColor: copied ? '#22c55e' : '#a855f7',
              color: '#ffffff',
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? '¡Comando Copiado!' : 'Copiar /tp Comando'}</span>
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: '10.5px',
          color: 'rgba(248, 250, 252, 0.5)',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        💡 <strong>Regla de Vinculación:</strong> 1 bloque en el Nether equivale a 8 bloques en el Overworld. Para evitar cruce de portales no deseados, construye el portal dentro del radio de 16 bloques en el Nether respecto a estas coordenadas exactas.
      </div>
    </div>
  );
};

export const NetherPortalModule: LauncherModule = {
  id: 'ct.nether-portal-calc',
  name: 'Calculadora de Portales Nether',
  version: '1.0.0',
  description: 'Calcula coordenadas exactas para enlazar portales del Nether y Overworld.',
  author: 'CrystalTides Core',
  category: 'tools',
  slots: {
    dockButton: {
      id: 'nether-calc',
      icon: <Compass size={22} color="#a855f7" />,
      label: 'Portales',
      tooltip: 'Calculadora de Portales del Nether',
      defaultColor: '#a855f7',
      onClick: (ctx) => {
        ctx.openModuleModal('ct.nether-portal-calc');
      },
    },
    modal: {
      id: 'nether-calc-modal',
      title: 'Calculadora de Portales del Nether',
      width: '460px',
      component: NetherPortalModalContent,
    },
  },
};
