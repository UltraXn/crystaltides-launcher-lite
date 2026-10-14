import React from 'react';

interface FlagProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const SpainFlag: React.FC<FlagProps> = ({ size = 16, className, style }) => (
  <svg
    width={size}
    height={Math.round((size * 2) / 3)}
    viewBox="0 0 24 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      borderRadius: '2px',
      display: 'inline-block',
      verticalAlign: 'middle',
      flexShrink: 0,
      ...style,
    }}
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="16" fill="#AA151B" />
    <rect y="4" width="24" height="8" fill="#F1BF00" />
  </svg>
);

export const UsaFlag: React.FC<FlagProps> = ({ size = 16, className, style }) => (
  <svg
    width={size}
    height={Math.round((size * 2) / 3)}
    viewBox="0 0 24 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      borderRadius: '2px',
      display: 'inline-block',
      verticalAlign: 'middle',
      flexShrink: 0,
      ...style,
    }}
    className={className}
    aria-hidden="true"
  >
    <rect width="24" height="16" fill="#B22234" />
    <rect y="2.46" width="24" height="1.23" fill="#FFFFFF" />
    <rect y="4.92" width="24" height="1.23" fill="#FFFFFF" />
    <rect y="7.38" width="24" height="1.23" fill="#FFFFFF" />
    <rect y="9.84" width="24" height="1.23" fill="#FFFFFF" />
    <rect y="12.3" width="24" height="1.23" fill="#FFFFFF" />
    <rect y="14.76" width="24" height="1.24" fill="#FFFFFF" />
    <rect width="10" height="8.6" fill="#3C3B6E" />
    <circle cx="2" cy="1.8" r="0.65" fill="#FFFFFF" />
    <circle cx="4.5" cy="1.8" r="0.65" fill="#FFFFFF" />
    <circle cx="7" cy="1.8" r="0.65" fill="#FFFFFF" />
    <circle cx="3.25" cy="3.6" r="0.65" fill="#FFFFFF" />
    <circle cx="5.75" cy="3.6" r="0.65" fill="#FFFFFF" />
    <circle cx="8.25" cy="3.6" r="0.65" fill="#FFFFFF" />
    <circle cx="2" cy="5.4" r="0.65" fill="#FFFFFF" />
    <circle cx="4.5" cy="5.4" r="0.65" fill="#FFFFFF" />
    <circle cx="7" cy="5.4" r="0.65" fill="#FFFFFF" />
    <circle cx="3.25" cy="7.2" r="0.65" fill="#FFFFFF" />
    <circle cx="5.75" cy="7.2" r="0.65" fill="#FFFFFF" />
    <circle cx="8.25" cy="7.2" r="0.65" fill="#FFFFFF" />
  </svg>
);
