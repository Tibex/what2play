import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { Game } from '../entities/game.entity';
import { GamesService } from '../games/games.service';
import { EventsService } from '../events/events.service';

interface ScoredCandidate {
  game: Game;
  score: number;
  source: string;
  explanation: Record<string, string>;
}

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(EventGameCandidate)
    private candidatesRepo: Repository<EventGameCandidate>,
    @InjectRepository(SessionTiming)
    private timingsRepo: Repository<SessionTiming>,
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    private gamesService: GamesService,
    private eventsService: EventsService,
  ) {}

  async generateCandidates(eventId: string): Promise<EventGameCandidate[]> {
    const event = await this.eventsService.findById(eventId);
    const attendeeIds = await this.eventsService.getAttendeeUserIds(eventId);
    const playerCount = attendeeIds.length;

    const ownedGames =
      await this.gamesService.getGamesOwnedByUsers(attendeeIds);
    const gameIds = ownedGames.map((g) => g.id);
    const ratings = await this.gamesService.getRatingsForGames(
      attendeeIds,
      gameIds,
    );

    const ratingsByGame = new Map<string, number[]>();
    ratings.forEach((r) => {
      const arr = ratingsByGame.get(r.gameId) || [];
      arr.push(Number(r.rating));
      ratingsByGame.set(r.gameId, arr);
    });

    const historicalTimings = await this.getAverageTimings(
      gameIds,
      playerCount,
    );
    const historicalFeedback = await this.getAverageFeedback(gameIds);
    const recentlyPlayed = await this.getRecentlyPlayedGameIds(attendeeIds);

    const scored: ScoredCandidate[] = [];

    for (const game of ownedGames) {
      if (game.minPlayers > playerCount || game.maxPlayers < playerCount)
        continue;

      const explanation: Record<string, string> = {};
      let score = 50;

      explanation['players'] =
        `Fits ${playerCount} players (${game.minPlayers}-${game.maxPlayers})`;

      const gameRatings = ratingsByGame.get(game.id);
      if (gameRatings && gameRatings.length > 0) {
        const avg = gameRatings.reduce((a, b) => a + b, 0) / gameRatings.length;
        score += avg * 3;
        explanation['rating'] = `Group avg rating: ${avg.toFixed(1)}/10`;
      }

      if (game.bggRating) {
        score += Number(game.bggRating);
        explanation['bgg'] = `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
      }

      const timing = historicalTimings.get(game.id);
      if (timing && event.durationMinutes) {
        const fits = timing <= event.durationMinutes;
        score += fits ? 10 : -15;
        explanation['time'] = fits
          ? `Avg ${timing}min fits ${event.durationMinutes}min budget`
          : `Avg ${timing}min may exceed ${event.durationMinutes}min budget`;
      } else if (game.playingTime && event.durationMinutes) {
        const fits = game.playingTime <= event.durationMinutes;
        score += fits ? 5 : -10;
        explanation['time'] = `Estimated ${game.playingTime}min`;
      }

      const feedback = historicalFeedback.get(game.id);
      if (feedback) {
        score += (feedback.avgEnjoyment - 3) * 5;
        score += feedback.completionRate * 10;
        explanation['history'] =
          `${(feedback.completionRate * 100).toFixed(0)}% completion, ${feedback.avgEnjoyment.toFixed(1)}/5 enjoyment`;
      }

      if (recentlyPlayed.has(game.id)) {
        score -= 8;
        explanation['freshness'] = 'Played recently';
      }

      scored.push({ game, score, source: 'owned', explanation });
    }

    scored.sort((a, b) => b.score - a.score);
    const topCandidates = scored.slice(0, 10);

    await this.candidatesRepo.delete({ eventId });

    const candidates = topCandidates.map((c) =>
      this.candidatesRepo.create({
        eventId,
        gameId: c.game.id,
        source: c.source,
        score: c.score,
        explanation: c.explanation,
      }),
    );

    return this.candidatesRepo.save(candidates);
  }

  async getCandidates(eventId: string): Promise<EventGameCandidate[]> {
    return this.candidatesRepo.find({
      where: { eventId },
      relations: ['game'],
      order: { score: 'DESC' },
    });
  }

  private async getAverageTimings(
    gameIds: string[],
    playerCount: number,
  ): Promise<Map<string, number>> {
    if (!gameIds.length) return new Map();
    const timings = await this.timingsRepo
      .createQueryBuilder('t')
      .select('t.gameId', 'gameId')
      .addSelect('AVG(t.totalMinutes)', 'avg')
      .where('t.gameId IN (:...gameIds)', { gameIds })
      .andWhere('t.playerCount BETWEEN :min AND :max', {
        min: Math.max(1, playerCount - 1),
        max: playerCount + 1,
      })
      .andWhere('t.totalMinutes IS NOT NULL')
      .groupBy('t.gameId')
      .getRawMany();

    const map = new Map<string, number>();
    timings.forEach((t) => map.set(t.gameId, Math.round(parseFloat(t.avg))));
    return map;
  }

  private async getAverageFeedback(
    gameIds: string[],
  ): Promise<Map<string, { avgEnjoyment: number; completionRate: number }>> {
    if (!gameIds.length) return new Map();
    const feedback = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('f.gameId', 'gameId')
      .addSelect('AVG(f.enjoymentRating)', 'avgEnjoyment')
      .addSelect(
        'AVG(CASE WHEN f.finishedGame THEN 1 ELSE 0 END)',
        'completionRate',
      )
      .where('f.gameId IN (:...gameIds)', { gameIds })
      .groupBy('f.gameId')
      .getRawMany();

    const map = new Map<
      string,
      { avgEnjoyment: number; completionRate: number }
    >();
    feedback.forEach((f) =>
      map.set(f.gameId, {
        avgEnjoyment: parseFloat(f.avgEnjoyment),
        completionRate: parseFloat(f.completionRate),
      }),
    );
    return map;
  }

  private async getRecentlyPlayedGameIds(
    userIds: string[],
  ): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('DISTINCT f.gameId', 'gameId')
      .where('f.userId IN (:...userIds)', { userIds })
      .andWhere('f.createdAt >= :since', { since: thirtyDaysAgo })
      .getRawMany();
    return new Set(recent.map((r) => r.gameId));
  }
}
