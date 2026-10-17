import React from 'react';

interface FlagIconProps {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Bandera vectorial de España (ES).
 * Franjas proporcionales roja-amarilla-roja con escudo heráldico estilizado.
 */
export const SpainFlag: React.FC<FlagIconProps> = ({
  size,
  width = size ?? 18,
  height = size ? Math.round((size * 2) / 3) : 12,
  className,
  style,
}) => (
  <svg
    viewBox="0 0 20 14"
    width={width}
    height={height}
    style={{
      borderRadius: '2.5px',
      overflow: 'hidden',
      flexShrink: 0,
      border: '1px solid rgba(255, 255, 255, 0.16)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
      display: 'inline-block',
      verticalAlign: 'middle',
      ...style,
    }}
    className={className}
    aria-hidden="true"
  >
    {/* Franjas rojas */}
    <rect width="20" height="14" fill="#AA151B" />
    {/* Franja central amarilla */}
    <rect y="3.5" width="20" height="7" fill="#F1BF00" />
    {/* Escudo español estilizado */}
    <circle cx="5.5" cy="5" r="0.8" fill="#AA151B" opacity="0.9" />
    <path
      d="M4.5 6 H6.5 V8.5 C6.5 9.2 5.5 9.6 5.5 9.6 C5.5 9.6 4.5 9.2 4.5 8.5 Z"
      fill="#AA151B"
    />
    <path
      d="M5 6.8 H6 V8 C6 8.3 5.5 8.6 5.5 8.6 C5.5 8.6 5 8.3 5 8 Z"
      fill="#F1BF00"
    />
  </svg>
);

/**
 * Bandera vectorial de Estados Unidos (USA) para inglés (EN).
 */
export const UsaFlag: React.FC<FlagIconProps> = ({
  size,
  width = size ?? 18,
  height = size ? Math.round((size * 2) / 3) : 12,
  className,
  style,
}) => (
  <svg
    viewBox="0 0 20 14"
    width={width}
    height={height}
    style={{
      borderRadius: '2.5px',
      overflow: 'hidden',
      flexShrink: 0,
      border: '1px solid rgba(255, 255, 255, 0.16)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
      display: 'inline-block',
      verticalAlign: 'middle',
      ...style,
    }}
    className={className}
    aria-hidden="true"
  >
    {/* Franjas rojas y blancas (13 franjas) */}
    <rect width="20" height="14" fill="#B22234" />
    <rect y="1.08" width="20" height="1.08" fill="#FFFFFF" />
    <rect y="3.24" width="20" height="1.08" fill="#FFFFFF" />
    <rect y="5.40" width="20" height="1.08" fill="#FFFFFF" />
    <rect y="7.56" width="20" height="1.08" fill="#FFFFFF" />
    <rect y="9.72" width="20" height="1.08" fill="#FFFFFF" />
    <rect y="11.88" width="20" height="1.08" fill="#FFFFFF" />
    {/* Cantón azul marino */}
    <rect width="8" height="7.56" fill="#3C3B6E" />
    {/* Estrellas estilizadas */}
    <circle cx="1.6" cy="1.5" r="0.45" fill="#FFFFFF" />
    <circle cx="3.6" cy="1.5" r="0.45" fill="#FFFFFF" />
    <circle cx="5.6" cy="1.5" r="0.45" fill="#FFFFFF" />
    <circle cx="2.6" cy="3.0" r="0.45" fill="#FFFFFF" />
    <circle cx="4.6" cy="3.0" r="0.45" fill="#FFFFFF" />
    <circle cx="6.6" cy="3.0" r="0.45" fill="#FFFFFF" />
    <circle cx="1.6" cy="4.5" r="0.45" fill="#FFFFFF" />
    <circle cx="3.6" cy="4.5" r="0.45" fill="#FFFFFF" />
    <circle cx="5.6" cy="4.5" r="0.45" fill="#FFFFFF" />
    <circle cx="2.6" cy="6.0" r="0.45" fill="#FFFFFF" />
    <circle cx="4.6" cy="6.0" r="0.45" fill="#FFFFFF" />
    <circle cx="6.6" cy="6.0" r="0.45" fill="#FFFFFF" />
  </svg>
);

/**
 * Bandera vectorial de Reino Unido (Union Jack) para inglés (EN).
 */
export const UkFlag: React.FC<FlagIconProps> = ({
  size,
  width = size ?? 18,
  height = size ? Math.round((size * 2) / 3) : 12,
  className,
  style,
}) => (
  <svg
    viewBox="0 0 20 14"
    width={width}
    height={height}
    style={{
      borderRadius: '2.5px',
      overflow: 'hidden',
      flexShrink: 0,
      border: '1px solid rgba(255, 255, 255, 0.16)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
      display: 'inline-block',
      verticalAlign: 'middle',
      ...style,
    }}
    className={className}
    aria-hidden="true"
  >
    {/* Base azul marina */}
    <rect width="20" height="14" fill="#012169" />
    {/* Aspas blancas (San Andrés / San Patricio) */}
    <path d="M0 0 L20 14 M20 0 L0 14" stroke="#ffffff" strokeWidth="3" />
    {/* Aspas rojas */}
    <path d="M0 0 L20 14 M20 0 L0 14" stroke="#C8102E" strokeWidth="1.6" />
    {/* Cruz blanca de San Jorge */}
    <path d="M10 0 V14 M0 7 H20" stroke="#ffffff" strokeWidth="5" />
    {/* Cruz roja de San Jorge */}
    <path d="M10 0 V14 M0 7 H20" stroke="#C8102E" strokeWidth="3" />
  </svg>
);
