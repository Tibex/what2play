import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Event } from '../entities/event.entity';
import { VotingService } from '../voting/voting.service';
import { NotificationDeliveryService } from './notification-delivery.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockEventsRepo = {
    find: jest.fn(),
  };
  const mockVotingService = {
    autoCloseVoting: jest.fn(),
  };
  const mockDeliveryService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        { provide: VotingService, useValue: mockVotingService },
        { provide: NotificationDeliveryService, useValue: mockDeliveryService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it('sends reminders only for confirmed upcoming events', async () => {
    mockEventsRepo.find.mockResolvedValue([
      {
        id: 'e1',
        title: 'Friday night',
        status: 'confirmed',
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        attendees: [
          {
            userId: 'u1',
            rsvpStatus: 'going',
            user: { email: 'user@example.com', name: 'Test User' },
          },
        ],
      },
    ]);

    await service.sendUpcomingEventReminders();
    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e1',
        type: 'event_reminder',
        recipientCount: 1,
        eventUrl: 'http://localhost:3000/events/e1',
        feedbackUrl: 'http://localhost:3000/events/e1#feedback',
        recipients: [
          expect.objectContaining({
            email: 'user@example.com',
            userId: 'u1',
          }),
        ],
      }),
    );
  });

  it('sends voting-started notifications to going attendees', async () => {
    mockEventsRepo.findOne = jest.fn().mockResolvedValue({
      id: 'e2',
      title: 'Saturday session',
      votingDeadline: new Date(Date.now() + 60 * 60 * 1000),
      attendees: [
        {
          userId: 'u9',
          rsvpStatus: 'going',
          user: { email: 'voter@example.com', name: 'Voter' },
        },
      ],
    });

    await service.sendVotingStartedNotification('e2');

    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e2',
        type: 'voting_started',
        recipientCount: 1,
        recipients: [expect.objectContaining({ email: 'voter@example.com' })],
      }),
    );
  });

  it('sends all-voted notifications to going attendees', async () => {
    mockEventsRepo.findOne = jest.fn().mockResolvedValue({
      id: 'e3',
      title: 'Sunday session',
      votingDeadline: new Date(Date.now() + 30 * 60 * 1000),
      attendees: [
        {
          userId: 'u7',
          rsvpStatus: 'going',
          user: { email: 'allvoted@example.com', name: 'All Voted' },
        },
      ],
    });

    await service.sendAllVotedNotification('e3');

    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e3',
        type: 'all_voted',
        recipientCount: 1,
      }),
    );
  });
});
