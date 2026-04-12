import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

// Downscale images to this width before sending to Claude.
// 1536 keeps ~4× more detail than 1024 for dense shelves (each game box ~40px wide
// vs ~25px) with only a modest token increase.
const MAX_IMAGE_WIDTH = 1536;

// Sonnet localizes in batches of this size — smaller batches = less attention dilution
// across a dense shelf.
const LOCALIZE_BATCH_SIZE = 8;

// Must match DETECTION_COLORS in ShelfParseReview.tsx
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

/**
 * Lowercase and strip punctuation, returning an array of tokens.
 * Used for fuzzy title matching between Sonnet output and canonical batch titles.
 */
function normalizeTitle(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Token overlap ratio: intersection size / max(a.length, b.length).
 * Returns a value in [0, 1]. Returns 0 if either token list is empty.
 */
function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const intersection = b.filter((t) => setA.has(t)).length;
  return intersection / Math.max(a.length, b.length);
}

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

  get isAvailable(): boolean {
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
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || metadata.width <= MAX_IMAGE_WIDTH) {
      return {
        buffer: imageBuffer,
        width: metadata.width ?? MAX_IMAGE_WIDTH,
        height: metadata.height ?? MAX_IMAGE_WIDTH,
        mediaType,
      };
    }
    const buffer = await sharp(imageBuffer)
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

  // Pass 1: Opus detects all game titles from the image (no coordinates).
  // Separating detection from localization improves recall significantly.
  private async detectTitles(
    imageData: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<string[]> {
    if (!this.client) return [];
    const response = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: `You are an expert at identifying board games on shelves.

Scan this image shelf by shelf — top to bottom, left to right within each row.
Board games appear in many orientations:
- Cover facing forward (title clearly visible)
- Spine out (only the narrow spine shows the title — read it rotated)
- Stacked horizontally with cover on top
- Tilted or partially behind another box

Pay special attention to games visible spine-out — the spine text may be rotated 90° or 180°.

For EACH game you find, note its title EXACTLY as printed on the box or spine.

Common misses to watch for: games tucked at shelf ends, small boxes in front of large ones, expansion boxes, games without spine labels (check covers).

Exclude titles that are clearly NOT a board game box: price tags, shelf labels, decorations, books, or other non-game items.

Return ONLY a JSON array of titles — no commentary, no numbering:
["Title 1", "Title 2", "Title 3"]

Be exhaustive. A false positive is better than a missed game. However, skip obvious non-box items (barcodes, store labels, stickers).
If no games are found: []`,
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
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];
      const nonGamePatterns = [
        /^\d+[.,]\d+$/,
        /^[\d\s\-/]+$/,
        /^(sale|price|label|tag|sticker)$/i,
      ];
      return parsed.filter(
        (t): t is string =>
          typeof t === 'string' &&
          t.length > 0 &&
          t.length < 100 &&
          !nonGamePatterns.some((p) => p.test(t.trim())),
      );
    } catch {
      return [];
    }
  }

  // Pass 2: Sonnet locates each title's bounding box in pixel coords, batched to
  // avoid attention dilution across a dense shelf.
  private async localizeTitles(
    imageData: string,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
    titles: string[],
    imgWidth: number,
    imgHeight: number,
  ): Promise<
    Array<{
      title: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>
  > {
    if (!this.client || titles.length === 0) return [];

    // Build batches upfront, then fire all Sonnet calls in parallel
    const batches: Array<{ offset: number; titles: string[] }> = [];
    for (let i = 0; i < titles.length; i += LOCALIZE_BATCH_SIZE) {
      batches.push({
        offset: i,
        titles: titles.slice(i, i + LOCALIZE_BATCH_SIZE),
      });
    }

    const TOKEN_OVERLAP_THRESHOLD = 0.3;

    const parseBatch = async (
      offset: number,
      batch: string[],
    ): Promise<
      Array<{
        title: string;
        x: number;
        y: number;
        width: number;
        height: number;
      }>
    > => {
      const list = batch.map((t, j) => `${offset + j + 1}. ${t}`).join('\n');
      let response;
      try {
        response = await this.client!.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: imageData,
                  },
                },
                {
                  type: 'text',
                  text: `This image is ${imgWidth}×${imgHeight} pixels and shows a shelf of board games.
Locate the bounding box of each game box listed below.

Games to locate:
${list}

Return PIXEL coordinates (integer values):
- x, y: top-left corner of the physical cardboard box
- width, height: size of the physical box in pixels

Rules:
- Measure the full cardboard box edges — NOT just the printed title or logo area
- For spine-out games, the box is very narrow (width may be only 20-60px)
- Each game gets its own entry; do not merge neighbouring boxes
- If a game cannot be found, set all values to 0
- Copy the title field EXACTLY from the provided list — do not paraphrase or rewrite.

Return ONLY a JSON array in the same order as the list:
[{"title":"Game Name","x":120,"y":45,"width":80,"height":220}]`,
                },
              ],
            },
          ],
        });
      } catch (err) {
        this.logger.warn(
          `Localization batch ${offset}–${offset + batch.length} failed`,
          err,
        );
        return [];
      }

      const text =
        response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : '';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];

      try {
        const parsed = JSON.parse(match[0]) as unknown;
        if (!Array.isArray(parsed)) return [];

        const results: Array<{
          title: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];

        // Pre-compute normalized tokens for every batch title (for fuzzy fallback)
        const batchTokens = batch.map(normalizeTitle);

        for (let j = 0; j < parsed.length; j++) {
          const item = parsed[j];
          if (
            item === null ||
            typeof item !== 'object' ||
            typeof (item as Record<string, unknown>).x !== 'number' ||
            typeof (item as Record<string, unknown>).y !== 'number' ||
            typeof (item as Record<string, unknown>).width !== 'number' ||
            typeof (item as Record<string, unknown>).height !== 'number'
          ) {
            continue;
          }

          const r = item as Record<string, unknown>;
          const parsedTitle = typeof r.title === 'string' ? r.title : '';

          // --- Index-aligned matching with fuzzy fallback ---
          let canonicalTitle: string | null = null;

          if (j < batch.length) {
            // Primary: use the batch slot at the same index
            const parsedTokens = normalizeTitle(parsedTitle);
            const slotTokens = batchTokens[j];
            if (
              tokenOverlap(parsedTokens, slotTokens) >= TOKEN_OVERLAP_THRESHOLD
            ) {
              // Sanity check passed — use the canonical batch title
              canonicalTitle = batch[j];
            } else {
              // Sanity check failed — try fuzzy match across all batch titles
              let bestScore = 0;
              let bestIdx = -1;
              for (let k = 0; k < batch.length; k++) {
                const score = tokenOverlap(parsedTokens, batchTokens[k]);
                if (score > bestScore) {
                  bestScore = score;
                  bestIdx = k;
                }
              }
              if (bestScore >= TOKEN_OVERLAP_THRESHOLD && bestIdx !== -1) {
                canonicalTitle = batch[bestIdx];
              }
              // else: no match found — skip this item
            }
          } else {
            // Index out of range — try fuzzy match across all batch titles
            const parsedTokens = normalizeTitle(parsedTitle);
            let bestScore = 0;
            let bestIdx = -1;
            for (let k = 0; k < batch.length; k++) {
              const score = tokenOverlap(parsedTokens, batchTokens[k]);
              if (score > bestScore) {
                bestScore = score;
                bestIdx = k;
              }
            }
            if (bestScore >= TOKEN_OVERLAP_THRESHOLD && bestIdx !== -1) {
              canonicalTitle = batch[bestIdx];
            }
            // else: no match found — skip this item
          }

          if (canonicalTitle === null) continue;

          results.push({
            title: canonicalTitle,
            x: (r.x as number) / imgWidth,
            y: (r.y as number) / imgHeight,
            width: (r.width as number) / imgWidth,
            height: (r.height as number) / imgHeight,
          });
        }

        return results;
      } catch {
        return [];
      }
    };

    // All batches run in parallel — reduces wall time from N×5s to ~5s
    const batchResults = await Promise.all(
      batches.map(({ offset, titles: batch }) => parseBatch(offset, batch)),
    );

    return batchResults.flat();
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
    if (!this.client) return [];
    try {
      const {
        buffer: resizedBuffer,
        width: resizedWidth,
        height: resizedHeight,
        mediaType: resizedMediaType,
      } = await this.resizeImage(imageBuffer, mediaType);
      const imageData = resizedBuffer.toString('base64');

      // Two-pass: detect titles first (Opus), then localize each one (Sonnet, batched)
      const titles = await this.detectTitles(imageData, resizedMediaType);
      if (titles.length === 0) return [];

      const locations = await this.localizeTitles(
        imageData,
        resizedMediaType,
        titles,
        resizedWidth,
        resizedHeight,
      );

      // Build a title→box lookup from the localization pass.
      // Since localizeTitles now returns canonical batch titles, lookups will always hit
      // when a box was successfully matched.
      const boxByTitle = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      for (const loc of locations) {
        const box = this.clampBoundingBox(loc);
        if (box.width > 0.005 && box.height > 0.005) {
          boxByTitle.set(loc.title.toLowerCase(), box);
        }
      }

      return titles.map((title) => ({
        title,
        boundingBox: boxByTitle.get(title.toLowerCase()),
      }));
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
    const metadata = await sharp(imageBuffer).metadata();
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
          ` fill="${color}" fill-opacity="0.18"` +
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

    return sharp(imageBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  /**
   * Clamps normalized bounding box coordinates into the valid 0-1 range.
   * Claude occasionally returns values slightly over 1 or negative — clipping
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
