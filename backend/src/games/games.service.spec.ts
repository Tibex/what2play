import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GamesService } from './games.service';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';
import { Event } from '../entities/event.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { ConfigService } from '@nestjs/config';
import { GoogleVisionService } from '../vision/google-vision.service';
import { ClaudeVisionService } from '../vision/claude-vision.service';

describe('GamesService', () => {
  let service: GamesService;

  const mockGamesRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    createQueryBuilder: jest.fn(),
  };

  const mockOwnershipRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockRatingsRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
  };

  const mockEventsRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockFeedbackRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockVotesRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockCandidatesRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockConfig = { get: jest.fn() };
  const mockVision = { detectTextBlocks: jest.fn() };
  const mockClaudeVision = {
    detectBoardGames: jest.fn(),
    drawAnnotations: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamesService,
        { provide: getRepositoryToken(Game), useValue: mockGamesRepo },
        {
          provide: getRepositoryToken(UserGameOwnership),
          useValue: mockOwnershipRepo,
        },
        {
          provide: getRepositoryToken(UserGameRating),
          useValue: mockRatingsRepo,
        },
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        {
          provide: getRepositoryToken(EventFeedback),
          useValue: mockFeedbackRepo,
        },
        { provide: getRepositoryToken(EventVote), useValue: mockVotesRepo },
        {
          provide: getRepositoryToken(EventGameCandidate),
          useValue: mockCandidatesRepo,
        },
        { provide: ConfigService, useValue: mockConfig },
        { provide: GoogleVisionService, useValue: mockVision },
        { provide: ClaudeVisionService, useValue: mockClaudeVision },
      ],
    }).compile();

    service = module.get<GamesService>(GamesService);
    jest.clearAllMocks();
  });

  it('updates existing game fields when findOrCreateByBggId is called again', async () => {
    const existingGame = {
      id: 'g-1',
      bggId: 123,
      title: 'Old title',
      minPlayers: 1,
      maxPlayers: 4,
      playingTime: 60,
    };

    mockGamesRepo.findOne.mockResolvedValue(existingGame);
    mockGamesRepo.save.mockImplementation(async (data) => data);

    const updated = await service.findOrCreateByBggId(123, {
      title: 'New title',
      minPlayers: 3,
      maxPlayers: 6,
      playingTime: 180,
    });

    expect(mockGamesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bggId: 123,
        title: 'New title',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
    expect(updated).toEqual(
      expect.objectContaining({
        bggId: 123,
        title: 'New title',
        minPlayers: 3,
        maxPlayers: 6,
        playingTime: 180,
      }),
    );
  });

  describe('isReasonableGameBox', () => {
    it('accepts a normal game box', () => {
      expect(
        (service as any).isReasonableGameBox({
          x: 0.1,
          y: 0.1,
          width: 0.1,
          height: 0.1,
        }),
      ).toBe(true);
    });

    it('accepts a spine-out box (width 0.01, height/width = 10, satisfies spine exception)', () => {
      // width 0.01 >= 0.005 and height/width = 10 >= 3 → spine exception applies
      expect(
        (service as any).isReasonableGameBox({
          x: 0,
          y: 0,
          width: 0.01,
          height: 0.1,
        }),
      ).toBe(true);
    });

    it('accepts a spine-out box (width 0.007, height 0.03 — tall aspect ratio >= 3)', () => {
      // width 0.007 < 0.02, height/width ≈ 4.3 >= 3, width >= 0.005 → spine rule passes
      expect(
        (service as any).isReasonableGameBox({
          x: 0.1,
          y: 0.1,
          width: 0.007,
          height: 0.03,
        }),
      ).toBe(true);
    });

    it('rejects a spine-out box whose width is too tiny (< 0.005)', () => {
      // width 0.003 < 0.005 fails spine exception; height 0.02 < 0.03 also fails height check
      expect(
        (service as any).isReasonableGameBox({
          x: 0,
          y: 0,
          width: 0.003,
          height: 0.02,
        }),
      ).toBe(false);
    });

    it('rejects a box that covers too large a fraction of the image (width > 0.95)', () => {
      expect(
        (service as any).isReasonableGameBox({
          x: 0,
          y: 0,
          width: 0.96,
          height: 0.5,
        }),
      ).toBe(false);
    });

    it('rejects a box with x coordinate below the allowed lower bound (< -0.02)', () => {
      // x = -0.1 < -0.02 → out of bounds
      expect(
        (service as any).isReasonableGameBox({
          x: -0.1,
          y: 0,
          width: 0.1,
          height: 0.1,
        }),
      ).toBe(false);
    });
  });

  it('assigns stable detection numbers when parsing shelf photo', async () => {
    mockClaudeVision.detectBoardGames.mockResolvedValue([]);
    mockClaudeVision.drawAnnotations.mockResolvedValue(Buffer.from('image'));
    mockVision.detectTextBlocks.mockResolvedValue([
      {
        text: 'Wingspan',
        boundingBox: { x: 0.4, y: 0.2, width: 0.2, height: 0.1 },
      },
      {
        text: 'Catan',
        boundingBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
      },
    ]);
    mockOwnershipRepo.find.mockResolvedValue([]);
    jest
      .spyOn(service, 'searchGames')
      .mockImplementation(async (query: string) => {
        if (query === 'Catan') {
          return [
            {
              id: 'g-catan',
              title: 'Catan',
              minPlayers: 3,
              maxPlayers: 4,
            } as Game,
          ];
        }
        if (query === 'Wingspan') {
          return [
            {
              id: 'g-wing',
              title: 'Wingspan',
              minPlayers: 1,
              maxPlayers: 5,
            } as Game,
          ];
        }
        return [];
      });

    const parsed = await service.parseShelfPhoto('u1', Buffer.from('image'));

    expect(parsed.candidates).toHaveLength(2);
    expect(parsed.candidates[0].detectionNumber).toBe(1);
    expect(parsed.candidates[0].title).toBe('Catan');
    expect(parsed.candidates[1].detectionNumber).toBe(2);
    expect(parsed.candidates[1].title).toBe('Wingspan');
  });
});
