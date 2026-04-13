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

@Injectable()
export class GeminiVisionService {
  private readonly logger = new Logger(GeminiVisionService.name);
  private model: GenerativeModel | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: 'gemini-2.5-flash',
      });
    } else {
      this.logger.warn(
        'GEMINI_API_KEY not configured — Gemini vision disabled',
      );
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  async detectBoardGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  ): Promise<
    Array<{
      title: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>
  > {
    if (!this.model) return [];
    try {
      const { buffer, mediaType: finalMediaType } = await this.resizeImage(
        imageBuffer,
        mediaType,
      );

      const parts = [
        {
          inlineData: {
            mimeType: finalMediaType,
            data: buffer.toString('base64'),
          },
        },
        {
          text: `You are an expert at identifying board games on shelves.

STEP 1 -- Spine-out games (most commonly missed):
Many games are stored spine-out, like books on a bookshelf. They appear as narrow vertical strips (roughly 1-6% of image width) with the game title running along the spine, rotated 90 or 180 degrees. Before doing a full scan, sweep each shelf specifically for narrow strips with vertical text -- every such strip is almost certainly a game spine.

STEP 2 -- Full shelf scan:
Scan systematically, shelf by shelf, top to bottom, left to right within each row. Do not skip any row.

Board games appear in several orientations:
- Spine-out: narrow strip, title rotated 90 or 180 degrees -- PRIORITIZE finding these (Step 1)
- Face-out: full box cover visible (title on the front face)
- Stacked horizontally: box lying flat, cover face up
- Partially obscured: tucked behind another box or at image edge

BOUNDING BOX PRECISION -- use color transitions:
Every game box has a distinct dominant background color. The physical edge of a box is precisely where that background color ends and the adjacent box's color (or the shelf surface) begins. When setting box_2d coordinates:
- Left/right edges: find where the box's background color transitions to a different color
- Top/bottom edges: find where the box color meets the shelf above/below or the shelf surface
- For spine-out boxes: the spine's narrow color band tells you the exact left and right pixel
- Do NOT expand the box to include neighboring colors; do NOT shrink it to just the text area
This color-boundary approach gives more precise boxes than estimating from text position alone.

For EACH game box you identify, return an object with:
- "label": exact title as printed on the box or spine (best guess if partially obscured)
- "box_2d": [ymin, xmin, ymax, xmax] where each value is an integer 0-1000 representing
  the fraction of image height/width multiplied by 1000.
  Use color transitions to measure the FULL physical cardboard box precisely.

Return ONLY a JSON array -- no explanation, no markdown:
[{"label":"Wingspan","box_2d":[340,120,560,250]},{"label":"Catan","box_2d":[340,270,560,390]}]

Rules:
- Include every item you are reasonably confident is a board game, card game, or tabletop expansion (including small boxes)
- Include partially hidden boxes and boxes where only part of the title is visible
- An imprecise bounding box is acceptable -- a missed game is not
- Do NOT include: books (look for author names, ISBNs, novel-style covers), magazines, DVDs, decorative objects, price tags, or shelf labels
- For spine-only items: include if it has game-style art or a recognizable game/expansion title; skip only if clearly a novel, magazine, or DVD
- Check every shelf row including top and bottom
- Return the COMPLETE title as printed. A word may appear large as a design choice — read ALL text on the box/spine (e.g. if "SLAY" is prominent but the box says "Here to Slay", return "Here to Slay", not "Slay" or "Slay the Spire")
- Return [] only if there are genuinely no game boxes in the image`,
        },
      ];

      // Retry up to 2 times on 503 (transient overload) with exponential backoff
      let result;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          result = await this.model.generateContent(parts);
          break;
        } catch (err: unknown) {
          const status = (err as { status?: number }).status;
          if (status === 503 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
            continue;
          }
          throw err;
        }
      }

      const text = result!.response.text().trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];

      const results: Array<{
        title: string;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }> = [];

      for (const item of parsed) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;

        const label = typeof r.label === 'string' ? r.label.trim() : '';
        if (!label || label.length >= 100) continue;

        const box = r.box_2d;
        if (
          Array.isArray(box) &&
          box.length === 4 &&
          box.every((v) => typeof v === 'number')
        ) {
          const [ymin, xmin, ymax, xmax] = box;
          const x = xmin / GEMINI_BOX_SCALE;
          const y = ymin / GEMINI_BOX_SCALE;
          const width = (xmax - xmin) / GEMINI_BOX_SCALE;
          const height = (ymax - ymin) / GEMINI_BOX_SCALE;

          if (width >= 0.005 && height >= 0.005) {
            results.push({
              title: label,
              boundingBox: {
                x: Math.max(0, x),
                y: Math.max(0, y),
                width: Math.min(width, 1 - Math.max(0, x)),
                height: Math.min(height, 1 - Math.max(0, y)),
              },
            });
            continue;
          }
        }

        results.push({ title: label });
      }

      return results;
    } catch (error) {
      this.logger.error('Gemini vision detection failed', error);
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
   * Bounding boxes are transformed back to the original image orientation.
   */
  async detectSpineOutGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  ): Promise<
    Array<{
      title: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>
  > {
    if (!this.model) return [];
    try {
      const { buffer: prepared } = await this.resizeImage(imageBuffer, mediaType);
      // Rotate 90° CW: spine-out games become wide horizontal boxes
      const rotated = await sharp(prepared)
        .rotate(90)
        .jpeg({ quality: 85 })
        .toBuffer();

      const parts = [
        {
          inlineData: {
            mimeType: 'image/jpeg' as const,
            data: rotated.toString('base64'),
          },
        },
        {
          text: `You are identifying board games on a shelf. This image has been rotated 90° clockwise so that games stored spine-out (standing like books, showing only their narrow edge) now appear as wider horizontal boxes with their title text reading left-to-right.

Identify every visible game box in this rotated image.

For each box, return:
- "label": the full game title as printed
- "box_2d": [ymin, xmin, ymax, xmax] as integers 0-1000. Use color transitions between boxes to set precise boundaries.

Return ONLY a JSON array, no explanation, no markdown:
[{"label":"Ticket to Ride","box_2d":[340,120,560,250]}]

Rules:
- Return the COMPLETE title. A word may appear large as a design choice — read ALL text on the box (e.g. if "SLAY" is large but it says "Here to Slay", return "Here to Slay")
- Include expansions and small boxes
- Do NOT include books, magazines, DVDs, price tags, or shelf labels
- Return [] if nothing is identifiable`,
        },
      ];

      let result;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          result = await this.model.generateContent(parts);
          break;
        } catch (err: unknown) {
          const status = (err as { status?: number }).status;
          if (status === 503 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
            continue;
          }
          throw err;
        }
      }

      const text = result!.response.text().trim();
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];

      const results: Array<{
        title: string;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }> = [];

      for (const item of parsed) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        const label = typeof r.label === 'string' ? r.label.trim() : '';
        if (!label || label.length >= 100) continue;

        const box = r.box_2d;
        if (
          Array.isArray(box) &&
          box.length === 4 &&
          box.every((v) => typeof v === 'number')
        ) {
          const [ymin, xmin, ymax, xmax] = box;
          const xRot = xmin / GEMINI_BOX_SCALE;
          const yRot = ymin / GEMINI_BOX_SCALE;
          const wRot = (xmax - xmin) / GEMINI_BOX_SCALE;
          const hRot = (ymax - ymin) / GEMINI_BOX_SCALE;

          if (wRot >= 0.005 && hRot >= 0.005) {
            // Invert 90° CW rotation: x_orig=yRot, y_orig=1-xRot-wRot, w_orig=hRot, h_orig=wRot
            const x = Math.max(0, yRot);
            const y = Math.max(0, 1 - xRot - wRot);
            const width = hRot;
            const height = wRot;
            results.push({
              title: label,
              boundingBox: {
                x,
                y,
                width: Math.min(width, 1 - x),
                height: Math.min(height, 1 - y),
              },
            });
            continue;
          }
        }

        results.push({ title: label });
      }

      return results;
    } catch (error) {
      this.logger.error('Gemini spine-out detection failed', error);
      return [];
    }
  }
}
