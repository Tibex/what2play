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
    findOne: jest.fn(),
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

  it('sends event invite notification to newly added friend attendee', async () => {
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e4',
      title: 'Monday session',
      status: 'planning',
      hostId: 'host-1',
      host: { id: 'host-1', name: 'Host Name' },
      attendees: [
        {
          userId: 'u10',
          user: { email: 'friend@example.com', name: 'Friend User' },
        },
      ],
    });

    await service.sendFriendAddedToEventNotification('e4', 'host-1', ['u10']);

    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e4',
        type: 'event_friend_invited',
        recipientCount: 1,
        recipients: [expect.objectContaining({ email: 'friend@example.com' })],
        body: expect.stringContaining(
          'Open the event to check details and RSVP',
        ),
      }),
    );
  });

  it('uses poll-aware invite copy when event is in scheduling status', async () => {
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e5',
      title: 'Friday Poll',
      status: 'scheduling',
      hostId: 'host-1',
      host: { id: 'host-1', name: 'Host Name' },
      attendees: [
        {
          userId: 'u11',
          rsvpStatus: 'pending',
          user: { email: 'pollfriend@example.com', name: 'Poll Friend' },
        },
      ],
    });

    await service.sendFriendAddedToEventNotification('e5', 'host-1', ['u11']);

    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e5',
        type: 'event_friend_invited',
        title: expect.stringContaining('availability poll'),
        body: expect.stringContaining('Respond Yes/No'),
      }),
    );
  });

  it('sends schedule-finalized notifications to active non-host attendees', async () => {
    const finalizedAt = new Date('2026-05-02T19:00:00.000Z');
    mockEventsRepo.findOne.mockResolvedValue({
      id: 'e6',
      title: 'Weekend Session',
      status: 'planning',
      hostId: 'host-1',
      eventTimezone: 'Europe/Zagreb',
      dateTime: finalizedAt,
      host: { id: 'host-1', name: 'Host Name' },
      attendees: [
        {
          userId: 'host-1',
          rsvpStatus: 'going',
          user: { email: 'host@example.com', name: 'Host Name' },
        },
        {
          userId: 'u12',
          rsvpStatus: 'pending',
          user: { email: 'pending@example.com', name: 'Pending User' },
        },
        {
          userId: 'u13',
          rsvpStatus: 'going',
          user: { email: 'going@example.com', name: 'Going User' },
        },
        {
          userId: 'u14',
          rsvpStatus: 'not_going',
          user: { email: 'notgoing@example.com', name: 'Not Going User' },
        },
      ],
    });

    await service.sendScheduleFinalizedNotification('e6', 'slot-123');

    expect(mockDeliveryService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'e6',
        type: 'schedule_finalized',
        idempotencyKey: `schedule_finalized:e6:${finalizedAt.toISOString()}`,
        recipientCount: 2,
        recipients: expect.arrayContaining([
          expect.objectContaining({
            email: 'pending@example.com',
            userId: 'u12',
          }),
          expect.objectContaining({
            email: 'going@example.com',
            userId: 'u13',
          }),
        ]),
        metadata: expect.objectContaining({
          winningSlotId: 'slot-123',
          finalizedDateTime: finalizedAt.toISOString(),
          eventTimezone: 'Europe/Zagreb',
        }),
      }),
    );
  });
});
