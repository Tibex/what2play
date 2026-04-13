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

      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: finalMediaType,
            data: buffer.toString('base64'),
          },
        },
        {
          text: `You are an expert at identifying board games on shelves.

Scan this image systematically -- shelf by shelf, top to bottom, left to right within each row. Do not skip any row.

Board games appear in many orientations:
- Face-out: full box cover visible (title on front face)
- Spine-out: only narrow spine visible -- read text rotated 90 or 180 degrees
- Stacked horizontally: cover face on top
- Partially hidden: tucked behind another box or at frame edge

For EACH game box you can identify, return an object with:
- "label": exact title as printed on the box or spine (best guess if partially obscured)
- "box_2d": [ymin, xmin, ymax, xmax] where each value is an integer 0-1000 representing
  the fraction of image height/width multiplied by 1000.
  Measure the FULL physical cardboard box -- not just the title text or logo area.

Return ONLY a JSON array -- no explanation, no markdown:
[{"label":"Wingspan","box_2d":[340,120,560,250]},{"label":"Catan","box_2d":[340,270,560,390]}]

Rules:
- Be exhaustive -- a missed game is worse than a slightly imprecise box
- Every shelf row must be checked, including top and bottom shelves
- Spine text is often rotated -- look carefully for narrow boxes with vertical text
- Expansions and small boxes count
- Skip only clear non-games: price tags, shelf labels, books, ornaments, barcodes
- Return [] only if there are genuinely no game boxes in the image`,
        },
      ]);

      const text = result.response.text().trim();
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
}
