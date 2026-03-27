import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThan } from 'typeorm';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { VotingService } from '../voting/voting.service';
import { NotificationDeliveryService } from './notification-delivery.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    private readonly votingService: VotingService,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  private getEventUrls(eventId: string): {
    eventUrl: string;
    feedbackUrl: string;
  } {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const eventUrl = `${frontendUrl}/events/${eventId}`;
    return {
      eventUrl,
      feedbackUrl: `${eventUrl}#feedback`,
    };
  }

  private getEmailRecipients(
    attendees: Event['attendees'],
  ): Array<{ email: string; name?: string; userId?: string }> {
    return attendees
      .filter((a) => a.rsvpStatus === 'going' && !!a.user?.email)
      .map((a) => ({
        email: a.user?.email || '',
        name: a.user?.name || undefined,
        userId: a.userId || undefined,
      }));
  }

  async sendVotingStartedNotification(eventId: string): Promise<void> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['attendees', 'attendees.user'],
    });
    if (!event) return;

    const recipients = this.getEmailRecipients(event.attendees || []);
    if (!recipients.length) return;

    const { eventUrl, feedbackUrl } = this.getEventUrls(event.id);
    await this.deliveryService.send({
      eventId: event.id,
      type: 'voting_started',
      idempotencyKey: `voting_started:${event.id}`,
      title: `Voting started: ${event.title}`,
      body: 'Voting is now open. Rank your game preferences before the deadline.',
      recipientCount: recipients.length,
      recipients,
      eventUrl,
      feedbackUrl,
      metadata: {
        votingDeadline: event.votingDeadline
          ? new Date(event.votingDeadline).toISOString()
          : undefined,
        attendeeIds: recipients
          .map((a) => a.userId)
          .filter((id): id is string => Boolean(id)),
      },
    });
    this.logger.log(
      `Voting-started notification dispatched for "${event.title}" (${recipients.length} recipients)`,
    );
  }

  async sendAllVotedNotification(eventId: string): Promise<void> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['attendees', 'attendees.user'],
    });
    if (!event) return;

    const recipients = this.getEmailRecipients(event.attendees || []);
    if (!recipients.length) return;

    const { eventUrl, feedbackUrl } = this.getEventUrls(event.id);
    await this.deliveryService.send({
      eventId: event.id,
      type: 'all_voted',
      idempotencyKey: `all_voted:${event.id}`,
      title: `Voting complete: ${event.title}`,
      body: 'Everyone has voted. Review results and pick the winning game.',
      recipientCount: recipients.length,
      recipients,
      eventUrl,
      feedbackUrl,
      metadata: {
        votingDeadline: event.votingDeadline
          ? new Date(event.votingDeadline).toISOString()
          : undefined,
        attendeeIds: recipients
          .map((a) => a.userId)
          .filter((id): id is string => Boolean(id)),
      },
    });
    this.logger.log(
      `All-voted notification dispatched for "${event.title}" (${recipients.length} recipients)`,
    );
  }

  async sendCancellationOrSpotUpdate(
    eventId: string,
    actorUserId: string,
    newStatus: string,
    cancellationReason?: string,
  ): Promise<void> {
    if (newStatus !== 'not_going') return;
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['attendees', 'attendees.user', 'host'],
    });
    if (!event) return;

    const actor = event.attendees.find((a) => a.userId === actorUserId);
    const actorName = actor?.user?.name || 'An attendee';
    const reason = cancellationReason?.trim();

    const hostRecipients = event.host?.email
      ? [
          {
            email: event.host.email,
            name: event.host.name || undefined,
            userId: event.hostId || undefined,
          },
        ]
      : [];
    const standbyRecipients = this.getRecipientsByStatuses(event.attendees, [
      'standby',
    ]);
    const { eventUrl, feedbackUrl } = this.getEventUrls(event.id);

    if (hostRecipients.length > 0) {
      const hourBucket = new Date().toISOString().slice(0, 13);
      await this.deliveryService.send({
        eventId: event.id,
        type: 'attendance_change',
        idempotencyKey: `attendance_change:host:${event.id}:${actorUserId}:${hourBucket}`,
        title: `Last-minute cancellation in ${event.title}`,
        body: reason
          ? `${actorName} can no longer attend (${reason}).`
          : `${actorName} can no longer attend.`,
        recipientCount: hostRecipients.length,
        recipients: hostRecipients,
        eventUrl,
        feedbackUrl,
        metadata: {
          actorUserId,
          actorName,
          reason: reason || null,
          currentGoingCount: event.attendees.filter(
            (a) => a.rsvpStatus === 'going',
          ).length,
        },
      });
    }

    if (standbyRecipients.length > 0) {
      const hourBucket = new Date().toISOString().slice(0, 13);
      await this.deliveryService.send({
        eventId: event.id,
        type: 'spot_opened',
        idempotencyKey: `spot_opened:${event.id}:${hourBucket}`,
        title: `Spot opened for ${event.title}`,
        body: 'A spot just opened up. Update your RSVP if you can join.',
        recipientCount: standbyRecipients.length,
        recipients: standbyRecipients,
        eventUrl,
        feedbackUrl,
        metadata: {
          actorUserId,
          reason: reason || null,
        },
      });
    }
  }

  private getRecipientsByStatuses(
    attendees: EventAttendee[],
    statuses: string[],
  ): Array<{ email: string; name?: string; userId?: string }> {
    const statusSet = new Set(statuses);
    return attendees
      .filter((a) => statusSet.has(a.rsvpStatus) && !!a.user?.email)
      .map((a) => ({
        email: a.user?.email || '',
        name: a.user?.name || undefined,
        userId: a.userId || undefined,
      }));
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCloseExpiredVoting() {
    const now = new Date();
    const events = await this.eventsRepo.find({
      where: {
        status: 'voting',
        votingDeadline: LessThanOrEqual(now),
      },
    });

    for (const event of events) {
      this.logger.log(
        `Auto-closing voting for event ${event.id}: ${event.title}`,
      );
      await this.votingService.autoCloseVoting(event.id);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedDeliveries() {
    const retried = await this.deliveryService.retryFailedDeliveries();
    if (retried > 0) {
      this.logger.log(`Retried ${retried} failed notification deliveries`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingEventReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingEvents = await this.eventsRepo.find({
      where: {
        dateTime: Between(now, in24h),
        status: 'confirmed',
      },
      relations: ['attendees', 'attendees.user'],
    });

    for (const event of upcomingEvents) {
      const recipients = this.getEmailRecipients(event.attendees);
      const { eventUrl, feedbackUrl } = this.getEventUrls(event.id);
      const reminderPayload = {
        eventId: event.id,
        type: 'event_reminder' as const,
        idempotencyKey: `event_reminder:${event.id}:${event.dateTime.toISOString().slice(0, 16)}`,
        title: `Reminder: ${event.title}`,
        body: `Your event starts within 24 hours.`,
        recipientCount: recipients.length,
        recipients,
        eventUrl,
        feedbackUrl,
        metadata: {
          dateTime: event.dateTime,
          attendeeIds: recipients
            .map((a) => a.userId)
            .filter((id): id is string => Boolean(id)),
        },
      };
      await this.deliveryService.send(reminderPayload);
      this.logger.log(
        `Reminder dispatched for "${event.title}" to ${recipients.length} attendees`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async promptPostEventFeedback() {
    const now = new Date();
    const past6h = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    const recentlyCompleted = await this.eventsRepo.find({
      where: {
        status: 'completed',
        dateTime: MoreThan(past6h),
      },
      relations: ['attendees', 'attendees.user', 'feedbacks'],
    });

    for (const event of recentlyCompleted) {
      const endTime = new Date(
        new Date(event.dateTime).getTime() +
          (event.durationMinutes ?? 0) * 60_000,
      );
      if (endTime > now) continue;

      const attendeesWithoutFeedback = event.attendees.filter(
        (a) =>
          a.rsvpStatus === 'going' &&
          !event.feedbacks.some((f) => f.userId === a.userId),
      );
      const recipients = attendeesWithoutFeedback
        .filter((a) => !!a.user?.email)
        .map((a) => ({
          email: a.user?.email || '',
          name: a.user?.name || undefined,
          userId: a.userId || undefined,
        }));
      const { eventUrl, feedbackUrl } = this.getEventUrls(event.id);

      if (recipients.length > 0) {
        await this.deliveryService.send({
          eventId: event.id,
          type: 'feedback_prompt',
          idempotencyKey: `feedback_prompt:${event.id}:${endTime.toISOString().slice(0, 13)}`,
          title: `How was ${event.title}?`,
          body: 'Share quick post-event feedback to improve next recommendations.',
          recipientCount: recipients.length,
          recipients,
          eventUrl,
          feedbackUrl,
          metadata: {
            attendeeIds: recipients
              .map((a) => a.userId)
              .filter((id): id is string => Boolean(id)),
            eventEndedAt: endTime.toISOString(),
          },
        });
        this.logger.log(
          `Feedback prompt dispatched for "${event.title}" (${recipients.length} recipients)`,
        );
      }
    }
  }

  getDeliveryMetrics(eventId?: string) {
    return this.deliveryService.getDeliveryMetrics(eventId);
  }
}
