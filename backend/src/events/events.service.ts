import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { EventReport } from '../entities/event-report.entity';
import { User } from '../entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AdminListEventsQueryDto } from './dto/admin-list-events-query.dto';
import { ReportEventDto } from './dto/report-event.dto';
import { resolveEventDateTime, resolveEventTimezone } from './timezone.utils';
import { FriendsService } from '../friends/friends.service';

type RsvpSource = 'direct' | 'invite_link';

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
    private readonly friendsService: FriendsService,
  ) {}

  async create(hostId: string, dto: CreateEventDto): Promise<Event> {
    const eventTimezone = resolveEventTimezone(dto.eventTimezone);
    const dateTime = resolveEventDateTime(dto.dateTime, eventTimezone);
    const type = dto.type === 'open' ? 'open' : 'invite';
    const capacity = type === 'open' ? (dto.capacity ?? null) : null;
    const event = this.eventsRepo.create({
      ...dto,
      hostId,
      dateTime,
      eventTimezone,
      type,
      capacity,
    });
    const saved = await this.eventsRepo.save(event);

    await this.attendeesRepo.save(
      this.attendeesRepo.create({
        eventId: saved.id,
        userId: hostId,
        rsvpStatus: 'going',
      }),
    );

    return this.findById(saved.id);
  }

  async findById(id: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({
      where: { id },
      relations: [
        'host',
        'attendees',
        'attendees.user',
        'candidates',
        'candidates.game',
      ],
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
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
      .orderBy('event.dateTime', 'DESC')
      .getMany();
  }

  async findOpenEvents(): Promise<Event[]> {
    return this.eventsRepo.find({
      where: { type: 'open', status: 'planning' },
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
      ...rest
    } = dto;

    Object.assign(event, {
      ...rest,
      type,
      capacity,
      dateTime: event.dateTime,
      eventTimezone: event.eventTimezone,
      votingDeadline: event.votingDeadline,
    });
    await this.eventsRepo.save(event);
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
    if (event.status !== 'planning') {
      throw new BadRequestException(
        'Invite links can only be created while event is in planning',
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
      .orderBy('event.dateTime', 'DESC');

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
