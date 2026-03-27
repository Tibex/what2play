import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { Event } from '../entities/event.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { Game } from '../entities/game.entity';
import { GamesService } from '../games/games.service';
import { EventsService } from '../events/events.service';

interface BggPlayerCountPollEntry {
  best: number;
  recommended: number;
  notRecommended: number;
  totalVotes: number;
}

interface ScoredCandidate {
  game: Game;
  score: number;
  source: string;
  explanation: Record<string, string>;
}

const RECOMMENDATION_WEIGHTS = {
  base: 40,
  groupRating: 20,
  bggRating: 10,
  timeFit: 16,
  history: 14,
  attendeeHistory: 14,
  freshness: 8,
  complexityFit: 10,
  bggBestPlayersFit: 8,
} as const;
const MIN_OWNED_CANDIDATES = 6;
const DISCOVERY_CANDIDATE_LIMIT = 6;
const FALLBACK_DISCOVERY_MAX_DELTA = 0.5;

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectRepository(EventGameCandidate)
    private candidatesRepo: Repository<EventGameCandidate>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(SessionTiming)
    private timingsRepo: Repository<SessionTiming>,
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    private gamesService: GamesService,
    private eventsService: EventsService,
  ) {}

  async generateCandidates(eventId: string): Promise<EventGameCandidate[]> {
    const event = await this.eventsService.findById(eventId);
    if (event.status === 'completed' || event.status === 'cancelled') {
      throw new BadRequestException(
        'Recommendations cannot be regenerated for completed or cancelled events',
      );
    }
    const attendeeIds = await this.eventsService.getAttendeeUserIds(eventId);
    const playerCount =
      (await this.eventsService.getGoingAttendeeCount?.(eventId)) ??
      attendeeIds.length;

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
    const attendeeHistoricalFeedback = await this.getAttendeeFeedbackSignals(
      attendeeIds,
      gameIds,
    );
    const recentlyPlayed = await this.getRecentlyPlayedGameIds(attendeeIds);

    const scored: ScoredCandidate[] = [];

    for (const game of ownedGames) {
      if (game.minPlayers > playerCount || game.maxPlayers < playerCount)
        continue;

      const explanation: Record<string, string> = {};
      const scoreBreakdown: Record<string, number> = {};
      let score = RECOMMENDATION_WEIGHTS.base;
      scoreBreakdown['base'] = RECOMMENDATION_WEIGHTS.base;

      explanation['players'] =
        `Fits ${playerCount} players (${game.minPlayers}-${game.maxPlayers})`;

      const gameRatings = ratingsByGame.get(game.id);
      if (gameRatings && gameRatings.length > 0) {
        const avg = gameRatings.reduce((a, b) => a + b, 0) / gameRatings.length;
        const ratingFit = this.clamp(avg / 10, 0, 1);
        const contribution = ratingFit * RECOMMENDATION_WEIGHTS.groupRating;
        score += contribution;
        scoreBreakdown['group_rating'] = contribution;
        explanation['rating'] = `Group avg BGG rating: ${avg.toFixed(1)}`;
      }

      if (game.bggRating) {
        const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
        const contribution = bggFit * RECOMMENDATION_WEIGHTS.bggRating;
        score += contribution;
        scoreBreakdown['bgg_rating'] = contribution;
        explanation['bgg'] = `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
      }

      const timing = historicalTimings.get(game.id);
      if (timing && event.durationMinutes) {
        const timeFit = this.getTimeFitScore(timing, event.durationMinutes);
        const contribution = timeFit * RECOMMENDATION_WEIGHTS.timeFit;
        score += contribution;
        scoreBreakdown['time_fit'] = contribution;
        explanation['time'] = `~${timing} min playtime`;
      } else if (game.playingTime && event.durationMinutes) {
        const timeFit = this.getTimeFitScore(
          game.playingTime,
          event.durationMinutes,
        );
        const contribution = timeFit * RECOMMENDATION_WEIGHTS.timeFit;
        score += contribution;
        scoreBreakdown['time_fit'] = contribution;
        explanation['time'] = `~${game.playingTime} min playtime`;
      }

      const feedback = historicalFeedback.get(game.id);
      if (feedback) {
        const enjoymentNorm = this.clamp((feedback.avgEnjoyment - 1) / 4, 0, 1);
        const historyFit = this.clamp(
          enjoymentNorm * 0.65 + feedback.completionRate * 0.35,
          0,
          1,
        );
        const contribution = historyFit * RECOMMENDATION_WEIGHTS.history;
        score += contribution;
        scoreBreakdown['history'] = contribution;
        explanation['history'] =
          `Completion rate: ${(feedback.completionRate * 100).toFixed(0)}%`;
        explanation['group_enjoyment'] =
          `Group avg. enjoyment: ${feedback.avgEnjoyment.toFixed(1)}`;
      }

      const attendeeFeedback = attendeeHistoricalFeedback.get(game.id);
      if (attendeeFeedback) {
        const attendeeEnjoymentNorm = this.clamp(
          (attendeeFeedback.avgEnjoyment - 1) / 4,
          0,
          1,
        );
        const attendeeFit = this.clamp(
          attendeeEnjoymentNorm * 0.7 + attendeeFeedback.playRate * 0.3,
          0,
          1,
        );
        const contribution =
          attendeeFit * RECOMMENDATION_WEIGHTS.attendeeHistory;
        score += contribution;
        scoreBreakdown['attendee_history'] = contribution;
        explanation['attendee_history'] =
          `Attendees played: ${Math.round(attendeeFeedback.playRate * 100)}%`;
      }

      const averagePreferredWeight = this.getAveragePreferredWeight(event);
      if (averagePreferredWeight != null && game.weight != null) {
        const complexityDistance = Math.abs(
          Number(game.weight) - averagePreferredWeight,
        );
        const complexityFit = this.clamp(1 - complexityDistance / 4, 0, 1);
        const contribution =
          complexityFit * RECOMMENDATION_WEIGHTS.complexityFit;
        score += contribution;
        scoreBreakdown['complexity_fit'] = contribution;
        explanation['complexity'] =
          `Complexity fit: ${Number(game.weight).toFixed(2)} vs group pref ${averagePreferredWeight.toFixed(2)}`;
      }

      const bestPlayerFit = this.getBestPlayersFitScore(game, playerCount);
      const bestPlayerContribution =
        bestPlayerFit * RECOMMENDATION_WEIGHTS.bggBestPlayersFit;
      score += bestPlayerContribution;
      scoreBreakdown['best_players_fit'] = bestPlayerContribution;
      explanation['best_players'] = this.getBestPlayersExplanation(
        game,
        playerCount,
        bestPlayerFit,
      );

      if (recentlyPlayed.has(game.id)) {
        score -= RECOMMENDATION_WEIGHTS.freshness;
        scoreBreakdown['freshness_penalty'] = -RECOMMENDATION_WEIGHTS.freshness;
        explanation['freshness'] = 'Played recently';
      }

      const confidence = this.getRecommendationConfidence(explanation);
      explanation['confidence'] = `Confidence: ${confidence}`;

      scored.push({ game, score, source: 'owned', explanation });
    }

    scored.sort((a, b) => b.score - a.score);
    const deduped = this.dedupeBaseAndExpansion(scored);

    const excludedIds = new Set(event.excludedGameIds || []);
    const filtered = deduped.filter((c) => !excludedIds.has(c.game.id));
    const shouldExpandDiscovery =
      event.discoveryMode || filtered.length < MIN_OWNED_CANDIDATES;
    const bestOwnedScore = filtered[0]?.score ?? null;

    if (shouldExpandDiscovery) {
      const discoveryPool = await this.gamesService.getDiscoveryGames(
        playerCount,
        [...new Set([...(event.excludedGameIds || []), ...gameIds])],
        DISCOVERY_CANDIDATE_LIMIT,
      );

      for (const game of discoveryPool) {
        const explanation: Record<string, string> = {
          source: 'External discovery candidate',
          source_detail: 'external_catalog_top_rated',
        };
        const scoreBreakdown: Record<string, number> = {};
        let score = RECOMMENDATION_WEIGHTS.base * 0.72;
        scoreBreakdown['base_discovery'] = score;

        explanation['players'] =
          `Fits ${playerCount} players (${game.minPlayers}-${game.maxPlayers})`;

        if (game.bggRating) {
          const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
          const contribution = bggFit * RECOMMENDATION_WEIGHTS.bggRating;
          score += contribution;
          scoreBreakdown['bgg_rating'] = contribution;
          explanation['bgg'] =
            `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
        }

        if (game.playingTime && event.durationMinutes) {
          const timeFit = this.getTimeFitScore(
            game.playingTime,
            event.durationMinutes,
          );
          const contribution = timeFit * RECOMMENDATION_WEIGHTS.timeFit;
          score += contribution;
          scoreBreakdown['time_fit'] = contribution;
          explanation['time'] = `~${game.playingTime} min playtime`;
        }

        const averagePreferredWeight = this.getAveragePreferredWeight(event);
        if (averagePreferredWeight != null && game.weight != null) {
          const complexityDistance = Math.abs(
            Number(game.weight) - averagePreferredWeight,
          );
          const complexityFit = this.clamp(1 - complexityDistance / 4, 0, 1);
          const contribution =
            complexityFit * RECOMMENDATION_WEIGHTS.complexityFit;
          score += contribution;
          scoreBreakdown['complexity_fit'] = contribution;
          explanation['complexity'] =
            `Complexity fit: ${Number(game.weight).toFixed(2)} vs group pref ${averagePreferredWeight.toFixed(2)}`;
        }

        const bestPlayerFit = this.getBestPlayersFitScore(game, playerCount);
        const bestPlayerContribution =
          bestPlayerFit * RECOMMENDATION_WEIGHTS.bggBestPlayersFit;
        score += bestPlayerContribution;
        scoreBreakdown['best_players_fit'] = bestPlayerContribution;
        explanation['best_players'] = this.getBestPlayersExplanation(
          game,
          playerCount,
          bestPlayerFit,
        );

        if (!event.discoveryMode && bestOwnedScore != null) {
          const maxAllowed = bestOwnedScore - FALLBACK_DISCOVERY_MAX_DELTA;
          if (score > maxAllowed) {
            score = maxAllowed;
            scoreBreakdown['fallback_guardrail'] =
              -FALLBACK_DISCOVERY_MAX_DELTA;
            explanation['guardrail'] =
              'Fallback discovery capped below strongest owned option';
          }
        }

        explanation['confidence'] =
          `Confidence: ${this.getRecommendationConfidence(explanation)}`;

        scored.push({
          game,
          score,
          source: 'external_catalog',
          explanation,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const rankedWithDiscovery = this.dedupeBaseAndExpansion(scored);
    const afterExclusions = rankedWithDiscovery.filter(
      (c) => !excludedIds.has(c.game.id),
    );
    const topCandidates = afterExclusions.slice(0, 10);

    const manualCandidates = await this.candidatesRepo.find({
      where: { eventId, source: 'manual' },
    });
    const manualGameIds = new Set(manualCandidates.map((c) => c.gameId));

    await this.candidatesRepo
      .createQueryBuilder()
      .delete()
      .from(EventGameCandidate)
      .where('eventId = :eventId', { eventId })
      .andWhere('source != :source', { source: 'manual' })
      .execute();

    const newCandidates = topCandidates
      .filter((c) => !manualGameIds.has(c.game.id))
      .map((c) =>
        this.candidatesRepo.create({
          eventId,
          gameId: c.game.id,
          source: c.source,
          score: Number(c.score.toFixed(2)),
          explanation: c.explanation,
        }),
      );

    return this.candidatesRepo.save(newCandidates);
  }

  async getCandidates(eventId: string): Promise<EventGameCandidate[]> {
    return this.candidatesRepo.find({
      where: { eventId },
      relations: ['game'],
      order: { score: 'DESC' },
    });
  }

  async addManualCandidate(
    eventId: string,
    gameId: string,
  ): Promise<EventGameCandidate> {
    const event = await this.eventsService.findById(eventId);
    if (event.status !== 'planning') {
      throw new BadRequestException(
        'Can only modify recommendations during planning',
      );
    }

    const existing = await this.candidatesRepo.findOne({
      where: { eventId, gameId },
    });
    if (existing) {
      throw new BadRequestException('Game is already in recommendations');
    }

    const game = await this.gamesService.findById(gameId);
    if (!game) throw new NotFoundException('Game not found');

    if (event.excludedGameIds?.includes(gameId)) {
      event.excludedGameIds = event.excludedGameIds.filter(
        (id) => id !== gameId,
      );
      await this.eventsRepo.save(event);
    }

    const candidate = this.candidatesRepo.create({
      eventId,
      gameId,
      source: 'manual',
      score: 100,
      explanation: { source: 'Manually added by host' },
    });
    return this.candidatesRepo.save(candidate);
  }

  async removeCandidate(eventId: string, candidateId: string): Promise<void> {
    const candidate = await this.candidatesRepo.findOne({
      where: { id: candidateId, eventId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (event) {
      const excluded = event.excludedGameIds || [];
      if (!excluded.includes(candidate.gameId)) {
        event.excludedGameIds = [...excluded, candidate.gameId];
        await this.eventsRepo.save(event);
      }
    }

    await this.candidatesRepo.remove(candidate);
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
    timings.forEach((t) =>
      map.set(t.gameId, Math.round(Number.parseFloat(t.avg))),
    );
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
        avgEnjoyment: Number.parseFloat(f.avgEnjoyment),
        completionRate: Number.parseFloat(f.completionRate),
      }),
    );
    return map;
  }

  private async getAttendeeFeedbackSignals(
    userIds: string[],
    gameIds: string[],
  ): Promise<Map<string, { avgEnjoyment: number; playRate: number }>> {
    if (!userIds.length || !gameIds.length) return new Map();
    const rows = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('f.gameId', 'gameId')
      .addSelect('AVG(f.enjoymentRating)', 'avgEnjoyment')
      .addSelect('COUNT(*)', 'playCount')
      .where('f.userId IN (:...userIds)', { userIds })
      .andWhere('f.gameId IN (:...gameIds)', { gameIds })
      .groupBy('f.gameId')
      .getRawMany();

    const denominator = Math.max(userIds.length, 1);
    const map = new Map<string, { avgEnjoyment: number; playRate: number }>();
    rows.forEach((r) =>
      map.set(r.gameId, {
        avgEnjoyment: Number.parseFloat(r.avgEnjoyment),
        playRate: Math.min(1, Number(r.playCount) / denominator),
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

  private dedupeBaseAndExpansion(scored: ScoredCandidate[]): ScoredCandidate[] {
    const referencedBaseIds = new Set<string>();
    for (const candidate of scored) {
      for (const baseId of candidate.game.expansionForBggIds || []) {
        referencedBaseIds.add(baseId);
      }
    }

    const groups = new Map<string, ScoredCandidate[]>();
    for (const candidate of scored) {
      const groupKey = this.getSeriesGroupKey(
        candidate.game,
        referencedBaseIds,
      );
      const arr = groups.get(groupKey) || [];
      arr.push(candidate);
      groups.set(groupKey, arr);
    }

    const selected = new Set<string>();
    for (const group of groups.values()) {
      if (group.length === 1) {
        selected.add(group[0].game.id);
        continue;
      }

      group.sort((a, b) => {
        if (!!a.game.isExpansion !== !!b.game.isExpansion) {
          return a.game.isExpansion ? 1 : -1;
        }
        if (a.score !== b.score) return b.score - a.score;
        return a.game.title.length - b.game.title.length;
      });

      selected.add(group[0].game.id);
    }

    return scored
      .filter((candidate) => selected.has(candidate.game.id))
      .sort((a, b) => b.score - a.score);
  }

  private getSeriesGroupKey(
    game: Game,
    referencedBaseIds: Set<string>,
  ): string {
    if (game.isExpansion && game.expansionForBggIds?.length) {
      const stableBaseId = [...game.expansionForBggIds].sort((a, b) =>
        a.localeCompare(b),
      )[0];
      return `bgg:${stableBaseId}`;
    }
    if (game.bggId && referencedBaseIds.has(String(game.bggId))) {
      return `bgg:${game.bggId}`;
    }
    const normalized = game.title
      .toLowerCase()
      .replaceAll(/[()]/g, '')
      .split(/[:\-–]/)[0]
      .replaceAll(/\s+/g, ' ')
      .trim();
    return normalized ? `title:${normalized}` : `id:${game.id}`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private getTimeFitScore(
    actualMinutes: number,
    budgetMinutes: number,
  ): number {
    if (budgetMinutes <= 0 || actualMinutes <= 0) return 0.5;
    if (actualMinutes <= budgetMinutes) {
      const spareRatio = (budgetMinutes - actualMinutes) / budgetMinutes;
      return this.clamp(1 - spareRatio * 0.4, 0, 1);
    }
    const overrunRatio = (actualMinutes - budgetMinutes) / budgetMinutes;
    return this.clamp(1 - overrunRatio, 0, 1);
  }

  private getBestPlayersFitScore(game: Game, playerCount: number): number {
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (pollEntry) {
      return this.getPollFitScore(pollEntry);
    }

    if (game.minPlayers > game.maxPlayers) return 0;
    const midpoint = (game.minPlayers + game.maxPlayers) / 2;
    const halfRange = Math.max(1, (game.maxPlayers - game.minPlayers) / 2);
    const distance = Math.abs(playerCount - midpoint);
    return this.clamp(1 - distance / (halfRange + 1), 0, 1);
  }

  private getBestPlayersExplanation(
    game: Game,
    playerCount: number,
    fitScore: number,
  ): string {
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (!pollEntry || pollEntry.totalVotes <= 0) {
      return `Best-player fit: ${(fitScore * 100).toFixed(0)}%`;
    }

    const bestPct = (pollEntry.best / pollEntry.totalVotes) * 100;
    const recPct = (pollEntry.recommended / pollEntry.totalVotes) * 100;
    return `BGG ${playerCount}p: Best ${bestPct.toFixed(0)}%, Rec ${recPct.toFixed(0)}%`;
  }

  private getPollFitScore(pollEntry: BggPlayerCountPollEntry): number {
    if (pollEntry.totalVotes <= 0) return 0;
    const weighted =
      pollEntry.best * 1 +
      pollEntry.recommended * 0.65 +
      pollEntry.notRecommended * 0;
    return this.clamp(weighted / pollEntry.totalVotes, 0, 1);
  }

  private getPollEntryForPlayerCount(
    game: Game,
    playerCount: number,
  ): BggPlayerCountPollEntry | null {
    const poll = game.bggPlayerCountPoll as
      | Record<string, BggPlayerCountPollEntry>
      | undefined;
    if (!poll) return null;

    const exact = poll[String(playerCount)];
    if (exact) return exact;

    for (const [key, value] of Object.entries(poll)) {
      const plusMatch = key.match(/^(\d+)\+$/);
      if (plusMatch && playerCount >= Number.parseInt(plusMatch[1], 10)) {
        return value;
      }
      const moreMatch = key.match(/^more than (\d+)$/i);
      if (moreMatch && playerCount > Number.parseInt(moreMatch[1], 10)) {
        return value;
      }
    }

    return null;
  }

  private getAveragePreferredWeight(event: Event): number | null {
    const weights =
      event.attendees
        ?.filter(
          (a) => a.rsvpStatus === 'going' && a.user?.preferredWeight != null,
        )
        .map((a) => Number(a.user?.preferredWeight))
        .filter((weight) => !Number.isNaN(weight)) || [];
    if (!weights.length) return null;
    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    return sum / weights.length;
  }

  private getRecommendationConfidence(
    explanation: Record<string, string>,
  ): 'high' | 'medium' | 'low' {
    const optionalSignals = [
      'rating',
      'bgg',
      'time',
      'history',
      'attendee_history',
      'complexity',
      'best_players',
    ];
    const present = optionalSignals.filter((key) => explanation[key]).length;
    const coverage = present / optionalSignals.length;
    if (coverage >= 0.7) return 'high';
    if (coverage >= 0.4) return 'medium';
    return 'low';
  }
}
