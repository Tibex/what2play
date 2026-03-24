import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan } from 'typeorm';
import { Event } from '../entities/event.entity';
import { VotingService } from '../voting/voting.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    private votingService: VotingService,
  ) {}

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
      this.logger.log(`Auto-closing voting for event ${event.id}: ${event.title}`);
      await this.votingService.autoCloseVoting(event.id);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendUpcomingEventReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingEvents = await this.eventsRepo.find({
      where: {
        dateTime: LessThanOrEqual(in24h),
        status: 'confirmed',
      },
      relations: ['attendees', 'attendees.user'],
    });

    for (const event of upcomingEvents) {
      const goingAttendees = event.attendees.filter((a) => a.rsvpStatus === 'going');
      this.logger.log(
        `Reminder: Event "${event.title}" in <24h — ${goingAttendees.length} attendees going`,
      );
      // In production: send push notifications / emails to attendees
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
      relations: ['attendees', 'feedbacks'],
    });

    for (const event of recentlyCompleted) {
      const attendeesWithoutFeedback = event.attendees.filter(
        (a) => a.rsvpStatus === 'going' && !event.feedbacks.some((f) => f.userId === a.userId),
      );

      if (attendeesWithoutFeedback.length > 0) {
        this.logger.log(
          `Feedback prompt: ${attendeesWithoutFeedback.length} attendees haven't submitted feedback for "${event.title}"`,
        );
        // In production: send push notification / email prompts
      }
    }
  }
}
