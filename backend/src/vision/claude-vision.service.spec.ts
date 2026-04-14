import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { ClaudeVisionService } from './claude-vision.service';

/**
 * Tests for ClaudeVisionService.detectBoardGames single-pass detection.
 *
 * The service makes one Claude API call that returns both game titles and
 * bounding boxes via a tool_use block (report_shelf_games). These tests mock
 * that single call and verify parsing, filtering, and bounding box handling.
 */
describe('ClaudeVisionService — single-pass detection', () => {
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
    (service as any).client = { messages: { create: mockCreate } };
  });

  afterEach(() => jest.clearAllMocks());

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

  it('returns game with bounding box when tool_use response contains valid game data', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'report_shelf_games',
          input: {
            games: [
              {
                title: 'Ticket to Ride',
                x: 0,
                y: 0,
                width: 1,
                height: 1,
                detection_confidence: 0.95,
                game_confidence: 0.92,
              },
            ],
          },
        },
      ],
    });

    const results = await service.detectBoardGames(
      await makeJpeg(),
      'image/jpeg',
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Ticket to Ride');
    expect(results[0].boundingBox).toBeDefined();
    expect(results[0].detectionConfidence).toBe(0.95);
    expect(results[0].gameConfidence).toBe(0.92);
  });

  it('returns game without bounding box when coordinates are absent from response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'report_shelf_games',
          input: {
            games: [
              {
                title: 'Catan',
                detection_confidence: 0.9,
                game_confidence: 0.85,
              },
            ],
          },
        },
      ],
    });

    const results = await service.detectBoardGames(
      await makeJpeg(),
      'image/jpeg',
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Catan');
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
