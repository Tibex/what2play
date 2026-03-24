import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventFeedback } from '../entities/event-feedback.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { Event } from '../entities/event.entity';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { SubmitTimingDto } from './dto/submit-timing.dto';

export interface FeedbackStatus {
  canSubmit: boolean;
  alreadySubmitted: boolean;
  eventEnded: boolean;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(SessionTiming)
    private timingRepo: Repository<SessionTiming>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
  ) {}

  async submitFeedback(
    eventId: string,
    userId: string,
    dto: SubmitFeedbackDto,
  ): Promise<EventFeedback> {
    const status = await this.getFeedbackStatus(eventId, userId);
    if (!status.eventEnded) {
      throw new BadRequestException(
        'Feedback can only be submitted after the event date',
      );
    }
    if (status.alreadySubmitted) {
      throw new BadRequestException(
        'Feedback already submitted for this event',
      );
    }

    const existing = await this.feedbackRepo.findOne({
      where: { eventId, userId },
    });
    if (existing) return existing;

    const feedback = this.feedbackRepo.create({ eventId, userId, ...dto });
    return this.feedbackRepo.save(feedback);
  }

  async getFeedbackStatus(
    eventId: string,
    userId: string,
  ): Promise<FeedbackStatus> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');

    const existing = await this.feedbackRepo.findOne({
      where: { eventId, userId },
      select: ['id'],
    });

    const eventEnded = new Date(event.dateTime).getTime() <= Date.now();
    const alreadySubmitted = !!existing;
    return {
      canSubmit: eventEnded && !alreadySubmitted,
      alreadySubmitted,
      eventEnded,
    };
  }

  async getEventFeedback(eventId: string): Promise<EventFeedback[]> {
    return this.feedbackRepo.find({
      where: { eventId },
      relations: ['user', 'game'],
    });
  }

  async submitTiming(
    eventId: string,
    dto: SubmitTimingDto,
  ): Promise<SessionTiming> {
    const timing = this.timingRepo.create({ eventId, ...dto });
    return this.timingRepo.save(timing);
  }

  async getEventTimings(eventId: string): Promise<SessionTiming[]> {
    return this.timingRepo.find({
      where: { eventId },
      relations: ['game'],
    });
  }

  async getGameStats(gameId: string) {
    const feedbacks = await this.feedbackRepo.find({ where: { gameId } });
    const timings = await this.timingRepo.find({ where: { gameId } });

    const avgEnjoyment = feedbacks.length
      ? feedbacks.reduce((sum, f) => sum + f.enjoymentRating, 0) /
        feedbacks.length
      : null;

    const completionRate = feedbacks.length
      ? feedbacks.filter((f) => f.finishedGame).length / feedbacks.length
      : null;

    const avgDuration = timings.length
      ? timings.reduce((sum, t) => sum + (t.totalMinutes || 0), 0) /
        timings.length
      : null;

    return {
      totalPlays: feedbacks.length,
      avgEnjoyment,
      completionRate,
      avgDuration,
      timingSamples: timings.length,
    };
  }
}
