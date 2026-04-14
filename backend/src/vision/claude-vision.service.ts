import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages';
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

/** Forced tool name — avoids fragile JSON.parse on free-form model text. */
const SHELF_GAMES_TOOL_NAME = 'report_shelf_games';

const SHELF_GAMES_TOOL: Tool = {
  name: SHELF_GAMES_TOOL_NAME,
  description:
    'Report every board game box detected on the shelf photo. Call once when the scan is complete.',
  input_schema: {
    type: 'object',
    properties: {
      games: {
        type: 'array',
        description:
          'All detected boxes, shelf by shelf (include spine-out and partially hidden).',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            edition_or_version: { type: 'string' },
            ocr_text: { type: 'string' },
            detection_confidence: { type: 'number' },
            game_confidence: { type: 'number' },
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  confidence: { type: 'number' },
                },
                required: ['title', 'confidence'],
              },
            },
            occlusion_level: {
              type: 'string',
              enum: ['none', 'low', 'medium', 'high'],
            },
            polygon: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: {
                type: 'array',
                minItems: 2,
                maxItems: 2,
                items: { type: 'number' },
              },
            },
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
          required: ['title'],
        },
      },
    },
    required: ['games'],
  },
};

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

  private isJunkClaudeShelfTitle(title: string): boolean {
    const t = title.replace(/\s+/g, ' ').trim();
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
    knownGames: string[] = [],
  ): Promise<
    Array<{
      title: string;
      editionOrVersion?: string;
      ocrText?: string;
      detectionConfidence?: number;
      gameConfidence?: number;
      candidates?: Array<{ title: string; confidence: number }>;
      occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
      boundingBox?: { x: number; y: number; width: number; height: number };
      polygon?: Array<[number, number]>;
    }>
  > {
    if (!this.client) return [];
    try {
      const { buffer: resizedBuffer, mediaType: resizedMediaType } =
        await this.resizeImage(imageBuffer, mediaType);
      const imageData = resizedBuffer.toString('base64');

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        tools: [SHELF_GAMES_TOOL],
        tool_choice: {
          type: 'tool',
          name: SHELF_GAMES_TOOL_NAME,
          disable_parallel_tool_use: true,
        },
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

STEP 1 -- Spine-out games (most commonly missed):
Many games are stored spine-out, like books on a bookshelf. They appear as narrow vertical strips (roughly 1-6% of image width) with the game title running along the spine, rotated 90 or 180 degrees. Before doing a full scan, sweep each shelf specifically for narrow strips with vertical text -- every such strip is almost certainly a game spine.

STEP 2 -- Full shelf scan:
Scan systematically, shelf by shelf, top to bottom, left to right within each row. Do not skip any row.

Board games appear in several orientations:
- Spine-out: narrow strip, title rotated 90 or 180 degrees -- PRIORITIZE finding these (Step 1)
- Face-out: full box cover visible (title on the front face)
- Stacked horizontally: box lying flat, cover face up
- Partially obscured: tucked behind another box or cut off at the image edge

For EACH game box you identify, return an object with:
- "title": best-guess title as printed on the box or spine. If the title is completely unreadable, omit that game entirely from the tool output (no placeholder titles).
- "edition_or_version": edition, version, or variant name if identifiable (e.g. "Legacy Season 1", "Big Box", "2nd Edition"); null otherwise
- "ocr_text": ALL text you can read verbatim from the box or spine, space-separated
- "detection_confidence": 0.0-1.0 — how certain you are this object IS a board game box
- "game_confidence": 0.0-1.0 — how certain you are about the title identity
- "candidates": when game_confidence < 0.85, list up to 3 alternatives as [{"title":"...","confidence":0.N}]; omit or use [] when confident
- "occlusion_level": how much of the box is hidden — "none", "low" (<25% hidden), "medium" (25-60%), or "high" (>60%)
- "polygon": 4 clockwise corner points [TL, TR, BR, BL] as [[x,y],[x,y],[x,y],[x,y]], normalized 0.0-1.0; tightly outline the physical box including any rotation or skew
- "x": left edge of the full physical cardboard box as a fraction of image width (0.0-1.0)
- "y": top edge of the full physical cardboard box as a fraction of image height (0.0-1.0)
- "width": box width as a fraction of image width (0.0-1.0)
- "height": box height as a fraction of image height (0.0-1.0)

Coordinates must describe the FULL physical cardboard box -- not just the title text, logo, or label.
For spine-out boxes width will be small (0.01-0.06), height will be larger, and the polygon will reflect the narrow vertical shape.

NON-OVERLAPPING PHYSICAL BOXES: each tool entry is ONE physical cardboard box. Rectangles/polygons for different games must not overlap in the image (edge contact is OK; shared interior area is NOT). If unsure whether two regions are one box or two, prefer a single tighter box. Never draw one giant rectangle around an entire shelf cubby that contains multiple distinct games.
${knownGames.length > 0 ? `\nKnown games in this collection (soft hints for title matching — not an exclusive list):\n${JSON.stringify(knownGames.slice(0, 150))}\n` : ''}
When your scan is complete, call the tool "${SHELF_GAMES_TOOL_NAME}" exactly once with { "games": [ ... ] }. Do not put a raw JSON array in plain assistant text and do not use markdown fences.

Rules:
- Include items you are reasonably confident are a board game, card game, or tabletop expansion (including small boxes). Skip ambiguous blobs, decor, and unclear packaging.
- Include partially hidden boxes only when you can read enough of the title/art to name the game; otherwise omit.
- Prefer precise, non-overlapping boxes over maximizing recall — do not invent games.
- Do NOT include: books (look for author names, ISBNs, novel-style covers), magazines, DVDs, decorative objects, price tags, or shelf labels
- For spine-only items: include if it has game-style art or a recognizable game/expansion title; skip only if clearly a novel, magazine, or DVD
- Check every shelf row including top and bottom
- Return the COMPLETE title as printed. A word may appear large as a design choice — read ALL text on the box/spine (e.g. if "SLAY" is prominent but the box says "Here to Slay", return "Here to Slay", not "Slay" or "Slay the Spire")
- If there are no game boxes, call the tool with { "games": [] }`,
              },
            ],
          },
        ],
      });

      let parsed: unknown[] | null = null;
      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === SHELF_GAMES_TOOL_NAME) {
          const input = block.input;
          if (input && typeof input === 'object') {
            const games = (input as Record<string, unknown>).games;
            if (Array.isArray(games)) {
              parsed = games;
              break;
            }
          }
        }
      }
      if (!parsed) {
        let joined = '';
        for (const block of response.content) {
          if (block.type === 'text') joined += `${block.text}\n`;
        }
        parsed = this.parseShelfGamesJsonFromText(joined.trim());
      }
      if (!parsed) return [];

      const results: Array<{
        title: string;
        editionOrVersion?: string;
        ocrText?: string;
        detectionConfidence?: number;
        gameConfidence?: number;
        candidates?: Array<{ title: string; confidence: number }>;
        occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
        boundingBox?: { x: number; y: number; width: number; height: number };
        polygon?: Array<[number, number]>;
      }> = [];

      for (const item of parsed) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r.title !== 'string' || r.title.trim().length === 0)
          continue;

        const title = r.title.replace(/\s+/g, ' ').trim();
        if (title.length >= 100) continue;
        if (this.isJunkClaudeShelfTitle(title)) continue;

        const editionOrVersion =
          typeof r.edition_or_version === 'string'
            ? r.edition_or_version.trim() || undefined
            : undefined;

        const ocrText =
          typeof r.ocr_text === 'string'
            ? r.ocr_text.trim() || undefined
            : undefined;

        const clampConf = (v: unknown): number | undefined =>
          typeof v === 'number' ? Math.max(0, Math.min(1, v)) : undefined;
        const detectionConfidence = clampConf(r.detection_confidence);
        const gameConfidence = clampConf(r.game_confidence);
        if (detectionConfidence !== undefined && detectionConfidence < 0.38)
          continue;
        if (gameConfidence !== undefined && gameConfidence < 0.32) continue;

        const OCCLUSION_LEVELS = ['none', 'low', 'medium', 'high'] as const;
        const occlusionLevel = OCCLUSION_LEVELS.includes(
          r.occlusion_level as (typeof OCCLUSION_LEVELS)[number],
        )
          ? (r.occlusion_level as 'none' | 'low' | 'medium' | 'high')
          : undefined;

        const candidates = Array.isArray(r.candidates)
          ? (r.candidates as unknown[])
              .filter(
                (c): c is { title: string; confidence: number } =>
                  c !== null &&
                  typeof c === 'object' &&
                  typeof (c as Record<string, unknown>).title === 'string' &&
                  typeof (c as Record<string, unknown>).confidence === 'number',
              )
              .slice(0, 3)
          : undefined;

        const rawPolygon = Array.isArray(r.polygon) ? r.polygon : null;
        const polygon =
          rawPolygon && rawPolygon.length === 4
            ? this.clampPolygon(
                rawPolygon.map((pt: unknown) =>
                  Array.isArray(pt) && pt.length >= 2
                    ? ([Number(pt[0]), Number(pt[1])] as [number, number])
                    : ([0, 0] as [number, number]),
                ),
              )
            : undefined;

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
          results.push({
            title,
            editionOrVersion,
            ocrText,
            detectionConfidence,
            gameConfidence,
            candidates,
            occlusionLevel,
            polygon,
          });
          continue;
        }

        results.push({
          title,
          editionOrVersion,
          ocrText,
          detectionConfidence,
          gameConfidence,
          candidates,
          occlusionLevel,
          boundingBox,
          polygon,
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Claude vision detection failed', error);
      return [];
    }
  }

  /**
   * Fallback when the model returns plain JSON in text instead of a tool call.
   */
  private parseShelfGamesJsonFromText(text: string): unknown[] | null {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const normalized = match[0]
      .replace(/([^\d])\.([0-9])/g, '$10.$2')
      .replace(/^\./gm, '0.');
    try {
      const parsed = JSON.parse(normalized) as unknown;
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
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
      polygon?: Array<[number, number]>;
    }>,
  ): Promise<Buffer> {
    const base = await sharp(imageBuffer).rotate().toBuffer();
    const metadata = await sharp(base).metadata();
    const imgWidth = metadata.width ?? 1000;
    const imgHeight = metadata.height ?? 1000;

    // Badge size scales with image so it's readable on both low and high-res photos
    const badgeR = Math.max(12, Math.round(imgWidth * 0.012));
    const fontSize = Math.max(11, Math.round(badgeR * 0.9));
    const strokeWidth = Math.max(3, Math.round(imgWidth * 0.0035));
    const haloStrokeWidth = Math.max(1, Math.round(strokeWidth * 0.45));

    const shapes = candidates
      .filter(
        (c) =>
          c.boundingBox &&
          c.boundingBox.width > 0.005 &&
          c.boundingBox.height > 0.005,
      )
      .map((c) => {
        const { x, y, width, height } = c.boundingBox!;
        const px = Math.max(
          0,
          Math.min(imgWidth - 2, Math.round(x * imgWidth)),
        );
        const py = Math.max(
          0,
          Math.min(imgHeight - 2, Math.round(y * imgHeight)),
        );
        const pw = Math.max(
          2,
          Math.min(imgWidth - px, Math.round(width * imgWidth)),
        );
        const ph = Math.max(
          2,
          Math.min(imgHeight - py, Math.round(height * imgHeight)),
        );
        const color =
          ANNOTATION_COLORS[(c.detectionNumber - 1) % ANNOTATION_COLORS.length];
        const n = c.detectionNumber;
        const badgeCx = px + badgeR + 4;
        const badgeCy = py + badgeR + 4;
        const corner = Math.max(4, Math.round(Math.min(pw, ph) * 0.06));
        const inset = Math.max(1, Math.round(strokeWidth * 0.5));
        const innerW = Math.max(1, pw - inset * 2);
        const innerH = Math.max(1, ph - inset * 2);

        // Render clean axis-aligned rectangles so outlines match physical game boxes.
        const outline =
          `<rect x="${px}" y="${py}" width="${pw}" height="${ph}"` +
          ` fill="${color}" fill-opacity="0.08"` +
          ` stroke="${color}" stroke-width="${strokeWidth}" rx="${corner}"/>` +
          `<rect x="${px + inset}" y="${py + inset}" width="${innerW}" height="${innerH}"` +
          ` fill="none" stroke="rgba(255,255,255,0.75)"` +
          ` stroke-width="${haloStrokeWidth}" rx="${Math.max(2, corner - inset)}"/>`;

        return (
          outline +
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

  /** Clamps each point of a 4-corner polygon into the valid 0-1 range. */
  private clampPolygon(
    polygon: Array<[number, number]>,
  ): Array<[number, number]> {
    const clamp = (v: number): number => Math.max(0, Math.min(1, v));
    return polygon.map(([x, y]) => [clamp(x), clamp(y)]);
  }
}
