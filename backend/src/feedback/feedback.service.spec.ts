import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeedbackService } from './feedback.service';
import { EventFeedback } from '../entities/event-feedback.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { Event } from '../entities/event.entity';

describe('FeedbackService', () => {
  let service: FeedbackService;

  const mockFeedbackRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
  };

  const mockTimingRepo = {
    create: jest.fn((data) => data),
    save: jest.fn((data) => data),
    find: jest.fn(),
  };

  const mockEventsRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbackService,
        {
          provide: getRepositoryToken(EventFeedback),
          useValue: mockFeedbackRepo,
        },
        {
          provide: getRepositoryToken(SessionTiming),
          useValue: mockTimingRepo,
        },
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
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
});
