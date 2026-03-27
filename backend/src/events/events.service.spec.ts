import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { FriendsService } from '../friends/friends.service';

describe('EventsService', () => {
  let service: EventsService;

  const mockEventsRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
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

  const mockFriendsService = {
    getFriendIds: jest.fn(),
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
        { provide: FriendsService, useValue: mockFriendsService },
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
          rsvpStatus: 'going',
        }),
      );
      expect(mockAttendeesRepo.save).toHaveBeenCalledTimes(1);
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

      await expect(service.deleteForAdmin('missing-event')).rejects.toBeInstanceOf(
        NotFoundException,
      );
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
