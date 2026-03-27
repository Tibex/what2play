import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { EventFeedback } from '../entities/event-feedback.entity';
import { Event } from '../entities/event.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';

describe('FeedbackService', () => {
  let service: FeedbackService;

  const mockFeedbackRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
  };

  const mockEventsRepo = {
    findOne: jest.fn(),
  };

  const mockVotesRepo = {
    find: jest.fn(),
  };

  const mockCandidatesRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(EventFeedback),
          useValue: mockFeedbackRepo,
        },
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        { provide: getRepositoryToken(EventVote), useValue: mockVotesRepo },
        {
          provide: getRepositoryToken(EventGameCandidate),
          useValue: mockCandidatesRepo,
        },
      ],
    }).compile();

    service = module.get<FeedbackService>(FeedbackService);
    jest.clearAllMocks();
  });

  it('rejects feedback submission before event date', async () => {
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e1',
      dateTime: new Date(Date.now() + 60_000),
    });
    mockFeedbackRepo.findOne.mockResolvedValue(null);

    await expect(
      service.submitFeedback('e1', 'u1', {
        enjoymentRating: 4,
        finishedGame: true,
      }),
    ).rejects.toThrow('after the event date');
  });

  it('rejects second feedback submission for same event/user', async () => {
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e1',
      dateTime: new Date(Date.now() - 60_000),
    });
    mockFeedbackRepo.findOne.mockResolvedValue({ id: 'f1' });

    await expect(
      service.submitFeedback('e1', 'u1', {
        enjoymentRating: 4,
        finishedGame: true,
      }),
    ).rejects.toThrow('already submitted');
  });

  it('returns aggregated analytics metadata', async () => {
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e1',
      selectedGameId: 'g1',
    });
    mockCandidatesRepo.find.mockResolvedValue([
      { gameId: 'g1', game: { id: 'g1', title: 'Game 1' } },
    ]);
    mockVotesRepo.find.mockResolvedValue([
      { gameId: 'g1', userId: 'u1', game: { id: 'g1', title: 'Game 1' } },
    ]);
    mockFeedbackRepo.find.mockResolvedValue([
      {
        id: 'f1',
        gameId: 'g1',
        userId: 'u1',
        enjoymentRating: 5,
        game: { id: 'g1', title: 'Game 1' },
      },
      {
        id: 'f2',
        gameId: 'g1',
        userId: 'u2',
        enjoymentRating: 4,
        game: { id: 'g1', title: 'Game 1' },
      },
    ]);

    const analytics = await service.getEventFeedbackAnalytics('e1');
    expect(analytics.totalFeedbackEntries).toBe(2);
    expect(analytics.totalUniquePlayers).toBe(2);
    expect(analytics.winnerPlayedRate).toBe(1);
  });
});
