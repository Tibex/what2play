import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedbackService } from '../feedback/feedback.service';
import { VotingService } from '../voting/voting.service';
import { VotingGateway } from '../voting/voting.gateway';
import { CalendarSyncService } from '../calendar/calendar-sync.service';
import { MultiTableOptimizerService } from './multi-table-optimizer.service';

describe('EventsController', () => {
  let controller: EventsController;

  const mockEventsService = {
    finalizeSchedule: jest.fn(),
    inviteFriends: jest.fn(),
  };
  const mockRecommendationsService = {
    generateCandidates: jest.fn(),
  };
  const mockNotificationsService = {
    sendScheduleFinalizedNotification: jest.fn(),
    sendFriendAddedToEventNotification: jest.fn(),
  };
  const mockFeedbackService = {};
  const mockVotingService = {};
  const mockVotingGateway = {
    emitVotingState: jest.fn(),
  };
  const mockCalendarSyncService = {
    queueEventSync: jest.fn(),
  };
  const mockMultiTableOptimizerService = {
    runForEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: mockEventsService },
        {
          provide: RecommendationsService,
          useValue: mockRecommendationsService,
        },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: FeedbackService, useValue: mockFeedbackService },
        { provide: VotingService, useValue: mockVotingService },
        { provide: VotingGateway, useValue: mockVotingGateway },
        { provide: CalendarSyncService, useValue: mockCalendarSyncService },
        {
          provide: MultiTableOptimizerService,
          useValue: mockMultiTableOptimizerService,
        },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
    jest.clearAllMocks();
    mockRecommendationsService.generateCandidates.mockResolvedValue(undefined);
    mockCalendarSyncService.queueEventSync.mockResolvedValue(undefined);
    mockNotificationsService.sendScheduleFinalizedNotification.mockResolvedValue(
      undefined,
    );
    mockNotificationsService.sendFriendAddedToEventNotification.mockResolvedValue(
      undefined,
    );
    mockVotingGateway.emitVotingState.mockResolvedValue(undefined);
  });

  it('triggers schedule-finalized notification after finalizing poll', async () => {
    const updatedEvent = { id: 'e1', status: 'planning' };
    mockEventsService.finalizeSchedule.mockResolvedValue(updatedEvent);

    const result = await controller.finalizeEventSchedule(
      'e1',
      { user: { id: 'host-1' } },
      { winningSlotId: 'slot-1' },
    );

    expect(result).toEqual(updatedEvent);
    expect(mockEventsService.finalizeSchedule).toHaveBeenCalledWith(
      'e1',
      'host-1',
      'slot-1',
    );
    expect(
      mockNotificationsService.sendScheduleFinalizedNotification,
    ).toHaveBeenCalledWith('e1', 'slot-1');
  });

  it('keeps finalize flow non-blocking when schedule-finalized notification fails', async () => {
    const updatedEvent = { id: 'e2', status: 'planning' };
    mockEventsService.finalizeSchedule.mockResolvedValue(updatedEvent);
    mockNotificationsService.sendScheduleFinalizedNotification.mockRejectedValue(
      new Error('delivery failed'),
    );

    await expect(
      controller.finalizeEventSchedule(
        'e2',
        { user: { id: 'host-1' } },
        { winningSlotId: 'slot-2' },
      ),
    ).resolves.toEqual(updatedEvent);
  });

  it('sends friend-invite notification for invited users', async () => {
    const inviteResult = {
      invitedUserIds: ['u10', 'u11'],
      alreadyAttendingUserIds: [],
      notFriendsUserIds: [],
    };
    mockEventsService.inviteFriends.mockResolvedValue(inviteResult);

    const result = await controller.inviteFriends(
      'e3',
      { user: { id: 'host-1' } },
      { userIds: ['u10', 'u11'] },
    );

    expect(result).toEqual(inviteResult);
    expect(mockEventsService.inviteFriends).toHaveBeenCalledWith(
      'e3',
      'host-1',
      ['u10', 'u11'],
    );
    expect(
      mockNotificationsService.sendFriendAddedToEventNotification,
    ).toHaveBeenCalledWith('e3', 'host-1', ['u10', 'u11']);
  });

  it('does not send friend-invite notification when no users were invited', async () => {
    const inviteResult = {
      invitedUserIds: [],
      alreadyAttendingUserIds: ['u10'],
      notFriendsUserIds: [],
    };
    mockEventsService.inviteFriends.mockResolvedValue(inviteResult);

    await controller.inviteFriends(
      'e4',
      { user: { id: 'host-1' } },
      { userIds: ['u10'] },
    );

    expect(
      mockNotificationsService.sendFriendAddedToEventNotification,
    ).not.toHaveBeenCalled();
  });

  it('keeps invite-friends flow non-blocking when notification fails', async () => {
    const inviteResult = {
      invitedUserIds: ['u12'],
      alreadyAttendingUserIds: [],
      notFriendsUserIds: [],
    };
    mockEventsService.inviteFriends.mockResolvedValue(inviteResult);
    mockNotificationsService.sendFriendAddedToEventNotification.mockRejectedValue(
      new Error('delivery failed'),
    );

    await expect(
      controller.inviteFriends(
        'e5',
        { user: { id: 'host-1' } },
        { userIds: ['u12'] },
      ),
    ).resolves.toEqual(inviteResult);
  });
});
