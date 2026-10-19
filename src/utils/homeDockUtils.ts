import type { UserAccount, DockButtonCustomization, LauncherState } from '../store/launcherStore';

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
  return /^#?[0-9a-f]{6}$/i.test(color) ? `${color}${suffix}` : color;
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

export const resolveButtonZIndex = (
  isDraggingThis: boolean,
  isEditingHud: boolean,
  isSelected = false,
  isResizing = false,
): number => {
  if (isDraggingThis || isResizing) return 990;
  if (isSelected) return 980;
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
  _isDraggingThis: boolean,
  isColliding: boolean,
  btnCustom: DockButtonCustomization | null | undefined,
  customBtnColor: string | null | undefined,
  dockBorderColorMode?: string,
  accentColor?: string,
): string => {
  if (isEditingHud) {
    const editColor = accentColor ?? '#38bdf8';
    return isColliding ? '2px dashed #ef4444' : `2px dashed ${editColor}`;
  }
  return resolveButtonBorder(btnCustom, customBtnColor, dockBorderColorMode);
};

export const resolveFreeButtonShadow = (
  isEditingHud: boolean,
  _isDraggingThis: boolean,
  isColliding: boolean,
  customBtnColor: string | null | undefined,
  accentColor?: string,
): string => {
  if (isEditingHud) {
    if (isColliding) {
      return '0 0 20px rgba(239, 68, 68, 0.65)';
    }
    if (accentColor) {
      return `0 0 16px ${accentColor}66`;
    }
    return '0 0 16px rgba(56, 189, 248, 0.4)';
  }
  if (customBtnColor) {
    return `0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px ${customBtnColor}33`;
  }
  return '0 20px 50px rgba(0, 0, 0, 0.8)';
};

export interface SegmentLimits {
  minSegmentW: number;
  maxSegmentW: number;
  minDockH: number;
  maxDockH: number;
}

export const getSegmentLimits = (showLabels: boolean, isCompact: boolean): SegmentLimits => {
  if (!showLabels) {
    return { minSegmentW: 46, maxSegmentW: 80, minDockH: 46, maxDockH: 80 };
  }
  if (isCompact) {
    return { minSegmentW: 70, maxSegmentW: 130, minDockH: 60, maxDockH: 96 };
  }
  return { minSegmentW: 80, maxSegmentW: 180, minDockH: 70, maxDockH: 130 };
};

export const getButtonBaseIconSize = (iconSize: number, btnId: string): number => {
  if (btnId === 'launch') return iconSize + 2;
  if (btnId === 'accounts') return iconSize + 4;
  return iconSize;
};

export interface AvailableDimensionsParams {
  isDockMode: boolean;
  effectiveSegmentHeightPx: number;
  effectiveSegmentWidthPx: number;
  btnId: string;
  isResizingThis: boolean;
  liveResizeDims?: { width: number; height: number } | null;
  btnCustom?: DockButtonCustomization;
  isCompact: boolean;
}

export const getAvailableButtonDimensions = (
  params: AvailableDimensionsParams,
): { availableW: number; availableH: number } => {
  const {
    isDockMode,
    effectiveSegmentHeightPx,
    effectiveSegmentWidthPx,
    btnId,
    isResizingThis,
    liveResizeDims,
    btnCustom,
    isCompact,
  } = params;

  if (isDockMode) {
    const width =
      btnId === 'launch' ? Math.round(effectiveSegmentWidthPx * 1.15) : effectiveSegmentWidthPx;
    return { availableW: width, availableH: effectiveSegmentHeightPx };
  }

  const defaultH = isCompact ? 74 : 108;
  const defaultW = isCompact ? 96 : 136;
  const liveW = isResizingThis && liveResizeDims ? liveResizeDims.width : undefined;
  const liveH = isResizingThis && liveResizeDims ? liveResizeDims.height : undefined;

  return {
    availableW: liveW ?? btnCustom?.customWidth ?? defaultW,
    availableH: liveH ?? btnCustom?.customHeight ?? defaultH,
  };
};

export const clampCoordinates = (
  pos: { x: number; y: number },
  dims: { width: number; height: number },
  winW: number,
  winH: number,
): { x: number; y: number } => {
  const halfW = dims.width / 2;
  const halfH = dims.height / 2;
  const minXPct = Math.round(((halfW + 14) / winW) * 100 * 10) / 10;
  const maxXPct = Math.round(((winW - halfW - 14) / winW) * 100 * 10) / 10;
  const minYPct = Math.round(((halfH + 64) / winH) * 100 * 10) / 10;
  const maxYPct = Math.round(((winH - halfH - 14) / winH) * 100 * 10) / 10;

  const clampedX = Math.max(minXPct, Math.min(maxXPct, pos.x));
  const clampedY = Math.max(minYPct, Math.min(maxYPct, pos.y));
  return { x: clampedX, y: clampedY };
};

export const shouldUpdateClampedPos = (
  current: { x: number; y: number },
  clamped: { x: number; y: number },
): boolean => {
  return Math.abs(clamped.x - current.x) > 0.5 || Math.abs(clamped.y - current.y) > 0.5;
};

export const isFreeButtonLabelAllowed = (
  btnCustom?: DockButtonCustomization | null,
  currentW?: number,
  currentH?: number,
): boolean => {
  if (btnCustom?.hideLabel) return false;
  if (currentH !== undefined && currentH < 62) return false;
  if (currentW !== undefined && currentW < 70) return false;
  return true;
};

export const hasSufficientIconClearance = (
  availableW: number,
  availableH: number,
  effectiveIconH: number,
): boolean => {
  return availableH - effectiveIconH >= 24 && availableW - effectiveIconH >= 14;
};

export interface CheckDockButtonLabelParams {
  btnId: string;
  showLabels: boolean;
  layoutMode: string;
  effectiveSegmentHeightPx: number;
  effectiveSegmentWidthPx: number;
  btnCustom?: DockButtonCustomization | null;
  isResizingThis: boolean;
  liveResizeDims?: { width: number; height: number } | null;
  iconScale?: number;
  iconSize: number;
  isCompact: boolean;
}

export const isDockButtonLabelVisible = (params: CheckDockButtonLabelParams): boolean => {
  const {
    btnId,
    showLabels,
    layoutMode,
    effectiveSegmentHeightPx,
    effectiveSegmentWidthPx,
    btnCustom,
    isResizingThis,
    liveResizeDims,
    iconScale = 1,
    iconSize,
    isCompact,
  } = params;

  if (!showLabels) return false;

  if (layoutMode === 'dock') {
    if (effectiveSegmentHeightPx < 48 || effectiveSegmentWidthPx < 50) return false;
  } else {
    const currentW = isResizingThis && liveResizeDims ? liveResizeDims.width : btnCustom?.customWidth;
    const currentH = isResizingThis && liveResizeDims ? liveResizeDims.height : btnCustom?.customHeight;
    if (!isFreeButtonLabelAllowed(btnCustom, currentW, currentH)) return false;
  }

  if (btnCustom?.iconType === 'none') return true;

  const btnScale = btnCustom?.iconScale ?? 1;
  const effectiveScale = Math.round(iconScale * btnScale * 100) / 100;
  const baseIconSize = getButtonBaseIconSize(iconSize, btnId);
  const effectiveIconH = Math.round(baseIconSize * effectiveScale);

  const dims = getAvailableButtonDimensions({
    isDockMode: layoutMode === 'dock',
    effectiveSegmentHeightPx,
    effectiveSegmentWidthPx,
    btnId,
    isResizingThis,
    liveResizeDims,
    btnCustom: btnCustom ?? undefined,
    isCompact,
  });

  return hasSufficientIconClearance(dims.availableW, dims.availableH, effectiveIconH);
};

export interface StartButtonColors {
  startColor: string;
  startSubtleBg: string;
  startHoverBg: string;
}

export const resolveStartButtonColors = (
  dockConfig: LauncherState['dockConfig'],
  accentColor: string,
): StartButtonColors => {
  let startColor = '#22c55e';
  if (dockConfig.customButtonColors?.launch) {
    startColor = dockConfig.customButtonColors.launch;
  } else if (dockConfig.startBtnColorMode === 'accent') {
    startColor = accentColor;
  } else if (dockConfig.startBtnColorMode === 'custom' && dockConfig.customStartBtnColor) {
    startColor = dockConfig.customStartBtnColor;
  }

  const hex = startColor.replace('#', '');
  const parsedR = Number.parseInt(hex.substring(0, 2), 16);
  const r = Number.isNaN(parsedR) ? 34 : parsedR;
  const parsedG = Number.parseInt(hex.substring(2, 4), 16);
  const g = Number.isNaN(parsedG) ? 197 : parsedG;
  const parsedB = Number.parseInt(hex.substring(4, 6), 16);
  const b = Number.isNaN(parsedB) ? 94 : parsedB;
  return {
    startColor,
    startSubtleBg: `rgba(${r}, ${g}, ${b}, 0.16)`,
    startHoverBg: `rgba(${r}, ${g}, ${b}, 0.28)`,
  };
};

export interface ComputeDockDimensionsParams {
  dockConfig: LauncherState['dockConfig'];
  liveDockDims: { width: number; height: number } | null;
  buttonCount: number;
  hasLaunch: boolean;
}

export interface ComputedDockDimensions {
  isCompact: boolean;
  showLabels: boolean;
  minSegmentW: number;
  maxSegmentW: number;
  minDockH: number;
  maxDockH: number;
  effectiveSegmentWidthPx: number;
  effectiveSegmentHeightPx: number;
  segmentWidth: string;
  segmentHeight: string;
  startSegmentWidth: string;
  iconSize: number;
  labelFontSize: string;
}

const computeUnlabeledDimensions = (
  dockConfig: LauncherState['dockConfig'],
  liveDockDims: { width: number; height: number } | null,
  limits: { minSegmentW: number; maxSegmentW: number; minDockH: number; maxDockH: number },
  buttonCount: number,
  hasLaunch: boolean,
  isCompact: boolean,
) => {
  const rawCompactW = dockConfig.customSegmentWidth ?? (isCompact ? 52 : 62);
  const rawCompactH = dockConfig.customDockHeight ?? (isCompact ? 52 : 62);
  let effectiveW = Math.max(limits.minSegmentW, Math.min(limits.maxSegmentW, rawCompactW));
  let effectiveH = Math.max(limits.minDockH, Math.min(limits.maxDockH, rawCompactH));

  if (liveDockDims) {
    effectiveH = Math.max(limits.minDockH, Math.min(limits.maxDockH, liveDockDims.height));
    const divisor = hasLaunch ? buttonCount - 1 + 1.12 : buttonCount;
    effectiveW = Math.max(
      limits.minSegmentW,
      Math.min(limits.maxSegmentW, Math.round(liveDockDims.width / divisor)),
    );
  }

  return {
    segmentWidth: `${effectiveW}px`,
    segmentHeight: `${effectiveH}px`,
    startSegmentWidth: `${Math.round(effectiveW * 1.12)}px`,
    effectiveSegmentWidthPx: effectiveW,
    effectiveSegmentHeightPx: effectiveH,
  };
};

export const computeDockDimensions = (
  params: ComputeDockDimensionsParams,
): ComputedDockDimensions => {
  const { dockConfig, liveDockDims, buttonCount, hasLaunch } = params;
  const isCompact = dockConfig.scale === 'compact';
  const showLabels = dockConfig.showLabels;
  const limits = getSegmentLimits(showLabels, isCompact);

  const rawBaseSegmentWidth = dockConfig.customSegmentWidth ?? (isCompact ? 96 : 136);
  const rawBaseSegmentHeight = dockConfig.customDockHeight ?? (isCompact ? 74 : 108);

  let effectiveSegmentWidthPx = Math.max(limits.minSegmentW, Math.min(limits.maxSegmentW, rawBaseSegmentWidth));
  let effectiveSegmentHeightPx = Math.max(limits.minDockH, Math.min(limits.maxDockH, rawBaseSegmentHeight));

  if (liveDockDims) {
    effectiveSegmentHeightPx = Math.max(limits.minDockH, Math.min(limits.maxDockH, liveDockDims.height));
    const divisor = hasLaunch ? buttonCount - 1 + 1.15 : buttonCount;
    effectiveSegmentWidthPx = Math.max(
      limits.minSegmentW,
      Math.min(limits.maxSegmentW, Math.round(liveDockDims.width / divisor)),
    );
  }

  let segmentWidth = `${effectiveSegmentWidthPx}px`;
  let segmentHeight = `${effectiveSegmentHeightPx}px`;
  let startSegmentWidth = `${Math.round(effectiveSegmentWidthPx * 1.15)}px`;

  if (!showLabels) {
    const unlabeled = computeUnlabeledDimensions(
      dockConfig,
      liveDockDims,
      limits,
      buttonCount,
      hasLaunch,
      isCompact,
    );
    segmentWidth = unlabeled.segmentWidth;
    segmentHeight = unlabeled.segmentHeight;
    startSegmentWidth = unlabeled.startSegmentWidth;
    effectiveSegmentWidthPx = unlabeled.effectiveSegmentWidthPx;
    effectiveSegmentHeightPx = unlabeled.effectiveSegmentHeightPx;
  }

  const iconSize = isCompact || effectiveSegmentHeightPx < 65 ? 20 : 24;
  const labelFontSize = isCompact || effectiveSegmentHeightPx < 65 ? '12px' : '13.5px';

  return {
    isCompact,
    showLabels,
    minSegmentW: limits.minSegmentW,
    maxSegmentW: limits.maxSegmentW,
    minDockH: limits.minDockH,
    maxDockH: limits.maxDockH,
    effectiveSegmentWidthPx,
    effectiveSegmentHeightPx,
    segmentWidth,
    segmentHeight,
    startSegmentWidth,
    iconSize,
    labelFontSize,
  };
};
