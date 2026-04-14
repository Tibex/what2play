import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AiRecommendationService,
  AiRerankContext,
} from './ai-recommendation.service';

type MinimalCandidate = {
  game: {
    id: string;
    title: string;
    bggRating?: number;
    playingTime?: number;
    weight?: number;
    minPlayers?: number;
    maxPlayers?: number;
  };
  score: number;
  explanation: Record<string, string>;
};

function makeCandidate(
  id: string,
  title: string,
  score = 10,
): MinimalCandidate {
  return {
    game: {
      id,
      title,
      bggRating: 7.5,
      playingTime: 60,
      weight: 2.5,
      minPlayers: 2,
      maxPlayers: 4,
    },
    score,
    explanation: {},
  };
}

const context: AiRerankContext = { playerCount: 4, durationMinutes: 90 };

describe('AiRecommendationService', () => {
  let service: AiRecommendationService;
  let mockCreate: jest.Mock;

  function buildModule(hasKey: boolean) {
    mockCreate = jest.fn();
    return Test.createTestingModule({
      providers: [
        AiRecommendationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ANTHROPIC_API_KEY')
                return hasKey ? 'fake-key' : undefined;
              return undefined;
            }),
          },
        },
      ],
    }).compile();
  }

  afterEach(() => jest.clearAllMocks());

  describe('when API key is missing', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule(false);
      service = module.get(AiRecommendationService);
    });

    it('returns candidates unchanged', async () => {
      const candidates = [makeCandidate('a', 'Catan')];
      const result = await service.rerankCandidates(candidates, context);
      expect(result).toEqual(candidates);
    });
  });

  describe('when AI is enabled and configured', () => {
    beforeEach(async () => {
      const module: TestingModule = await buildModule(true);
      service = module.get(AiRecommendationService);
      (service as any).client = { messages: { create: mockCreate } };
    });

    it('re-orders candidates based on AI rank response', async () => {
      const candidates = [
        makeCandidate('id-a', 'Game A', 20),
        makeCandidate('id-b', 'Game B', 18),
        makeCandidate('id-c', 'Game C', 15),
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 'id-c', rank: 1, reason: 'Best player count fit' },
              { id: 'id-a', rank: 2, reason: 'High BGG rating' },
              { id: 'id-b', rank: 3, reason: 'Good complexity match' },
            ]),
          },
        ],
      });

      const result = await service.rerankCandidates(candidates, context);

      expect(result[0].game.id).toBe('id-c');
      expect(result[1].game.id).toBe('id-a');
      expect(result[2].game.id).toBe('id-b');
    });

    it('injects ai_reason into explanation on success', async () => {
      const candidates = [
        makeCandidate('id-x', 'Terra Mystica', 10),
        makeCandidate('id-y', 'Splendor', 9),
      ];

      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 'id-x', rank: 1, reason: 'Perfect complexity match' },
              { id: 'id-y', rank: 2, reason: 'Fast setup time' },
            ]),
          },
        ],
      });

      const result = await service.rerankCandidates(candidates, context);

      expect(result[0].explanation['ai_reason']).toBe(
        'Perfect complexity match',
      );
      expect(result[1].explanation['ai_reason']).toBe('Fast setup time');
    });

    it('falls back to original order when AI returns invalid JSON', async () => {
      const candidates = [
        makeCandidate('a', 'Catan'),
        makeCandidate('b', 'Agricola'),
      ];
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json' }],
      });

      const result = await service.rerankCandidates(candidates, context);
      expect(result).toEqual(candidates);
    });

    it('falls back to original order when AI returns fewer than 2 valid entries', async () => {
      const candidates = [
        makeCandidate('a', 'Catan'),
        makeCandidate('b', 'Agricola'),
      ];
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([{ id: 'a', rank: 1, reason: 'ok' }]),
          },
        ],
      });

      const result = await service.rerankCandidates(candidates, context);
      expect(result).toEqual(candidates);
    });

    it('ignores AI-returned ids not present in input', async () => {
      const candidates = [
        makeCandidate('id-real', 'Real Game', 10),
        makeCandidate('id-real2', 'Real Game 2', 9),
      ];
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { id: 'id-hallucinated', rank: 1, reason: 'Invented game' },
              { id: 'id-real', rank: 2, reason: 'Actual game' },
              { id: 'id-real2', rank: 3, reason: 'Another real game' },
            ]),
          },
        ],
      });

      const result = await service.rerankCandidates(candidates, context);
      // Only valid ids included — id-hallucinated is dropped
      const ids = result.map((c) => c.game.id);
      expect(ids).not.toContain('id-hallucinated');
      expect(ids).toContain('id-real');
      expect(ids).toContain('id-real2');
    });

    it('returns empty array unchanged', async () => {
      const result = await service.rerankCandidates([], context);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
