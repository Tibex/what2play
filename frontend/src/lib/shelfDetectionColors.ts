/**
 * Per-detection colors for shelf parse UI (list + optional CSS overlay).
 * Keep in sync with ANNOTATION_COLORS in backend/src/vision/claude-vision.service.ts
 */
export const SHELF_DETECTION_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#10b981',
  '#f97316',
  '#06b6d4',
  '#ec4899',
] as const;

export function shelfDetectionColor(detectionNumber: number): string {
  const i = detectionNumber - 1;
  return SHELF_DETECTION_COLORS[
    ((i % SHELF_DETECTION_COLORS.length) + SHELF_DETECTION_COLORS.length) %
      SHELF_DETECTION_COLORS.length
  ];
}
