import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  icon?: React.ReactNode;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  height?: number | string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  disabled = false,
  style,
  className = '',
  height = 38,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  // Group options if groups are present
  const groupedOptions = options.reduce<Record<string, SelectOption[]>>((acc, opt) => {
    const grp = opt.group ?? '__nogroup__';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(opt);
    return acc;
  }, {});

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      onKeyDown={(e) => {
        if (e.key === 'Tab' && isOpen) {
          setIsOpen(false);
        }
      }}
      style={{
        position: 'relative',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Tab' && isOpen) {
            setIsOpen(false);
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          padding: '0 12px',
          background: disabled
            ? 'rgba(255, 255, 255, 0.02)'
            : isOpen
              ? 'rgba(14, 21, 33, 0.92)'
              : 'rgba(8, 13, 20, 0.78)',
          color: disabled ? 'rgba(255, 255, 255, 0.3)' : '#f1f5f9',
          border: isOpen ? '1px solid rgba(22, 160, 133, 0.7)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'var(--font-inter)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen
            ? '0 0 0 2px rgba(22, 160, 133, 0.25), 0 4px 12px rgba(0, 0, 0, 0.45)'
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
          transition:
            'border-color 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
            e.currentTarget.style.background = 'rgba(13, 20, 31, 0.88)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.background = 'rgba(8, 13, 20, 0.78)';
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: '6px',
            fontWeight: 500,
            minWidth: 0,
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: disabled ? 'rgba(255, 255, 255, 0.2)' : isOpen ? '#38bdf8' : '#94a3b8',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Menu (Linear / Raycast Context Menu Style) */}
      {isOpen && (
        <div
          className="custom-select-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'rgba(9, 14, 23, 0.96)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            boxShadow:
              '0 16px 40px -4px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            maxHeight: '230px',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarGutter: 'stable',
            padding: '5px',
            animation: 'customSelectPop 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {Object.entries(groupedOptions).map(([groupName, groupOpts]) => (
            <div key={groupName}>
              {groupName !== '__nogroup__' && (
                <div
                  style={{
                    padding: '6px 10px 4px 10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: '#16A085',
                    fontFamily: 'var(--font-inter)',
                  }}
                >
                  {groupName}
                </div>
              )}
              {groupOpts.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                      padding: '7px 10px',
                      margin: '2px 0',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-inter)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      background: isSelected ? 'rgba(22, 160, 133, 0.16)' : 'transparent',
                      color: isSelected ? '#16A085' : '#e2e8f0',
                      fontWeight: isSelected ? 600 : 400,
                      transition:
                        'background-color 0.12s cubic-bezier(0.16, 1, 0.3, 1), color 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                        e.currentTarget.style.color = '#ffffff';
                      } else {
                        e.currentTarget.style.background = 'rgba(22, 160, 133, 0.25)';
                        e.currentTarget.style.color = '#1abc9c';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#e2e8f0';
                      } else {
                        e.currentTarget.style.background = 'rgba(22, 160, 133, 0.16)';
                        e.currentTarget.style.color = '#16A085';
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingRight: '8px',
                        minWidth: 0,
                      }}
                    >
                      {opt.icon && (
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '12px',
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && (
                      <Check size={13} strokeWidth={2.5} color="#16A085" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
