/** Match game-night length options used in event creation. */
export const GAME_DURATION_OPTIONS_MINUTES = [60, 120, 180, 240, 300, 360];

export function formatDurationMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
