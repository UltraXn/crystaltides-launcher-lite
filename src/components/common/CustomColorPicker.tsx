import React, { useState, useRef, useEffect } from 'react';
import { Pipette, Check, X } from 'lucide-react';

interface CustomColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
  label?: string;
}

const PRESET_SWATCHES = [
  '#00e5ff', '#38bdf8', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981',
];

export const CustomColorPicker: React.FC<CustomColorPickerProps> = ({
  color,
  onChange,
  label = 'Personalizado',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputHex, setInputHex] = useState(color.toUpperCase());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputHex(color.toUpperCase());
  }, [color]);

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

  const handleHexChange = (val: string) => {
    let clean = val.replace(/[^0-9A-Fa-f]/g, '');
    if (clean.length > 6) clean = clean.substring(0, 6);
    setInputHex('#' + clean.toUpperCase());
    if (clean.length === 6) {
      onChange('#' + clean.toLowerCase());
    }
  };

  const handleSelectSwatch = (hex: string) => {
    setInputHex(hex.toUpperCase());
    onChange(hex.toLowerCase());
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="accent-custom-picker-btn"
        style={{
          border: isOpen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.14)',
          background: isOpen ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '4px',
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}80`,
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        />
        <Pipette size={13} style={{ color }} />
        <span>{label} ({color.toUpperCase()})</span>
      </button>

      {/* Fully Custom In-App Dark Popover (Zero OS dialogs) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1500,
            width: '240px',
            backgroundColor: '#0f141c',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(56, 189, 248, 0.15)',
            backdropFilter: 'blur(20px)',
            animation: 'fadeIn 0.18s ease-out',
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
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(248, 250, 252, 0.5)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Quick Swatch Matrix */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              marginBottom: '12px',
            }}
          >
            {PRESET_SWATCHES.map((swatch) => {
              const isSelected = color.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => handleSelectSwatch(swatch)}
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: swatch,
                    border: isSelected
                      ? '2px solid #ffffff'
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.12s ease',
                    boxShadow: isSelected ? `0 0 10px ${swatch}` : 'none',
                  }}
                >
                  {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                </button>
              );
            })}
          </div>

          {/* HEX Input Field */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              padding: '6px 10px',
            }}
          >
            <span style={{ fontSize: '11px', color: 'rgba(248, 250, 252, 0.4)', fontWeight: 600 }}>
              HEX
            </span>
            <input
              type="text"
              value={inputHex}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#00E5FF"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            />
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: color,
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
