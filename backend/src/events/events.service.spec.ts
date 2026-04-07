import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { EventReport } from '../entities/event-report.entity';
import { EventScheduleSlot } from '../entities/event-schedule-slot.entity';
import { EventScheduleResponse } from '../entities/event-schedule-response.entity';
import { FriendsService } from '../friends/friends.service';
import { GroupsService } from '../groups/groups.service';

describe('EventsService', () => {
  let service: EventsService;

  const mockEventsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockAttendeesRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn((value) => Promise.resolve(value)),
    create: jest.fn((value) => value),
    remove: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
  };

  const mockInvitesRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((value) => value),
  };

  const mockEventReportsRepo = {
    findOne: jest.fn(),
    save: jest.fn((value) => Promise.resolve(value)),
    create: jest.fn((value) => value),
  };

  const mockScheduleSlotsRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({}),
    create: jest.fn((value) => value),
  };

  const mockScheduleResponsesRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((value) => Promise.resolve(value)),
    create: jest.fn((value) => value),
  };

  const mockFriendsService = {
    getFriendIds: jest.fn(),
  };

  const mockGroupsService = {
    assertMembership: jest.fn(),
    getMemberUserIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: mockEventsRepo },
        {
          provide: getRepositoryToken(EventAttendee),
          useValue: mockAttendeesRepo,
        },
        { provide: getRepositoryToken(EventInvite), useValue: mockInvitesRepo },
        {
          provide: getRepositoryToken(EventReport),
          useValue: mockEventReportsRepo,
        },
        {
          provide: getRepositoryToken(EventScheduleSlot),
          useValue: mockScheduleSlotsRepo,
        },
        {
          provide: getRepositoryToken(EventScheduleResponse),
          useValue: mockScheduleResponsesRepo,
        },
        { provide: FriendsService, useValue: mockFriendsService },
        { provide: GroupsService, useValue: mockGroupsService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
    jest.clearAllMocks();
  });

  describe('inviteFriends', () => {
    it('enforces host-only access', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'host-1',
        attendees: [],
      });

      await expect(
        service.inviteFriends('e1', 'not-host', ['u2']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('invites only accepted friends and skips existing attendees', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'host-1',
        attendees: [{ userId: 'u2' }],
      });
      mockFriendsService.getFriendIds.mockResolvedValue(['u2', 'u3']);

      const result = await service.inviteFriends('e1', 'host-1', [
        'u2',
        'u3',
        'u3',
        'u9',
      ]);

      expect(result).toEqual({
        invitedUserIds: ['u3'],
        alreadyAttendingUserIds: ['u2'],
        notFriendsUserIds: ['u9'],
      });
      expect(mockAttendeesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'e1',
          userId: 'u3',
          rsvpStatus: 'pending',
        }),
      );
      expect(mockAttendeesRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByIdForUser', () => {
    it('hides invite-only events from non-members', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-private',
        hostId: 'host-1',
        type: 'invite',
        attendees: [{ userId: 'u2' }],
      });

      await expect(
        service.findByIdForUser('e-private', 'stranger'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows open events for authenticated users', async () => {
      const event = {
        id: 'e-open',
        hostId: 'host-1',
        type: 'open',
        attendees: [],
      };
      mockEventsRepo.findOne.mockResolvedValue(event);

      await expect(service.findByIdForUser('e-open', 'u2')).resolves.toEqual(
        event,
      );
    });
  });

  describe('capacity normalization', () => {
    it('forces invite events to store null capacity on create', async () => {
      const persistedEvent = {
        id: 'e-create',
        hostId: 'host-1',
        type: 'invite',
        capacity: null,
      };
      mockEventsRepo.save.mockResolvedValue({ id: 'e-create' });
      mockEventsRepo.findOne.mockResolvedValue(persistedEvent);

      await service.create('host-1', {
        title: 'Invite Event',
        dateTime: new Date('2026-05-01T18:00:00.000Z').toISOString(),
        type: 'invite',
        capacity: 12,
      });

      expect(mockEventsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hostId: 'host-1',
          type: 'invite',
          capacity: null,
        }),
      );
    });

    it('clears capacity when updating an event to invite type', async () => {
      const existingEvent = {
        id: 'e-update-invite',
        hostId: 'host-1',
        type: 'open',
        capacity: 10,
        status: 'planning',
        dateTime: new Date('2026-05-02T18:00:00.000Z'),
        eventTimezone: 'UTC',
        votingDeadline: null,
      };
      mockEventsRepo.findOne.mockResolvedValue(existingEvent);

      await service.update('e-update-invite', 'host-1', {
        type: 'invite',
        capacity: 6,
      });

      expect(mockEventsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'e-update-invite',
          type: 'invite',
          capacity: null,
        }),
      );
    });

    it('keeps existing open capacity when update payload omits capacity', async () => {
      const existingEvent = {
        id: 'e-update-open',
        hostId: 'host-1',
        type: 'open',
        capacity: 6,
        status: 'planning',
        title: 'Original',
        dateTime: new Date('2026-05-03T18:00:00.000Z'),
        eventTimezone: 'UTC',
        votingDeadline: null,
      };
      mockEventsRepo.findOne.mockResolvedValue(existingEvent);

      await service.update('e-update-open', 'host-1', {
        title: 'Renamed',
      });

      expect(mockEventsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'e-update-open',
          type: 'open',
          capacity: 6,
          title: 'Renamed',
        }),
      );
    });
  });

  describe('rsvp', () => {
    it('blocks direct RSVP to invite-only event for non-attendees', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'host-1',
        type: 'invite',
        status: 'planning',
      });
      mockAttendeesRepo.findOne.mockResolvedValue(null);

      await expect(service.rsvp('e1', 'u2', 'going')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mockAttendeesRepo.save).not.toHaveBeenCalled();
    });

    it('blocks joining open event outside planning status', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-open',
        hostId: 'host-1',
        type: 'open',
        status: 'voting',
        capacity: 8,
      });
      mockAttendeesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rsvp('e-open', 'u2', 'going'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockAttendeesRepo.save).not.toHaveBeenCalled();
    });

    it('returns conflict when open event is at capacity', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-open',
        hostId: 'host-1',
        type: 'open',
        status: 'planning',
        capacity: 2,
      });
      mockAttendeesRepo.findOne.mockResolvedValue(null);
      mockAttendeesRepo.count.mockResolvedValue(2);

      await expect(
        service.rsvp('e-open', 'u2', 'going'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(mockAttendeesRepo.save).not.toHaveBeenCalled();
    });

    it('allows invite-link flow to join invite-only events', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-invite',
        hostId: 'host-1',
        type: 'invite',
        status: 'planning',
        capacity: null,
      });
      mockAttendeesRepo.findOne.mockResolvedValue(null);
      mockAttendeesRepo.count.mockResolvedValue(1);

      await expect(
        service.rsvp('e-invite', 'u2', 'going', undefined, 'invite_link'),
      ).resolves.toEqual(
        expect.objectContaining({
          eventId: 'e-invite',
          userId: 'u2',
          rsvpStatus: 'going',
        }),
      );
      expect(mockAttendeesRepo.save).toHaveBeenCalledTimes(1);
    });

    it('rejects host RSVP change to not_going', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-open',
        hostId: 'host-1',
        type: 'open',
        status: 'planning',
        capacity: 6,
      });

      await expect(
        service.rsvp('e-open', 'host-1', 'not_going'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockAttendeesRepo.findOne).not.toHaveBeenCalled();
      expect(mockAttendeesRepo.remove).not.toHaveBeenCalled();
      expect(mockAttendeesRepo.save).not.toHaveBeenCalled();
    });

    it('removes non-host attendee when RSVP changes to not_going', async () => {
      const event = {
        id: 'e-open',
        hostId: 'host-1',
        type: 'open',
        status: 'planning',
        capacity: 6,
      };
      const attendee = {
        id: 'attendee-1',
        eventId: 'e-open',
        userId: 'u2',
        rsvpStatus: 'going',
      };
      mockEventsRepo.findOne.mockResolvedValue(event);
      mockAttendeesRepo.findOne.mockResolvedValue(attendee);
      mockAttendeesRepo.remove.mockResolvedValue(attendee);

      const result = await service.rsvp('e-open', 'u2', 'not_going');

      expect(mockAttendeesRepo.remove).toHaveBeenCalledWith(attendee);
      expect(mockAttendeesRepo.save).not.toHaveBeenCalled();
      expect(result.rsvpStatus).toBe('not_going');
    });
  });

  describe('reportOpenEvent', () => {
    it('deduplicates repeated reports by the same reporter', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e-open',
        type: 'open',
      });
      mockEventReportsRepo.findOne.mockResolvedValue({
        id: 'report-1',
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
      });

      const result = await service.reportOpenEvent('e-open', 'u2', {
        reason: 'spam',
      });

      expect(result).toEqual({
        reported: true,
        deduped: true,
        reportedAt: new Date('2026-03-01T10:00:00.000Z'),
      });
      expect(mockEventReportsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getInviteableFriends', () => {
    it('filters out already attending friends', async () => {
      mockEventsRepo.findOne.mockResolvedValue({
        id: 'e1',
        hostId: 'host-1',
        attendees: [{ userId: 'u2' }, { userId: 'host-1' }],
      });
      mockFriendsService.getFriendIds.mockResolvedValue(['u2', 'u3', 'u4']);
      const mockUsersRepo = {
        find: jest.fn().mockResolvedValue([{ id: 'u3' }, { id: 'u4' }]),
      };
      mockAttendeesRepo.manager.getRepository.mockReturnValue(mockUsersRepo);

      const result = await service.getInviteableFriends('e1', 'host-1');

      expect(result).toEqual([{ id: 'u3' }, { id: 'u4' }]);
      expect(mockUsersRepo.find).toHaveBeenCalled();
    });
  });

  describe('markPastEventsAsCompleted', () => {
    it('marks ended events as completed and past', async () => {
      const now = new Date('2026-03-27T12:00:00.000Z');
      mockEventsRepo.find.mockResolvedValue([
        {
          id: 'past-1',
          title: 'Past Event',
          status: 'confirmed',
          type: 'open',
          dateTime: new Date('2026-03-27T09:00:00.000Z'),
          durationMinutes: 120,
        },
        {
          id: 'future-1',
          title: 'Future Event',
          status: 'planning',
          type: 'invite',
          dateTime: new Date('2026-03-27T14:00:00.000Z'),
          durationMinutes: 90,
        },
      ]);

      const updated = await service.markPastEventsAsCompleted(now);

      expect(updated).toBe(1);
      expect(mockEventsRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'past-1',
          status: 'completed',
        }),
      );
    });
  });

  describe('deleteForAdmin', () => {
    it('throws when event does not exist', async () => {
      mockEventsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteForAdmin('missing-event'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockEventsRepo.remove).not.toHaveBeenCalled();
    });

    it('removes event when found', async () => {
      const event = { id: 'event-1' };
      mockEventsRepo.findOne.mockResolvedValue(event);

      await service.deleteForAdmin('event-1');

      expect(mockEventsRepo.remove).toHaveBeenCalledWith(event);
    });
  });
});
