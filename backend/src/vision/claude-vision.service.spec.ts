import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ClaudeVisionService } from './claude-vision.service';

/**
 * Tests for normalizeTitle and tokenOverlap (indirect).
 *
 * Both are unexported module-level functions in claude-vision.service.ts.
 * They are exercised through ClaudeVisionService.detectBoardGames, which
 * calls localizeTitles — the step that uses tokenOverlap to map Sonnet
 * responses back to canonical batch titles.
 *
 * The mock Anthropic client makes localizeTitles return pixel coordinates
 * relative to a 1×1 image (imgWidth=1, imgHeight=1). To survive the
 * clampBoundingBox step (which computes width=min(w,1-x)), we use x=0, y=0,
 * width=1, height=1 so that the clamped box has non-zero dimensions.
 */
describe('ClaudeVisionService — normalizeTitle / tokenOverlap (indirect)', () => {
  let service: ClaudeVisionService;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    mockCreate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeVisionService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('fake-api-key') },
        },
      ],
    }).compile();

    service = module.get<ClaudeVisionService>(ClaudeVisionService);

    // Inject a fake Anthropic client so no real HTTP calls are made.

    (service as any).client = { messages: { create: mockCreate } };
  });

  afterEach(() => jest.clearAllMocks());

  /** Build a minimal valid 1×1 JPEG buffer for tests. */
  async function makeJpeg(): Promise<Buffer> {
    return sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
  }

  it('preserves canonical title when Sonnet returns paraphrased title with sufficient token overlap', async () => {
    // Opus detection pass returns canonical title.
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '["Ticket to Ride"]' }],
    });

    // Sonnet localization pass returns a slightly paraphrased title.
    // normalizeTitle('Ticket to Ride: Europe') -> ['ticket','to','ride','europe']
    // normalizeTitle('Ticket to Ride')         -> ['ticket','to','ride']
    // tokenOverlap([ticket,to,ride,europe], [ticket,to,ride]) = 3/4 = 0.75 >= 0.3
    // -> canonical title is preserved.
    //
    // Pixel coords x=0,y=0,width=1,height=1 with a 1×1 image (imgWidth=1) give
    // normalized x=0,y=0,width=1,height=1. After clampBoundingBox:
    //   width = min(1, 1-0) = 1 > 0.005 -> box is added to the lookup map.
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            {
              title: 'Ticket to Ride: Europe',
              x: 0,
              y: 0,
              width: 1,
              height: 1,
            },
          ]),
        },
      ],
    });

    const results = await service.detectBoardGames(
      await makeJpeg(),
      'image/jpeg',
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Ticket to Ride');
    // Bounding box resolved from the localization pass confirms normalizeTitle +
    // tokenOverlap successfully matched the paraphrased title to the canonical one.
    expect(results[0].boundingBox).toBeDefined();
  });

  it('drops a localized entry when Sonnet title has zero token overlap with any canonical title', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '["Catan"]' }],
    });

    // 'Monopoly' shares no tokens with 'Catan':
    // normalizeTitle('Monopoly') = ['monopoly'], normalizeTitle('Catan') = ['catan']
    // tokenOverlap([monopoly], [catan]) = 0 < 0.3 -> entry is dropped.
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: JSON.stringify([
            { title: 'Monopoly', x: 0, y: 0, width: 1, height: 1 },
          ]),
        },
      ],
    });

    const results = await service.detectBoardGames(
      await makeJpeg(),
      'image/jpeg',
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Catan');
    // No bounding box because the localization entry was discarded.
    expect(results[0].boundingBox).toBeUndefined();
  });

  it('returns empty array when the Anthropic client is not configured', async () => {
    (service as any).client = null;
    const results = await service.detectBoardGames(
      Buffer.from(''),
      'image/jpeg',
    );
    expect(results).toEqual([]);
  });
});
