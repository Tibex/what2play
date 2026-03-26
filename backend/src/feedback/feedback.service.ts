import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventFeedback } from '../entities/event-feedback.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { Event } from '../entities/event.entity';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { SubmitTimingDto } from './dto/submit-timing.dto';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { Game } from '../entities/game.entity';

export interface FeedbackStatus {
  canSubmit: boolean;
  alreadySubmitted: boolean;
  eventEnded: boolean;
}

export interface EventFeedbackAnalyticsGame {
  game: Game;
  recommendedCount: number;
  voteCount: number;
  playedCount: number;
  avgEnjoyment: number | null;
  playedByVotersCount: number;
  playedByNonVotersCount: number;
}

export interface EventFeedbackAnalytics {
  selectedGameId?: string;
  recommendedGames: EventFeedbackAnalyticsGame[];
  votedGames: EventFeedbackAnalyticsGame[];
  playedGames: EventFeedbackAnalyticsGame[];
  winnerPlayedRate: number | null;
  totalFeedbackEntries: number;
  totalUniquePlayers: number;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectRepository(EventFeedback)
    private readonly feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(SessionTiming)
    private readonly timingRepo: Repository<SessionTiming>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventVote)
    private readonly votesRepo: Repository<EventVote>,
    @InjectRepository(EventGameCandidate)
    private readonly candidatesRepo: Repository<EventGameCandidate>,
  ) {}

  async submitFeedback(
    eventId: string,
    userId: string,
    dto: SubmitFeedbackDto,
  ): Promise<EventFeedback[]> {
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
    if (existing) {
      throw new BadRequestException(
        'Feedback already submitted for this event',
      );
    }

    const rows =
      dto.playedGames
        ?.filter((g) => g.gameId)
        ?.map((g) =>
          this.feedbackRepo.create({
            eventId,
            userId,
            gameId: g.gameId,
            enjoymentRating: g.enjoymentRating,
            finishedGame: g.finishedGame,
            durationFeel: g.durationFeel,
            notes: g.notes,
          }),
        ) ?? [];

    if (rows.length > 0) {
      const seenGameIds = new Set<string>();
      for (const row of rows) {
        if (!row.gameId) continue;
        if (seenGameIds.has(row.gameId)) {
          throw new BadRequestException(
            'Duplicate game entries are not allowed in playedGames',
          );
        }
        seenGameIds.add(row.gameId);
      }
    }

    if (!rows.length) {
      rows.push(
        this.feedbackRepo.create({
          eventId,
          userId,
          gameId: dto.gameId,
          enjoymentRating: dto.enjoymentRating,
          finishedGame: dto.finishedGame,
          durationFeel: dto.durationFeel,
          notes: dto.notes,
        }),
      );
    }

    return this.feedbackRepo.save(rows);
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

  async getEventFeedbackAnalytics(
    eventId: string,
  ): Promise<EventFeedbackAnalytics> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');

    const [recommended, votes, feedbacks] = await Promise.all([
      this.candidatesRepo.find({ where: { eventId }, relations: ['game'] }),
      this.votesRepo.find({ where: { eventId }, relations: ['game'] }),
      this.feedbackRepo.find({
        where: { eventId },
        relations: ['game', 'user'],
      }),
    ]);

    const byGame = new Map<string, EventFeedbackAnalyticsGame>();
    const ensure = (game: Game | undefined, gameId?: string) => {
      const id = game?.id ?? gameId;
      if (!id || !game) return null;
      if (!byGame.has(id)) {
        byGame.set(id, {
          game,
          recommendedCount: 0,
          voteCount: 0,
          playedCount: 0,
          avgEnjoyment: null,
          playedByVotersCount: 0,
          playedByNonVotersCount: 0,
        });
      }
      return byGame.get(id)!;
    };

    for (const c of recommended) {
      const item = ensure(c.game, c.gameId);
      if (item) item.recommendedCount += 1;
    }

    const votedUsersByGame = new Map<string, Set<string>>();
    for (const v of votes) {
      const item = ensure(v.game, v.gameId);
      if (item) item.voteCount += 1;
      if (!votedUsersByGame.has(v.gameId))
        votedUsersByGame.set(v.gameId, new Set());
      votedUsersByGame.get(v.gameId)!.add(v.userId);
    }

    const enjoymentSums = new Map<string, { sum: number; count: number }>();
    for (const f of feedbacks) {
      const item = ensure(f.game, f.gameId);
      if (!item || !f.gameId) continue;
      item.playedCount += 1;

      const votedUsers = votedUsersByGame.get(f.gameId) ?? new Set<string>();
      if (votedUsers.has(f.userId)) item.playedByVotersCount += 1;
      else item.playedByNonVotersCount += 1;

      const cur = enjoymentSums.get(f.gameId) ?? { sum: 0, count: 0 };
      cur.sum += Number(f.enjoymentRating);
      cur.count += 1;
      enjoymentSums.set(f.gameId, cur);
    }

    for (const [gameId, agg] of enjoymentSums.entries()) {
      const item = byGame.get(gameId);
      if (item) item.avgEnjoyment = agg.count ? agg.sum / agg.count : null;
    }

    const all = [...byGame.values()];
    const sortBy = (selector: (g: EventFeedbackAnalyticsGame) => number) =>
      [...all].sort((a, b) => selector(b) - selector(a));

    const selectedGameId = event.selectedGameId;
    const selectedPlayedCount = selectedGameId
      ? feedbacks.filter((f) => f.gameId === selectedGameId).length
      : 0;
    const winnerPlayedRate =
      selectedGameId && feedbacks.length
        ? selectedPlayedCount / feedbacks.length
        : null;

    return {
      selectedGameId: selectedGameId ?? undefined,
      recommendedGames: sortBy((g) => g.recommendedCount || g.playedCount),
      votedGames: sortBy((g) => g.voteCount),
      playedGames: sortBy((g) => g.playedCount),
      winnerPlayedRate,
      totalFeedbackEntries: feedbacks.length,
      totalUniquePlayers: new Set(feedbacks.map((f) => f.userId)).size,
    };
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
