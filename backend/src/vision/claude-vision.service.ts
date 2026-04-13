import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

// Downscale images to this width before sending to Claude.
// 1536 keeps ~4× more detail than 1024 for dense shelves (each game box ~40px wide
// vs ~25px) with only a modest token increase.
const MAX_IMAGE_WIDTH = 1536;

// Must match SHELF_DETECTION_COLORS in frontend/src/lib/shelfDetectionColors.ts
const ANNOTATION_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f97316', // orange
  '#06b6d4', // cyan
  '#ec4899', // pink
];

@Injectable()
export class ClaudeVisionService {
  private readonly logger = new Logger(ClaudeVisionService.name);
  private client: Anthropic | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY not configured — Claude vision disabled, falling back to OCR only',
      );
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  private async resizeImage(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<{
    buffer: Buffer;
    width: number;
    height: number;
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  }> {
    const oriented = await sharp(imageBuffer).rotate().toBuffer();
    const metadata = await sharp(oriented).metadata();
    if (!metadata.width || metadata.width <= MAX_IMAGE_WIDTH) {
      return {
        buffer: oriented,
        width: metadata.width ?? MAX_IMAGE_WIDTH,
        height: metadata.height ?? MAX_IMAGE_WIDTH,
        mediaType,
      };
    }
    const buffer = await sharp(oriented)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const resized = await sharp(buffer).metadata();
    return {
      buffer,
      width: resized.width ?? MAX_IMAGE_WIDTH,
      height: resized.height ?? MAX_IMAGE_WIDTH,
      mediaType: 'image/jpeg',
    };
  }

  /**
   * Single-pass detection: Opus identifies every game box AND its bounding box
   * in one prompt, returning normalized (0-1) coordinates directly.
   *
   * Previously this was two passes (Opus detects titles then Sonnet localizes each).
   * That caused systematic misalignment because Sonnet was re-finding boxes that
   * Opus already located, often getting wrong coordinates.
   */
  async detectBoardGames(
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
  ): Promise<
    Array<{
      title: string;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>
  > {
    if (!this.client) return [];
    try {
      const { buffer: resizedBuffer, mediaType: resizedMediaType } =
        await this.resizeImage(imageBuffer, mediaType);
      const imageData = resizedBuffer.toString('base64');

      const response = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: resizedMediaType,
                  data: imageData,
                },
              },
              {
                type: 'text',
                text: `You are an expert at identifying board games on shelves.

Scan this image systematically -- shelf by shelf, top to bottom, left to right within each row. Do not skip any row.

Board games appear in many orientations:
- Face-out: full box cover visible (title on front face)
- Spine-out: only narrow spine visible -- read text rotated 90 or 180 degrees
- Stacked horizontally: cover face on top
- Partially hidden: tucked behind another box or cut off at the frame edge

For EACH game box you can identify, return an object with:
- "title": exact title as printed on the box or spine (best guess if partially obscured)
- "x": left edge of the physical cardboard box as a fraction of image width (0.0-1.0)
- "y": top edge of the physical cardboard box as a fraction of image height (0.0-1.0)
- "width": box width as a fraction of image width (0.0-1.0)
- "height": box height as a fraction of image height (0.0-1.0)

Coordinates must describe the FULL physical cardboard box -- not just the title text, logo, or label area.
For spine-out games width will naturally be small (0.01-0.05).

Return ONLY a JSON array -- no explanation, no markdown fences:
[{"title":"Wingspan","x":0.12,"y":0.34,"width":0.13,"height":0.22},{"title":"Catan","x":0.27,"y":0.34,"width":0.12,"height":0.22}]

Important rules:
- Be exhaustive -- a missed game is worse than a slightly imprecise box
- Every shelf row must be checked, including top and bottom shelves
- Spine text is often rotated -- look carefully for narrow boxes with vertical text
- Expansions and small boxes count
- Skip only clear non-games: price tags, shelf labels, books, ornaments, barcodes
- Return [] only if there are genuinely no game boxes in the image`,
              },
            ],
          },
        ],
      });

      const text =
        response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      // Normalize bare decimals like .41 → 0.41 (valid JS but not JSON)
      const normalized = match[0]
        .replace(/([^\d])\.([0-9])/g, '$10.$2')
        .replace(/^\./gm, '0.');
      const parsed = JSON.parse(normalized) as unknown;
      if (!Array.isArray(parsed)) return [];

      const results: Array<{
        title: string;
        boundingBox?: { x: number; y: number; width: number; height: number };
      }> = [];

      for (const item of parsed) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r.title !== 'string' || r.title.trim().length === 0)
          continue;

        const title = r.title.replace(/\s+/g, ' ').trim();
        if (title.length >= 100) continue;

        const hasCoords =
          typeof r.x === 'number' &&
          typeof r.y === 'number' &&
          typeof r.width === 'number' &&
          typeof r.height === 'number';

        const boundingBox = hasCoords
          ? this.clampBoundingBox({
              x: r.x as number,
              y: r.y as number,
              width: r.width as number,
              height: r.height as number,
            })
          : undefined;

        // Skip degenerate boxes (near-zero area) but keep entries with no box at all
        if (
          boundingBox &&
          (boundingBox.width < 0.005 || boundingBox.height < 0.005)
        ) {
          results.push({ title });
          continue;
        }

        results.push({ title, boundingBox });
      }

      return results;
    } catch (error) {
      this.logger.error('Claude vision detection failed', error);
      return [];
    }
  }

  /**
   * Draws numbered bounding-box annotations onto the image using sharp SVG compositing.
   * Returns a JPEG buffer with boxes and badges rendered directly on the photo,
   * eliminating the need for CSS overlay positioning on the frontend.
   */
  async drawAnnotations(
    imageBuffer: Buffer,
    candidates: Array<{
      detectionNumber: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    }>,
  ): Promise<Buffer> {
    const base = await sharp(imageBuffer).rotate().toBuffer();
    const metadata = await sharp(base).metadata();
    const imgWidth = metadata.width ?? 1000;
    const imgHeight = metadata.height ?? 1000;

    // Badge size scales with image so it's readable on both low and high-res photos
    const badgeR = Math.max(12, Math.round(imgWidth * 0.012));
    const fontSize = Math.max(11, Math.round(badgeR * 0.9));
    const strokeWidth = Math.max(2, Math.round(imgWidth * 0.002));

    const shapes = candidates
      .filter(
        (c) =>
          c.boundingBox &&
          c.boundingBox.width > 0.005 &&
          c.boundingBox.height > 0.005,
      )
      .map((c) => {
        const { x, y, width, height } = c.boundingBox!;
        const px = Math.round(x * imgWidth);
        const py = Math.round(y * imgHeight);
        const pw = Math.round(width * imgWidth);
        const ph = Math.round(height * imgHeight);
        const color =
          ANNOTATION_COLORS[(c.detectionNumber - 1) % ANNOTATION_COLORS.length];
        const n = c.detectionNumber;
        const badgeCx = px + badgeR + 4;
        const badgeCy = py + badgeR + 4;

        return (
          `<rect x="${px}" y="${py}" width="${pw}" height="${ph}"` +
          ` fill="${color}" fill-opacity="0.12"` +
          ` stroke="${color}" stroke-width="${strokeWidth}" rx="3"/>` +
          `<circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="${color}"/>` +
          `<text x="${badgeCx}" y="${badgeCy}"` +
          ` text-anchor="middle" dominant-baseline="central"` +
          ` font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold"` +
          ` fill="white">${n}</text>`
        );
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${imgHeight}">${shapes}</svg>`;

    return sharp(base)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Clamps normalized bounding box coordinates into the valid 0-1 range.
   * Claude occasionally returns values slightly over 1 or negative -- clipping
   * prevents misaligned overlays on the frontend.
   */
  private clampBoundingBox(box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number } {
    const clamp = (v: number): number => Math.max(0, Math.min(1, v));
    const x = clamp(box.x);
    const y = clamp(box.y);
    const width = clamp(box.width);
    const height = clamp(box.height);
    return {
      x,
      y,
      width: Math.min(width, 1 - x),
      height: Math.min(height, 1 - y),
    };
  }
}
