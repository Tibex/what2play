import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventFeedback } from '../entities/event-feedback.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { SubmitTimingDto } from './dto/submit-timing.dto';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(SessionTiming)
    private timingRepo: Repository<SessionTiming>,
  ) {}

  async submitFeedback(eventId: string, userId: string, dto: SubmitFeedbackDto): Promise<EventFeedback> {
    let existing = await this.feedbackRepo.findOne({ where: { eventId, userId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.feedbackRepo.save(existing);
    }
    const feedback = this.feedbackRepo.create({ eventId, userId, ...dto });
    return this.feedbackRepo.save(feedback);
  }

  async getEventFeedback(eventId: string): Promise<EventFeedback[]> {
    return this.feedbackRepo.find({
      where: { eventId },
      relations: ['user', 'game'],
    });
  }

  async submitTiming(eventId: string, dto: SubmitTimingDto): Promise<SessionTiming> {
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
      ? feedbacks.reduce((sum, f) => sum + f.enjoymentRating, 0) / feedbacks.length
      : null;

    const completionRate = feedbacks.length
      ? feedbacks.filter((f) => f.finishedGame).length / feedbacks.length
      : null;

    const avgDuration = timings.length
      ? timings.reduce((sum, t) => sum + (t.totalMinutes || 0), 0) / timings.length
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
