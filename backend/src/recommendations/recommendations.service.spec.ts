import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecommendationsService } from './recommendations.service';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { GamesService } from '../games/games.service';
import { EventsService } from '../events/events.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  const mockCandidatesRepo = {
    find: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
    delete: jest.fn(),
  };

  const mockTimingsRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockFeedbackRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockGamesService = {
    getGamesOwnedByUsers: jest.fn(),
    getRatingsForGames: jest.fn(),
  };

  const mockEventsService = {
    findById: jest.fn(),
    getAttendeeUserIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        {
          provide: getRepositoryToken(EventGameCandidate),
          useValue: mockCandidatesRepo,
        },
        {
          provide: getRepositoryToken(SessionTiming),
          useValue: mockTimingsRepo,
        },
        {
          provide: getRepositoryToken(EventFeedback),
          useValue: mockFeedbackRepo,
        },
        { provide: GamesService, useValue: mockGamesService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    jest.clearAllMocks();
  });

  describe('generateCandidates', () => {
    it('should filter games by player count', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
      ]);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Game 1', minPlayers: 2, maxPlayers: 4 },
        { id: 'g2', title: 'Game 2', minPlayers: 4, maxPlayers: 6 },
        { id: 'g3', title: 'Game 3', minPlayers: 1, maxPlayers: 2 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');

      const gameIds = result.map((r) => r.gameId);
      expect(gameIds).toContain('g1');
      expect(gameIds).not.toContain('g3');
    });

    it('should score rated games higher', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1', 'u2']);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Highly Rated', minPlayers: 2, maxPlayers: 4 },
        { id: 'g2', title: 'Unrated Game', minPlayers: 2, maxPlayers: 4 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([
        { gameId: 'g1', rating: 9 },
        { gameId: 'g1', rating: 8.5 },
      ]);

      const result = await service.generateCandidates('e1');

      const g1 = result.find((r) => r.gameId === 'g1')!;
      const g2 = result.find((r) => r.gameId === 'g2')!;
      expect(Number(g1.score)).toBeGreaterThan(Number(g2.score));
    });

    it('should add explanation labels', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1', 'u2']);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'g1',
          title: 'Game 1',
          minPlayers: 2,
          maxPlayers: 4,
          playingTime: 90,
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');

      expect(result[0].explanation).toHaveProperty('players');
      expect(result[0].explanation).toHaveProperty('time');
    });

    it('should return empty when no compatible games', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
        'u4',
        'u5',
        'u6',
      ]);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Too Small', minPlayers: 2, maxPlayers: 3 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');
      expect(result).toHaveLength(0);
    });
  });
});
