import { isVideoSource } from './wallpaperStorage';

export const isNearOpacity = (current: number, target: number): boolean =>
  Math.abs(current - target) < 0.01;

export const getLoaderStatusColor = (status: { success?: boolean; loading?: boolean }): string => {
  if (status.success) return '#22c55e';
  if (status.loading) return '#38bdf8';
  return '#f43f5e';
};

export const getCustomWallpaperLabel = (url: string, isVideo: boolean): string => {
  if (isVideo || isVideoSource(url)) return 'Vídeo de fondo en uso';
  if (url.toLowerCase().includes('.gif') || url.startsWith('data:image/gif')) {
    return 'GIF animado en uso';
  }
  return 'Fondo personalizado en uso';
};

export const resolveActiveBtnColor = (
  btnId: string,
  customColors?: Record<string, string> | Partial<Record<string, string>>,
  startBtnColorMode?: string,
  customStartBtnColor?: string,
  fallbackAccent?: string,
): string => {
  if (customColors?.[btnId]) return customColors[btnId];
  if (btnId === 'launch') {
    if (startBtnColorMode === 'custom' && customStartBtnColor) {
      return customStartBtnColor;
    }
    if (startBtnColorMode === 'accent' && fallbackAccent) return fallbackAccent;
    return '#22c55e';
  }
  return fallbackAccent ?? '#00e5ff';
};

export const extractCleanMinecraftVersion = (raw: string): string => {
  if (!raw) return '1.21.1';
  let clean = raw.trim();
  // Strip trailing parenthesized tags (e.g. "(quilt)", "(Vanilla)", "(official)")
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '').trim();

  if (clean.startsWith('quilt-loader-') || clean.startsWith('fabric-loader-')) {
    const parts = clean.split('-');
    return parts[parts.length - 1];
  }
  if (clean.includes('-forge-')) {
    return clean.split('-forge-')[0];
  }
  if (clean.startsWith('neoforge-')) {
    const ver = clean.replace('neoforge-', '');
    const parts = ver.split('.');
    if (parts.length >= 2) {
      const major = parts[0];
      const minor = parts[1];
      if (major === '20' || major === '21') {
        return minor !== '0' ? `1.${major}.${minor}` : `1.${major}`;
      }
      if (major === '47') return '1.20.1';
      return `1.${major}`;
    }
  }
  return clean;
};
