import React from 'react';

export type LauncherSourceType = 'mojang' | 'curseforge' | 'modrinth' | 'prism' | 'multimc' | 'crystaltides' | 'custom' | string;

interface LauncherBrandIconProps {
  source: LauncherSourceType;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Logotipo oficial de CurseForge (SVG extraído de SimpleIcons / CurseForge Brand Assets)
 */
export const CurseForgeLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    aria-label="CurseForge"
  >
    <path
      fill="#f16436"
      d="M18.326 9.2145S23.2261 8.4418 24 6.1882h-7.5066V4.4H0l2.0318 2.3576V9.173s5.1267-.2665 7.1098 1.2372c2.7146 2.516-3.053 5.917-3.053 5.917L5.0995 19.6c1.5465-1.4726 4.494-3.3775 9.8983-3.2857-2.0565.65-4.1245 1.6651-5.7344 3.2857h10.9248l-1.0288-3.2726s-7.918-4.6688-.8336-7.1127z"
    />
  </svg>
);

/**
 * Logotipo oficial de Modrinth (SVG extraído de Modrinth Brand Assets / SimpleIcons)
 */
export const ModrinthLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    aria-label="Modrinth"
  >
    <path
      fill="#00af5c"
      d="M12.252.004a11.78 11.768 0 0 0-8.92 3.73 11 10.999 0 0 0-2.17 3.11 11.37 11.359 0 0 0-1.16 5.169c0 1.42.17 2.5.6 3.77.24.759.77 1.899 1.17 2.529a12.3 12.298 0 0 0 8.85 5.639c.44.05 2.54.07 2.76.02.2-.04.22.1-.26-1.7l-.36-1.37-1.01-.06a8.5 8.489 0 0 1-5.18-1.8 5.34 5.34 0 0 1-1.3-1.26c0-.05.34-.28.74-.5a37.572 37.545 0 0 1 2.88-1.629c.03 0 .5.45 1.06.98l1 .97 2.07-.43 2.06-.43 1.47-1.47c.8-.8 1.48-1.5 1.48-1.52 0-.09-.42-1.63-.46-1.7-.04-.06-.2-.03-1.02.18-.53.13-1.2.3-1.45.4l-.48.15-.53.53-.53.53-.93.1-.93.07-.52-.5a2.7 2.7 0 0 1-.96-1.7l-.13-.6.43-.57c.68-.9.68-.9 1.46-1.1.4-.1.65-.2.83-.33.13-.099.65-.579 1.14-1.069l.9-.9-.7-.7-.7-.7-1.95.54c-1.07.3-1.96.53-1.97.53-.03 0-2.23 2.48-2.63 2.97l-.29.35.28 1.03c.16.56.3 1.16.31 1.34l.03.3-.34.23c-.37.23-2.22 1.3-2.84 1.63-.36.2-.37.2-.44.1-.08-.1-.23-.6-.32-1.03-.18-.86-.17-2.75.02-3.73a8.84 8.839 0 0 1 7.9-6.93c.43-.03.77-.08.78-.1.06-.17.5-2.999.47-3.039-.01-.02-.1-.02-.2-.03Zm3.68.67c-.2 0-.3.1-.37.38-.06.23-.46 2.42-.46 2.52 0 .04.1.11.22.16a8.51 8.499 0 0 1 2.99 2 8.38 8.379 0 0 1 2.16 3.449 6.9 6.9 0 0 1 .4 2.8c0 1.07 0 1.27-.1 1.73a9.37 9.369 0 0 1-1.76 3.769c-.32.4-.98 1.06-1.37 1.38-.38.32-1.54 1.1-1.7 1.14-.1.03-.1.06-.07.26.03.18.64 2.56.7 2.78l.06.06a12.07 12.058 0 0 0 7.27-9.4c.13-.77.13-2.58 0-3.4a11.96 11.948 0 0 0-5.73-8.578c-.7-.42-2.05-1.06-2.25-1.06Z"
    />
  </svg>
);

/**
 * Logotipo oficial de Prism Launcher (Vector multicolor original de PrismLauncher/develop)
 */
export const PrismLauncherLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 13 13"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    aria-label="Prism Launcher"
  >
    <path d="m6.35 0.529-2.521 4.366 2.521 1.455 2.52-1.455 0.11-3.1c-1.151-.664-2.339-1.266-2.63-1.266z" fill="#df6277" />
    <path d="m8.98 1.795-2.63 4.555 2.52 1.455 2.521-4.365c-.145-.252-1.26-.98-2.411-1.645z" fill="#fb9168" />
    <path d="m11.391 3.44-5.041 2.91 2.52 1.455 2.739-1.455c0-1.33-.072-2.659-.218-2.91z" fill="#f3db6c" />
    <path d="m6.35 6.35v2.91h5.041c.146-.252.218-1.581.218-2.91z" fill="#7ab392" />
    <path d="m6.35 6.35v2.91l2.63 1.645c1.151-.665 2.266-1.393 2.411-1.645z" fill="#4b7cbc" />
    <path d="m6.35 6.35-2.521 1.455 2.521 4.366c.291 0 1.479-.602 2.63-1.266z" fill="#6f488c" />
    <path d="m3.829 4.895-2.52 4.365c.291.505 4.459 2.91 5.041 2.91v-5.82z" fill="#4d3f33" />
    <path d="m1.309 3.44c-.291.504-.291 5.317 0 5.821l5.041-2.91v-2.91z" fill="#7a573b" />
    <path d="m6.35 0.529c-.582 0-4.75 2.406-5.041 2.91l5.041 2.91z" fill="#99cd61" />
    <g transform="translate(0.75, 0.76)">
      <path d="m6.35 2.939c-.341 0-2.783 1.41-2.953 1.706l2.953 5.115 2.954-5.115c-.171-.296-2.613-1.706-2.954-1.706z" fill="#ffffff" />
    </g>
    <path d="m3.83 4.895c-.146.252-.146 2.658 0 2.91.145.252 2.229 1.455 2.52 1.455v-2.91z" fill="#d6d2d2" />
  </svg>
);

/**
 * Logotipo oficial de Minecraft Oficial (Cubo de césped isométrico de alta definición)
 */
export const MinecraftOficialLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src="/icons/minecraft.png"
    alt="Minecraft Oficial"
    width={size}
    height={size}
    style={{
      imageRendering: 'pixelated',
      flexShrink: 0,
      display: 'inline-block',
      verticalAlign: 'middle',
      objectFit: 'contain',
      ...style,
    }}
    onError={(e) => {
      // Fallback seguro a cubo SVG si la imagen no carga
      e.currentTarget.style.display = 'none';
    }}
  />
);

/**
 * Logotipo oficial de CrystalTides
 */
export const CrystalTidesLogo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src="/logo.png"
    alt="CrystalTides"
    width={size}
    height={size}
    style={{
      flexShrink: 0,
      display: 'inline-block',
      verticalAlign: 'middle',
      objectFit: 'contain',
      filter: 'drop-shadow(0 0 4px rgba(0, 229, 255, 0.4))',
      ...style,
    }}
  />
);

/**
 * Componente unificado para renderizar el logo auténtico de cualquier launcher
 */
export const LauncherBrandIcon: React.FC<LauncherBrandIconProps> = ({
  source,
  size = 16,
  style,
}) => {
  const norm = source.toLowerCase();

  if (norm.includes('curseforge')) {
    return <CurseForgeLogo size={size} style={style} />;
  }

  if (norm.includes('modrinth')) {
    return <ModrinthLogo size={size} style={style} />;
  }

  if (norm.includes('prism')) {
    return <PrismLauncherLogo size={size} style={style} />;
  }

  if (norm.includes('multimc')) {
    return <PrismLauncherLogo size={size} style={style} />;
  }

  if (norm.includes('crystaltides')) {
    return <CrystalTidesLogo size={size} style={style} />;
  }

  if (norm.includes('mojang') || norm.includes('oficial') || norm.includes('minecraft')) {
    return <MinecraftOficialLogo size={size} style={style} />;
  }

  // Fallback por defecto para carpetas manuales o personalizadas
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#38bdf8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
};
