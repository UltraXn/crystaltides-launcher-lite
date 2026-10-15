import type { UserAccount, DockButtonCustomization } from '../store/launcherStore';

export interface ButtonBgOptions {
  btnCustom?: DockButtonCustomization | null;
  isLaunch: boolean;
  isRunning: boolean;
  isLaunching: boolean;
  startHoverBg: string;
  startSubtleBg: string;
  customBtnColor?: string | null;
  fallbackBg?: string;
}

const appendHexAlpha = (color: string, suffix: string): string => {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? `${color}${suffix}` : color;
};

export const resolveButtonBg = (opts: ButtonBgOptions): string => {
  const {
    btnCustom,
    isLaunch,
    isRunning,
    isLaunching,
    startHoverBg,
    startSubtleBg,
    customBtnColor,
    fallbackBg,
  } = opts;
  if (btnCustom?.bgType === 'color' && btnCustom.bgColor) return btnCustom.bgColor;
  if (btnCustom?.bgType === 'image' && btnCustom.bgImage) {
    return `url(${btnCustom.bgImage}) center / cover no-repeat`;
  }
  if (isLaunch) {
    return isRunning || isLaunching ? startHoverBg : startSubtleBg;
  }
  if (customBtnColor) {
    return appendHexAlpha(customBtnColor, '18');
  }
  return fallbackBg ?? 'transparent';
};

export const resolveDockBorder = (isEditing: boolean, borderMode?: string): string => {
  if (isEditing) return '2px dashed #38bdf8';
  if (borderMode === 'accent') return '1px solid var(--border-accent, rgba(0, 229, 255, 0.4))';
  return '1px solid rgba(255, 255, 255, 0.08)';
};

export const resolveDockBoxShadow = (isEditing: boolean, borderMode?: string): string => {
  if (isEditing) {
    return '0 0 25px rgba(56, 189, 248, 0.5), 0 25px 65px rgba(0, 0, 0, 0.9)';
  }
  if (borderMode === 'accent') {
    return '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 25px var(--accent-glow, rgba(0, 229, 255, 0.25))';
  }
  return '0 25px 65px rgba(0, 0, 0, 0.9), inset 0 1px 1px rgba(255, 255, 255, 0.1)';
};

export const resolveDockCursor = (isEditing: boolean, isDraggingDock: boolean): string => {
  if (!isEditing) return 'default';
  return isDraggingDock ? 'grabbing' : 'grab';
};

export const resolveStatusClass = (isRunning: boolean, isLaunching: boolean): string => {
  if (isRunning) return 'running';
  if (isLaunching) return 'launching';
  return '';
};

export const resolveButtonCursor = (isEditingHud: boolean, isDraggingThis: boolean): string => {
  if (!isEditingHud) return 'pointer';
  return isDraggingThis ? 'grabbing' : 'grab';
};

export const resolveButtonZIndex = (isDraggingThis: boolean, isEditingHud: boolean): number => {
  if (isDraggingThis) return 960;
  if (isEditingHud) return 940;
  return 25;
};

export const resolveAccountAvatarSrc = (account?: UserAccount | null): string | null => {
  if (account?.skinUrl) return account.skinUrl;
  if (account?.uuid && account.uuid !== '00000000-0000-0000-0000-000000000000') {
    return `https://mc-heads.net/avatar/${account.uuid}/48`;
  }
  return null;
};

export const resolveButtonColor = (
  btnCustom: DockButtonCustomization | null | undefined,
  isLaunch: boolean,
  startColor: string,
  customBtnColor?: string | null,
): string => {
  if (btnCustom?.contentColor) return btnCustom.contentColor;
  if (isLaunch) return startColor;
  return customBtnColor ?? '#cbd5e1';
};

export const resolveButtonBorder = (
  btnCustom: DockButtonCustomization | null | undefined,
  customBtnColor?: string | null,
  borderMode?: string,
): string => {
  if (btnCustom?.bgType === 'color' && btnCustom.bgColor) {
    return `1px solid ${appendHexAlpha(btnCustom.bgColor, '80')}`;
  }
  if (btnCustom?.bgType === 'image' && btnCustom.bgImage) {
    return '1px solid rgba(255, 255, 255, 0.16)';
  }
  if (customBtnColor) {
    return `1px solid ${appendHexAlpha(customBtnColor, '80')}`;
  }
  if (borderMode === 'accent') {
    return '1px solid var(--border-accent, rgba(0, 229, 255, 0.4))';
  }
  return '1px solid rgba(255, 255, 255, 0.1)';
};

export const getEffectClassName = (effect?: string): string => {
  if (effect === 'rainbow_rgb') return 'btn-fx-rainbow-rgb';
  if (effect === 'neon_pulse') return 'btn-fx-neon-pulse';
  if (effect === 'glitch') return 'btn-fx-glitch';
  if (effect === 'hologram') return 'btn-fx-hologram';
  if (effect === 'fire') return 'btn-fx-fire';
  return '';
};

export const resolveFreeButtonBorder = (
  isEditingHud: boolean,
  isDraggingThis: boolean,
  isColliding: boolean,
  btnCustom: DockButtonCustomization | null | undefined,
  customBtnColor: string | null | undefined,
  dockBorderColorMode?: string,
  accentColor?: string,
): string => {
  if (isEditingHud) {
    const editColor = accentColor || '#38bdf8';
    return isDraggingThis && isColliding ? '2px dashed #ef4444' : `2px dashed ${editColor}`;
  }
  return resolveButtonBorder(btnCustom, customBtnColor, dockBorderColorMode);
};

export const resolveFreeButtonShadow = (
  isEditingHud: boolean,
  isDraggingThis: boolean,
  isColliding: boolean,
  customBtnColor: string | null | undefined,
  accentColor?: string,
): string => {
  if (isEditingHud) {
    return isDraggingThis && isColliding
      ? '0 0 20px rgba(239, 68, 68, 0.65)'
      : accentColor
        ? `0 0 16px ${accentColor}66`
        : '0 0 16px rgba(56, 189, 248, 0.4)';
  }
  if (customBtnColor) {
    return `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px ${customBtnColor}33`;
  }
  return '0 20px 50px rgba(0, 0, 0, 0.8)';
};
