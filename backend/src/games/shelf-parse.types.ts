export type ShelfParseProgressStage =
  | 'prepare'
  | 'detect'
  | 'merge'
  | 'match'
  | 'annotate'
  | 'finalize';

export type ShelfParseProgressDetail = {
  done?: number;
  total?: number;
  /** Vision sub-pipeline: how many of 4 sources finished (Gemini×2, Claude, OCR). */
  sourcesDone?: number;
  sourcesTotal?: number;
  /** Raw detection rows returned before merge (per source). */
  geminiUpright?: number;
  geminiSpine?: number;
  claude?: number;
  ocrBlocks?: number;
  /** Unique title rows after merge + junk filter + overlap suppression. */
  mergedTitles?: number;
};

export type ShelfParseProgressPayload = {
  stage: ShelfParseProgressStage;
  message: string;
  /** 0–100 */
  percent: number;
  detail?: ShelfParseProgressDetail;
};
