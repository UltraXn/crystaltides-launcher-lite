import React from 'react';

export type LoaderBrand = 'neoforge' | 'fabric' | 'forge' | 'quilt' | 'vanilla';

interface LoaderIconProps {
  type: LoaderBrand | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const NeoForgeLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 18,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    aria-label="NeoForge Logo"
  >
    <defs>
      <linearGradient
        id="nf-flame-grad"
        x1="4"
        y1="20"
        x2="20"
        y2="4"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#ea580c" />
        <stop offset="50%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#fbbf24" />
      </linearGradient>
    </defs>
    {/* Stylized NeoForge geometric flame */}
    <path
      d="M12 2C9.5 6 6 8.5 6 13C6 17.5 9 21 12 22C15 21 18 17.5 18 13C18 10 16 7 15 5.5C14.5 7.5 13.5 9 12 10C12.5 8 13.5 5 12 2Z"
      fill="url(#nf-flame-grad)"
    />
    <path
      d="M12 13C10.8 13 10 14.2 10 15.8C10 17.8 11.2 19.5 12 20C12.8 19.5 14 17.8 14 15.8C14 14.5 13.2 13.5 12.5 13.1C12.3 13.6 12 14.2 11.5 14.5C11.6 14 12 13.5 12 13Z"
      fill="#fef08a"
    />
  </svg>
);

export const FabricLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 18,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    aria-label="Fabric Logo"
  >
    <defs>
      <linearGradient
        id="fabric-grad-1"
        x1="5"
        y1="4"
        x2="19"
        y2="20"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
      <linearGradient
        id="fabric-grad-2"
        x1="12"
        y1="2"
        x2="12"
        y2="22"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="100%" stopColor="#38bdf8" />
      </linearGradient>
    </defs>
    {/* Fabric iconic layered loom origami ribbon */}
    <path
      d="M12 3L4 7.5V16.5L12 21L20 16.5V7.5L12 3Z"
      stroke="url(#fabric-grad-1)"
      strokeWidth="2"
      strokeLinejoin="round"
      fill="rgba(56, 189, 248, 0.12)"
    />
    <path d="M12 7.5L7 10.5V14.5L12 17.5L17 14.5V10.5L12 7.5Z" fill="url(#fabric-grad-2)" />
    <path
      d="M12 3V21M4 7.5L20 16.5M20 7.5L4 16.5"
      stroke="#38bdf8"
      strokeWidth="1.2"
      strokeOpacity="0.4"
    />
  </svg>
);

export const ForgeLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 18,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    aria-label="Forge Logo"
  >
    <defs>
      <linearGradient id="forge-metal" x1="4" y1="8" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#d97706" />
        <stop offset="50%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="forge-fire" x1="12" y1="3" x2="12" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    {/* Forge Anvil body */}
    <path
      d="M3 8C3 7.4 3.4 7 4 7H20C20.6 7 21 7.4 21 8V10C21 10.6 20.6 11 20 11H18L17 14H19V16H18L19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19L6 16H5V14H7L6 11H4C3.4 11 3 10.6 3 10V8Z"
      fill="url(#forge-metal)"
    />
    {/* Inner Anvil horn and highlight */}
    <path d="M4 8.5H20V9.5H4V8.5Z" fill="#fef3c7" opacity="0.6" />
    {/* Fire spark above anvil */}
    <path
      d="M12 2C11 4 9.5 5 9.5 6.5C9.5 8 10.5 9 12 9C13.5 9 14.5 8 14.5 6.5C14.5 5 13 4 12 2Z"
      fill="url(#forge-fire)"
    />
  </svg>
);

export const QuiltLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 18,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    aria-label="Quilt Logo"
  >
    <defs>
      <linearGradient id="quilt-g1" x1="12" y1="3" x2="12" y2="11" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#e879f9" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
      <linearGradient id="quilt-g2" x1="13" y1="12" x2="21" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <linearGradient id="quilt-g3" x1="12" y1="13" x2="12" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#7e22ce" />
      </linearGradient>
      <linearGradient id="quilt-g4" x1="3" y1="12" x2="11" y2="12" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f472b6" />
        <stop offset="100%" stopColor="#c084fc" />
      </linearGradient>
    </defs>
    {/* Quilt official four-patch geometric floral cross */}
    {/* Top petal/diamond */}
    <path d="M12 3L15.5 7L12 11L8.5 7L12 3Z" fill="url(#quilt-g1)" />
    {/* Right petal/diamond */}
    <path d="M21 12L17 15.5L13 12L17 8.5L21 12Z" fill="url(#quilt-g2)" />
    {/* Bottom petal/diamond */}
    <path d="M12 21L8.5 17L12 13L15.5 17L12 21Z" fill="url(#quilt-g3)" />
    {/* Left petal/diamond */}
    <path d="M3 12L7 8.5L11 12L7 15.5L3 12Z" fill="url(#quilt-g4)" />
    {/* Center stitch dot */}
    <circle cx="12" cy="12" r="1.8" fill="#ffffff" />
  </svg>
);

export const VanillaLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 18,
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, ...style }}
    aria-label="Minecraft Vanilla Logo"
  >
    <defs>
      <linearGradient id="mc-grass" x1="12" y1="3" x2="12" y2="10" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#22c55e" />
      </linearGradient>
      <linearGradient id="mc-dirt" x1="12" y1="10" x2="12" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#854d0e" />
        <stop offset="100%" stopColor="#543007" />
      </linearGradient>
    </defs>
    {/* Isometric Minecraft cube - Top face (Grass) */}
    <path d="M12 3L20 7.5L12 12L4 7.5L12 3Z" fill="#4ade80" />
    <path d="M12 4L18.5 7.5L12 11L5.5 7.5L12 4Z" fill="url(#mc-grass)" />
    {/* Left face (Dirt with grass trim) */}
    <path d="M4 7.5L12 12V21L4 16.5V7.5Z" fill="url(#mc-dirt)" />
    <path d="M4 7.5L12 12V14L10 13V14.5L8 13.5V14.5L6 13.5V15L4 14V7.5Z" fill="#22c55e" />
    {/* Right face (Dirt with shadow & grass trim) */}
    <path d="M12 12L20 7.5V16.5L12 21V12Z" fill="#543007" />
    <path d="M12 12L20 7.5V14L18 14.5V13.5L16 14.5V13.5L14 14V13L12 14V12Z" fill="#16a34a" />
  </svg>
);

export const LoaderIconBadge: React.FC<LoaderIconProps> = ({
  type,
  size = 18,
  className = '',
  style,
}) => {
  const norm = (type || '').toLowerCase().trim();
  const [imgError, setImgError] = React.useState(false);

  let bg = 'rgba(255, 255, 255, 0.08)';
  let borderColor = 'rgba(255, 255, 255, 0.12)';
  let iconSrc = '/icons/vanilla.png';
  let altText = 'Vanilla';
  let fallbackSvg = <VanillaLogo size={size - 4} />;

  if (norm.includes('neoforge')) {
    bg = 'rgba(234, 88, 12, 0.16)';
    borderColor = 'rgba(249, 115, 22, 0.35)';
    iconSrc = '/icons/neoforge.png';
    altText = 'NeoForge';
    fallbackSvg = <NeoForgeLogo size={size - 4} />;
  } else if (norm.includes('fabric')) {
    bg = 'rgba(2, 132, 199, 0.16)';
    borderColor = 'rgba(56, 189, 248, 0.35)';
    iconSrc = '/icons/fabric.png';
    altText = 'Fabric';
    fallbackSvg = <FabricLogo size={size - 4} />;
  } else if (norm.includes('quilt')) {
    bg = 'rgba(168, 85, 247, 0.16)';
    borderColor = 'rgba(192, 132, 252, 0.35)';
    iconSrc = '/icons/quilt.png';
    altText = 'Quilt';
    fallbackSvg = <QuiltLogo size={size - 4} />;
  } else if (norm.includes('forge')) {
    bg = 'rgba(217, 119, 6, 0.16)';
    borderColor = 'rgba(234, 179, 8, 0.35)';
    iconSrc = '/icons/forge.png';
    altText = 'Forge';
    fallbackSvg = <ForgeLogo size={size - 4} />;
  } else {
    bg = 'rgba(34, 197, 94, 0.16)';
    borderColor = 'rgba(74, 222, 128, 0.35)';
    iconSrc = '/icons/vanilla.png';
    altText = 'Vanilla';
    fallbackSvg = <VanillaLogo size={size - 4} />;
  }

  const innerSize = Math.max(12, size - 4);

  return (
    <span
      className={`loader-icon-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '5px',
        background: bg,
        border: `1px solid ${borderColor}`,
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {!imgError ? (
        <img
          src={iconSrc}
          alt={altText}
          width={innerSize}
          height={innerSize}
          style={{
            width: innerSize,
            height: innerSize,
            objectFit: 'contain',
            display: 'block',
          }}
          onError={() => setImgError(true)}
        />
      ) : (
        fallbackSvg
      )}
    </span>
  );
};

export const getLoaderImageSrc = (type: string): { src: string; alt: string } => {
  const norm = (type || '').toLowerCase().trim();
  if (norm.includes('neoforge')) return { src: '/icons/neoforge.png', alt: 'NeoForge' };
  if (norm.includes('fabric')) return { src: '/icons/fabric.png', alt: 'Fabric' };
  if (norm.includes('quilt')) return { src: '/icons/quilt.png', alt: 'Quilt' };
  if (norm.includes('forge')) return { src: '/icons/forge.png', alt: 'Forge' };
  return { src: '/icons/vanilla.png', alt: 'Minecraft' };
};

export interface LoaderLogoProps {
  type: LoaderBrand | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const LoaderLogo: React.FC<LoaderLogoProps> = ({
  type,
  size = 24,
  style,
  className = '',
}) => {
  const norm = (type || '').toLowerCase().trim();
  const [hasError, setHasError] = React.useState(false);
  const { src, alt } = getLoaderImageSrc(type);

  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    if (norm.includes('neoforge')) return <NeoForgeLogo size={size} style={style} />;
    if (norm.includes('fabric')) return <FabricLogo size={size} style={style} />;
    if (norm.includes('quilt')) return <QuiltLogo size={size} style={style} />;
    if (norm.includes('forge')) return <ForgeLogo size={size} style={style} />;
    return <VanillaLogo size={size} style={style} />;
  }

  return (
    <img
      src={src}
      alt={`${alt} Logo`}
      aria-label={`${alt} Logo`}
      width={size}
      height={size}
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      onError={() => setHasError(true)}
    />
  );
};

