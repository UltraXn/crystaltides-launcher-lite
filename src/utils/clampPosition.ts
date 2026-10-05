/**
 * Utility to clamp an element's position within the viewport bounds.
 * Prevents elements from sliding off-screen or getting lost.
 */
export const clampPositionToViewport = (
  clientX: number,
  clientY: number,
  elementWidth: number,
  elementHeight: number,
  padding: number = 14,
  topPadding: number = 64, // Keep clearance for window controls and top header bar
): { x: number; y: number } => {
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

  const halfW = elementWidth / 2;
  const halfH = elementHeight / 2;

  // Safe boundaries for the center coordinates
  const minX = halfW + padding;
  const maxX = Math.max(minX, winW - halfW - padding);
  const minY = halfH + topPadding;
  const maxY = Math.max(minY, winH - halfH - padding);

  const clampedPxX = Math.max(minX, Math.min(maxX, clientX));
  const clampedPxY = Math.max(minY, Math.min(maxY, clientY));

  // Convert to clean percentage
  const xPct = Math.round(((clampedPxX / winW) * 100) * 10) / 10;
  const yPct = Math.round(((clampedPxY / winH) * 100) * 10) / 10;

  return { x: xPct, y: yPct };
};
