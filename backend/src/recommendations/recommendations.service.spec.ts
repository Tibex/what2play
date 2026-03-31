import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { RecommendationsService } from './recommendations.service';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { Event } from '../entities/event.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { RecommendationTelemetry } from '../entities/recommendation-telemetry.entity';
import { GamesService } from '../games/games.service';
import { EventsService } from '../events/events.service';

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  const mockCandidatesRepo = {
    find: jest.fn(),
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
  };

  const mockEventsRepo = {
    findOne: jest.fn(),
    save: jest.fn((data) => data),
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
    getDiscoveryGames: jest.fn(),
  };

  const mockTelemetryRepo = {
    save: jest.fn((data) => data),
    create: jest.fn((data) => data),
  };

  const mockConfigService = {
    get: jest.fn(() => undefined),
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
          provide: getRepositoryToken(Event),
          useValue: mockEventsRepo,
        },
        {
          provide: getRepositoryToken(EventFeedback),
          useValue: mockFeedbackRepo,
        },
        {
          provide: getRepositoryToken(RecommendationTelemetry),
          useValue: mockTelemetryRepo,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        { provide: GamesService, useValue: mockGamesService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    jest.clearAllMocks();
    mockCandidatesRepo.find.mockResolvedValue([]);
    mockGamesService.getDiscoveryGames.mockResolvedValue([]);
  });

  describe('generateCandidates', () => {
    it('should filter games by player count', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
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
        status: 'planning',
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
        status: 'planning',
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
        status: 'planning',
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

    it('prefers base game over expansion when both are compatible', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 180,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
        'u4',
      ]);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'base',
          bggId: 100,
          title: 'Great Game',
          minPlayers: 2,
          maxPlayers: 4,
          isExpansion: false,
        },
        {
          id: 'exp',
          bggId: 101,
          title: 'Great Game: Expansion',
          minPlayers: 2,
          maxPlayers: 5,
          isExpansion: true,
          expansionForBggIds: ['100'],
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');
      const gameIds = result.map((r) => r.gameId);

      expect(gameIds).toContain('base');
      expect(gameIds).not.toContain('exp');
    });

    it('keeps expansion when base game is not player-compatible', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 180,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
        'u4',
        'u5',
      ]);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'base',
          bggId: 100,
          title: 'Great Game',
          minPlayers: 2,
          maxPlayers: 4,
          isExpansion: false,
        },
        {
          id: 'exp',
          bggId: 101,
          title: 'Great Game: Expansion',
          minPlayers: 2,
          maxPlayers: 5,
          isExpansion: true,
          expansionForBggIds: ['100'],
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');
      const gameIds = result.map((r) => r.gameId);

      expect(gameIds).toContain('exp');
      expect(gameIds).not.toContain('base');
    });

    it('keeps only one candidate when base and multiple expansions are all compatible', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 180,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
        'u4',
      ]);

      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'base',
          bggId: 200,
          title: 'Dune',
          minPlayers: 2,
          maxPlayers: 6,
          isExpansion: false,
        },
        {
          id: 'exp1',
          bggId: 201,
          title: 'Dune: Ixians & Tleilaxu',
          minPlayers: 2,
          maxPlayers: 6,
          isExpansion: true,
        },
        {
          id: 'exp2',
          bggId: 202,
          title: 'Dune: Immortality',
          minPlayers: 2,
          maxPlayers: 6,
          isExpansion: true,
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      const result = await service.generateCandidates('e1');
      const duneFamily = result.filter((r) =>
        ['base', 'exp1', 'exp2'].includes(r.gameId),
      );

      expect(duneFamily).toHaveLength(1);
      expect(duneFamily[0].gameId).toBe('base');
    });

    it('rejects generating recommendations for completed events', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'completed',
      });

      await expect(service.generateCandidates('e1')).rejects.toThrow(
        'cannot be regenerated for completed or cancelled events',
      );
    });

    it('applies freshness penalty to recently played games', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1', 'u2']);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Played recently', minPlayers: 2, maxPlayers: 4 },
        { id: 'g2', title: 'Fresh pick', minPlayers: 2, maxPlayers: 4 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);

      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set(['g1']));
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());

      const result = await service.generateCandidates('e1');
      const g1 = result.find((r) => r.gameId === 'g1');
      const g2 = result.find((r) => r.gameId === 'g2');

      expect(g1).toBeDefined();
      expect(g2).toBeDefined();
      expect(Number(g1!.score)).toBeLessThan(Number(g2!.score));
    });

    it('boosts games that match attendee preferred complexity', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
        attendees: [
          { rsvpStatus: 'going', user: { preferredWeight: 3 } },
          { rsvpStatus: 'going', user: { preferredWeight: 3 } },
        ],
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1', 'u2']);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'g1',
          title: 'Closer match',
          minPlayers: 2,
          maxPlayers: 4,
          weight: 3.1,
        },
        {
          id: 'g2',
          title: 'Farther match',
          minPlayers: 2,
          maxPlayers: 4,
          weight: 4.8,
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const g1 = result.find((r) => r.gameId === 'g1');
      const g2 = result.find((r) => r.gameId === 'g2');

      expect(g1).toBeDefined();
      expect(g2).toBeDefined();
      expect(Number(g1!.score)).toBeGreaterThan(Number(g2!.score));
      expect(g1!.explanation).toHaveProperty('complexity');
      expect(g1!.explanation).toHaveProperty('confidence');
    });

    it('boosts games with stronger best-player-count fit', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
        'u4',
      ]);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Perfect at 4', minPlayers: 4, maxPlayers: 4 },
        { id: 'g2', title: 'Best around 5', minPlayers: 2, maxPlayers: 8 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const g1 = result.find((r) => r.gameId === 'g1');
      const g2 = result.find((r) => r.gameId === 'g2');

      expect(g1).toBeDefined();
      expect(g2).toBeDefined();
      expect(Number(g1!.score)).toBeGreaterThan(Number(g2!.score));
      expect(g1!.explanation).toHaveProperty('best_players');
    });

    it('uses BGG player-count poll fit when available', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
      ]);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'g1',
          title: 'Poll favored at 3',
          minPlayers: 1,
          maxPlayers: 6,
          bggPlayerCountPoll: {
            '3': {
              best: 800,
              recommended: 150,
              notRecommended: 50,
              totalVotes: 1000,
            },
          },
        },
        {
          id: 'g2',
          title: 'Poll disliked at 3',
          minPlayers: 1,
          maxPlayers: 6,
          bggPlayerCountPoll: {
            '3': {
              best: 100,
              recommended: 350,
              notRecommended: 550,
              totalVotes: 1000,
            },
          },
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const favored = result.find((r) => r.gameId === 'g1');
      const disliked = result.find((r) => r.gameId === 'g2');

      expect(favored).toBeDefined();
      expect(disliked).toBeDefined();
      expect(Number(favored!.score)).toBeGreaterThan(Number(disliked!.score));
      expect(favored!.explanation.best_players).toContain('BGG 3p');
    });

    it('filters out games with 60% or more not-recommended votes for player count', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
      ]);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'g1',
          title: 'Poll acceptable at 3',
          minPlayers: 1,
          maxPlayers: 6,
          bggPlayerCountPoll: {
            '3': {
              best: 300,
              recommended: 200,
              notRecommended: 500,
              totalVotes: 1000,
            },
          },
        },
        {
          id: 'g2',
          title: 'Poll rejected at 3',
          minPlayers: 1,
          maxPlayers: 6,
          bggPlayerCountPoll: {
            '3': {
              best: 100,
              recommended: 300,
              notRecommended: 600,
              totalVotes: 1000,
            },
          },
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const gameIds = result.map((r) => r.gameId);

      expect(gameIds).toContain('g1');
      expect(gameIds).not.toContain('g2');
    });

    it('adds external discovery candidates when discovery mode is enabled', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: true,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
      ]);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      mockGamesService.getDiscoveryGames.mockResolvedValue([
        {
          id: 'x1',
          title: 'External Pick',
          minPlayers: 2,
          maxPlayers: 4,
          bggRating: 8.2,
        },
      ]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      expect(result).toHaveLength(1);
      expect(result[0].gameId).toBe('x1');
      expect(result[0].source).toBe('external_catalog');
      expect(result[0].explanation).toHaveProperty('source');
      expect(result[0].explanation).toHaveProperty('source_detail');
    });

    it('applies least-misery penalty when one attendee strongly dislikes a game', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 120,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1', 'u2']);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        { id: 'g1', title: 'Polarizing game', minPlayers: 2, maxPlayers: 4 },
        { id: 'g2', title: 'Stable game', minPlayers: 2, maxPlayers: 4 },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([
        { gameId: 'g1', userId: 'u1', rating: 10 },
        { gameId: 'g1', userId: 'u2', rating: 2 },
        { gameId: 'g2', userId: 'u1', rating: 6 },
        { gameId: 'g2', userId: 'u2', rating: 6 },
      ]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const polarizing = result.find((r) => r.gameId === 'g1');
      const stable = result.find((r) => r.gameId === 'g2');

      expect(polarizing).toBeDefined();
      expect(stable).toBeDefined();
      expect(Number(stable!.score)).toBeGreaterThan(Number(polarizing!.score));
    });

    it('adds archetype explanation for sparse-signal discovery recommendations', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 90,
        discoveryMode: true,
        status: 'planning',
        attendees: [{ rsvpStatus: 'going', user: { preferredWeight: 2.8, preferredDuration: 75 } }],
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue(['u1']);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([]);
      mockGamesService.getRatingsForGames.mockResolvedValue([]);
      mockGamesService.getDiscoveryGames.mockResolvedValue([
        {
          id: 'x1',
          title: 'Discovery Fit',
          minPlayers: 1,
          maxPlayers: 4,
          bggRating: 7.8,
          weight: 2.7,
          playingTime: 80,
          mechanics: ['Hand Management'],
        },
      ]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      expect(result).toHaveLength(1);
      expect(result[0].explanation.archetype).toBeDefined();
    });

    it('keeps fallback discovery below strongest owned candidate', async () => {
      mockEventsService.findById.mockResolvedValue({
        id: 'e1',
        durationMinutes: 180,
        discoveryMode: false,
        status: 'planning',
      });
      mockEventsService.getAttendeeUserIds.mockResolvedValue([
        'u1',
        'u2',
        'u3',
      ]);
      mockGamesService.getGamesOwnedByUsers.mockResolvedValue([
        {
          id: 'g1',
          title: 'Owned Strong Pick',
          minPlayers: 2,
          maxPlayers: 4,
          bggRating: 8.4,
        },
      ]);
      mockGamesService.getRatingsForGames.mockResolvedValue([
        { gameId: 'g1', rating: 9 },
        { gameId: 'g1', rating: 8.5 },
      ]);
      mockGamesService.getDiscoveryGames.mockResolvedValue([
        {
          id: 'x1',
          title: 'External Very Strong',
          minPlayers: 2,
          maxPlayers: 4,
          bggRating: 9.5,
        },
      ]);
      jest
        .spyOn(service as any, 'getAverageFeedback')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getAttendeeFeedbackSignals')
        .mockResolvedValue(new Map());
      jest
        .spyOn(service as any, 'getRecentlyPlayedGameIds')
        .mockResolvedValue(new Set());

      const result = await service.generateCandidates('e1');
      const owned = result.find((r) => r.gameId === 'g1');
      const external = result.find((r) => r.gameId === 'x1');

      expect(owned).toBeDefined();
      expect(external).toBeDefined();
      expect(Number(owned!.score)).toBeGreaterThan(Number(external!.score));
      expect(external!.source).toBe('external_catalog');
    });
  });
});
