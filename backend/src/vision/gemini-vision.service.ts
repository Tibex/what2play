import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from '@google/generative-ai';
import sharp from 'sharp';

const MAX_IMAGE_WIDTH = 1536;
// Spine pass only reads title text on narrow strips — 1280 is enough and
// cuts input tokens ~30% versus 1536.
const SPINE_MAX_IMAGE_WIDTH = 1280;
// Gemini returns box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000
const GEMINI_BOX_SCALE = 1000;

/** Upright shelf-vision model (flash keeps precision on small spines). */
const GEMINI_UPRIGHT_MODEL = 'gemini-2.5-flash';
/** Spine pass and upright fallback — ~2× faster than flash. */
const GEMINI_SPINE_MODEL = 'gemini-2.5-flash-lite';

/**
 * Generation config shared across both models:
 * - thinkingConfig.thinkingBudget=0 disables 2.5-flash "thinking" mode, which
 *   is pure latency burn for perception tasks. Biggest latency win.
 * - responseMimeType pins JSON so we don't pay for markdown framing.
 * - maxOutputTokens caps worst-case output (a 60-box response is ~3k tokens).
 * The `thinkingConfig` field is accepted by the REST API but isn't in the
 * SDK's TypeScript types for v0.24 yet — hence the cast.
 */
const GEMINI_GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  maxOutputTokens: 4096,
  temperature: 0,
  thinkingConfig: { thinkingBudget: 0 },
} as unknown as Record<string, unknown>;

export type GeminiDetection = {
  title: string;
  editionOrVersion?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  polygon?: Array<[number, number]>;
  detectionConfidence?: number;
  gameConfidence?: number;
};

@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);
  private uprightModel: GenerativeModel | null = null;
  private spineModel: GenerativeModel | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      const genai = new GoogleGenerativeAI(apiKey);
      this.uprightModel = genai.getGenerativeModel({
        model: GEMINI_UPRIGHT_MODEL,
        generationConfig: GEMINI_GENERATION_CONFIG as never,
      });
      this.spineModel = genai.getGenerativeModel({
        model: GEMINI_SPINE_MODEL,
        generationConfig: GEMINI_GENERATION_CONFIG as never,
      });
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured — Gemini vision disabled',
      );
    }
  }

  isAvailable(): boolean {
    return this.uprightModel !== null;
  }

  private getGeminiHttpStatus(err: unknown): number | undefined {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      const s = (err as { status?: unknown }).status;
      return typeof s === 'number' ? s : undefined;
    }
    return undefined;
  }

  private async generateContentWithBackoff(
    model: GenerativeModel,
    parts: Parameters<GenerativeModel['generateContent']>[0],
  ): Promise<Awaited<ReturnType<GenerativeModel['generateContent']>>> {
    const maxAttempts = 6;
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await model.generateContent(parts);
      } catch (err: unknown) {
        lastErr = err;
        const status = this.getGeminiHttpStatus(err);
        const retryable =
          status === 503 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 504;
        if (!retryable || attempt >= maxAttempts - 1) {
          throw err;
        }
        const baseMs = 500 * 2 ** attempt;
        const jitterMs = Math.floor(Math.random() * 400);
        this.logger.warn(
          `Gemini generateContent transient HTTP ${String(status)} — retry ${attempt + 2}/${maxAttempts} in ${baseMs + jitterMs}ms`,
        );
        await new Promise((r) => setTimeout(r, baseMs + jitterMs));
      }
    }
    throw lastErr;
  }

  /**
   * Runs `primary` with backoff, then `fallback` if primary still fails.
   */
  private async generateContentPrimaryThenFallback(
    parts: Parameters<GenerativeModel['generateContent']>[0],
    primary: GenerativeModel | null,
    primaryLabel: string,
    fallback: GenerativeModel | null,
    fallbackLabel: string,
  ): Promise<Awaited<ReturnType<GenerativeModel['generateContent']>>> {
    if (!primary) {
      throw new Error('Gemini model not configured');
    }
    try {
      return await this.generateContentWithBackoff(primary, parts);
    } catch (primaryErr: unknown) {
      if (!fallback) {
        throw primaryErr;
      }
      this.logger.warn(
        `Gemini primary (${primaryLabel}) failed after retries — trying fallback (${fallbackLabel})`,
        primaryErr,
      );
      return await this.generateContentWithBackoff(fallback, parts);
    }
  }

  async detectBoardGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    knownGames: string[] = [],
  ): Promise<GeminiDetection[]> {
    if (!this.uprightModel) return [];
    const startedAt = Date.now();
    try {
      const resizeStartedAt = Date.now();
      const { buffer, mediaType: finalMediaType } = await this.resizeImage(
        imageBuffer,
        mediaType,
        MAX_IMAGE_WIDTH,
      );

      const knownGamesHint =
        knownGames.length > 0
          ? `\nKnown games hint (guide, not a rule): ${JSON.stringify(knownGames.slice(0, 100))}\n`
          : '';

      const parts = [
        {
          inlineData: {
            mimeType: finalMediaType,
            data: buffer.toString('base64'),
          },
        },
        {
          text: `Identify every board game box on this shelf. Many games sit spine-out (narrow vertical strip, title rotated 90/180°) — scan shelves row by row and include them.${knownGamesHint}

Return a JSON array only. For each physical box:
- "label": full title as printed (read every word, not just the largest; e.g. "Here to Slay", not "Slay")
- "edition": edition/expansion if visible, else null
- "box_2d": [ymin, xmin, ymax, xmax] integers 0-1000 tracing the full cardboard box
- "polygon": [[x1,y1]..[x4,y4]] clockwise corners, integers 0-1000 (x = col/width×1000)
- "detect_conf": 0.0-1.0 this is a game
- "game_conf": 0.0-1.0 title is correct

Rules: each entry = one physical box, rectangles non-overlapping (edge contact only). Skip books/magazines/DVDs, floors, carpets, walls, tables, furniture, decorative objects, shelf hardware, figurines, and anything without a publisher logo or game title. Do NOT include wall art, rugs, plants, or plain surfaces — a valid detection must show game art or a readable game title. Look for games stacked side-on where only the narrow spine is visible (thin vertical strips, 1–5% of image width). Include games near image corners and edges. Only include a detection if you can clearly read specific text naming the game — title, expansion name, or publisher. If you cannot read identifying text, omit it. Do not invent titles. Return [] if none.

Example: [{"label":"Wingspan","edition":null,"box_2d":[340,120,560,250],"polygon":[[120,340],[250,340],[250,560],[120,560]],"detect_conf":0.98,"game_conf":0.95}]`,
        },
      ];

      const resizeMs = Date.now() - resizeStartedAt;

      const modelStartedAt = Date.now();
      const result = await this.generateContentPrimaryThenFallback(
        parts,
        this.uprightModel,
        GEMINI_UPRIGHT_MODEL,
        this.spineModel,
        GEMINI_SPINE_MODEL,
      );
      const modelMs = Date.now() - modelStartedAt;

      const parseStartedAt = Date.now();
      const text = result.response.text().trim();
      const parsed = this.parseGeminiJsonArrayFromText(text, 'upright');
      if (parsed.length === 0) return [];

      const items = this.parseDetectionItems(parsed);
      const parseMs = Date.now() - parseStartedAt;
      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `Gemini upright timings (ms): resize=${resizeMs}, model=${modelMs}, parse=${parseMs}, total=${totalMs}, detections=${items.length}`,
      );

      return items;
    } catch (error) {
      this.logger.warn('Gemini vision detection failed', error);
      this.logger.warn(
        `Gemini upright failed after ${Date.now() - startedAt}ms`,
      );
      return [];
    }
  }

  private async resizeImage(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
    maxWidth: number = MAX_IMAGE_WIDTH,
  ): Promise<{
    buffer: Buffer;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  }> {
    const oriented = await sharp(imageBuffer).rotate().toBuffer();
    const metadata = await sharp(oriented).metadata();
    if (!metadata.width || metadata.width <= maxWidth) {
      return { buffer: oriented, mediaType };
    }
    const buffer = await sharp(oriented)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { buffer, mediaType: 'image/jpeg' };
  }

  /**
   * Detects spine-out games by rotating the image 90° CW so that narrow
   * vertical spines become wider horizontal boxes with readable text.
   * Bounding boxes and polygons are transformed back to the original image orientation.
   */
  async detectSpineOutGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    knownGames: string[] = [],
  ): Promise<GeminiDetection[]> {
    if (!this.spineModel) return [];
    const startedAt = Date.now();
    try {
      const resizeStartedAt = Date.now();
      const { buffer: prepared } = await this.resizeImage(
        imageBuffer,
        mediaType,
        SPINE_MAX_IMAGE_WIDTH,
      );
      // Rotate 90° CW: spine-out games become wide horizontal boxes
      const rotated = await sharp(prepared)
        .rotate(90)
        .jpeg({ quality: 85 })
        .toBuffer();

      const knownGamesHint =
        knownGames.length > 0
          ? `\nKnown games hint (guide, not a rule): ${JSON.stringify(knownGames.slice(0, 100))}\n`
          : '';

      const parts = [
        {
          inlineData: {
            mimeType: 'image/jpeg' as const,
            data: rotated.toString('base64'),
          },
        },
        {
          text: `This shelf image was rotated 90° clockwise — spine-out games now appear as wide horizontal boxes with title text reading left-to-right. Identify every game box.${knownGamesHint}

Return a JSON array only. For each physical box:
- "label": full title as printed (read every word, e.g. "Here to Slay", not "Slay")
- "edition": edition/expansion if visible, else null
- "box_2d": [ymin, xmin, ymax, xmax] integers 0-1000
- "polygon": [[x1,y1]..[x4,y4]] clockwise corners, integers 0-1000
- "detect_conf": 0.0-1.0 this is a game
- "game_conf": 0.0-1.0 title is correct

Rules: each entry = one physical box, non-overlapping (edge contact only). Skip books, magazines, DVDs, furniture surfaces, decorative objects, and anything without a game title or publisher logo. Only include entries where you can clearly read a game title or publisher. Omit unreadable items rather than labeling "UNKNOWN". Return [] if none.

Example: [{"label":"Ticket to Ride","edition":null,"box_2d":[340,120,560,250],"polygon":[[120,340],[250,340],[250,560],[120,560]],"detect_conf":0.95,"game_conf":0.9}]`,
        },
      ];

      const resizeMs = Date.now() - resizeStartedAt;

      const modelStartedAt = Date.now();
      // Spine pass runs on flash-lite first (~2× faster) with flash as fallback.
      const result = await this.generateContentPrimaryThenFallback(
        parts,
        this.spineModel,
        GEMINI_SPINE_MODEL,
        this.uprightModel,
        GEMINI_UPRIGHT_MODEL,
      );
      const modelMs = Date.now() - modelStartedAt;

      const parseStartedAt = Date.now();
      const text = result.response.text().trim();
      const parsed = this.parseGeminiJsonArrayFromText(text, 'spine');
      if (parsed.length === 0) return [];

      const items = this.parseDetectionItems(parsed);

      // Invert 90° CW rotation back to original image orientation.
      // For a point (xr, yr) in rotated normalized [0,1]: original = (yr, 1-xr)
      const normalizedItems = items.map((item) => {
        const bb = item.boundingBox;
        const invertedBoundingBox = bb
          ? (() => {
              // x_orig=yRot, y_orig=1-xRot-wRot, w_orig=hRot, h_orig=wRot
              const x = Math.max(0, bb.y);
              const y = Math.max(0, 1 - bb.x - bb.width);
              const width = bb.height;
              const height = bb.width;
              return {
                x,
                y,
                width: Math.min(width, 1 - x),
                height: Math.min(height, 1 - y),
              };
            })()
          : undefined;

        const invertedPolygon = item.polygon
          ? item.polygon.map(([px, py]) => [py, 1 - px] as [number, number])
          : undefined;

        return {
          ...item,
          boundingBox: invertedBoundingBox,
          polygon: invertedPolygon,
        };
      });

      const parseMs = Date.now() - parseStartedAt;
      const totalMs = Date.now() - startedAt;
      this.logger.log(
        `Gemini spine timings (ms): resize+rotate=${resizeMs}, model=${modelMs}, parse+invert=${parseMs}, total=${totalMs}, detections=${normalizedItems.length}`,
      );

      return normalizedItems;
    } catch (error) {
      this.logger.warn('Gemini spine-out detection failed', error);
      this.logger.warn(
        `Gemini spine-out failed after ${Date.now() - startedAt}ms`,
      );
      return [];
    }
  }

  /**
   * Gemini can occasionally emit slightly malformed JSON in long arrays even
   * when responseMimeType is pinned. Recover what we can instead of failing the
   * whole detection pass.
   */
  private parseGeminiJsonArrayFromText(
    text: string,
    pass: 'upright' | 'spine',
  ): unknown[] {
    const trimmed = text.trim();
    const strictParsed = this.tryParseJsonArray(trimmed);
    if (strictParsed) return strictParsed;

    // Fallback model sometimes wraps JSON in markdown.
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const bracketed = match[0];

    const bracketedStrict = this.tryParseJsonArray(bracketed);
    if (bracketedStrict) return bracketedStrict;

    const normalized = this.normalizeJsonText(bracketed);
    const normalizedParsed = this.tryParseJsonArray(normalized);
    if (normalizedParsed) {
      this.logger.warn(
        `Gemini ${pass} returned malformed JSON array; recovered via normalization`,
      );
      return normalizedParsed;
    }

    const salvaged = this.salvageJsonObjectsFromArray(bracketed);
    if (salvaged.length > 0) {
      this.logger.warn(
        `Gemini ${pass} returned malformed JSON array; salvaged ${salvaged.length} object(s)`,
      );
      return salvaged;
    }

    return [];
  }

  private tryParseJsonArray(text: string): unknown[] | null {
    try {
      const parsed = JSON.parse(text) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private normalizeJsonText(text: string): string {
    return text
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([^\d])\.([0-9])/g, '$10.$2')
      .replace(/^\./gm, '0.');
  }

  private salvageJsonObjectsFromArray(arrayText: string): unknown[] {
    const recovered: unknown[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < arrayText.length; i++) {
      const char = arrayText[i];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === '{') {
        if (depth === 0) start = i;
        depth += 1;
        continue;
      }

      if (char === '}') {
        if (depth === 0) continue;
        depth -= 1;
        if (depth === 0 && start >= 0) {
          const rawObject = arrayText.slice(start, i + 1);
          const parsed = this.tryParseJsonObject(rawObject);
          if (parsed) recovered.push(parsed);
          start = -1;
        }
      }
    }

    return recovered;
  }

  private tryParseJsonObject(text: string): Record<string, unknown> | null {
    const strict = this.parseObject(text);
    if (strict) return strict;
    return this.parseObject(this.normalizeJsonText(text));
  }

  private parseObject(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private isJunkGeminiShelfLabel(label: string): boolean {
    const t = label.replace(/\s+/g, ' ').trim();
    if (t.length < 2) return true;
    const u = t.toUpperCase();
    const garbage = new Set([
      'UNKNOWN',
      'N/A',
      'NA',
      'NONE',
      'NULL',
      '???',
      '?',
      'UNREADABLE',
      'NOT FOUND',
      'NO TITLE',
      'NOT A GAME',
      'NOT IDENTIFIED',
      '(UNKNOWN)',
      '[UNKNOWN]',
    ]);
    if (garbage.has(u)) return true;
    if (/^unknown$/i.test(t)) return true;
    if (/^n\/?a$/i.test(t)) return true;
    if (/^not\s+found$/i.test(t)) return true;
    return false;
  }

  /**
   * Parses a raw JSON array from Gemini into typed GeminiDetection objects.
   * Shared by detectBoardGames and detectSpineOutGames.
   */
  private parseDetectionItems(parsed: unknown[]): GeminiDetection[] {
    const results: GeminiDetection[] = [];

    for (const item of parsed) {
      if (item === null || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;

      const label = typeof r.label === 'string' ? r.label.trim() : '';
      if (!label || label.length >= 100) continue;
      if (this.isJunkGeminiShelfLabel(label)) continue;

      // Skip very low detection confidence — likely a false positive
      const detectionConfidence =
        typeof r.detect_conf === 'number' ? r.detect_conf : undefined;
      if (detectionConfidence !== undefined && detectionConfidence < 0.5)
        continue;

      const editionOrVersion =
        typeof r.edition === 'string' && r.edition.trim()
          ? r.edition.trim()
          : undefined;

      const gameConfidence =
        typeof r.game_conf === 'number' ? r.game_conf : undefined;
      if (gameConfidence !== undefined && gameConfidence < 0.32) continue;

      // Parse polygon: [[x,y],...] in 0-1000 scale → normalize to [0,1]
      const rawPoly = r.polygon;
      let polygon: Array<[number, number]> | undefined;
      if (
        Array.isArray(rawPoly) &&
        rawPoly.length === 4 &&
        rawPoly.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            typeof p[0] === 'number' &&
            typeof p[1] === 'number',
        )
      ) {
        polygon = (rawPoly as Array<[number, number]>).map(
          ([px, py]) =>
            [
              Math.max(0, Math.min(1, px / GEMINI_BOX_SCALE)),
              Math.max(0, Math.min(1, py / GEMINI_BOX_SCALE)),
            ] as [number, number],
        );
      }

      const box = r.box_2d;
      if (
        Array.isArray(box) &&
        box.length === 4 &&
        box.every((v) => typeof v === 'number')
      ) {
        const [ymin, xmin, ymax, xmax] = box as [
          number,
          number,
          number,
          number,
        ];
        const x = xmin / GEMINI_BOX_SCALE;
        const y = ymin / GEMINI_BOX_SCALE;
        const width = (xmax - xmin) / GEMINI_BOX_SCALE;
        const height = (ymax - ymin) / GEMINI_BOX_SCALE;

        if (width >= 0.005 && height >= 0.005) {
          results.push({
            title: label,
            editionOrVersion,
            boundingBox: {
              x: Math.max(0, x),
              y: Math.max(0, y),
              width: Math.min(width, 1 - Math.max(0, x)),
              height: Math.min(height, 1 - Math.max(0, y)),
            },
            polygon,
            detectionConfidence,
            gameConfidence,
          });
          continue;
        }
      }

      results.push({
        title: label,
        editionOrVersion,
        polygon,
        detectionConfidence,
        gameConfidence,
      });
    }

    return results;
  }
}
