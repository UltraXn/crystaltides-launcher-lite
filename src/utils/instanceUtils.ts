export interface GameTypeBadgeStyle {
  label: string;
  background: string;
  color: string;
}

export const getGameTypeBadge = (hardcore?: boolean, gameType?: number): GameTypeBadgeStyle => {
  if (hardcore) {
    return {
      label: 'Hardcore',
      background: 'rgba(239, 68, 68, 0.2)',
      color: '#ef4444',
    };
  }
  if (gameType === 1) {
    return {
      label: 'Creativo',
      background: 'rgba(56, 189, 248, 0.2)',
      color: '#38bdf8',
    };
  }
  return {
    label: 'Supervivencia',
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  };
};
