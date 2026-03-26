import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventInvite } from '../entities/event-invite.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ManualSessionTimingDto } from './dto/manual-session-timing.dto';
import { resolveEventDateTime, resolveEventTimezone } from './timezone.utils';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventAttendee)
    private readonly attendeesRepo: Repository<EventAttendee>,
    @InjectRepository(EventInvite)
    private readonly invitesRepo: Repository<EventInvite>,
  ) {}

  async create(hostId: string, dto: CreateEventDto): Promise<Event> {
    const eventTimezone = resolveEventTimezone(dto.eventTimezone);
    const dateTime = resolveEventDateTime(dto.dateTime, eventTimezone);
    const event = this.eventsRepo.create({
      ...dto,
      hostId,
      dateTime,
      eventTimezone,
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

  async findUserEvents(userId: string): Promise<Event[]> {
    return this.eventsRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'attendee')
      .leftJoinAndSelect('event.host', 'host')
      .where('event.hostId = :userId', { userId })
      .orWhere('attendee.userId = :userId', { userId })
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
    Object.assign(event, {
      ...dto,
      dateTime: event.dateTime,
      eventTimezone: event.eventTimezone,
      votingDeadline: event.votingDeadline,
    });
    await this.eventsRepo.save(event);
    return this.findById(id);
  }

  async startSession(eventId: string, userId: string): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only host can start session timer');
    }
    if (!event.sessionStartedAt) {
      event.sessionStartedAt = new Date();
      event.sessionTimingSource = 'timer';
    }
    await this.eventsRepo.save(event);
    return this.findById(eventId);
  }

  async endSession(eventId: string, userId: string): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only host can end session timer');
    }
    if (!event.sessionStartedAt) {
      throw new BadRequestException('Session timer has not been started');
    }
    if (event.sessionEndedAt) {
      throw new BadRequestException('Session timer already ended');
    }

    event.sessionEndedAt = new Date();
    const diffMs =
      event.sessionEndedAt.getTime() - event.sessionStartedAt.getTime();
    event.sessionTotalMinutes = Math.max(0, Math.round(diffMs / 60000));
    event.sessionTimingSource = 'timer';
    await this.eventsRepo.save(event);
    return this.findById(eventId);
  }

  async setManualSessionTiming(
    eventId: string,
    userId: string,
    dto: ManualSessionTimingDto,
  ): Promise<Event> {
    const event = await this.findById(eventId);
    if (event.hostId !== userId) {
      throw new ForbiddenException('Only host can edit session timing');
    }

    const startedAt = resolveEventDateTime(
      dto.startedAt,
      event.eventTimezone ?? 'UTC',
    );
    const endedAt = resolveEventDateTime(
      dto.endedAt,
      event.eventTimezone ?? 'UTC',
    );
    if (endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('endedAt must be after startedAt');
    }

    event.sessionStartedAt = startedAt;
    event.sessionEndedAt = endedAt;
    event.sessionTotalMinutes = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 60000,
    );
    event.sessionTimingSource = 'manual';
    await this.eventsRepo.save(event);
    return this.findById(eventId);
  }

  async rsvp(
    eventId: string,
    userId: string,
    status: string,
  ): Promise<EventAttendee> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'planning') {
      throw new BadRequestException(
        'RSVP cannot be changed after voting has started',
      );
    }

    let attendee = await this.attendeesRepo.findOne({
      where: { eventId, userId },
    });
    if (attendee) {
      attendee.rsvpStatus = status;
      return this.attendeesRepo.save(attendee);
    }
    attendee = this.attendeesRepo.create({
      eventId,
      userId,
      rsvpStatus: status,
    });
    return this.attendeesRepo.save(attendee);
  }

  async guestRsvp(
    eventId: string,
    guestName: string,
    status: string,
  ): Promise<EventAttendee> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== 'planning') {
      throw new BadRequestException(
        'RSVP cannot be changed after voting has started',
      );
    }

    const normalized = guestName.trim().toLowerCase();
    const existing = await this.attendeesRepo
      .createQueryBuilder('attendee')
      .where('attendee.eventId = :eventId', { eventId })
      .andWhere('attendee.isGuest = true')
      .andWhere('LOWER(attendee.guestName) = :guestName', {
        guestName: normalized,
      })
      .getOne();

    if (existing) {
      existing.guestName = guestName.trim();
      existing.rsvpStatus = status;
      return this.attendeesRepo.save(existing);
    }

    const attendee = this.attendeesRepo.create({
      eventId,
      guestName: guestName.trim(),
      rsvpStatus: status,
      isGuest: true,
    });
    return this.attendeesRepo.save(attendee);
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
    return this.rsvp(invite.eventId, userId, 'going');
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

  async delete(id: string, userId: string): Promise<void> {
    const event = await this.findById(id);
    if (event.hostId !== userId)
      throw new ForbiddenException('Only host can delete');
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
    if (event.status !== 'planning') {
      throw new BadRequestException(
        'Attendees can only be removed while event is in planning',
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
}
