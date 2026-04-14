import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  type GenerativeModel,
} from '@google/generative-ai';
import sharp from 'sharp';

const MAX_IMAGE_WIDTH = 1536;
// Gemini returns box_2d as [ymin, xmin, ymax, xmax] normalized to 0-1000
const GEMINI_BOX_SCALE = 1000;

/** Primary shelf-vision model */
const GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash';
/**
 * Fallback when primary fails after retries (503/overload, etc.).
 * Use another 2.5-family id: unversioned `gemini-2.0-flash` returns 404 for new API projects.
 */
const GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash-lite';

const VALID_OCCLUSION = ['none', 'low', 'medium', 'high'] as const;

export type GeminiDetection = {
  title: string;
  editionOrVersion?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  polygon?: Array<[number, number]>;
  detectionConfidence?: number;
  gameConfidence?: number;
  occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
  candidates?: string[];
};

@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);
  private primaryModel: GenerativeModel | null = null;
  private fallbackModel: GenerativeModel | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      const genai = new GoogleGenerativeAI(apiKey);
      this.primaryModel = genai.getGenerativeModel({
        model: GEMINI_PRIMARY_MODEL,
      });
      this.fallbackModel = genai.getGenerativeModel({
        model: GEMINI_FALLBACK_MODEL,
      });
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured — Gemini vision disabled',
      );
    }
  }

  isAvailable(): boolean {
    return this.primaryModel !== null;
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
        const baseMs = 1200 * 2 ** attempt;
        const jitterMs = Math.floor(Math.random() * 900);
        this.logger.warn(
          `Gemini generateContent transient HTTP ${String(status)} — retry ${attempt + 2}/${maxAttempts} in ${baseMs + jitterMs}ms`,
        );
        await new Promise((r) => setTimeout(r, baseMs + jitterMs));
      }
    }
    throw lastErr;
  }

  /**
   * Retries on the primary model, then the hardcoded fallback if primary still fails.
   */
  private async generateContentPrimaryThenFallback(
    parts: Parameters<GenerativeModel['generateContent']>[0],
  ): Promise<Awaited<ReturnType<GenerativeModel['generateContent']>>> {
    if (!this.primaryModel) {
      throw new Error('Gemini model not configured');
    }
    try {
      return await this.generateContentWithBackoff(this.primaryModel, parts);
    } catch (primaryErr: unknown) {
      if (!this.fallbackModel) {
        throw primaryErr;
      }
      this.logger.warn(
        `Gemini primary (${GEMINI_PRIMARY_MODEL}) failed after retries — trying fallback (${GEMINI_FALLBACK_MODEL})`,
        primaryErr,
      );
      return await this.generateContentWithBackoff(this.fallbackModel, parts);
    }
  }

  async detectBoardGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    knownGames: string[] = [],
  ): Promise<GeminiDetection[]> {
    if (!this.primaryModel) return [];
    try {
      const { buffer, mediaType: finalMediaType } = await this.resizeImage(
        imageBuffer,
        mediaType,
      );

      const knownGamesHint =
        knownGames.length > 0
          ? `\nKnown games hint (soft constraint — use as a guide, not a rule):\n${JSON.stringify(knownGames.slice(0, 100))}\n`
          : '';

      const parts = [
        {
          inlineData: {
            mimeType: finalMediaType,
            data: buffer.toString('base64'),
          },
        },
        {
          text: `You are an expert at identifying board games on shelves.${knownGamesHint}

STEP 1 -- Spine-out games (most commonly missed):
Many games are stored spine-out, like books on a bookshelf. They appear as narrow vertical strips (roughly 1-6% of image width) with the game title running along the spine, rotated 90 or 180 degrees. Before doing a full scan, sweep each shelf specifically for narrow strips with vertical text -- every such strip is almost certainly a game spine.

STEP 2 -- Full shelf scan:
Scan systematically, shelf by shelf, top to bottom, left to right within each row. Do not skip any row.

Board games appear in several orientations:
- Spine-out: narrow strip, title rotated 90 or 180 degrees -- PRIORITIZE finding these (Step 1)
- Face-out: full box cover visible (title on the front face)
- Stacked horizontally: box lying flat, cover face up
- Partially obscured: tucked behind another box or at image edge

BOUNDING BOX AND POLYGON PRECISION -- use color transitions:
Every game box has a distinct dominant background color. The physical edge of a box is precisely where that background color ends and the adjacent box's color (or the shelf surface) begins. Use this color-boundary approach for both box_2d and polygon corners.

NON-OVERLAPPING PHYSICAL BOXES:
Each entry must represent ONE physical cardboard box. Boxes cannot intersect or share interior area with another game's box in your output. If two games touch, their rectangles must meet at an edge only (zero overlap). Merge split detections for the same physical box into a single box. Prefer slightly inset/tight boxes over oversized boxes that swallow neighbors.

For EACH game box you identify, return an object with:
- "label": exact title as printed on the box or spine (best guess if partially obscured)
- "edition": edition, variant, or expansion name if visible (e.g. "5th Edition", "Legacy", "European Expansion"), or null
- "box_2d": [ymin, xmin, ymax, xmax] where each value is an integer 0-1000 (fraction of image height/width × 1000). Use color transitions to measure the FULL physical cardboard box precisely.
- "polygon": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] four corner points clockwise, tightly tracing the visible face/spine boundary; integers 0-1000 (x = col/width×1000, y = row/height×1000)
- "detect_conf": 0.0-1.0 confidence this is actually a game box
- "game_conf": 0.0-1.0 confidence in the title identification
- "occlusion": "none"|"low"|"medium"|"high"
- "candidates": array of alternative title strings when game_conf < 0.7, else []

Return ONLY a JSON array -- no explanation, no markdown:
[{"label":"Wingspan","edition":null,"box_2d":[340,120,560,250],"polygon":[[120,340],[250,340],[250,560],[120,560]],"detect_conf":0.98,"game_conf":0.95,"occlusion":"none","candidates":[]}]

Rules:
- Include items you are reasonably confident are a board game, card game, or tabletop expansion (including small boxes). Skip ambiguous blobs, shelf decor, and unclear packaging.
- Include partially hidden boxes only when you can read enough title art to name the game; otherwise omit.
- Prefer precision and non-overlapping boxes over maximizing recall — do not invent games.
- Do NOT include: books (look for author names, ISBNs, novel-style covers), magazines, DVDs, decorative objects, price tags, or shelf labels
- For spine-only items: include if it has game-style art or a recognizable game/expansion title; skip only if clearly a novel, magazine, or DVD
- Check every shelf row including top and bottom
- Return the COMPLETE title as printed. A word may appear large as a design choice -- read ALL text on the box/spine (e.g. if "SLAY" is prominent but the box says "Here to Slay", return "Here to Slay", not "Slay the Spire")
- Return [] only if there are genuinely no game boxes in the image`,
        },
      ];

      const result = await this.generateContentPrimaryThenFallback(parts);

      const text = result.response.text().trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];

      return this.parseDetectionItems(parsed);
    } catch (error) {
      this.logger.warn('Gemini vision detection failed', error);
      return [];
    }
  }

  private async resizeImage(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<{
    buffer: Buffer;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  }> {
    const oriented = await sharp(imageBuffer).rotate().toBuffer();
    const metadata = await sharp(oriented).metadata();
    if (!metadata.width || metadata.width <= MAX_IMAGE_WIDTH) {
      return { buffer: oriented, mediaType };
    }
    const buffer = await sharp(oriented)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
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
    if (!this.primaryModel) return [];
    try {
      const { buffer: prepared } = await this.resizeImage(
        imageBuffer,
        mediaType,
      );
      // Rotate 90° CW: spine-out games become wide horizontal boxes
      const rotated = await sharp(prepared)
        .rotate(90)
        .jpeg({ quality: 85 })
        .toBuffer();

      const knownGamesHint =
        knownGames.length > 0
          ? `\nKnown games hint (soft constraint — use as a guide, not a rule):\n${JSON.stringify(knownGames.slice(0, 100))}\n`
          : '';

      const parts = [
        {
          inlineData: {
            mimeType: 'image/jpeg' as const,
            data: rotated.toString('base64'),
          },
        },
        {
          text: `You are identifying board games on a shelf. This image has been rotated 90° clockwise so that games stored spine-out (standing like books, showing only their narrow edge) now appear as wider horizontal boxes with their title text reading left-to-right.${knownGamesHint}

Identify every visible game box in this rotated image.

NON-OVERLAPPING PHYSICAL BOXES: each JSON entry is one physical box; rectangles must not overlap other entries (edge contact only). Do not output placeholder labels like "UNKNOWN" — omit unreadable items.

For each box, return:
- "label": the full game title as printed
- "edition": edition, variant, or expansion name if visible, or null
- "box_2d": [ymin, xmin, ymax, xmax] as integers 0-1000. Use color transitions between boxes to set precise boundaries.
- "polygon": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] four corner points clockwise in the rotated image; integers 0-1000 (x = col/width×1000, y = row/height×1000)
- "detect_conf": 0.0-1.0 confidence this is a game box
- "game_conf": 0.0-1.0 confidence in the title
- "occlusion": "none"|"low"|"medium"|"high"
- "candidates": alternative titles when game_conf < 0.7, else []

Return ONLY a JSON array, no explanation, no markdown:
[{"label":"Ticket to Ride","edition":null,"box_2d":[340,120,560,250],"polygon":[[120,340],[250,340],[250,560],[120,560]],"detect_conf":0.95,"game_conf":0.9,"occlusion":"none","candidates":[]}]

Rules:
- Return the COMPLETE title. A word may appear large as a design choice -- read ALL text on the box (e.g. if "SLAY" is large but it says "Here to Slay", return "Here to Slay")
- Include expansions and small boxes
- Do NOT include books, magazines, DVDs, price tags, or shelf labels
- Return [] if nothing is identifiable`,
        },
      ];

      const result = await this.generateContentPrimaryThenFallback(parts);

      const text = result.response.text().trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];

      const items = this.parseDetectionItems(parsed);

      // Invert 90° CW rotation back to original image orientation.
      // For a point (xr, yr) in rotated normalized [0,1]: original = (yr, 1-xr)
      return items.map((item) => {
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
    } catch (error) {
      this.logger.warn('Gemini spine-out detection failed', error);
      return [];
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
      if (detectionConfidence !== undefined && detectionConfidence < 0.38)
        continue;

      const editionOrVersion =
        typeof r.edition === 'string' && r.edition.trim()
          ? r.edition.trim()
          : undefined;

      const gameConfidence =
        typeof r.game_conf === 'number' ? r.game_conf : undefined;
      if (gameConfidence !== undefined && gameConfidence < 0.32) continue;

      const occlusionLevel =
        typeof r.occlusion === 'string' &&
        (VALID_OCCLUSION as readonly string[]).includes(r.occlusion)
          ? (r.occlusion as 'none' | 'low' | 'medium' | 'high')
          : undefined;

      const rawCandidates = r.candidates;
      const candidates = Array.isArray(rawCandidates)
        ? rawCandidates.filter(
            (c): c is string =>
              typeof c === 'string' && c.length > 0 && c.length < 100,
          )
        : undefined;

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
            occlusionLevel,
            candidates,
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
        occlusionLevel,
        candidates,
      });
    }

    return results;
  }
}
