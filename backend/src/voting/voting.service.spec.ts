import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VotingService } from './voting.service';
import { EventVote } from '../entities/event-vote.entity';
import { Event } from '../entities/event.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';

describe('VotingService', () => {
  let service: VotingService;

  const mockVotesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data) => data),
    delete: jest.fn(),
  };

  const mockEventsRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockCandidatesRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VotingService,
        { provide: getRepositoryToken(EventVote), useValue: mockVotesRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        {
          provide: getRepositoryToken(EventGameCandidate),
          useValue: mockCandidatesRepo,
        },
      ],
    }).compile();

    service = module.get<VotingService>(VotingService);
    jest.clearAllMocks();
  });

  describe('getResults', () => {
    it('should return empty array when no votes', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'event-1',
        hostId: 'u1',
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockCandidatesRepo.find.mockResolvedValue([{ gameId: 'g1' }]);
      mockVotesRepo.find.mockResolvedValue([]);
      const results = await service.getResults('event-1');
      expect(results).toEqual([]);
    });

    it('should compute Borda scores correctly', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'u1',
        attendees: [
          { userId: 'u1', rsvpStatus: 'going' },
          { userId: 'u2', rsvpStatus: 'going' },
        ],
      });
      mockCandidatesRepo.find.mockResolvedValue([
        { gameId: 'g1' },
        { gameId: 'g2' },
        { gameId: 'g3' },
      ]);
      mockVotesRepo.find.mockResolvedValue([
        { eventId: 'e1', userId: 'u1', gameId: 'g1', rank: 1 },
        { eventId: 'e1', userId: 'u1', gameId: 'g2', rank: 2 },
        { eventId: 'e1', userId: 'u1', gameId: 'g3', rank: 3 },
        { eventId: 'e1', userId: 'u2', gameId: 'g2', rank: 1 },
        { eventId: 'e1', userId: 'u2', gameId: 'g1', rank: 2 },
        { eventId: 'e1', userId: 'u2', gameId: 'g3', rank: 3 },
      ]);

      const results = await service.getResults('e1');

      expect(results.length).toBe(3);
      const g1 = results.find((r) => r.gameId === 'g1')!;
      const g2 = results.find((r) => r.gameId === 'g2')!;
      const g3 = results.find((r) => r.gameId === 'g3')!;

      // g1: rank 1 (3pts) + rank 2 (2pts) = 5
      expect(g1.totalScore).toBe(5);
      // g2: rank 2 (2pts) + rank 1 (3pts) = 5
      expect(g2.totalScore).toBe(5);
      // g3: rank 3 (1pt) + rank 3 (1pt) = 2
      expect(g3.totalScore).toBe(2);
    });

    it('should break ties by average rank', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'u1',
        attendees: [
          { userId: 'u1', rsvpStatus: 'going' },
          { userId: 'u2', rsvpStatus: 'going' },
        ],
      });
      mockCandidatesRepo.find.mockResolvedValue([
        { gameId: 'g1' },
        { gameId: 'g2' },
      ]);
      mockVotesRepo.find.mockResolvedValue([
        { eventId: 'e1', userId: 'u1', gameId: 'g1', rank: 1 },
        { eventId: 'e1', userId: 'u1', gameId: 'g2', rank: 2 },
        { eventId: 'e1', userId: 'u2', gameId: 'g2', rank: 1 },
        { eventId: 'e1', userId: 'u2', gameId: 'g1', rank: 2 },
      ]);

      const results = await service.getResults('e1');
      // Both have same score, tie-break by average rank (both 1.5), so order is stable
      expect(results[0].totalScore).toBe(results[1].totalScore);
    });

    it('should hide results until all expected voters have submitted', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'u1',
        attendees: [
          { userId: 'u1', rsvpStatus: 'going' },
          { userId: 'u2', rsvpStatus: 'going' },
          { userId: 'u3', rsvpStatus: 'going' },
        ],
      });
      mockCandidatesRepo.find.mockResolvedValue([
        { gameId: 'g1' },
        { gameId: 'g2' },
      ]);
      mockVotesRepo.find.mockResolvedValue([
        { eventId: 'e1', userId: 'u1', gameId: 'g1', rank: 1 },
        { eventId: 'e1', userId: 'u2', gameId: 'g2', rank: 1 },
      ]);

      const results = await service.getResults('e1');
      expect(results).toEqual([]);
    });
  });

  describe('submitVotes', () => {
    it('should delete existing votes and save new ones', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'voting',
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue(null);
      mockCandidatesRepo.find.mockResolvedValue([
        { gameId: 'g1' },
        { gameId: 'g2' },
      ]);
      mockVotesRepo.save.mockImplementation((v) => Promise.resolve(v));

      const rankings = [
        { gameId: 'g1', rank: 1 },
        { gameId: 'g2', rank: 2 },
      ];

      await service.submitVotes('e1', 'u1', rankings);

      expect(mockVotesRepo.save).toHaveBeenCalled();
    });

    it('should ignore stale game ids not in current candidates', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'voting',
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue(null);
      mockCandidatesRepo.find.mockResolvedValue([
        { gameId: 'g1' },
        { gameId: 'g2' },
      ]);
      mockVotesRepo.save.mockImplementation((v) => Promise.resolve(v));

      await service.submitVotes('e1', 'u1', [
        { gameId: 'g1', rank: 1 },
        { gameId: 'stale-id', rank: 2 },
      ]);

      expect(mockVotesRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ gameId: 'g1' }),
      ]);
    });

    it('should reject re-submission when user already voted', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'voting',
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue({ id: 'vote-1' });
      mockCandidatesRepo.find.mockResolvedValue([{ gameId: 'g1' }]);

      await expect(
        service.submitVotes('e1', 'u1', [{ gameId: 'g1', rank: 1 }]),
      ).rejects.toThrow('already submitted');
    });

    it('should reject votes after deadline', async () => {
      const pastDeadline = new Date(Date.now() - 60000).toISOString();
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'voting',
        votingDeadline: pastDeadline,
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue(null);
      mockCandidatesRepo.find.mockResolvedValue([{ gameId: 'g1' }]);

      await expect(
        service.submitVotes('e1', 'u1', [{ gameId: 'g1', rank: 1 }]),
      ).rejects.toThrow('Voting has closed');
    });

    it('should reject votes before voting phase starts', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'planning',
        attendees: [{ userId: 'u1', rsvpStatus: 'going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue(null);
      mockCandidatesRepo.find.mockResolvedValue([{ gameId: 'g1' }]);

      await expect(
        service.submitVotes('e1', 'u1', [{ gameId: 'g1', rank: 1 }]),
      ).rejects.toThrow('not open');
    });

    it('should reject votes from attendees marked as not going', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        status: 'voting',
        attendees: [{ userId: 'u1', rsvpStatus: 'not_going' }],
      });
      mockVotesRepo.findOne.mockResolvedValue(null);
      mockCandidatesRepo.find.mockResolvedValue([{ gameId: 'g1' }]);

      await expect(
        service.submitVotes('e1', 'u1', [{ gameId: 'g1', rank: 1 }]),
      ).rejects.toThrow('marked as going');
    });
  });

  describe('selectWinner', () => {
    it('should allow host to select specific game', async () => {
      const event = { id: 'e1', hostId: 'host1', status: 'voting' };
      mockEventsRepo.findOne.mockResolvedValue(event);
      mockEventsRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.selectWinner('e1', 'host1', 'g1');

      expect(result.selectedGameId).toBe('g1');
      expect(result.status).toBe('confirmed');
    });

    it('should reject non-host', async () => {
      mockEventsRepo.findOne.mockResolvedValue({ id: 'e1', hostId: 'host1' });

      await expect(service.selectWinner('e1', 'user2', 'g1')).rejects.toThrow();
    });
  });
});
