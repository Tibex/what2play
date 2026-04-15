import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeVisionService } from './claude-vision.service';

// Access private methods for unit testing via any-cast
type ServicePrivate = {
  buildTileRegions(aspectRatio: number): Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  adjustDetectionsForTile<
    T extends {
      boundingBox?: { x: number; y: number; width: number; height: number };
      polygon?: Array<[number, number]>;
    },
  >(
    items: T[],
    tile: { x: number; y: number; width: number; height: number },
  ): T[];
  deduplicateTileDetections<
    T extends {
      detectionConfidence?: number;
      boundingBox?: { x: number; y: number; width: number; height: number };
    },
  >(
    items: T[],
  ): T[];
};

describe('ClaudeVisionService — tiling helpers', () => {
  let service: ClaudeVisionService;
  let priv: ServicePrivate;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ClaudeVisionService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) }, // no API key → client stays null
        },
      ],
    }).compile();

    service = module.get(ClaudeVisionService);
    priv = service as unknown as ServicePrivate;
  });

  // ── buildTileRegions ─────────────────────────────────────────────────────────

  describe('buildTileRegions', () => {
    it('returns 1 tile for aspect ratio < 1.8 (portrait / square)', () => {
      const tiles = priv.buildTileRegions(1.5);
      expect(tiles).toHaveLength(1);
      expect(tiles[0]).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    });

    it('returns exactly 1 tile at exactly 1.0', () => {
      expect(priv.buildTileRegions(1.0)).toHaveLength(1);
    });

    it('returns 2 tiles for aspect ratio 2.0', () => {
      expect(priv.buildTileRegions(2.0)).toHaveLength(2);
    });

    it('returns 2 tiles for aspect ratio 2.9 (just below 3.0 threshold)', () => {
      expect(priv.buildTileRegions(2.9)).toHaveLength(2);
    });

    it('returns 3 tiles for aspect ratio 3.5', () => {
      expect(priv.buildTileRegions(3.5)).toHaveLength(3);
    });

    it('returns 4 tiles for aspect ratio 5.0', () => {
      expect(priv.buildTileRegions(5.0)).toHaveLength(4);
    });

    it('tiles cover the full width (first starts at 0, last ends at 1)', () => {
      for (const ratio of [2.0, 3.5, 5.0]) {
        const tiles = priv.buildTileRegions(ratio);
        const first = tiles[0];
        const last = tiles[tiles.length - 1];
        expect(first.x).toBeCloseTo(0, 5);
        expect(last.x + last.width).toBeCloseTo(1, 2);
      }
    });

    it('adjacent tiles overlap (each pair shares area)', () => {
      const tiles = priv.buildTileRegions(3.5); // 3 tiles
      for (let i = 0; i < tiles.length - 1; i++) {
        const a = tiles[i];
        const b = tiles[i + 1];
        // b starts before a ends → overlap
        expect(b.x).toBeLessThan(a.x + a.width);
      }
    });
  });

  // ── adjustDetectionsForTile ──────────────────────────────────────────────────

  describe('adjustDetectionsForTile', () => {
    it('transforms bounding box from tile-local to full-image coordinates', () => {
      const tile = { x: 0.4, y: 0, width: 0.6, height: 1 };
      // A box centred in the tile at (0.5, 0.5) with 10% width/height
      const item = {
        boundingBox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
        detectionConfidence: 0.9,
      };
      const [adjusted] = priv.adjustDetectionsForTile([item], tile);
      const bb = adjusted.boundingBox;
      // x: 0.4 + 0.5 * 0.6 = 0.70
      expect(bb.x).toBeCloseTo(0.7, 5);
      // y: 0 + 0.5 * 1 = 0.5
      expect(bb.y).toBeCloseTo(0.5, 5);
      // width: 0.1 * 0.6 = 0.06
      expect(bb.width).toBeCloseTo(0.06, 5);
      // height: 0.1 * 1 = 0.1
      expect(bb.height).toBeCloseTo(0.1, 5);
    });

    it('transforms polygon points the same way', () => {
      const tile = { x: 0.0, y: 0.5, width: 1.0, height: 0.5 };
      const item = {
        polygon: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ] as Array<[number, number]>,
        detectionConfidence: 0.8,
      };
      const [adjusted] = priv.adjustDetectionsForTile([item], tile);
      // Tile covers bottom half of the image: y offset 0.5, height fraction 0.5
      const poly = adjusted.polygon;
      expect(poly[0]).toEqual([0, 0.5]); // TL: [0+0*1, 0.5+0*0.5]
      expect(poly[2]).toEqual([1, 1]); // BR: [0+1*1, 0.5+1*0.5]
    });

    it('keeps entries without a bounding box unchanged', () => {
      const tile = { x: 0.5, y: 0, width: 0.5, height: 1 };
      const item = { detectionConfidence: 0.7 }; // no boundingBox
      const [adjusted] = priv.adjustDetectionsForTile([item], tile);
      expect(adjusted.boundingBox).toBeUndefined();
    });
  });

  // ── deduplicateTileDetections ────────────────────────────────────────────────

  describe('deduplicateTileDetections', () => {
    it('keeps both boxes when they do not overlap', () => {
      const items = [
        {
          boundingBox: { x: 0, y: 0, width: 0.2, height: 0.2 },
          detectionConfidence: 0.9,
        },
        {
          boundingBox: { x: 0.5, y: 0.5, width: 0.2, height: 0.2 },
          detectionConfidence: 0.8,
        },
      ];
      const result = priv.deduplicateTileDetections(items);
      expect(result).toHaveLength(2);
    });

    it('keeps only the higher-confidence box when IoU >= 0.30', () => {
      // Two nearly identical boxes (IoU ~1.0) — one has higher confidence
      const items = [
        {
          boundingBox: { x: 0.0, y: 0.0, width: 0.3, height: 0.3 },
          detectionConfidence: 0.6, // lower
        },
        {
          boundingBox: { x: 0.0, y: 0.0, width: 0.3, height: 0.3 },
          detectionConfidence: 0.9, // higher
        },
      ];
      const result = priv.deduplicateTileDetections(items);
      expect(result).toHaveLength(1);
      expect(result[0].detectionConfidence).toBe(0.9);
    });

    it('keeps both when IoU is exactly below 0.30', () => {
      // Two boxes that barely miss the IoU threshold
      const items = [
        {
          boundingBox: { x: 0.0, y: 0, width: 0.4, height: 1 },
          detectionConfidence: 0.9,
        },
        {
          boundingBox: { x: 0.7, y: 0, width: 0.3, height: 1 }, // no overlap at all
          detectionConfidence: 0.8,
        },
      ];
      const result = priv.deduplicateTileDetections(items);
      expect(result).toHaveLength(2);
    });

    it('keeps items with no bounding box (OCR-only entries)', () => {
      const items = [
        { detectionConfidence: 0.7 }, // no boundingBox
        { detectionConfidence: 0.8 }, // no boundingBox
      ];
      const result = priv.deduplicateTileDetections(items);
      expect(result).toHaveLength(2);
    });
  });
});
