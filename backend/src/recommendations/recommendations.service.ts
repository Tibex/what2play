import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { Event } from '../entities/event.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { Game } from '../entities/game.entity';
import { RecommendationTelemetry } from '../entities/recommendation-telemetry.entity';
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
  novelty?: number;
}

export interface DemoRecommendationResult {
  game: Game;
  score: number;
  explanation: Record<string, string>;
}

export interface DemoRecommendationDebugResult {
  selected: Array<{
    gameId: string;
    title: string;
    score: number;
    explanation: Record<string, string>;
  }>;
  rejected: Array<{
    gameId: string;
    title: string;
    reason: string;
    detail?: string;
  }>;
}

const RECOMMENDATION_WEIGHTS = {
  base: 40,
  groupRating: 20,
  bggRating: 16,
  bggConsensus: 8,
  timeFit: 16,
  preferredDurationFit: 8,
  history: 14,
  attendeeHistory: 14,
  freshness: 8,
  complexityFit: 10,
  bggBestPlayersFit: 8,
  leastMiseryPenalty: 14,
  dislikePenalty: 8,
  affinityFit: 10,
  discoveryArchetypeFit: 12,
} as const;
const MIN_OWNED_CANDIDATES = 6;
const DISCOVERY_CANDIDATE_LIMIT = 6;
const FALLBACK_DISCOVERY_MAX_DELTA = 0.5;
const MAX_NOT_RECOMMENDED_PCT = 0.6;
const FEEDBACK_SHRINKAGE_PIVOT = 6;
const ATTENDEE_FEEDBACK_SHRINKAGE_PIVOT = 4;
const POLL_SHRINKAGE_PIVOT = 80;
const DEFAULT_DIVERSITY_LIMIT = 10;
const EXPLORATION_SLOTS = 2;
const LOW_BEST_PLAYER_DAMPENER_THRESHOLD = 0.1;
const LOW_BEST_PLAYER_DAMPENER_FACTOR = 0.78;
const DEMO_MIN_BEST_PLAYER_RATIO = 0.12;
const DEMO_MIN_BEST_PLAYER_FIT = 0.42;
const DEMO_MIN_TIME_FIT = 0.7;
const DEMO_RELAXED_MIN_BEST_PLAYER_RATIO = 0.06;
const DEMO_RELAXED_MIN_BEST_PLAYER_FIT = 0.24;
const DEMO_RELAXED_MIN_TIME_FIT = 0.45;
const SOLO_QUALITY_BOOST = 6;
const SOLO_RANGE_PENALTY = 4;
const SOLO_NO_POLL_BASE_FIT = 0.78;
const SOLO_LONG_DURATION_RELAX_MULTIPLIER = 2.1;

interface RecommendationTuningProfile {
  lowBestPlayerDampenerThreshold: number;
  lowBestPlayerDampenerFactor: number;
  demoMinBestPlayerRatio: number;
  demoMinBestPlayerFit: number;
  demoMinTimeFit: number;
  demoRelaxedMinBestPlayerRatio: number;
  demoRelaxedMinBestPlayerFit: number;
  demoRelaxedMinTimeFit: number;
}

@Injectable()
export class RecommendationsService {
  private readonly tuning: RecommendationTuningProfile;

  constructor(
    @InjectRepository(EventGameCandidate)
    private candidatesRepo: Repository<EventGameCandidate>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(RecommendationTelemetry)
    private telemetryRepo: Repository<RecommendationTelemetry>,
    private gamesService: GamesService,
    private eventsService: EventsService,
    private configService: ConfigService,
  ) {
    this.tuning = this.buildTuningProfile();
  }

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
    const ratingsByGameByUser = new Map<string, Map<string, number>>();
    ratings.forEach((r) => {
      const arr = ratingsByGame.get(r.gameId) || [];
      arr.push(Number(r.rating));
      ratingsByGame.set(r.gameId, arr);
      const userRatings = ratingsByGameByUser.get(r.gameId) || new Map<string, number>();
      userRatings.set(r.userId, Number(r.rating));
      ratingsByGameByUser.set(r.gameId, userRatings);
    });

    const historicalFeedback = await this.getAverageFeedback(gameIds);
    const attendeeHistoricalFeedback = await this.getAttendeeFeedbackSignals(
      attendeeIds,
      gameIds,
    );
    const recentlyPlayed = await this.getRecentlyPlayedGameIds(attendeeIds);
    const preferenceProfile = this.buildPreferenceProfile(ownedGames, ratings);
    const sparseSignals =
      ratings.length < 6 && attendeeHistoricalFeedback.size < 3;
    const averagePreferredWeight = this.getAveragePreferredWeight(event);
    const averagePreferredDuration = this.getAveragePreferredDuration(event);

    const scored: ScoredCandidate[] = [];

    for (const game of ownedGames) {
      if (game.minPlayers > playerCount || game.maxPlayers < playerCount)
        continue;
      if (this.shouldExcludeByNotRecommendedPoll(game, playerCount)) continue;

      const explanation: Record<string, string> = {};
      const scoreBreakdown: Record<string, number> = {};
      let score = RECOMMENDATION_WEIGHTS.base;
      scoreBreakdown['base'] = RECOMMENDATION_WEIGHTS.base;

      explanation['players'] =
        `Fits ${this.formatPlayerCountLabel(playerCount)} (${game.minPlayers}-${game.maxPlayers})`;

      const gameRatings = ratingsByGame.get(game.id);
      const perUserRatings = ratingsByGameByUser.get(game.id);
      if (gameRatings && gameRatings.length > 0) {
        const avg = gameRatings.reduce((a, b) => a + b, 0) / gameRatings.length;
        const ratingFit = this.clamp(avg / 10, 0, 1);
        const shrunkenRatingFit = this.shrinkToNeutral(
          ratingFit,
          gameRatings.length,
          ATTENDEE_FEEDBACK_SHRINKAGE_PIVOT,
        );
        const contribution = shrunkenRatingFit * RECOMMENDATION_WEIGHTS.groupRating;
        score += contribution;
        scoreBreakdown['group_rating'] = contribution;
        explanation['rating'] = `Group avg BGG rating: ${avg.toFixed(1)}`;

        if (perUserRatings && perUserRatings.size > 0) {
          const attendeeRatingNorms = attendeeIds
            .map((userId) => perUserRatings.get(userId))
            .filter((rating): rating is number => rating != null)
            .map((rating) => this.clamp(rating / 10, 0, 1));
          if (attendeeRatingNorms.length > 1) {
            const leastMisery = Math.min(...attendeeRatingNorms);
            const miseryPenalty =
              (1 - leastMisery) * RECOMMENDATION_WEIGHTS.leastMiseryPenalty;
            score -= miseryPenalty;
            scoreBreakdown['least_misery_penalty'] = -miseryPenalty;
            explanation['fairness'] = `Least-misery guardrail: ${(leastMisery * 100).toFixed(0)}%`;
          }
        }
      }

      if (game.bggRating) {
        const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
        const contribution = bggFit * RECOMMENDATION_WEIGHTS.bggRating;
        score += contribution;
        scoreBreakdown['bgg_rating'] = contribution;
        explanation['bgg'] = `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
      }
      const consensusFit = this.getBggConsensusScore(game);
      if (consensusFit > 0) {
        const contribution = consensusFit * RECOMMENDATION_WEIGHTS.bggConsensus;
        score += contribution;
        scoreBreakdown['bgg_consensus'] = contribution;
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

      const feedback = historicalFeedback.get(game.id);
      if (feedback) {
        const enjoymentNorm = this.clamp((feedback.avgEnjoyment - 1) / 4, 0, 1);
        const rawHistoryFit = this.clamp(
          enjoymentNorm * 0.65 + feedback.completionRate * 0.35,
          0,
          1,
        );
        const historyFit = this.shrinkToNeutral(
          rawHistoryFit,
          feedback.sampleSize,
          FEEDBACK_SHRINKAGE_PIVOT,
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
        const rawAttendeeFit = this.clamp(
          attendeeEnjoymentNorm * 0.7 + attendeeFeedback.playRate * 0.3,
          0,
          1,
        );
        const attendeeFit = this.shrinkToNeutral(
          rawAttendeeFit,
          attendeeFeedback.sampleSize,
          ATTENDEE_FEEDBACK_SHRINKAGE_PIVOT,
        );
        const contribution =
          attendeeFit * RECOMMENDATION_WEIGHTS.attendeeHistory;
        score += contribution;
        scoreBreakdown['attendee_history'] = contribution;
        explanation['attendee_history'] =
          `Attendees played: ${Math.round(attendeeFeedback.playRate * 100)}%`;
        if (attendeeFeedback.dislikeRate > 0.3) {
          const dislikePenalty =
            attendeeFeedback.dislikeRate * RECOMMENDATION_WEIGHTS.dislikePenalty;
          score -= dislikePenalty;
          scoreBreakdown['dislike_penalty'] = -dislikePenalty;
          explanation['dislike_signal'] =
            `Dislike signal: ${(attendeeFeedback.dislikeRate * 100).toFixed(0)}%`;
        }
      }

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
      if (averagePreferredDuration != null && game.playingTime != null) {
        const durationFit = this.getTimeFitScore(
          game.playingTime,
          averagePreferredDuration,
        );
        const contribution =
          durationFit * RECOMMENDATION_WEIGHTS.preferredDurationFit;
        score += contribution;
        scoreBreakdown['preferred_duration_fit'] = contribution;
        explanation['duration_pref'] =
          `Duration fit: ${game.playingTime}m vs group pref ${Math.round(averagePreferredDuration)}m`;
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
      const lowBestPenalty = this.getLowBestPlayerDampener(game, playerCount);
      if (lowBestPenalty > 0) {
        score -= lowBestPenalty;
        scoreBreakdown['low_best_players_penalty'] = -lowBestPenalty;
        explanation['best_players_guardrail'] =
          `Best-vote guardrail: -${lowBestPenalty.toFixed(1)} pts`;
      }

      const affinityFit = this.getAffinityFitScore(game, preferenceProfile);
      if (affinityFit !== 0.5) {
        const contribution = affinityFit * RECOMMENDATION_WEIGHTS.affinityFit;
        score += contribution;
        scoreBreakdown['affinity_fit'] = contribution;
        explanation['affinity'] = this.getAffinityExplanation(
          game,
          preferenceProfile,
        );
      }

      if (recentlyPlayed.has(game.id)) {
        score -= RECOMMENDATION_WEIGHTS.freshness;
        scoreBreakdown['freshness_penalty'] = -RECOMMENDATION_WEIGHTS.freshness;
        explanation['freshness'] = 'Played recently';
      }

      const confidence = this.getRecommendationConfidence(
        explanation,
        this.getConfidenceSampleSize(feedback?.sampleSize, attendeeFeedback?.sampleSize),
      );
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
        if (this.shouldExcludeByNotRecommendedPoll(game, playerCount)) continue;

        const explanation: Record<string, string> = {
          source: 'External discovery candidate',
          source_detail: 'external_catalog_top_rated',
        };
        const scoreBreakdown: Record<string, number> = {};
        let score = RECOMMENDATION_WEIGHTS.base * 0.72;
        scoreBreakdown['base_discovery'] = score;

        explanation['players'] =
          `Fits ${this.formatPlayerCountLabel(playerCount)} (${game.minPlayers}-${game.maxPlayers})`;

        if (game.bggRating) {
          const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
          const contribution = bggFit * RECOMMENDATION_WEIGHTS.bggRating;
          score += contribution;
          scoreBreakdown['bgg_rating'] = contribution;
          explanation['bgg'] =
            `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
        }
        const consensusFit = this.getBggConsensusScore(game);
        if (consensusFit > 0) {
          const contribution = consensusFit * RECOMMENDATION_WEIGHTS.bggConsensus;
          score += contribution;
          scoreBreakdown['bgg_consensus'] = contribution;
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
        const lowBestPenalty = this.getLowBestPlayerDampener(game, playerCount);
        if (lowBestPenalty > 0) {
          score -= lowBestPenalty;
          scoreBreakdown['low_best_players_penalty'] = -lowBestPenalty;
          explanation['best_players_guardrail'] =
            `Best-vote guardrail: -${lowBestPenalty.toFixed(1)} pts`;
        }
        const archetypeFit = this.getArchetypeFitScore(
          game,
          event.durationMinutes,
          averagePreferredWeight,
          averagePreferredDuration,
          preferenceProfile,
        );
        const archetypeContribution =
          archetypeFit * RECOMMENDATION_WEIGHTS.discoveryArchetypeFit;
        score += archetypeContribution;
        scoreBreakdown['archetype_fit'] = archetypeContribution;
        if (sparseSignals) {
          explanation['archetype'] = 'Cold-start archetype fit applied';
        }

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
    const topCandidates = this.rerankForDiversity(
      afterExclusions,
      DEFAULT_DIVERSITY_LIMIT,
      EXPLORATION_SLOTS,
    );

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

  async getPublicDemoRecommendations(
    playerCount: number,
    complexity: 'light' | 'medium' | 'heavy',
    duration: 'short' | 'medium' | 'long',
  ): Promise<DemoRecommendationResult[]> {
    const normalizedPlayerCount = Math.max(1, Math.min(12, Math.floor(playerCount)));
    const budgetMinutes =
      duration === 'short' ? 60 : duration === 'long' ? 150 : 120;
    const preferredWeight =
      complexity === 'light' ? 1.8 : complexity === 'heavy' ? 3.6 : 2.6;

    const pool = await this.gamesService.getDiscoveryGames(
      normalizedPlayerCount,
      [],
      240,
    );
    const scoredStrict: DemoRecommendationResult[] = [];
    const scoredRelaxed: DemoRecommendationResult[] = [];
    const archetypeProfile = { likedTags: new Set<string>(), dislikedTags: new Set<string>() };
    for (const game of pool) {
      if (game.isExpansion) continue;
      if (this.shouldExcludeByNotRecommendedPoll(game, normalizedPlayerCount))
        continue;
      if (!this.isDemoDurationCompatible(game.playingTime, duration, budgetMinutes))
        continue;
      const strictComplexity = this.isDemoComplexityCompatible(
        game.weight,
        preferredWeight,
        complexity,
      );
      const relaxedComplexity = this.isDemoComplexityCompatible(
        game.weight,
        preferredWeight,
        complexity,
        true,
      );
      if (!relaxedComplexity) continue;

      const explanation: Record<string, string> = {};
      let score = RECOMMENDATION_WEIGHTS.base * 0.55;

      explanation['players'] =
        `Fits ${this.formatPlayerCountLabel(normalizedPlayerCount)} (${game.minPlayers}-${game.maxPlayers})`;

      if (game.bggRating) {
        const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
        const contribution = bggFit * RECOMMENDATION_WEIGHTS.bggRating;
        score += contribution;
        explanation['bgg'] = `BGG rating: ${Number(game.bggRating).toFixed(1)}`;
      }
      const consensusFit = this.getBggConsensusScore(game);
      if (consensusFit > 0) {
        score += consensusFit * RECOMMENDATION_WEIGHTS.bggConsensus;
      }

      if (game.playingTime) {
        const timeFitBudget =
          normalizedPlayerCount === 1 && duration === 'long'
            ? Math.round(budgetMinutes * SOLO_LONG_DURATION_RELAX_MULTIPLIER)
            : budgetMinutes;
        const timeFit = this.getTimeFitScore(game.playingTime, timeFitBudget);
        if (timeFit < this.tuning.demoRelaxedMinTimeFit) continue;
        const contribution = timeFit * RECOMMENDATION_WEIGHTS.timeFit;
        score += contribution;
        explanation['time'] = `~${game.playingTime} min playtime`;
        if (timeFit < this.tuning.demoMinTimeFit) {
          score -= 5;
          explanation['time_guardrail'] = 'Slightly above ideal duration';
        }
      }

      if (game.weight != null) {
        const complexityDistance = Math.abs(Number(game.weight) - preferredWeight);
        const complexityFit = this.clamp(1 - complexityDistance / 4, 0, 1);
        const contribution = complexityFit * RECOMMENDATION_WEIGHTS.complexityFit;
        score += contribution;
        explanation['complexity'] =
          `Complexity fit: ${Number(game.weight).toFixed(2)} vs group pref ${preferredWeight.toFixed(2)}`;
      }

      const bestPlayerFit = this.getBestPlayersFitScore(game, normalizedPlayerCount);
      const relaxedBestFitThreshold =
        normalizedPlayerCount === 1
          ? 0.15
          : this.tuning.demoRelaxedMinBestPlayerFit;
      const strictBestFitThreshold =
        normalizedPlayerCount === 1 ? 0.25 : this.tuning.demoMinBestPlayerFit;
      const relaxedBestRatioThreshold =
        normalizedPlayerCount === 1
          ? 0.03
          : this.tuning.demoRelaxedMinBestPlayerRatio;
      const strictBestRatioThreshold =
        normalizedPlayerCount === 1 ? 0.06 : this.tuning.demoMinBestPlayerRatio;
      if (normalizedPlayerCount !== 1 && bestPlayerFit < relaxedBestFitThreshold)
        continue;
      score += bestPlayerFit * RECOMMENDATION_WEIGHTS.bggBestPlayersFit;
      explanation['best_players'] = this.getBestPlayersExplanation(
        game,
        normalizedPlayerCount,
        bestPlayerFit,
      );
      const bestRatio = this.getBestPlayerRatio(game, normalizedPlayerCount);
      if (
        normalizedPlayerCount !== 1 &&
        bestRatio != null &&
        bestRatio < relaxedBestRatioThreshold
      )
        continue;
      if (
        normalizedPlayerCount !== 1 &&
        bestRatio != null &&
        bestRatio < strictBestRatioThreshold
      ) {
        score -= 4;
        explanation['best_players_guardrail'] = 'Lower best-vote support at this player count';
      }
      if (normalizedPlayerCount === 1) {
        const soloRange = Math.max(0, game.maxPlayers - game.minPlayers);
        if (game.minPlayers === 1) {
          score += SOLO_QUALITY_BOOST;
          explanation['solo_fit'] = 'Solo-ready rules support';
        }
        if (soloRange > 4) {
          score -= SOLO_RANGE_PENALTY;
          explanation['solo_focus'] = 'Designed more for wider groups';
        }
      }
      const archetypeFit = this.getArchetypeFitScore(
        game,
        budgetMinutes,
        preferredWeight,
        budgetMinutes,
        archetypeProfile,
      );
      score += archetypeFit * RECOMMENDATION_WEIGHTS.discoveryArchetypeFit;
      if (archetypeFit >= 0.58) {
        explanation['archetype'] = `Archetype fit: ${(archetypeFit * 100).toFixed(0)}%`;
      }

      const isStrictPick =
        strictComplexity &&
        bestPlayerFit >= strictBestFitThreshold &&
        (bestRatio == null || bestRatio >= strictBestRatioThreshold) &&
        (!game.playingTime ||
          this.getTimeFitScore(
            game.playingTime,
            normalizedPlayerCount === 1 && duration === 'long'
              ? Math.round(budgetMinutes * SOLO_LONG_DURATION_RELAX_MULTIPLIER)
              : budgetMinutes,
          ) >=
            this.tuning.demoMinTimeFit);
      if (isStrictPick) {
        scoredStrict.push({ game, score, explanation });
      } else {
        scoredRelaxed.push({ game, score, explanation });
      }
    }

    const scored = [...scoredStrict, ...scoredRelaxed];
    scored.sort((a, b) => b.score - a.score);
    const deduped = this.dedupeBaseAndExpansion(
      scored.map((entry) => ({
        game: entry.game,
        score: entry.score,
        source: 'demo',
        explanation: entry.explanation,
      })),
    );
    const reranked = this.rerankForDiversity(
      deduped,
      3,
      1,
    );
    const bestScore = reranked[0]?.score ?? 0;
    const worstScore = reranked[reranked.length - 1]?.score ?? bestScore;
    const scoreSpan = Math.max(0.01, bestScore - worstScore);

    return reranked.map((entry) => {
      const relative = (entry.score - worstScore) / scoreSpan;
      const confidence: 'high' | 'medium' | 'low' =
        relative >= 0.75 ? 'high' : relative >= 0.4 ? 'medium' : 'low';
      return {
        game: entry.game,
        explanation: {
          ...entry.explanation,
          confidence: `Confidence: ${confidence}`,
        },
        score: Number(entry.score.toFixed(2)),
      };
    });
  }

  async getPublicDemoRecommendationDebug(
    playerCount: number,
    complexity: 'light' | 'medium' | 'heavy',
    duration: 'short' | 'medium' | 'long',
  ): Promise<DemoRecommendationDebugResult> {
    const normalizedPlayerCount = Math.max(1, Math.min(12, Math.floor(playerCount)));
    const budgetMinutes =
      duration === 'short' ? 60 : duration === 'long' ? 150 : 120;
    const preferredWeight =
      complexity === 'light' ? 1.8 : complexity === 'heavy' ? 3.6 : 2.6;

    const pool = await this.gamesService.getDiscoveryGames(
      normalizedPlayerCount,
      [],
      240,
    );

    const selected: Array<{
      gameId: string;
      title: string;
      score: number;
      explanation: Record<string, string>;
    }> = [];
    const rejected: Array<{
      gameId: string;
      title: string;
      reason: string;
      detail?: string;
    }> = [];

    for (const game of pool) {
      if (game.isExpansion) {
        rejected.push({ gameId: game.id, title: game.title, reason: 'is_expansion' });
        continue;
      }
      if (this.shouldExcludeByNotRecommendedPoll(game, normalizedPlayerCount)) {
        rejected.push({
          gameId: game.id,
          title: game.title,
          reason: 'not_recommended_poll',
        });
        continue;
      }
      if (!this.isDemoDurationCompatible(game.playingTime, duration, budgetMinutes)) {
        rejected.push({
          gameId: game.id,
          title: game.title,
          reason: 'duration_incompatible',
          detail: `playingTime=${game.playingTime ?? 'n/a'} budget=${budgetMinutes}`,
        });
        continue;
      }
      const strictComplexity = this.isDemoComplexityCompatible(
        game.weight,
        preferredWeight,
        complexity,
      );
      const relaxedComplexity = this.isDemoComplexityCompatible(
        game.weight,
        preferredWeight,
        complexity,
        true,
      );
      if (!relaxedComplexity) {
        rejected.push({
          gameId: game.id,
          title: game.title,
          reason: 'complexity_incompatible',
          detail: `weight=${game.weight ?? 'n/a'} pref=${preferredWeight}`,
        });
        continue;
      }

      const explanation: Record<string, string> = {};
      let score = RECOMMENDATION_WEIGHTS.base * 0.55;

      explanation['players'] =
        `Fits ${this.formatPlayerCountLabel(normalizedPlayerCount)} (${game.minPlayers}-${game.maxPlayers})`;

      if (game.bggRating) {
        const bggFit = this.clamp(Number(game.bggRating) / 10, 0, 1);
        score += bggFit * RECOMMENDATION_WEIGHTS.bggRating;
      }
      const consensusFit = this.getBggConsensusScore(game);
      if (consensusFit > 0) {
        score += consensusFit * RECOMMENDATION_WEIGHTS.bggConsensus;
      }

      if (game.playingTime) {
        const timeFitBudget =
          normalizedPlayerCount === 1 && duration === 'long'
            ? Math.round(budgetMinutes * SOLO_LONG_DURATION_RELAX_MULTIPLIER)
            : budgetMinutes;
        const timeFit = this.getTimeFitScore(game.playingTime, timeFitBudget);
        if (timeFit < this.tuning.demoRelaxedMinTimeFit) {
          rejected.push({
            gameId: game.id,
            title: game.title,
            reason: 'time_fit_below_relaxed',
            detail: `timeFit=${timeFit.toFixed(2)}`,
          });
          continue;
        }
        score += timeFit * RECOMMENDATION_WEIGHTS.timeFit;
      }

      if (game.weight != null) {
        const complexityDistance = Math.abs(Number(game.weight) - preferredWeight);
        const complexityFit = this.clamp(1 - complexityDistance / 4, 0, 1);
        score += complexityFit * RECOMMENDATION_WEIGHTS.complexityFit;
      }

      const bestPlayerFit = this.getBestPlayersFitScore(game, normalizedPlayerCount);
      const relaxedBestFitThreshold =
        normalizedPlayerCount === 1
          ? 0.15
          : this.tuning.demoRelaxedMinBestPlayerFit;
      const strictBestFitThreshold =
        normalizedPlayerCount === 1 ? 0.25 : this.tuning.demoMinBestPlayerFit;
      const relaxedBestRatioThreshold =
        normalizedPlayerCount === 1
          ? 0.03
          : this.tuning.demoRelaxedMinBestPlayerRatio;
      const strictBestRatioThreshold =
        normalizedPlayerCount === 1 ? 0.06 : this.tuning.demoMinBestPlayerRatio;

      if (normalizedPlayerCount !== 1 && bestPlayerFit < relaxedBestFitThreshold) {
        rejected.push({
          gameId: game.id,
          title: game.title,
          reason: 'best_fit_below_relaxed',
          detail: `bestFit=${bestPlayerFit.toFixed(2)}`,
        });
        continue;
      }
      score += bestPlayerFit * RECOMMENDATION_WEIGHTS.bggBestPlayersFit;
      const bestRatio = this.getBestPlayerRatio(game, normalizedPlayerCount);
      if (
        normalizedPlayerCount !== 1 &&
        bestRatio != null &&
        bestRatio < relaxedBestRatioThreshold
      ) {
        rejected.push({
          gameId: game.id,
          title: game.title,
          reason: 'best_ratio_below_relaxed',
          detail: `bestRatio=${bestRatio.toFixed(3)}`,
        });
        continue;
      }

      if (normalizedPlayerCount === 1) {
        const soloRange = Math.max(0, game.maxPlayers - game.minPlayers);
        if (game.minPlayers === 1) score += SOLO_QUALITY_BOOST;
        if (soloRange > 4) score -= SOLO_RANGE_PENALTY;
      }

      const isStrictPick =
        strictComplexity &&
        bestPlayerFit >= strictBestFitThreshold &&
        (bestRatio == null || bestRatio >= strictBestRatioThreshold) &&
        (!game.playingTime ||
          this.getTimeFitScore(
            game.playingTime,
            normalizedPlayerCount === 1 && duration === 'long'
              ? Math.round(budgetMinutes * SOLO_LONG_DURATION_RELAX_MULTIPLIER)
              : budgetMinutes,
          ) >=
            this.tuning.demoMinTimeFit);
      explanation['bucket'] = isStrictPick ? 'strict' : 'relaxed';

      selected.push({
        gameId: game.id,
        title: game.title,
        score: Number(score.toFixed(2)),
        explanation,
      });
    }

    selected.sort((a, b) => b.score - a.score);
    return { selected: selected.slice(0, 25), rejected };
  }

  async trackTelemetry(
    eventId: string,
    userId: string | undefined,
    eventName: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.telemetryRepo.save(
      this.telemetryRepo.create({
        eventId,
        userId,
        eventName,
        payload: payload ?? {},
      }),
    );
  }

  private async getAverageFeedback(
    gameIds: string[],
  ): Promise<
    Map<string, { avgEnjoyment: number; completionRate: number; sampleSize: number }>
  > {
    if (!gameIds.length) return new Map();
    const feedback = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('f.gameId', 'gameId')
      .addSelect('AVG(f.enjoymentRating)', 'avgEnjoyment')
      .addSelect(
        'AVG(CASE WHEN f.finishedGame THEN 1 ELSE 0 END)',
        'completionRate',
      )
      .addSelect('COUNT(*)', 'sampleSize')
      .where('f.gameId IN (:...gameIds)', { gameIds })
      .groupBy('f.gameId')
      .getRawMany();

    const map = new Map<
      string,
      { avgEnjoyment: number; completionRate: number; sampleSize: number }
    >();
    feedback.forEach((f) =>
      map.set(f.gameId, {
        avgEnjoyment: Number.parseFloat(f.avgEnjoyment),
        completionRate: Number.parseFloat(f.completionRate),
        sampleSize: Number(f.sampleSize ?? 0),
      }),
    );
    return map;
  }

  private async getAttendeeFeedbackSignals(
    userIds: string[],
    gameIds: string[],
  ): Promise<
    Map<
      string,
      { avgEnjoyment: number; playRate: number; sampleSize: number; dislikeRate: number }
    >
  > {
    if (!userIds.length || !gameIds.length) return new Map();
    const rows = await this.feedbackRepo
      .createQueryBuilder('f')
      .select('f.gameId', 'gameId')
      .addSelect('AVG(f.enjoymentRating)', 'avgEnjoyment')
      .addSelect('AVG(CASE WHEN f.enjoymentRating <= 2 THEN 1 ELSE 0 END)', 'dislikeRate')
      .addSelect('COUNT(*)', 'playCount')
      .addSelect('COUNT(DISTINCT f.userId)', 'distinctUsers')
      .where('f.userId IN (:...userIds)', { userIds })
      .andWhere('f.gameId IN (:...gameIds)', { gameIds })
      .groupBy('f.gameId')
      .getRawMany();

    const denominator = Math.max(userIds.length, 1);
    const map = new Map<
      string,
      { avgEnjoyment: number; playRate: number; sampleSize: number; dislikeRate: number }
    >();
    rows.forEach((r) =>
      map.set(r.gameId, {
        avgEnjoyment: Number.parseFloat(r.avgEnjoyment),
        playRate: Math.min(1, Number(r.distinctUsers) / denominator),
        sampleSize: Number(r.playCount ?? 0),
        dislikeRate: Number.parseFloat(r.dislikeRate ?? '0'),
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

  private buildPreferenceProfile(
    games: Game[],
    ratings: Array<{ gameId: string; rating: number }>,
  ): { likedTags: Set<string>; dislikedTags: Set<string> } {
    const gameById = new Map(games.map((game) => [game.id, game]));
    const likedTags = new Set<string>();
    const dislikedTags = new Set<string>();
    for (const rating of ratings) {
      const game = gameById.get(rating.gameId);
      if (!game) continue;
      const tags = this.getGameTags(game);
      if (rating.rating >= 8) {
        tags.forEach((tag) => likedTags.add(tag));
      } else if (rating.rating <= 5) {
        tags.forEach((tag) => dislikedTags.add(tag));
      }
    }
    return { likedTags, dislikedTags };
  }

  private getArchetypeFitScore(
    game: Game,
    eventDurationMinutes?: number,
    preferredWeight?: number | null,
    preferredDuration?: number | null,
    profile?: { likedTags: Set<string>; dislikedTags: Set<string> },
  ): number {
    const fitScores: number[] = [];
    if (eventDurationMinutes != null && game.playingTime != null) {
      fitScores.push(this.getTimeFitScore(game.playingTime, eventDurationMinutes));
    }
    if (preferredDuration != null && game.playingTime != null) {
      fitScores.push(this.getTimeFitScore(game.playingTime, preferredDuration));
    }
    if (preferredWeight != null && game.weight != null) {
      const distance = Math.abs(Number(game.weight) - preferredWeight);
      fitScores.push(this.clamp(1 - distance / 4, 0, 1));
    }
    if (profile) {
      fitScores.push(this.getAffinityFitScore(game, profile));
    }
    if (!fitScores.length) return 0.5;
    return fitScores.reduce((sum, value) => sum + value, 0) / fitScores.length;
  }

  private getAffinityFitScore(
    game: Game,
    profile: { likedTags: Set<string>; dislikedTags: Set<string> },
  ): number {
    const tags = this.getGameTags(game);
    if (!tags.length) return 0.5;
    const likedMatches = tags.filter((tag) => profile.likedTags.has(tag)).length;
    const dislikedMatches = tags.filter((tag) => profile.dislikedTags.has(tag)).length;
    const raw = 0.5 + likedMatches * 0.12 - dislikedMatches * 0.16;
    return this.clamp(raw, 0, 1);
  }

  private getAffinityExplanation(
    game: Game,
    profile: { likedTags: Set<string>; dislikedTags: Set<string> },
  ): string {
    const tags = this.getGameTags(game);
    const liked = tags.filter((tag) => profile.likedTags.has(tag)).slice(0, 2);
    const disliked = tags.filter((tag) => profile.dislikedTags.has(tag)).slice(0, 1);
    if (liked.length && disliked.length) {
      return `Affinity: +${liked.join(', ')} / avoid ${disliked.join(', ')}`;
    }
    if (liked.length) return `Affinity: matches ${liked.join(', ')}`;
    if (disliked.length) return `Affinity: conflicts with ${disliked.join(', ')}`;
    return 'Affinity: neutral';
  }

  private rerankForDiversity(
    ranked: ScoredCandidate[],
    limit: number,
    explorationSlots: number,
  ): ScoredCandidate[] {
    if (ranked.length <= limit) return ranked.slice(0, limit);
    const pool = ranked.slice(0, Math.min(ranked.length, 30));
    const selected: ScoredCandidate[] = [];
    const available = [...pool];
    while (selected.length < Math.max(0, limit - explorationSlots) && available.length) {
      let bestIdx = 0;
      let bestValue = Number.NEGATIVE_INFINITY;
      for (let idx = 0; idx < available.length; idx += 1) {
        const candidate = available[idx];
        const relevance = candidate.score;
        const maxSimilarity = selected.length
          ? Math.max(
              ...selected.map((picked) => this.getCandidateSimilarity(candidate, picked)),
            )
          : 0;
        const mmr = relevance * 0.78 - maxSimilarity * 12;
        if (mmr > bestValue) {
          bestValue = mmr;
          bestIdx = idx;
        }
      }
      selected.push(available.splice(bestIdx, 1)[0]);
    }
    if (explorationSlots > 0 && available.length) {
      const exploratory = [...available]
        .sort((a, b) => {
          const noveltyDelta =
            this.getNoveltyScore(b.game) - this.getNoveltyScore(a.game);
          if (noveltyDelta !== 0) return noveltyDelta;
          return b.score - a.score;
        })
        .slice(0, explorationSlots);
      selected.push(...exploratory);
    }
    return selected.slice(0, limit).sort((a, b) => b.score - a.score);
  }

  private getCandidateSimilarity(a: ScoredCandidate, b: ScoredCandidate): number {
    const aTags = new Set(this.getGameTags(a.game));
    const bTags = new Set(this.getGameTags(b.game));
    const intersection = [...aTags].filter((tag) => bTags.has(tag)).length;
    const union = new Set([...aTags, ...bTags]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const weightPenalty =
      a.game.weight != null && b.game.weight != null
        ? Math.abs(Number(a.game.weight) - Number(b.game.weight)) / 5
        : 0.2;
    const timePenalty =
      a.game.playingTime && b.game.playingTime
        ? Math.abs(a.game.playingTime - b.game.playingTime) / 240
        : 0.2;
    const franchisePenalty =
      this.getFranchiseKey(a.game.title) === this.getFranchiseKey(b.game.title)
        ? 0.35
        : 0;
    return this.clamp(
      jaccard * 0.7 + (1 - weightPenalty) * 0.2 + (1 - timePenalty) * 0.1 + franchisePenalty,
      0,
      1,
    );
  }

  private getNoveltyScore(game: Game): number {
    const weightVariety = game.weight == null ? 0.5 : Math.abs(Number(game.weight) - 2.7) / 2.7;
    const durationVariety = game.playingTime == null ? 0.4 : Math.min(1, Math.abs(game.playingTime - 90) / 90);
    const mechanicRichness = Math.min(1, this.getGameTags(game).length / 5);
    return this.clamp(weightVariety * 0.35 + durationVariety * 0.25 + mechanicRichness * 0.4, 0, 1);
  }

  private getGameTags(game: Game): string[] {
    return [
      ...(game.categories || []),
      ...(game.mechanics || []),
    ]
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }

  private getFranchiseKey(title: string): string {
    return title
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)[0] || title.toLowerCase();
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
      const fit = this.getPollFitScore(pollEntry);
      return this.shrinkToNeutral(fit, pollEntry.totalVotes, POLL_SHRINKAGE_PIVOT);
    }

    if (playerCount === 1 && game.minPlayers <= 1) {
      // Without poll data, treat solo-capable games as a good baseline fit.
      const soloRangePenalty = Math.max(0, (game.maxPlayers - 1) / 10);
      return this.clamp(SOLO_NO_POLL_BASE_FIT - soloRangePenalty, 0, 1);
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
    const bestRatio = pollEntry.best / pollEntry.totalVotes;
    const recommendedRatio = pollEntry.recommended / pollEntry.totalVotes;
    const notRecommendedRatio = pollEntry.notRecommended / pollEntry.totalVotes;
    const weighted =
      bestRatio * 1.0 +
      recommendedRatio * 0.18 -
      notRecommendedRatio * 0.45;
    return this.clamp(weighted, 0, 1);
  }

  private getBggConsensusScore(game: Game): number {
    const ratingNorm = game.bggRating
      ? this.clamp(Number(game.bggRating) / 10, 0, 1)
      : 0;
    const totalVotes = this.getTotalPollVotes(game);
    const confidence = this.clamp(Math.log10(totalVotes + 1) / 3, 0, 1);
    return this.clamp(ratingNorm * 0.8 + confidence * 0.2, 0, 1);
  }

  private getTotalPollVotes(game: Game): number {
    const poll = game.bggPlayerCountPoll as
      | Record<string, BggPlayerCountPollEntry>
      | undefined;
    if (!poll) return 0;
    return Object.values(poll).reduce(
      (sum, entry) => sum + Math.max(0, entry.totalVotes || 0),
      0,
    );
  }

  private getLowBestPlayerDampener(game: Game, playerCount: number): number {
    if (playerCount === 1) return 0;
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (!pollEntry || pollEntry.totalVotes <= 0) return 0;
    const bestRatio = pollEntry.best / pollEntry.totalVotes;
    if (bestRatio >= this.tuning.lowBestPlayerDampenerThreshold) return 0;
    const severity =
      (this.tuning.lowBestPlayerDampenerThreshold - bestRatio) /
      this.tuning.lowBestPlayerDampenerThreshold;
    return severity *
      RECOMMENDATION_WEIGHTS.bggBestPlayersFit *
      this.tuning.lowBestPlayerDampenerFactor;
  }

  private shouldExcludeByNotRecommendedPoll(
    game: Game,
    playerCount: number,
  ): boolean {
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (!pollEntry || pollEntry.totalVotes <= 0) return false;
    const notRecommendedPct = pollEntry.notRecommended / pollEntry.totalVotes;
    return notRecommendedPct >= MAX_NOT_RECOMMENDED_PCT;
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
    sampleStrength?: number,
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
    if (coverage >= 0.7 && (sampleStrength ?? 0) >= 0.6) return 'high';
    if (coverage >= 0.4 || (sampleStrength ?? 0) >= 0.35) return 'medium';
    return 'low';
  }

  private shrinkToNeutral(
    value: number,
    sampleSize: number,
    pivot: number,
    neutral = 0.5,
  ): number {
    if (sampleSize <= 0) return neutral;
    const weight = sampleSize / (sampleSize + pivot);
    return this.clamp(neutral + (value - neutral) * weight, 0, 1);
  }

  private getConfidenceSampleSize(
    globalFeedbackSize?: number,
    attendeeFeedbackSize?: number,
  ): number {
    const globalNorm = this.clamp((globalFeedbackSize ?? 0) / 12, 0, 1);
    const attendeeNorm = this.clamp((attendeeFeedbackSize ?? 0) / 8, 0, 1);
    return this.clamp(globalNorm * 0.45 + attendeeNorm * 0.55, 0, 1);
  }

  private getAveragePreferredDuration(event: Event): number | null {
    const durations =
      event.attendees
        ?.filter(
          (a) => a.rsvpStatus === 'going' && a.user?.preferredDuration != null,
        )
        .map((a) => Number(a.user?.preferredDuration))
        .filter((duration) => !Number.isNaN(duration) && duration > 0) || [];
    if (!durations.length) return null;
    const sum = durations.reduce((acc, duration) => acc + duration, 0);
    return sum / durations.length;
  }

  private formatPlayerCountLabel(playerCount: number): string {
    return `${playerCount} player${playerCount === 1 ? '' : 's'}`;
  }

  private isDemoDurationCompatible(
    playingTime: number | null | undefined,
    duration: 'short' | 'medium' | 'long',
    budgetMinutes: number,
  ): boolean {
    if (!playingTime || playingTime <= 0) return true;
    if (duration === 'short') {
      return playingTime <= Math.round(budgetMinutes * 1.25);
    }
    if (duration === 'medium') {
      return playingTime >= Math.round(budgetMinutes * 0.45) &&
        playingTime <= Math.round(budgetMinutes * 1.2);
    }
    return playingTime >= Math.round(budgetMinutes * 0.6);
  }

  private isDemoComplexityCompatible(
    weight: number | null | undefined,
    preferredWeight: number,
    complexity: 'light' | 'medium' | 'heavy',
    relaxed = false,
  ): boolean {
    if (weight == null) return true;
    const distance = Math.abs(Number(weight) - preferredWeight);
    if (complexity === 'heavy') return distance <= (relaxed ? 1.2 : 0.9);
    if (complexity === 'light') return distance <= (relaxed ? 1.1 : 0.8);
    return distance <= (relaxed ? 1.3 : 1.0);
  }

  private isDemoBestPlayerCompatible(game: Game, playerCount: number): boolean {
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (!pollEntry || pollEntry.totalVotes <= 0) return true;
    const bestRatio = pollEntry.best / pollEntry.totalVotes;
    const fit = this.getBestPlayersFitScore(game, playerCount);
    return (
      bestRatio >= this.tuning.demoMinBestPlayerRatio &&
      fit >= this.tuning.demoMinBestPlayerFit
    );
  }

  private getBestPlayerRatio(game: Game, playerCount: number): number | null {
    const pollEntry = this.getPollEntryForPlayerCount(game, playerCount);
    if (!pollEntry || pollEntry.totalVotes <= 0) return null;
    return pollEntry.best / pollEntry.totalVotes;
  }

  private buildTuningProfile(): RecommendationTuningProfile {
    return {
      lowBestPlayerDampenerThreshold: this.getNumericTuning(
        'REC_LOW_BEST_PLAYER_DAMPENER_THRESHOLD',
        LOW_BEST_PLAYER_DAMPENER_THRESHOLD,
      ),
      lowBestPlayerDampenerFactor: this.getNumericTuning(
        'REC_LOW_BEST_PLAYER_DAMPENER_FACTOR',
        LOW_BEST_PLAYER_DAMPENER_FACTOR,
      ),
      demoMinBestPlayerRatio: this.getNumericTuning(
        'REC_DEMO_MIN_BEST_PLAYER_RATIO',
        DEMO_MIN_BEST_PLAYER_RATIO,
      ),
      demoMinBestPlayerFit: this.getNumericTuning(
        'REC_DEMO_MIN_BEST_PLAYER_FIT',
        DEMO_MIN_BEST_PLAYER_FIT,
      ),
      demoMinTimeFit: this.getNumericTuning(
        'REC_DEMO_MIN_TIME_FIT',
        DEMO_MIN_TIME_FIT,
      ),
      demoRelaxedMinBestPlayerRatio: this.getNumericTuning(
        'REC_DEMO_RELAXED_MIN_BEST_PLAYER_RATIO',
        DEMO_RELAXED_MIN_BEST_PLAYER_RATIO,
      ),
      demoRelaxedMinBestPlayerFit: this.getNumericTuning(
        'REC_DEMO_RELAXED_MIN_BEST_PLAYER_FIT',
        DEMO_RELAXED_MIN_BEST_PLAYER_FIT,
      ),
      demoRelaxedMinTimeFit: this.getNumericTuning(
        'REC_DEMO_RELAXED_MIN_TIME_FIT',
        DEMO_RELAXED_MIN_TIME_FIT,
      ),
    };
  }

  private getNumericTuning(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (raw == null || raw === '') return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

}
