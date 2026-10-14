import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pipette, X, Check } from 'lucide-react';

interface CustomColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
  compact?: boolean;
  alignRight?: boolean;
}

// Convert HSV to RGB [0-255, 0-255, 0-255]
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

// Convert RGB to HEX #rrggbb
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert HEX string to HSV { h: 0-360, s: 0-1, v: 0-1 }
function hexToHsv(hexStr: string): { h: number; s: number; v: number } {
  let clean = hexStr.replace(/^#/, '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
    return { h: 215, s: 0.15, v: 0.95 };
  }
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60;
    } else {
      h = ((r - g) / d + 4) * 60;
    }
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h: Math.round(h), s, v };
}

const PRESET_SWATCHES = [
  '#f8fafc', // Blanco Cristal / Frost
  '#94a3b8', // Plata Pizarra / Slate
  '#475569', // Titanio Grafito
  '#38bdf8', // Azul Éter Suave
  '#818cf8', // Índigo Crepúsculo
  '#c084fc', // Lavanda Satinado
  '#fb7185', // Rosa Cuarzo Cálido
  '#fb923c', // Ámbar Crepúsculo
  '#eab308', // Oro Champagne
  '#34d399', // Salvia Esmeralda
];

export const CustomColorPicker: React.FC<CustomColorPickerProps> = ({
  color,
  onChange,
  label = 'Personalizado',
  compact = false,
  alignRight = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prevColor, setPrevColor] = useState(color);
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [inputHex, setInputHex] = useState(() => color.toUpperCase());

  const popoverRef = useRef<HTMLDivElement>(null);
  const svBoxRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const isDraggingSvRef = useRef(false);
  const isDraggingHueRef = useRef(false);
  const hsvRef = useRef(hsv);

  // Keep hsvRef in sync with state outside of render
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  // Sync state if color changes externally
  if (color !== prevColor) {
    setPrevColor(color);
    const isDragging = isDraggingSvRef.current || isDraggingHueRef.current;
    const [r, g, b] = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const currentHex = rgbToHex(r, g, b);
    const isSameColor = color.toLowerCase() === currentHex.toLowerCase();

    if (!isDragging && !isSameColor) {
      const newHsv = hexToHsv(color);
      setHsv(newHsv);
    }
    setInputHex(color.toUpperCase());
  }

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle Saturation / Value drag or click (pure updater + external side effect)
  const updateSvFromCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!svBoxRef.current) return;
      const rect = svBoxRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
      const s = Math.round((x / rect.width) * 100) / 100;
      const v = Math.round((1 - y / rect.height) * 100) / 100;

      const currentH = hsvRef.current.h;
      const nextHsv = { h: currentH, s, v };
      setHsv(nextHsv);
      hsvRef.current = nextHsv;

      const [r, g, b] = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
      const hex = rgbToHex(r, g, b);
      setInputHex(hex.toUpperCase());
      onChange(hex);
    },
    [onChange],
  );

  const handleSvMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSvRef.current = true;
    updateSvFromCoords(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      if (isDraggingSvRef.current) {
        updateSvFromCoords(ev.clientX, ev.clientY);
      }
    };
    const onMouseUp = () => {
      isDraggingSvRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [updateSvFromCoords]);

  // Handle Hue spectrum bar drag or click (pure updater + external side effect)
  const updateHueFromCoords = useCallback(
    (clientX: number) => {
      if (!hueBarRef.current) return;
      const rect = hueBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      const h = Math.round(Math.max(0, Math.min(360, ratio * 360)));

      const currentSv = hsvRef.current;
      const nextHsv = { ...currentSv, h };
      setHsv(nextHsv);
      hsvRef.current = nextHsv;

      const [r, g, b] = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
      const hex = rgbToHex(r, g, b);
      setInputHex(hex.toUpperCase());
      onChange(hex);
    },
    [onChange],
  );

  const handleHueMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHueRef.current = true;
    updateHueFromCoords(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      if (isDraggingHueRef.current) {
        updateHueFromCoords(ev.clientX);
      }
    };
    const onMouseUp = () => {
      isDraggingHueRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [updateHueFromCoords]);

  // Handle HEX typing in text box
  const handleHexChange = (val: string) => {
    let clean = val.replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length > 6) clean = clean.substring(0, 6);
    setInputHex('#' + clean.toUpperCase());
    if (clean.length === 6) {
      const hex = '#' + clean.toLowerCase();
      const newHsv = hexToHsv(hex);
      setHsv(newHsv);
      hsvRef.current = newHsv;
      onChange(hex);
    }
  };

  const handleSelectSwatch = (hex: string) => {
    setInputHex(hex.toUpperCase());
    const newHsv = hexToHsv(hex);
    setHsv(newHsv);
    hsvRef.current = newHsv;
    onChange(hex.toLowerCase());
  };

  useEffect(() => {
    if (!isOpen) return;
    const svBox = svBoxRef.current;
    const onSvDown = (e: MouseEvent) => {
      handleSvMouseDown(e as unknown as React.MouseEvent);
    };
    if (svBox) svBox.addEventListener('mousedown', onSvDown);

    const hueBar = hueBarRef.current;
    const onHueDown = (e: MouseEvent) => {
      handleHueMouseDown(e as unknown as React.MouseEvent);
    };
    if (hueBar) hueBar.addEventListener('mousedown', onHueDown);

    return () => {
      if (svBox) svBox.removeEventListener('mousedown', onSvDown);
      if (hueBar) hueBar.removeEventListener('mousedown', onHueDown);
    };
  }, [isOpen, handleSvMouseDown, handleHueMouseDown]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`accent-custom-picker-btn ${compact ? 'compact' : ''}`}
        title={compact ? `${label} (${color.toUpperCase()})` : undefined}
        style={{
          border: isOpen
            ? '1px solid rgba(56, 189, 248, 0.45)'
            : '1px solid rgba(255, 255, 255, 0.12)',
          background: isOpen ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
          gap: compact ? '2px' : '6px',
        }}
      >
        <div
          style={{
            width: compact ? '10px' : '14px',
            height: compact ? '10px' : '14px',
            borderRadius: compact ? '3px' : '4px',
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}60`,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            flexShrink: 0,
          }}
        />
        <Pipette
          size={compact ? 10 : 13}
          style={{ color: compact ? '#cbd5e1' : color, flexShrink: 0 }}
        />
        {!compact && (
          <span>
            {label} ({color.toUpperCase()})
          </span>
        )}
      </button>

      {/* Modern HSV 2D Board + Hue Bar Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: alignRight ? 'auto' : 0,
            right: alignRight ? 0 : 'auto',
            zIndex: 1500,
            width: '264px',
            backgroundColor: '#0c1017',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            padding: '12px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(56, 189, 248, 0.08)',
            backdropFilter: 'blur(20px)',
            animation: 'fadeIn 0.18s ease-out',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
              Selector de Color
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar selector de color"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(248, 250, 252, 0.5)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* 1. Saturation / Value 2D Gradient Canvas */}
          <div
            ref={svBoxRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '140px',
              borderRadius: '8px',
              cursor: 'crosshair',
              overflow: 'hidden',
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
              backgroundImage: `linear-gradient(to top, #000 0%, transparent 100%), linear-gradient(to right, #fff 0%, transparent 100%)`,
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* Draggable Circle Pointer */}
            <div
              style={{
                position: 'absolute',
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                border: '2px solid #ffffff',
                boxShadow: '0 0 4px rgba(0, 0, 0, 0.9), inset 0 0 2px rgba(0, 0, 0, 0.5)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* 2. Rainbow Hue Slider Bar */}
          <div
            ref={hueBarRef}
            style={{
              position: 'relative',
              width: '100%',
              height: '12px',
              borderRadius: '999px',
              marginTop: '10px',
              marginBottom: '12px',
              cursor: 'pointer',
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
            }}
          >
            {/* Draggable Hue Thumb */}
            <div
              style={{
                position: 'absolute',
                left: `${(hsv.h / 360) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '15px',
                height: '15px',
                borderRadius: '50%',
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                border: '2px solid #ffffff',
                boxShadow: '0 0 4px rgba(0, 0, 0, 0.8)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* 3. Color Preview & HEX Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            {/* Live Color Swatch */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}66`,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                flexShrink: 0,
              }}
            />

            {/* HEX Input Box */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                padding: '6px 10px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(248, 250, 252, 0.4)',
                  fontWeight: 600,
                }}
              >
                HEX
              </span>
              <input
                type="text"
                value={inputHex}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#00E5FF"
                aria-label="Código hexadecimal de color"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* 4. Quick Shortcut Swatches */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '5px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {PRESET_SWATCHES.map((swatch) => {
              const isSelected = color.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => handleSelectSwatch(swatch)}
                  aria-label={`Seleccionar color ${swatch}`}
                  style={{
                    height: '22px',
                    borderRadius: '4px',
                    backgroundColor: swatch,
                    border: isSelected
                      ? '2px solid #ffffff'
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isSelected ? `0 0 8px ${swatch}` : 'none',
                  }}
                >
                  {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
