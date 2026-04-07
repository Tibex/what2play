import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, In, IsNull, Not, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { EventReport } from '../entities/event-report.entity';
import { EventScheduleSlot } from '../entities/event-schedule-slot.entity';
import {
  EventScheduleAnswer,
  EventScheduleResponse,
} from '../entities/event-schedule-response.entity';
import { User } from '../entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AdminListEventsQueryDto } from './dto/admin-list-events-query.dto';
import { ReportEventDto } from './dto/report-event.dto';
import {
  isValidEventScheduleAnswer,
  SetEventScheduleResponsesDto,
} from './dto/set-event-schedule-responses.dto';
import { resolveEventDateTime, resolveEventTimezone } from './timezone.utils';
import { FriendsService } from '../friends/friends.service';
import { GroupsService } from '../groups/groups.service';

export type EventScheduleSlotSummary = {
  id: string;
  start: string;
  label: string | null;
  sortOrder: number;
  counts: { yes: number; no: number };
};

export type EventScheduleDetail = {
  eventId: string;
  title: string;
  eventTimezone: string;
  durationMinutes: number | null;
  status: string;
  isHost: boolean;
  host: { id: string; name: string };
  slots: EventScheduleSlotSummary[];
  myResponses: Record<string, EventScheduleAnswer>;
  voters: Array<{
    userId: string;
    name: string;
    responsesBySlotId: Record<string, EventScheduleAnswer | null>;
  }>;
};

type RsvpSource = 'direct' | 'invite_link';
type AdminActivityItem = {
  id: string;
  type: 'event_created' | 'event_reported';
  title: string;
  subtitle: string;
  createdAt: string;
};

function normalizeEventScheduleAnswer(answer: string): EventScheduleAnswer {
  return answer === 'yes' ? 'yes' : 'no';
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventAttendee)
    private readonly attendeesRepo: Repository<EventAttendee>,
    @InjectRepository(EventInvite)
    private readonly invitesRepo: Repository<EventInvite>,
    @InjectRepository(EventReport)
    private readonly eventReportsRepo: Repository<EventReport>,
    @InjectRepository(EventScheduleSlot)
    private readonly scheduleSlotsRepo: Repository<EventScheduleSlot>,
    @InjectRepository(EventScheduleResponse)
    private readonly scheduleResponsesRepo: Repository<EventScheduleResponse>,
    private readonly friendsService: FriendsService,
    private readonly groupsService: GroupsService,
  ) {}

  async create(hostId: string, dto: CreateEventDto): Promise<Event> {
    const eventTimezone = resolveEventTimezone(dto.eventTimezone);
    const type = dto.type === 'open' ? 'open' : 'invite';
    const capacity = type === 'open' ? (dto.capacity ?? null) : null;
    const usePoll = dto.useAvailabilityPoll === true;
    const groupId = dto.groupId ?? null;
    if (groupId) {
      await this.groupsService.assertMembership(groupId, hostId);
    }

    if (usePoll && type === 'open') {
      throw new BadRequestException(
        'Open game nights need a fixed date. Use invite-only when polling availability.',
      );
    }

    if (usePoll) {
      const slotsIn = dto.availabilitySlots ?? [];
      if (slotsIn.length < 1) {
        throw new BadRequestException('Add at least one time option');
      }
      if (dto.dateTime) {
        throw new BadRequestException(
          'Do not send dateTime when using availability polling',
        );
      }
      const schedulingPayload: DeepPartial<Event> = {
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        hostId,
        dateTime: null,
        eventTimezone,
        durationMinutes: dto.durationMinutes ?? null,
        location: dto.location?.trim() ?? null,
        type,
        capacity,
        status: 'scheduling',
        discoveryMode: dto.discoveryMode ?? false,
        autoPromoteWaitlist: dto.autoPromoteWaitlist ?? false,
        groupId,
      };
      const event = this.eventsRepo.create(schedulingPayload);
      const saved = await this.eventsRepo.save(event);

      const slotRows = slotsIn.map((s, i) =>
        this.scheduleSlotsRepo.create({
          eventId: saved.id,
          start: resolveEventDateTime(s.start, eventTimezone),
          label: s.label?.trim() || null,
          sortOrder: i,
        }),
      );
      for (const row of slotRows) {
        if (Number.isNaN(row.start.getTime())) {
          throw new BadRequestException('Invalid slot start time');
        }
      }
      await this.scheduleSlotsRepo.save(slotRows);

      await this.attendeesRepo.save(
        this.attendeesRepo.create({
          eventId: saved.id,
          userId: hostId,
          rsvpStatus: 'going',
        }),
      );
      if (groupId) {
        await this.seedGroupMembersAsPending(saved.id, groupId, hostId);
      }

      return this.findById(saved.id);
    }

    if (!dto.dateTime) {
      throw new BadRequestException('dateTime is required');
    }
    const dateTime = resolveEventDateTime(dto.dateTime, eventTimezone);
    const planningPayload: DeepPartial<Event> = {
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      hostId,
      dateTime,
      eventTimezone,
      durationMinutes: dto.durationMinutes ?? null,
      location: dto.location?.trim() ?? null,
      type,
      capacity,
      status: 'planning',
      discoveryMode: dto.discoveryMode ?? false,
      autoPromoteWaitlist: dto.autoPromoteWaitlist ?? false,
      groupId,
    };
    const event = this.eventsRepo.create(planningPayload);
    const saved = await this.eventsRepo.save(event);

    await this.attendeesRepo.save(
      this.attendeesRepo.create({
        eventId: saved.id,
        userId: hostId,
        rsvpStatus: 'going',
      }),
    );
    if (groupId) {
      await this.seedGroupMembersAsPending(saved.id, groupId, hostId);
    }

    return this.findById(saved.id);
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: [
        'host',
        'group',
        'attendees',
        'attendees.user',
        'candidates',
        'candidates.game',
      ],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  private async seedGroupMembersAsPending(
    eventId: string,
    groupId: string,
    hostId: string,
  ): Promise<void> {
    const memberUserIds = await this.groupsService.getMemberUserIds(groupId);
    const existingRows = await this.attendeesRepo.find({
      where: { eventId },
      select: ['userId'],
    });
    const existingUserIds = new Set(
      existingRows.map((row) => row.userId).filter(Boolean),
    );
    const rows = memberUserIds
      .filter((userId) => userId !== hostId && !existingUserIds.has(userId))
      .map((userId) =>
        this.attendeesRepo.create({
          eventId,
          userId,
          rsvpStatus: 'pending',
          waitlistPriority: null,
          lastStatusChangeAt: new Date(),
          cancellationReason: null,
        }),
      );
    if (!rows.length) return;
    await this.attendeesRepo.save(rows);
  }

  async findByIdForUser(id: string, userId: string): Promise<Event> {
    const event = await this.findById(id);
    if (event.type !== 'invite') {
      return event;
    }

    const isVisible =
      event.hostId === userId ||
      (event.attendees || []).some((attendee) => attendee.userId === userId);
    if (!isVisible) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async findUserEvents(userId: string): Promise<Event[]> {
    return this.eventsRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'attendee')
      .leftJoinAndSelect('event.host', 'host')
      .leftJoin(
        'event.attendees',
        'membership',
        'membership.userId = :userId AND membership.rsvpStatus != :notGoingStatus',
        { userId, notGoingStatus: 'not_going' },
      )
      .where('event.hostId = :userId', { userId })
      .orWhere('membership.id IS NOT NULL')
      .orderBy('event.dateTime', 'DESC', 'NULLS LAST')
      .addOrderBy('event.createdAt', 'DESC')
      .getMany();
  }

  async findOpenEvents(): Promise<Event[]> {
    return this.eventsRepo.find({
      where: {
        type: 'open',
        status: 'planning',
        dateTime: Not(IsNull()),
      },
      relations: ['host', 'attendees'],
      order: { dateTime: 'ASC' },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateEventDto,
  ): Promise<Event> {
    const event = await this.findById(id);
    if (event.hostId !== userId)
      throw new ForbiddenException('Only host can update');
    const statusBeforeUpdate = event.status;
    const useAvailabilityPoll = dto.useAvailabilityPoll === true;
    if (dto.groupId) {
      await this.groupsService.assertMembership(dto.groupId, userId);
    }

    if (event.status === 'scheduling') {
      if (dto.dateTime !== undefined) {
        throw new BadRequestException(
          'This event is still picking a time — finalize the schedule to set the date.',
        );
      }
      if (dto.status !== undefined && dto.status !== 'scheduling') {
        throw new BadRequestException(
          'Finalize the schedule before changing event status.',
        );
      }
    }

    if (useAvailabilityPoll) {
      if ((dto.type ?? event.type) === 'open') {
        throw new BadRequestException(
          'Open game nights need a fixed date. Use invite-only when polling availability.',
        );
      }
      if (dto.dateTime !== undefined) {
        throw new BadRequestException(
          'Do not send dateTime when using availability polling',
        );
      }
      const slotsIn = dto.availabilitySlots ?? [];
      if (slotsIn.length < 1) {
        throw new BadRequestException('Add at least one time option');
      }
      if (slotsIn.length > 32) {
        throw new BadRequestException('Maximum 32 time options');
      }
    }

    if (dto.status === 'voting') {
      const nextDateTime =
        dto.dateTime !== undefined
          ? resolveEventDateTime(dto.dateTime, event.eventTimezone ?? 'UTC')
          : event.dateTime;
      if (!nextDateTime) {
        throw new BadRequestException(
          'Set a date and time before starting voting.',
        );
      }
    }

    if (dto.eventTimezone !== undefined) {
      event.eventTimezone = resolveEventTimezone(dto.eventTimezone);
    }
    if (dto.dateTime !== undefined) {
      event.dateTime = resolveEventDateTime(
        dto.dateTime,
        event.eventTimezone ?? 'UTC',
      );
    }
    if (dto.votingDeadline !== undefined) {
      event.votingDeadline = new Date(dto.votingDeadline);
    }
    if (
      dto.status === 'voting' &&
      statusBeforeUpdate !== 'voting' &&
      event.votingStartedAttendeeCount == null
    ) {
      event.votingStartedAttendeeCount = await this.getGoingAttendeeCount(id);
    }
    const type = dto.type ?? event.type;
    const capacity =
      type === 'open' ? (dto.capacity ?? event.capacity ?? null) : null;

    const {
      dateTime: _ignoredDateTime,
      eventTimezone: _ignoredEventTimezone,
      votingDeadline: _ignoredVotingDeadline,
      capacity: _ignoredCapacity,
      type: _ignoredType,
      useAvailabilityPoll: _ignoredUseAvailabilityPoll,
      availabilitySlots: _ignoredAvailabilitySlots,
      ...rest
    } = dto;

    if (useAvailabilityPoll) {
      event.dateTime = null;
      event.status = 'scheduling';
    }

    Object.assign(event, {
      ...rest,
      type,
      capacity,
      dateTime: event.dateTime,
      eventTimezone: event.eventTimezone,
      votingDeadline: event.votingDeadline,
    });
    await this.eventsRepo.save(event);

    if (useAvailabilityPoll) {
      const slotsIn = dto.availabilitySlots ?? [];
      await this.scheduleResponsesRepo.delete({ eventId: event.id });
      await this.scheduleSlotsRepo.delete({ eventId: event.id });
      const slotRows = slotsIn.map((s, i) =>
        this.scheduleSlotsRepo.create({
          eventId: event.id,
          start: resolveEventDateTime(s.start, event.eventTimezone ?? 'UTC'),
          label: s.label?.trim() || null,
          sortOrder: i,
        }),
      );
      for (const row of slotRows) {
        if (Number.isNaN(row.start.getTime())) {
          throw new BadRequestException('Invalid slot start time');
        }
      }
      await this.scheduleSlotsRepo.save(slotRows);
    }

    return this.findById(id);
  }

  async rsvp(
    eventId: string,
    userId: string,
    status: string,
    cancellationReason?: string,
    source: RsvpSource = 'direct',
  ): Promise<EventAttendee> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new BadRequestException(
        'RSVP cannot be changed for completed or cancelled events',
      );
    }
    if (status === 'not_going' && event.hostId === userId) {
      throw new BadRequestException('Host cannot leave their own event');
    }

    let attendee = await this.attendeesRepo.findOne({
      where: { eventId, userId },
    });
    const isNewAttendee = !attendee;

    if (
      event.type === 'invite' &&
      isNewAttendee &&
      event.hostId !== userId &&
      source !== 'invite_link'
    ) {
      throw new NotFoundException('Event not found');
    }

    if (
      event.type === 'open' &&
      status === 'going' &&
      attendee?.rsvpStatus !== 'going' &&
      event.status !== 'planning'
    ) {
      throw new BadRequestException(
        'Open event is no longer accepting new attendees',
      );
    }

    if (status === 'going' && attendee?.rsvpStatus !== 'going') {
      await this.ensureCapacityAvailable(eventId, event.capacity);
    }

    const previousStatus = attendee?.rsvpStatus;
    if (attendee) {
      if (status === 'not_going' && attendee.userId !== event.hostId) {
        const removed = await this.attendeesRepo.remove(attendee);
        await this.handleAttendanceImpact(
          eventId,
          previousStatus,
          'not_going',
          cancellationReason,
        );
        return { ...removed, rsvpStatus: 'not_going' };
      }

      attendee.rsvpStatus = status;
      attendee.lastStatusChangeAt = new Date();
      attendee.cancellationReason =
        status === 'not_going' ? cancellationReason?.trim() || null : null;
      attendee.waitlistPriority = null;
      const saved = await this.attendeesRepo.save(attendee);
      await this.handleAttendanceImpact(
        eventId,
        previousStatus,
        status,
        cancellationReason,
      );
      return saved;
    }
    attendee = this.attendeesRepo.create({
      eventId,
      userId,
      rsvpStatus: status,
      waitlistPriority: null,
      lastStatusChangeAt: new Date(),
      cancellationReason:
        status === 'not_going' ? cancellationReason?.trim() || null : null,
    });
    const saved = await this.attendeesRepo.save(attendee);
    await this.handleAttendanceImpact(
      eventId,
      undefined,
      status,
      cancellationReason,
    );
    return saved;
  }

  private async handleAttendanceImpact(
    eventId: string,
    previousStatus: string | undefined,
    nextStatus: string,
    cancellationReason?: string,
  ): Promise<void> {
    if (previousStatus === nextStatus) return;
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) return;
    event.lastAttendanceChangeAt = new Date();
    if (
      previousStatus === 'going' &&
      nextStatus === 'not_going' &&
      cancellationReason
    ) {
      event.lateCancellationCount = (event.lateCancellationCount ?? 0) + 1;
    }
    if (event.status === 'voting' || event.status === 'confirmed') {
      event.attendanceChangeAfterDecision = true;
    }
    await this.eventsRepo.save(event);
  }

  async clearAttendanceDecisionFlag(
    eventId: string,
    hostUserId: string,
  ): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.hostId !== hostUserId) {
      throw new ForbiddenException('Only host can clear decision alerts');
    }
    event.attendanceChangeAfterDecision = false;
    await this.eventsRepo.save(event);
    return this.findById(eventId);
  }

  async getCancellationAnalytics(eventId: string) {
    const event = await this.findById(eventId);
    const attendees = event.attendees || [];
    const cancelled = attendees.filter((a) => a.rsvpStatus === 'not_going');
    const standby = attendees.filter((a) => a.rsvpStatus === 'standby');
    const reasonBuckets: Record<string, number> = {};
    for (const attendee of cancelled) {
      const rawReason = attendee.cancellationReason?.trim().toLowerCase();
      const bucket = rawReason || 'unspecified';
      reasonBuckets[bucket] = (reasonBuckets[bucket] || 0) + 1;
    }

    return {
      totalCancelled: cancelled.length,
      totalStandby: standby.length,
      lateCancellationCount: event.lateCancellationCount || 0,
      autoPromoteWaitlist: !!event.autoPromoteWaitlist,
      reasonBuckets,
    };
  }

  async createInviteLink(
    eventId: string,
    userId: string,
  ): Promise<EventInvite> {
    const event = await this.findById(eventId);
    if (event.hostId !== userId)
      throw new ForbiddenException('Only host can create invite links');
    if (event.status !== 'planning' && event.status !== 'scheduling') {
      throw new BadRequestException(
        'Invite links can only be created while the event is being planned or scheduled',
      );
    }
    const token = uuid();
    const invite = this.invitesRepo.create({ eventId, token });
    return this.invitesRepo.save(invite);
  }

  async joinViaInvite(token: string, userId: string): Promise<EventAttendee> {
    const invite = await this.invitesRepo.findOne({ where: { token } });
    if (!invite) throw new NotFoundException('Invalid invite link');
    return this.rsvp(invite.eventId, userId, 'going', undefined, 'invite_link');
  }

  async getInviteEvent(token: string): Promise<Event> {
    const invite = await this.invitesRepo.findOne({ where: { token } });
    if (!invite) throw new NotFoundException('Invalid invite link');
    return this.findById(invite.eventId);
  }

  async trackInviteTelemetry(
    token: string,
    eventName: string,
    payload?: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const invite = await this.invitesRepo.findOne({
      where: { token },
      select: ['eventId'],
    });
    if (!invite) throw new NotFoundException('Invalid invite link');
    this.logger.log(
      JSON.stringify({
        type: 'invite_telemetry',
        eventId: invite.eventId,
        eventName,
        payload: payload ?? {},
      }),
    );
    return { ok: true };
  }

  async getAttendeeUserIds(eventId: string): Promise<string[]> {
    const attendees = await this.attendeesRepo.find({
      where: { eventId, rsvpStatus: 'going' },
    });
    return attendees.filter((a) => a.userId).map((a) => a.userId);
  }

  async getGoingAttendeeCount(eventId: string): Promise<number> {
    return this.attendeesRepo.count({
      where: { eventId, rsvpStatus: 'going' },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.findById(id);
    if (event.hostId !== userId)
      throw new ForbiddenException('Only host can delete');
    await this.eventsRepo.remove(event);
  }

  async deleteForAdmin(id: string): Promise<void> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    await this.eventsRepo.remove(event);
  }

  async removeAttendee(
    eventId: string,
    hostUserId: string,
    attendeeId: string,
  ): Promise<void> {
    const event = await this.findById(eventId);
    if (event.hostId !== hostUserId) {
      throw new ForbiddenException('Only host can remove attendees');
    }
    if (
      event.status === 'past' ||
      event.status === 'completed' ||
      event.status === 'cancelled'
    ) {
      throw new BadRequestException(
        'Attendees cannot be removed for past, completed, or cancelled events',
      );
    }

    const attendee = await this.attendeesRepo.findOne({
      where: { id: attendeeId, eventId },
    });
    if (!attendee) throw new NotFoundException('Attendee not found');

    if (attendee.userId === event.hostId) {
      throw new BadRequestException('Host cannot be removed from event');
    }

    await this.attendeesRepo.remove(attendee);
  }

  async getInviteableFriends(
    eventId: string,
    hostUserId: string,
  ): Promise<User[]> {
    const event = await this.findById(eventId);
    if (event.hostId !== hostUserId) {
      throw new ForbiddenException('Only host can invite friends');
    }

    const friendIds = await this.friendsService.getFriendIds(hostUserId);
    if (friendIds.length === 0) {
      return [];
    }

    const attendeeUserIds = new Set(
      (event.attendees || [])
        .map((attendee) => attendee.userId)
        .filter((userId): userId is string => Boolean(userId)),
    );

    const inviteableUserIds = friendIds.filter(
      (friendId) => !attendeeUserIds.has(friendId),
    );
    if (inviteableUserIds.length === 0) {
      return [];
    }

    return this.attendeesRepo.manager.getRepository(User).find({
      where: inviteableUserIds.map((id) => ({ id })),
      order: { name: 'ASC' },
    });
  }

  async inviteFriends(
    eventId: string,
    hostUserId: string,
    userIds: string[],
  ): Promise<{
    invitedUserIds: string[];
    alreadyAttendingUserIds: string[];
    notFriendsUserIds: string[];
  }> {
    const event = await this.findById(eventId);
    if (event.hostId !== hostUserId) {
      throw new ForbiddenException('Only host can invite friends');
    }

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return {
        invitedUserIds: [],
        alreadyAttendingUserIds: [],
        notFriendsUserIds: [],
      };
    }

    const friendIds = new Set(
      await this.friendsService.getFriendIds(hostUserId),
    );
    const attendeeByUserId = new Set(
      (event.attendees || [])
        .map((attendee) => attendee.userId)
        .filter((userId): userId is string => Boolean(userId)),
    );

    const invitedUserIds: string[] = [];
    const alreadyAttendingUserIds: string[] = [];
    const notFriendsUserIds: string[] = [];

    for (const userId of uniqueUserIds) {
      if (!friendIds.has(userId)) {
        notFriendsUserIds.push(userId);
        continue;
      }
      if (attendeeByUserId.has(userId)) {
        alreadyAttendingUserIds.push(userId);
        continue;
      }

      const attendee = this.attendeesRepo.create({
        eventId,
        userId,
        rsvpStatus: 'pending',
        waitlistPriority: null,
        lastStatusChangeAt: new Date(),
        cancellationReason: null,
      });
      await this.attendeesRepo.save(attendee);
      invitedUserIds.push(userId);
      attendeeByUserId.add(userId);
    }

    return {
      invitedUserIds,
      alreadyAttendingUserIds,
      notFriendsUserIds,
    };
  }

  private assertUserCanAccessEventSchedule(event: Event, userId: string): void {
    if (event.hostId === userId) return;
    if (event.type === 'invite') {
      const visible = (event.attendees || []).some(
        (a) => a.userId === userId && a.rsvpStatus !== 'not_going',
      );
      if (!visible) {
        throw new ForbiddenException('Event not found');
      }
    }
  }

  private assertCanRespondToEventSchedule(event: Event, userId: string): void {
    this.assertUserCanAccessEventSchedule(event, userId);
    if (event.hostId === userId) return;
    const row = event.attendees?.find((a) => a.userId === userId);
    if (!row || row.rsvpStatus === 'not_going') {
      throw new ForbiddenException(
        'Join this event before responding to availability',
      );
    }
  }

  async getScheduleDetail(
    eventId: string,
    userId: string,
  ): Promise<EventScheduleDetail> {
    const event = await this.findById(eventId);
    if (event.status !== 'scheduling') {
      throw new BadRequestException('This event is not in scheduling mode');
    }
    this.assertUserCanAccessEventSchedule(event, userId);

    const slots = await this.scheduleSlotsRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const slotIds = slots.map((s) => s.id);
    const responses =
      slotIds.length === 0
        ? []
        : await this.scheduleResponsesRepo.find({
            where: { eventId, slotId: In(slotIds) },
          });

    const countsBySlot: Record<string, { yes: number; no: number }> = {};
    for (const sid of slotIds) {
      countsBySlot[sid] = { yes: 0, no: 0 };
    }
    for (const r of responses) {
      const c = countsBySlot[r.slotId];
      if (!c) continue;
      const answer = normalizeEventScheduleAnswer(r.answer);
      if (answer === 'yes') c.yes += 1;
      else c.no += 1;
    }

    const voterIds = new Set<string>();
    voterIds.add(event.hostId);
    for (const a of event.attendees || []) {
      if (a.userId && a.rsvpStatus !== 'not_going') {
        voterIds.add(a.userId);
      }
    }

    const votersMeta =
      voterIds.size === 0
        ? []
        : await this.attendeesRepo.manager.getRepository(User).find({
            where: [...voterIds].map((id) => ({ id })),
            select: ['id', 'name'],
          });
    const nameById = new Map(votersMeta.map((u) => [u.id, u.name]));

    const myResponses: Record<string, EventScheduleAnswer> = {};
    for (const r of responses) {
      if (r.userId === userId) {
        myResponses[r.slotId] = normalizeEventScheduleAnswer(r.answer);
      }
    }

    const responsesByUserSlot = new Map<
      string,
      Map<string, EventScheduleAnswer>
    >();
    for (const uid of voterIds) {
      responsesByUserSlot.set(uid, new Map());
    }
    for (const r of responses) {
      responsesByUserSlot
        .get(r.userId)
        ?.set(r.slotId, normalizeEventScheduleAnswer(r.answer));
    }

    const voters = [...voterIds].map((uid) => {
      const bySlot: Record<string, EventScheduleAnswer | null> = {};
      const row = responsesByUserSlot.get(uid) ?? new Map();
      for (const sid of slotIds) {
        bySlot[sid] = row.get(sid) ?? null;
      }
      return {
        userId: uid,
        name: nameById.get(uid) ?? 'Unknown',
        responsesBySlotId: bySlot,
      };
    });
    voters.sort((a, b) => a.name.localeCompare(b.name));

    return {
      eventId: event.id,
      title: event.title,
      eventTimezone: event.eventTimezone ?? 'UTC',
      durationMinutes: event.durationMinutes ?? null,
      status: event.status,
      isHost: event.hostId === userId,
      host: {
        id: event.host.id,
        name: event.host.name,
      },
      slots: slots.map((s) => ({
        id: s.id,
        start: s.start.toISOString(),
        label: s.label,
        sortOrder: s.sortOrder,
        counts: countsBySlot[s.id] ?? { yes: 0, no: 0 },
      })),
      myResponses,
      voters,
    };
  }

  async setScheduleResponses(
    eventId: string,
    userId: string,
    dto: SetEventScheduleResponsesDto,
  ): Promise<void> {
    const event = await this.findById(eventId);
    if (event.status !== 'scheduling') {
      throw new BadRequestException('This event is not in scheduling mode');
    }
    this.assertCanRespondToEventSchedule(event, userId);

    const pollSlots = await this.scheduleSlotsRepo.find({ where: { eventId } });
    const validSlotIds = new Set(pollSlots.map((s) => s.id));

    const entries = Object.entries(dto.responses);
    if (entries.length > 64) {
      throw new BadRequestException('Too many response entries');
    }
    for (const [slotId, answer] of entries) {
      if (!validSlotIds.has(slotId)) {
        throw new BadRequestException(`Unknown slot: ${slotId}`);
      }
      if (typeof answer !== 'string' || !isValidEventScheduleAnswer(answer)) {
        throw new BadRequestException(`Invalid answer for slot ${slotId}`);
      }
    }
    for (const [slotId, answer] of entries) {
      const existing = await this.scheduleResponsesRepo.findOne({
        where: { slotId, userId },
      });
      if (existing) {
        existing.answer = answer;
        await this.scheduleResponsesRepo.save(existing);
      } else {
        await this.scheduleResponsesRepo.save(
          this.scheduleResponsesRepo.create({
            eventId,
            slotId,
            userId,
            answer,
          }),
        );
      }
    }
  }

  async finalizeSchedule(
    eventId: string,
    hostId: string,
    winningSlotId: string,
  ): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.hostId !== hostId) {
      throw new ForbiddenException('Only the host can finalize the schedule');
    }
    if (event.status !== 'scheduling') {
      throw new BadRequestException('This event is not in scheduling mode');
    }
    const slot = await this.scheduleSlotsRepo.findOne({
      where: { id: winningSlotId, eventId },
    });
    if (!slot) {
      throw new BadRequestException(
        'That time option does not belong to this event',
      );
    }
    event.dateTime = slot.start;
    event.status = 'planning';
    await this.scheduleSlotsRepo.delete({ eventId });
    await this.eventsRepo.save(event);
    return this.findById(eventId);
  }

  async assertHostAccess(eventId: string, userId: string): Promise<void> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      select: ['id', 'hostId'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only host can access analytics');
    }
  }

  async markPastEventsAsCompleted(now: Date = new Date()): Promise<number> {
    const activeStatuses = ['planning', 'voting', 'confirmed', 'active'];
    const candidates = await this.eventsRepo.find({
      where: {
        status: In(activeStatuses),
      },
      select: ['id', 'title', 'dateTime', 'durationMinutes', 'status', 'type'],
    });

    let updated = 0;
    for (const event of candidates) {
      if (!event.dateTime) continue;
      const eventEndsAt = new Date(
        new Date(event.dateTime).getTime() +
          (event.durationMinutes ?? 0) * 60_000,
      );
      if (eventEndsAt > now) continue;

      event.status = 'completed';
      await this.eventsRepo.save(event);
      updated += 1;
      this.logger.log(`Auto-completed past event ${event.id}: ${event.title}`);
    }

    return updated;
  }

  async listAllForAdmin(query: AdminListEventsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const qb = this.eventsRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.host', 'host')
      .orderBy('event.dateTime', 'DESC', 'NULLS LAST')
      .addOrderBy('event.createdAt', 'DESC');

    if (query.status) {
      qb.andWhere('event.status = :status', { status: query.status });
    }

    if (query.hostId) {
      qb.andWhere('event.hostId = :hostId', { hostId: query.hostId });
    }

    if (query.reportedOnly === 'true') {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM "event_reports" "report_filter"
          WHERE "report_filter"."eventId" = event.id
        )`,
      );
    }

    const totalQuery = qb.clone();
    qb.addSelect(
      `(
        SELECT COUNT(1)
        FROM "event_reports" "report_count"
        WHERE "report_count"."eventId" = event.id
      )`,
      'openReportCount',
    );
    qb.addSelect(
      `(
        SELECT MAX("report_last"."createdAt")
        FROM "event_reports" "report_last"
        WHERE "report_last"."eventId" = event.id
      )`,
      'lastReportedAt',
    );
    qb.skip(skip).take(pageSize);

    const [{ entities, raw }, total] = await Promise.all([
      qb.getRawAndEntities(),
      totalQuery.getCount(),
    ]);
    const items = entities.map((event, index) => ({
      ...event,
      openReportCount: Number(raw[index]?.openReportCount ?? 0),
      lastReportedAt: raw[index]?.lastReportedAt
        ? new Date(raw[index].lastReportedAt).toISOString()
        : null,
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async getAdminSummary() {
    const [totalEvents, openEvents, reportsLast7d, reportedOpenEvents] =
      await Promise.all([
        this.eventsRepo.count(),
        this.eventsRepo.count({ where: { type: 'open' } }),
        this.eventReportsRepo
          .createQueryBuilder('report')
          .where(`report."createdAt" >= NOW() - INTERVAL '7 days'`)
          .getCount(),
        this.eventsRepo
          .createQueryBuilder('event')
          .where('event.type = :type', { type: 'open' })
          .andWhere(
            `EXISTS (
              SELECT 1
              FROM "event_reports" "report_filter"
              WHERE "report_filter"."eventId" = event.id
            )`,
          )
          .getCount(),
      ]);

    return {
      totalEvents,
      openEvents,
      reportedOpenEvents,
      reportsLast7d,
    };
  }

  async getAdminActivity(query: { page?: number; pageSize?: number }) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const seedSize = pageSize * 3;

    const [latestEvents, latestReports] = await Promise.all([
      this.eventsRepo.find({
        relations: ['host'],
        order: { createdAt: 'DESC' },
        take: seedSize,
      }),
      this.eventReportsRepo.find({
        relations: ['event', 'reporter'],
        order: { createdAt: 'DESC' },
        take: seedSize,
      }),
    ]);

    const eventItems: AdminActivityItem[] = latestEvents.map((event) => ({
      id: `event_created:${event.id}`,
      type: 'event_created',
      title: event.title,
      subtitle: `Created by ${event.host?.name || event.hostId}`,
      createdAt: event.createdAt.toISOString(),
    }));

    const reportItems: AdminActivityItem[] = latestReports.map((report) => ({
      id: `event_reported:${report.id}`,
      type: 'event_reported',
      title: report.event?.title || `Event ${report.eventId}`,
      subtitle: `Reported by ${report.reporter?.name || report.reporterUserId}: ${report.reason}`,
      createdAt: report.createdAt.toISOString(),
    }));

    const merged = [...eventItems, ...reportItems].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    const total = merged.length;
    const items = merged.slice(skip, skip + pageSize);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async reportOpenEvent(
    eventId: string,
    reporterUserId: string,
    dto: ReportEventDto,
  ) {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      select: ['id', 'type'],
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.type !== 'open') {
      throw new BadRequestException('Only open events can be reported');
    }

    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Report reason is required');
    }

    const existing = await this.eventReportsRepo.findOne({
      where: { eventId, reporterUserId },
      select: ['id', 'createdAt'],
    });
    if (existing) {
      return {
        reported: true,
        deduped: true,
        reportedAt: existing.createdAt,
      };
    }

    const created = await this.eventReportsRepo.save(
      this.eventReportsRepo.create({
        eventId,
        reporterUserId,
        reason,
        details: dto.details?.trim() || null,
      }),
    );

    return {
      reported: true,
      deduped: false,
      reportedAt: created.createdAt,
    };
  }

  private async ensureCapacityAvailable(
    eventId: string,
    capacity: number | null | undefined,
  ): Promise<void> {
    if (!capacity || capacity < 1) {
      return;
    }
    const goingCount = await this.getGoingAttendeeCount(eventId);
    if (goingCount >= capacity) {
      throw new ConflictException('Event is full');
    }
  }
}
