import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { GoogleVisionService } from '../vision/google-vision.service';
import { ClaudeVisionService } from '../vision/claude-vision.service';
import { GeminiVisionService } from '../vision/gemini-vision.service';

import type {
  ShelfParseProgressDetail,
  ShelfParseProgressPayload,
} from './shelf-parse.types';

type GameCollectionPerformance = {
  pickedCount: number;
  avgVotingRank: number | null;
  votingPoolCount: number;
  autoRecommendedCount: number;
  avgEnjoyment: number | null;
};

export type UserCollectionItem = UserGameOwnership & {
  game: Game;
  performance: GameCollectionPerformance;
};

type BatchAddItem = {
  gameId?: string;
  bggId?: number;
  title?: string;
};

class Semaphore {
  private running = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.max) {
        this.running++;
        resolve();
      } else {
        this.queue.push(() => {
          this.running++;
          resolve();
        });
      }
    });
  }
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const bggSemaphore = new Semaphore(5);
const OCR_MATCH_MIN_SCORE = 36;
const LOCAL_MATCH_MIN_SCORE = 38;
const BGG_MATCH_MIN_SCORE = 30;
const TITLE_DUPLICATE_MATCH_SCORE = 90;
const MAX_OCR_SUPPLEMENTAL_TITLES = 20;

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private gamesRepo: Repository<Game>,
    @InjectRepository(UserGameOwnership)
    private ownershipRepo: Repository<UserGameOwnership>,
    @InjectRepository(UserGameRating)
    private ratingsRepo: Repository<UserGameRating>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(EventFeedback)
    private feedbackRepo: Repository<EventFeedback>,
    @InjectRepository(EventVote)
    private votesRepo: Repository<EventVote>,
    @InjectRepository(EventGameCandidate)
    private candidatesRepo: Repository<EventGameCandidate>,
    private config: ConfigService,
    private vision: GoogleVisionService,
    private claudeVision: ClaudeVisionService,
    private geminiVision: GeminiVisionService,
  ) {}

  async searchGames(query: string): Promise<Game[]> {
    return this.gamesRepo
      .createQueryBuilder('game')
      .where('LOWER(game.title) LIKE :q', { q: `%${query.toLowerCase()}%` })
      .limit(20)
      .getMany();
  }

  async findById(id: string): Promise<Game> {
    const game = await this.gamesRepo.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  async findOrCreateByBggId(bggId: number, data: Partial<Game>): Promise<Game> {
    const normalized = this.normalizeIncomingGameData(data);
    let game = await this.gamesRepo.findOne({ where: { bggId } });
    if (!game) {
      game = this.gamesRepo.create({ ...normalized, bggId });
      await this.gamesRepo.save(game);
    } else {
      Object.assign(game, {
        ...game,
        ...normalized,
        bggId,
      });
      await this.gamesRepo.save(game);
    }
    return game;
  }

  private normalizeIncomingGameData(input: Partial<Game>): Partial<Game> {
    const output: Partial<Game> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;

      if (
        (key === 'title' || key === 'imageUrl' || key === 'thumbnailUrl') &&
        typeof value === 'string' &&
        value.trim() === ''
      ) {
        continue;
      }

      if (key === 'bggRating' && typeof value === 'number') {
        if (value < 0 || value > 10 || Number.isNaN(value)) continue;
      }
      if (key === 'weight' && typeof value === 'number') {
        if (value < 0 || value > 5 || Number.isNaN(value)) continue;
      }
      if (
        (key === 'minPlayers' ||
          key === 'maxPlayers' ||
          key === 'playingTime' ||
          key === 'yearPublished') &&
        typeof value === 'number'
      ) {
        if (value <= 0 || Number.isNaN(value)) continue;
      }

      (output as Record<string, unknown>)[key] = value;
    }
    return output;
  }

  async getUserCollection(userId: string): Promise<UserCollectionItem[]> {
    const ownerships = await this.ownershipRepo.find({
      where: { userId },
      relations: ['game'],
      order: { createdAt: 'DESC' },
    });
    if (ownerships.length === 0) return [];

    const gameIds = ownerships.map((ownership) => ownership.gameId);
    const votingPoolStatuses = [
      'voting',
      'confirmed',
      'active',
      'completed',
      'past',
    ];

    const [pickedRows, votingRows, votingPoolRows, autoRows, enjoymentRows] =
      await Promise.all([
        this.eventsRepo
          .createQueryBuilder('event')
          .select('event.selectedGameId', 'gameId')
          .addSelect('COUNT(DISTINCT event.id)', 'pickedCount')
          .leftJoin(
            EventAttendee,
            'membership',
            'membership.eventId = event.id AND membership.userId = :userId AND membership.rsvpStatus = :going',
            { userId, going: 'going' },
          )
          .where('event.selectedGameId IN (:...gameIds)', { gameIds })
          .andWhere('(event.hostId = :userId OR membership.id IS NOT NULL)', {
            userId,
          })
          .groupBy('event.selectedGameId')
          .getRawMany<{ gameId: string; pickedCount: string }>(),
        this.votesRepo
          .createQueryBuilder('vote')
          .innerJoin(Event, 'event', 'event.id = vote.eventId')
          .leftJoin(
            EventAttendee,
            'membership',
            'membership.eventId = event.id AND membership.userId = :userId AND membership.rsvpStatus = :going',
            { userId, going: 'going' },
          )
          .select('vote.gameId', 'gameId')
          .addSelect('AVG(vote.rank)', 'avgVotingRank')
          .where('vote.gameId IN (:...gameIds)', { gameIds })
          .andWhere('(event.hostId = :userId OR membership.id IS NOT NULL)', {
            userId,
          })
          .groupBy('vote.gameId')
          .getRawMany<{ gameId: string; avgVotingRank: string | null }>(),
        this.candidatesRepo
          .createQueryBuilder('candidate')
          .innerJoin(Event, 'event', 'event.id = candidate.eventId')
          .leftJoin(
            EventAttendee,
            'membership',
            'membership.eventId = event.id AND membership.userId = :userId AND membership.rsvpStatus = :going',
            { userId, going: 'going' },
          )
          .select('candidate.gameId', 'gameId')
          .addSelect('COUNT(DISTINCT candidate.eventId)', 'votingPoolCount')
          .where('candidate.gameId IN (:...gameIds)', { gameIds })
          .andWhere('event.status IN (:...votingPoolStatuses)', {
            votingPoolStatuses,
          })
          .andWhere('(event.hostId = :userId OR membership.id IS NOT NULL)', {
            userId,
          })
          .groupBy('candidate.gameId')
          .getRawMany<{ gameId: string; votingPoolCount: string }>(),
        this.candidatesRepo
          .createQueryBuilder('candidate')
          .innerJoin(Event, 'event', 'event.id = candidate.eventId')
          .leftJoin(
            EventAttendee,
            'membership',
            'membership.eventId = event.id AND membership.userId = :userId AND membership.rsvpStatus = :going',
            { userId, going: 'going' },
          )
          .select('candidate.gameId', 'gameId')
          .addSelect(
            'COUNT(DISTINCT candidate.eventId)',
            'autoRecommendedCount',
          )
          .where('candidate.gameId IN (:...gameIds)', { gameIds })
          .andWhere('candidate.source != :manualSource', {
            manualSource: 'manual',
          })
          .andWhere('event.status != :cancelledStatus', {
            cancelledStatus: 'cancelled',
          })
          .andWhere('(event.hostId = :userId OR membership.id IS NOT NULL)', {
            userId,
          })
          .groupBy('candidate.gameId')
          .getRawMany<{ gameId: string; autoRecommendedCount: string }>(),
        this.feedbackRepo
          .createQueryBuilder('feedback')
          .innerJoin(Event, 'event', 'event.id = feedback.eventId')
          .leftJoin(
            EventAttendee,
            'membership',
            'membership.eventId = event.id AND membership.userId = :userId AND membership.rsvpStatus = :going',
            { userId, going: 'going' },
          )
          .select('feedback.gameId', 'gameId')
          .addSelect('AVG(feedback.enjoymentRating)', 'avgEnjoyment')
          .where('feedback.gameId IN (:...gameIds)', { gameIds })
          .andWhere('(event.hostId = :userId OR membership.id IS NOT NULL)', {
            userId,
          })
          .groupBy('feedback.gameId')
          .getRawMany<{ gameId: string; avgEnjoyment: string | null }>(),
      ]);

    const pickedCountByGame = new Map<string, number>();
    for (const row of pickedRows) {
      pickedCountByGame.set(row.gameId, Number(row.pickedCount) || 0);
    }

    const avgVotingRankByGame = new Map<string, number | null>();
    for (const row of votingRows) {
      avgVotingRankByGame.set(
        row.gameId,
        row.avgVotingRank == null
          ? null
          : Number(Number(row.avgVotingRank).toFixed(2)),
      );
    }

    const votingPoolByGame = new Map<string, number>();
    for (const row of votingPoolRows) {
      votingPoolByGame.set(row.gameId, Number(row.votingPoolCount) || 0);
    }

    const autoRecommendedByGame = new Map<string, number>();
    for (const row of autoRows) {
      autoRecommendedByGame.set(
        row.gameId,
        Number(row.autoRecommendedCount) || 0,
      );
    }

    const avgEnjoymentByGame = new Map<string, number | null>();
    for (const row of enjoymentRows) {
      avgEnjoymentByGame.set(
        row.gameId,
        row.avgEnjoyment == null
          ? null
          : Number(Number(row.avgEnjoyment).toFixed(2)),
      );
    }

    return ownerships.map((ownership) => {
      return {
        ...ownership,
        performance: {
          pickedCount: pickedCountByGame.get(ownership.gameId) ?? 0,
          avgVotingRank: avgVotingRankByGame.get(ownership.gameId) ?? null,
          votingPoolCount: votingPoolByGame.get(ownership.gameId) ?? 0,
          autoRecommendedCount:
            autoRecommendedByGame.get(ownership.gameId) ?? 0,
          avgEnjoyment: avgEnjoymentByGame.get(ownership.gameId) ?? null,
        },
      };
    });
  }

  async addToCollection(
    userId: string,
    gameId: string,
  ): Promise<UserGameOwnership> {
    const existing = await this.ownershipRepo.findOne({
      where: { userId, gameId },
    });
    if (existing) return existing;
    const ownership = this.ownershipRepo.create({ userId, gameId });
    return this.ownershipRepo.save(ownership);
  }

  async removeFromCollection(userId: string, gameId: string): Promise<void> {
    await this.ownershipRepo.delete({ userId, gameId });
  }

  async rateGame(
    userId: string,
    gameId: string,
    rating: number,
    notes?: string,
  ): Promise<UserGameRating> {
    const existing = await this.ratingsRepo.findOne({
      where: { userId, gameId },
    });
    if (existing) {
      existing.rating = rating;
      if (notes !== undefined) existing.notes = notes;
      return this.ratingsRepo.save(existing);
    }
    const r = this.ratingsRepo.create({ userId, gameId, rating, notes });
    return this.ratingsRepo.save(r);
  }

  async getUserRatings(userId: string): Promise<UserGameRating[]> {
    return this.ratingsRepo.find({ where: { userId }, relations: ['game'] });
  }

  async getGamesOwnedByUsers(userIds: string[]): Promise<Game[]> {
    const ownerships = await this.ownershipRepo.find({
      where: { userId: In(userIds) },
      relations: ['game'],
    });
    const gameMap = new Map<string, Game>();
    ownerships.forEach((o) => gameMap.set(o.gameId, o.game));
    return Array.from(gameMap.values());
  }

  async parseShelfPhoto(
    userId: string,
    imageBuffer: Buffer,
    mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    onProgress?: (payload: ShelfParseProgressPayload) => void,
  ): Promise<{
    candidates: Array<{
      detectionNumber: number;
      rawText: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      polygon?: Array<[number, number]>;
      title?: string;
      editionOrVersion?: string;
      gameId?: string;
      bggId?: number;
      thumbnailUrl?: string;
      imageUrl?: string;
      bggUrl?: string;
      source: 'local' | 'bgg';
      isOwned: boolean;
      detectionConfidence?: number;
      gameConfidence?: number;
      occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
      titleCandidates?: string[];
    }>;
    annotatedImageBase64?: string;
  }> {
    const owned = await this.getUserCollection(userId);
    const ownedGameIds = new Set(owned.map((o) => o.gameId));
    const ownedBggIds = new Set(
      owned.map((o) => o.game.bggId).filter((id): id is number => id != null),
    );

    // Build known-games hint for Gemini from the user's collection titles.
    // Passed as a soft constraint to improve title recognition on familiar games.
    const knownGames = owned
      .map((o) => o.game.title)
      .filter((t): t is string => Boolean(t));

    onProgress?.({
      stage: 'prepare',
      message: 'Loading your collection for recognition hints...',
      percent: 5,
    });

    // Run all four detection sources in parallel for maximum coverage.
    // Gemini boxes are most accurate; Claude covers Gemini misses; OCR fills the rest.
    // spineOut sends a 90°-rotated image to Gemini so spine-out games appear as normal
    // horizontal boxes — dramatically improving detection of games stored like books.
    let detectDetail: ShelfParseProgressDetail = {};
    let sourcesDone = 0;
    const sourcesTotal = 4;

    const bumpDetect = (label: string, partial: ShelfParseProgressDetail) => {
      sourcesDone += 1;
      detectDetail = { ...detectDetail, ...partial, sourcesDone, sourcesTotal };
      const pct = 12 + Math.round((sourcesDone / sourcesTotal) * 18);
      onProgress?.({
        stage: 'detect',
        message: label,
        percent: Math.min(32, pct),
        detail: detectDetail,
      });
    };

    onProgress?.({
      stage: 'detect',
      message: 'Scanning your photo for game boxes...',
      percent: 12,
      detail: { sourcesDone: 0, sourcesTotal },
    });

    const runGeminiMain = async () => {
      try {
        const r = await this.geminiVision.detectBoardGames(
          imageBuffer,
          mediaType,
          knownGames,
        );
        bumpDetect(`Pass complete: found ${r.length} possible boxes`, {
          geminiUpright: r.length,
        });
        return r;
      } catch (err) {
        this.logger.warn('Gemini upright shelf detection failed', err);
        bumpDetect('Pass complete: no boxes found', { geminiUpright: 0 });
        return [];
      }
    };

    const runClaude = async () => {
      try {
        const r = await this.claudeVision.detectBoardGames(
          imageBuffer,
          mediaType,
          knownGames,
        );
        bumpDetect(`Pass complete: found ${r.length} possible boxes`, {
          claude: r.length,
        });
        return r;
      } catch (err) {
        this.logger.warn('Claude shelf detection failed', err);
        bumpDetect('Pass complete: no boxes found', { claude: 0 });
        return [];
      }
    };

    const runOcr = async () => {
      try {
        const r = await this.vision.detectTextBlocks(imageBuffer);
        bumpDetect(`Text scan complete: ${r.length} text areas read`, {
          ocrBlocks: r.length,
        });
        return r;
      } catch (err) {
        this.logger.warn('Google OCR shelf detection failed', err);
        bumpDetect('Text scan complete: no text found', { ocrBlocks: 0 });
        return [];
      }
    };

    const runGeminiSpine = async () => {
      try {
        const r = await this.geminiVision.detectSpineOutGames(
          imageBuffer,
          mediaType,
          knownGames,
        );
        bumpDetect(`Pass complete: found ${r.length} possible boxes`, {
          geminiSpine: r.length,
        });
        return r;
      } catch (err) {
        this.logger.warn('Gemini spine-out shelf detection failed', err);
        bumpDetect('Pass complete: no boxes found', { geminiSpine: 0 });
        return [];
      }
    };

    const [geminiResults, claudeResults, ocrBlocks, spineOutResults] =
      await Promise.all([
        runGeminiMain(),
        runClaude(),
        runOcr(),
        runGeminiSpine(),
      ]);

    onProgress?.({
      stage: 'merge',
      message: 'Combining scan results...',
      percent: 33,
      detail: detectDetail,
    });

    const cleanedOcr = this.cleanOcrBlocks(ocrBlocks).sort((a, b) =>
      a.boundingBox.y === b.boundingBox.y
        ? a.boundingBox.x - b.boundingBox.x
        : a.boundingBox.y - b.boundingBox.y,
    );

    // Build merged title list: Gemini first (best boxes), then Claude for
    // anything Gemini missed, then OCR for anything neither AI caught.
    const titlesToSearch: Array<{
      title: string;
      editionOrVersion?: string;
      claudeBox?: { x: number; y: number; width: number; height: number };
      polygon?: Array<[number, number]>;
      detectionConfidence?: number;
      gameConfidence?: number;
      occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
      titleCandidates?: string[];
      ocrHint?: {
        text: string;
        confidence?: number;
        boundingBox: { x: number; y: number; width: number; height: number };
      };
    }> = geminiResults.map((r) => ({
      title: r.title,
      editionOrVersion: r.editionOrVersion,
      claudeBox: r.boundingBox,
      polygon: r.polygon,
      detectionConfidence: r.detectionConfidence,
      gameConfidence: r.gameConfidence,
      occlusionLevel: r.occlusionLevel,
      titleCandidates: r.candidates,
    }));

    for (const r of claudeResults) {
      const existing = titlesToSearch.find((t) =>
        this.isLikelySameTitle(r.title, t.title),
      );
      if (!existing) {
        titlesToSearch.push({
          title: r.title,
          editionOrVersion: r.editionOrVersion,
          claudeBox: r.boundingBox,
          polygon: r.polygon,
          titleCandidates: r.candidates?.map((c) => c.title),
          detectionConfidence: r.detectionConfidence,
          gameConfidence: r.gameConfidence,
          occlusionLevel: r.occlusionLevel,
        });
      } else {
        // Gemini detected this game — backfill any missing data from Claude
        if (!existing.claudeBox && r.boundingBox)
          existing.claudeBox = r.boundingBox;
        if (!existing.polygon && r.polygon) existing.polygon = r.polygon;
        if (!existing.editionOrVersion && r.editionOrVersion)
          existing.editionOrVersion = r.editionOrVersion;
        if (!existing.detectionConfidence && r.detectionConfidence)
          existing.detectionConfidence = r.detectionConfidence;
        if (!existing.gameConfidence && r.gameConfidence)
          existing.gameConfidence = r.gameConfidence;
        if (!existing.occlusionLevel && r.occlusionLevel)
          existing.occlusionLevel = r.occlusionLevel;
        if (!existing.titleCandidates?.length && r.candidates?.length)
          existing.titleCandidates = r.candidates.map((c) => c.title);
      }
    }

    // Merge spine-out results (90°-rotated Gemini pass) — fills in games that
    // were missed by the upright scan because their text was nearly unreadable
    // as a narrow vertical strip.
    for (const r of spineOutResults) {
      const existing = titlesToSearch.find((t) =>
        this.isLikelySameTitle(r.title, t.title),
      );
      if (!existing) {
        titlesToSearch.push({
          title: r.title,
          editionOrVersion: r.editionOrVersion,
          claudeBox: r.boundingBox,
          polygon: r.polygon,
          detectionConfidence: r.detectionConfidence,
          gameConfidence: r.gameConfidence,
          occlusionLevel: r.occlusionLevel,
          titleCandidates: r.candidates,
        });
      } else if (!existing.claudeBox && r.boundingBox) {
        existing.claudeBox = r.boundingBox;
        if (!existing.polygon && r.polygon) existing.polygon = r.polygon;
      }
    }

    const supplementalOcrBlocks = cleanedOcr
      .filter((block) => this.shouldUseOcrBlockAsTitle(block))
      .filter(
        (block) =>
          !titlesToSearch.some((t) =>
            this.isLikelySameTitle(block.text, t.title),
          ),
      )
      .sort((a, b) => {
        const confidenceDiff = (b.confidence ?? 0.7) - (a.confidence ?? 0.7);
        if (confidenceDiff !== 0) return confidenceDiff;
        return (
          b.boundingBox.width * b.boundingBox.height -
          a.boundingBox.width * a.boundingBox.height
        );
      })
      .slice(0, MAX_OCR_SUPPLEMENTAL_TITLES);

    for (const block of supplementalOcrBlocks) {
      titlesToSearch.push({ title: block.text, ocrHint: block });
    }

    // Last resort: if all AI sources returned nothing, use raw OCR
    if (titlesToSearch.length === 0) {
      for (const block of cleanedOcr.slice(0, MAX_OCR_SUPPLEMENTAL_TITLES)) {
        titlesToSearch.push({ title: block.text, ocrHint: block });
      }
    }

    const prunedTitles = this.suppressOverlappingShelfTitles(
      titlesToSearch.filter((t) => !this.isJunkShelfTitle(t.title)),
      0.2,
      0.28,
    );
    titlesToSearch.length = 0;
    titlesToSearch.push(...prunedTitles);

    onProgress?.({
      stage: 'merge',
      message: `Found ${titlesToSearch.length} likely game title(s)`,
      percent: 38,
      detail: { ...detectDetail, mergedTitles: titlesToSearch.length },
    });

    const candidates: Array<{
      detectionNumber: number;
      rawText: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      polygon?: Array<[number, number]>;
      title?: string;
      editionOrVersion?: string;
      gameId?: string;
      bggId?: number;
      thumbnailUrl?: string;
      imageUrl?: string;
      bggUrl?: string;
      source: 'local' | 'bgg';
      isOwned: boolean;
      detectionConfidence?: number;
      gameConfidence?: number;
      occlusionLevel?: 'none' | 'low' | 'medium' | 'high';
      titleCandidates?: string[];
    }> = [];

    // Process all detected titles in parallel — sequential BGG calls per game
    // were causing 90 s+ timeouts when Claude detects 20+ games.
    const matchTotal = titlesToSearch.length;
    let matchDone = 0;
    const bumpMatchProgress = () => {
      matchDone += 1;
      const done = matchDone;
      const pct =
        matchTotal === 0
          ? 78
          : 40 + Math.min(38, Math.round((done / matchTotal) * 38));
      onProgress?.({
        stage: 'match',
        message:
          matchTotal === 0
            ? 'No game titles found yet.'
            : `Matching games to our catalog (${done}/${matchTotal})...`,
        percent: pct,
        detail: { done, total: matchTotal },
      });
    };

    onProgress?.({
      stage: 'match',
      message:
        matchTotal === 0
          ? 'No game titles found. Skipping catalog match.'
          : `Matching ${matchTotal} game title(s) to our catalog...`,
      percent: 40,
      detail: { done: 0, total: matchTotal },
    });

    const settled = await Promise.allSettled(
      titlesToSearch.map(
        async (
          {
            title: rawText,
            editionOrVersion,
            claudeBox,
            polygon,
            detectionConfidence,
            gameConfidence,
            occlusionLevel,
            titleCandidates,
            ocrHint,
          },
          i,
        ) => {
          try {
            const ocrMatch =
              ocrHint ?? this.findBestOcrMatch(rawText, cleanedOcr);
            const rawOcrBox = ocrMatch?.boundingBox ?? null;
            const boundingBox = this.selectBestBoundingBox(
              claudeBox,
              rawOcrBox,
            );
            const confidence = ocrMatch?.confidence ?? undefined;

            // Include edition in BGG search when Gemini identified one
            const bggQuery = editionOrVersion
              ? `${rawText} ${editionOrVersion}`
              : rawText;

            const local = await this.searchLocalCandidates(rawText);
            const localBest = this.pickBestLocalMatch(rawText, local);
            if (localBest) {
              let thumb =
                localBest.thumbnailUrl?.trim() || localBest.imageUrl?.trim();
              let imageUrl = localBest.imageUrl?.trim();
              // If no image in local DB, fetch from BGG and persist the update.
              if (localBest.bggId != null && !thumb) {
                await bggSemaphore.acquire();
                try {
                  const d = await this.fetchBggThingByIdWithRetry(
                    localBest.bggId,
                  );
                  if (d?.thumbnailUrl || d?.imageUrl) {
                    thumb =
                      d.thumbnailUrl?.trim() || d.imageUrl?.trim() || thumb;
                    imageUrl = d.imageUrl?.trim() || imageUrl;
                    await this.findOrCreateByBggId(localBest.bggId, d);
                  }
                } finally {
                  bggSemaphore.release();
                }
              }
              return {
                detectionNumber: i + 1,
                rawText,
                confidence,
                boundingBox,
                polygon,
                title: localBest.title,
                editionOrVersion,
                gameId: localBest.id,
                bggId: localBest.bggId ?? undefined,
                thumbnailUrl: thumb || undefined,
                imageUrl: imageUrl || undefined,
                bggUrl:
                  localBest.bggId != null
                    ? `https://boardgamegeek.com/boardgame/${localBest.bggId}`
                    : undefined,
                source: 'local' as const,
                isOwned:
                  ownedGameIds.has(localBest.id) ||
                  (localBest.bggId != null && ownedBggIds.has(localBest.bggId)),
                detectionConfidence,
                gameConfidence,
                occlusionLevel,
                titleCandidates,
              };
            }

            const bgg = await this.fetchBestBggMatch(bggQuery);
            if (!bgg) return null;

            await bggSemaphore.acquire();
            let details: Partial<Game> | null = null;
            try {
              details = await this.fetchBggThingByIdWithRetry(bgg.bggId);
            } finally {
              bggSemaphore.release();
            }

            // Persist the BGG game locally so future shelf scans find it in the DB.
            const savedGame = details
              ? await this.findOrCreateByBggId(bgg.bggId, details)
              : null;

            const bggThumb = details?.thumbnailUrl ?? details?.imageUrl;
            // Prefer whichever title best matches the OCR text. The BGG /thing API
            // can return a localized/alternate primary title that differs
            // significantly from the search-result title that actually matched.
            const thingTitle = savedGame?.title ?? details?.title;
            const displayTitle =
              thingTitle &&
              this.scoreTitleMatch(rawText, thingTitle) >=
                this.scoreTitleMatch(rawText, bgg.title)
                ? thingTitle
                : bgg.title;
            return {
              detectionNumber: i + 1,
              rawText,
              confidence,
              boundingBox,
              polygon,
              title: displayTitle,
              editionOrVersion,
              gameId: savedGame?.id,
              bggId: bgg.bggId,
              thumbnailUrl: bggThumb ?? undefined,
              imageUrl: details?.imageUrl ?? undefined,
              bggUrl: `https://boardgamegeek.com/boardgame/${bgg.bggId}`,
              source: 'bgg' as const,
              isOwned:
                (savedGame != null && ownedGameIds.has(savedGame.id)) ||
                ownedBggIds.has(bgg.bggId),
              detectionConfidence,
              gameConfidence,
              occlusionLevel,
              titleCandidates,
            };
          } finally {
            bumpMatchProgress();
          }
        },
      ),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value !== null) {
        candidates.push(result.value);
      }
    }

    const seenGameIds = new Set<string>();
    const seenBggIds = new Set<number>();
    const deduped = candidates.filter((candidate) => {
      if (candidate.gameId) {
        if (seenGameIds.has(candidate.gameId)) return false;
        seenGameIds.add(candidate.gameId);
      }
      if (candidate.bggId != null) {
        if (seenBggIds.has(candidate.bggId)) return false;
        seenBggIds.add(candidate.bggId);
      }
      return true;
    });

    // Reassign detectionNumber 1..N after dedupe to remove gaps
    const renumbered = deduped.map((candidate, index) => ({
      ...candidate,
      detectionNumber: index + 1,
    }));

    // Final pass on *matched* boxes: OCR blending can reintroduce overlaps that
    // title-merge NMS never saw. Drop lower-confidence overlaps so outlines
    // cannot intersect in the annotated image / overlay.
    const overlapPruned = this.suppressOverlappingShelfCandidates(renumbered, {
      iouThreshold: 0.14,
      overlapSmallerMin: 0.26,
    });
    const finalCandidates = overlapPruned.map((candidate, index) => ({
      ...candidate,
      detectionNumber: index + 1,
    }));

    // Draw bounding boxes directly on the image so the frontend can display
    // an annotated photo without fragile CSS overlay positioning.
    onProgress?.({
      stage: 'annotate',
      message: 'Drawing clean box outlines on your photo...',
      percent: 84,
    });

    const annotatedBuffer = await this.claudeVision
      .drawAnnotations(imageBuffer, finalCandidates)
      .catch((err) => {
        this.logger.warn('Failed to draw shelf annotations', err);
        return null;
      });
    const annotatedImageBase64 = annotatedBuffer
      ? `data:image/jpeg;base64,${annotatedBuffer.toString('base64')}`
      : undefined;

    onProgress?.({
      stage: 'finalize',
      message: 'Preparing your results...',
      percent: 97,
    });

    return { candidates: finalCandidates, annotatedImageBase64 };
  }

  private isJunkShelfTitle(title: string): boolean {
    const t = title.replace(/\s+/g, ' ').trim();
    if (t.length < 2) return true;
    const u = t.toUpperCase();
    const garbage = new Set([
      'UNKNOWN',
      'N/A',
      'NA',
      'NONE',
      'NULL',
      '???',
      '?',
      'UNREADABLE',
      'NOT FOUND',
      'NO TITLE',
      'NOT A GAME',
      'NOT IDENTIFIED',
      '(UNKNOWN)',
      '[UNKNOWN]',
    ]);
    if (garbage.has(u)) return true;
    if (/^unknown$/i.test(t)) return true;
    if (/^n\/?a$/i.test(t)) return true;
    if (/^not\s+found$/i.test(t)) return true;
    if (/^unable\s+to\s+read$/i.test(t)) return true;
    return false;
  }

  private shelfBoxIoU(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);
    const iw = Math.max(0, x2 - x1);
    const ih = Math.max(0, y2 - y1);
    const inter = iw * ih;
    const union = a.width * a.height + b.width * b.height - inter;
    return union <= 0 ? 0 : inter / union;
  }

  /**
   * Intersection area divided by the smaller box's area — catches strong partial
   * overlaps where IoU stays low because the boxes differ in size.
   */
  private shelfBoxOverlapSmaller(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): number {
    const inter = this.intersectionArea(a, b);
    const aArea = this.boxArea(a);
    const bArea = this.boxArea(b);
    const smaller = Math.min(aArea, bArea);
    return smaller <= 0 ? 0 : inter / smaller;
  }

  /**
   * True when one box largely covers another (nested duplicate), even if IoU is moderate
   * because the inner box is much smaller.
   */
  private shelfBoxNestedDuplicate(
    inner: { x: number; y: number; width: number; height: number },
    outer: { x: number; y: number; width: number; height: number },
  ): boolean {
    const x1 = Math.max(inner.x, outer.x);
    const y1 = Math.max(inner.y, outer.y);
    const x2 = Math.min(inner.x + inner.width, outer.x + outer.width);
    const y2 = Math.min(inner.y + inner.height, outer.y + outer.height);
    const iw = Math.max(0, x2 - x1);
    const ih = Math.max(0, y2 - y1);
    const inter = iw * ih;
    const innerArea = inner.width * inner.height;
    const outerArea = outer.width * outer.height;
    if (innerArea <= 0 || outerArea <= 0) return false;
    const coverInner = inter / innerArea;
    const coverOuter = inter / outerArea;
    return (
      (coverInner >= 0.52 && innerArea <= outerArea * 0.95) ||
      (coverOuter >= 0.52 && outerArea <= innerArea * 0.95)
    );
  }

  private shelfTitleDetectionScore(title: {
    detectionConfidence?: number;
    gameConfidence?: number;
  }): number {
    const d = title.detectionConfidence ?? 0.55;
    const g = title.gameConfidence ?? 0.55;
    return d * 0.55 + g * 0.45;
  }

  private shelfBoundingBoxFromPolygon(
    polygon?: Array<[number, number]>,
  ): { x: number; y: number; width: number; height: number } | undefined {
    if (!polygon || polygon.length !== 4) return undefined;
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    if (!(width > 0.001 && height > 0.001)) return undefined;
    return this.clampUnitBox({ x: minX, y: minY, width, height });
  }

  private shelfBoundingBoxForTitle(title: {
    claudeBox?: { x: number; y: number; width: number; height: number };
    ocrHint?: {
      text: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
    };
    polygon?: Array<[number, number]>;
  }): { x: number; y: number; width: number; height: number } | undefined {
    return (
      title.claudeBox ??
      title.ocrHint?.boundingBox ??
      this.shelfBoundingBoxFromPolygon(title.polygon)
    );
  }

  private suppressOverlappingShelfTitles<
    T extends {
      title: string;
      claudeBox?: { x: number; y: number; width: number; height: number };
      ocrHint?: {
        text: string;
        confidence?: number;
        boundingBox: { x: number; y: number; width: number; height: number };
      };
      polygon?: Array<[number, number]>;
      detectionConfidence?: number;
      gameConfidence?: number;
    },
  >(items: T[], iouThreshold: number, overlapSmallerMin: number): T[] {
    const ordered = [...items].sort(
      (a, b) =>
        this.shelfTitleDetectionScore(b) - this.shelfTitleDetectionScore(a),
    );
    const kept: T[] = [];
    for (const cur of ordered) {
      const box = this.shelfBoundingBoxForTitle(cur);
      if (
        !box ||
        box.width <= 0.001 ||
        box.height <= 0.001 ||
        box.width > 0.99 ||
        box.height > 0.99
      ) {
        kept.push(cur);
        continue;
      }
      let overlaps = false;
      for (const existing of kept) {
        const ob = this.shelfBoundingBoxForTitle(existing);
        if (!ob) continue;
        if (
          this.shelfBoxIoU(box, ob) >= iouThreshold ||
          this.shelfBoxOverlapSmaller(box, ob) >= overlapSmallerMin ||
          this.shelfBoxNestedDuplicate(box, ob) ||
          this.shelfBoxNestedDuplicate(ob, box)
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) kept.push(cur);
    }
    return kept;
  }

  private shelfCandidateVisualScore(candidate: {
    confidence?: number;
    detectionConfidence?: number;
    gameConfidence?: number;
  }): number {
    const base = this.shelfTitleDetectionScore(candidate);
    const ocr = candidate.confidence;
    if (ocr == null) return base;
    return base * 0.62 + ocr * 0.38;
  }

  private suppressOverlappingShelfCandidates<
    T extends {
      boundingBox: { x: number; y: number; width: number; height: number };
      confidence?: number;
      detectionConfidence?: number;
      gameConfidence?: number;
    },
  >(
    items: T[],
    opts: { iouThreshold: number; overlapSmallerMin: number },
  ): T[] {
    const ordered = [...items].sort(
      (a, b) =>
        this.shelfCandidateVisualScore(b) - this.shelfCandidateVisualScore(a),
    );
    const kept: T[] = [];
    for (const cur of ordered) {
      const box = this.clampUnitBox(cur.boundingBox);
      if (
        box.width <= 0.001 ||
        box.height <= 0.001 ||
        box.width > 0.99 ||
        box.height > 0.99
      ) {
        kept.push(cur);
        continue;
      }
      let overlaps = false;
      for (const existing of kept) {
        const ob = this.clampUnitBox(existing.boundingBox);
        if (
          ob.width <= 0.001 ||
          ob.height <= 0.001 ||
          ob.width > 0.99 ||
          ob.height > 0.99
        ) {
          continue;
        }
        if (
          this.shelfBoxIoU(box, ob) >= opts.iouThreshold ||
          this.shelfBoxOverlapSmaller(box, ob) >= opts.overlapSmallerMin ||
          this.shelfBoxNestedDuplicate(box, ob) ||
          this.shelfBoxNestedDuplicate(ob, box)
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) kept.push(cur);
    }
    return kept;
  }

  /**
   * Returns true when a bounding box looks like a plausible single game box.
   * Rejects boxes that are too tiny (positioning noise) or too large (likely
   * Claude wrapped an entire shelf section instead of one box).
   */
  private isReasonableGameBox(box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): boolean {
    const area = box.width * box.height;
    return (
      (box.width >= 0.02 ||
        (box.width >= 0.005 && box.height / box.width >= 3)) &&
      box.height >= 0.03 &&
      // A single game box can legitimately fill most of a close-up frame.
      // Only reject degenerate boxes that cover effectively the whole image.
      box.width <= 0.95 &&
      box.height <= 0.95 &&
      area <= 0.72 &&
      box.x >= -0.02 &&
      box.y >= -0.02 &&
      box.x + box.width <= 1.05 &&
      box.y + box.height <= 1.05
    );
  }

  /**
   * Expands an OCR text region to estimate the full game box it belongs to.
   * Game box faces are much larger than the text region — typically 3-5× taller
   * and 1.2-1.5× wider than the title text area.
   */
  private expandOcrToGameBox(textBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number } {
    const textAspect = textBox.height / Math.max(textBox.width, 0.0001);
    const isLikelySpine = textAspect >= 2.2;
    const expandedWidth = Math.min(
      1,
      Math.max(
        textBox.width * (isLikelySpine ? 2.2 : 1.8),
        isLikelySpine ? 0.022 : 0.06,
      ),
    );
    const expandedHeight = Math.min(
      1,
      Math.max(
        textBox.height * (isLikelySpine ? 2.8 : 4.6),
        isLikelySpine ? 0.08 : 0.12,
      ),
    );
    const centerX = textBox.x + textBox.width / 2;
    // Front-facing covers usually print title in the upper half, so bias the
    // expanded box downward. Spine text is typically centered.
    const verticalAnchor = isLikelySpine ? 0.5 : 0.35;
    const x = Math.max(0, centerX - expandedWidth / 2);
    const y = Math.max(
      0,
      textBox.y + textBox.height / 2 - expandedHeight * verticalAnchor,
    );
    return {
      x,
      y,
      width: Math.min(expandedWidth, 1 - x),
      height: Math.min(expandedHeight, 1 - y),
    };
  }

  private findBestOcrMatch(
    title: string,
    ocrBlocks: Array<{
      text: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>,
  ): {
    text: string;
    confidence?: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  } | null {
    const normalizedTitle = this.normalizeTitle(title);
    let best: { block: (typeof ocrBlocks)[0]; score: number } | null = null;
    for (const block of ocrBlocks) {
      const score = this.scoreTitleMatch(normalizedTitle, block.text);
      if (score >= OCR_MATCH_MIN_SCORE && (!best || score > best.score)) {
        best = { block, score };
      }
    }
    return best?.block ?? null;
  }

  async batchAddToCollection(
    userId: string,
    items: BatchAddItem[],
  ): Promise<{ added: number; skipped: number; addedGameIds: string[] }> {
    let added = 0;
    let skipped = 0;
    const addedGameIds: string[] = [];
    for (const item of items) {
      if (item.gameId) {
        const result = await this.addToCollection(userId, item.gameId);
        if (result) {
          added++;
          addedGameIds.push(item.gameId);
        } else {
          skipped++;
        }
        continue;
      }
      if (item.bggId != null) {
        const details = await this.fetchBggThingById(item.bggId);
        if (!details) {
          skipped++;
          continue;
        }
        const game = await this.findOrCreateByBggId(item.bggId, details);
        await this.addToCollection(userId, game.id);
        added++;
        addedGameIds.push(game.id);
        continue;
      }
      skipped++;
    }
    return { added, skipped, addedGameIds };
  }

  private cleanOcrBlocks(
    blocks: Array<{
      text: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>,
  ): Array<{
    text: string;
    confidence?: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  }> {
    const noiseWords = new Set(['edition', 'game', 'board', 'the', 'new']);
    const seen = new Set<string>();
    return blocks
      .map((block) => ({
        ...block,
        text: block.text.replace(/\s+/g, ' ').trim(),
      }))
      .filter((block) => block.text.length >= 2)
      .filter((block) => {
        const normalized = block.text.toLowerCase().replace(/[^a-z0-9 ]+/g, '');
        if (!/[a-z]/.test(normalized)) return false;
        if (normalized.split(' ').length === 1 && noiseWords.has(normalized)) {
          return false;
        }
        const { x, y, width, height } = block.boundingBox;
        const dedupeKey = `${normalized}:${Math.round(x * 100)}:${Math.round(
          y * 100,
        )}:${Math.round(width * 100)}:${Math.round(height * 100)}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
  }

  private shouldUseOcrBlockAsTitle(block: {
    text: string;
    confidence?: number;
    boundingBox: { x: number; y: number; width: number; height: number };
  }): boolean {
    const normalized = this.normalizeTitle(block.text);
    if (!normalized) return false;
    const tokens = normalized.split(' ').filter(Boolean);
    if (!tokens.length) return false;
    if (tokens.length === 1) {
      if (tokens[0].length < 4) return false;
      if (/^\d+$/.test(tokens[0])) return false;
    }
    const area = block.boundingBox.width * block.boundingBox.height;
    if (area < 0.00005) return false;
    return (block.confidence ?? 0.7) >= 0.28;
  }

  private isLikelySameTitle(a: string, b: string): boolean {
    const normalizedA = this.normalizeTitle(a);
    const normalizedB = this.normalizeTitle(b);
    if (!normalizedA || !normalizedB) return false;
    if (normalizedA === normalizedB) return true;
    return (
      this.scoreTitleMatch(normalizedA, normalizedB) >=
        TITLE_DUPLICATE_MATCH_SCORE ||
      this.scoreTitleMatch(normalizedB, normalizedA) >=
        TITLE_DUPLICATE_MATCH_SCORE
    );
  }

  private clampUnitBox(box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): { x: number; y: number; width: number; height: number } {
    const x = Math.max(0, Math.min(1, box.x));
    const y = Math.max(0, Math.min(1, box.y));
    const width = Math.max(0, Math.min(box.width, 1 - x));
    const height = Math.max(0, Math.min(box.height, 1 - y));
    return { x, y, width, height };
  }

  private boxArea(box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): number {
    return Math.max(0, box.width) * Math.max(0, box.height);
  }

  private intersectionArea(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): number {
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  }

  private selectBestBoundingBox(
    claudeBox?: { x: number; y: number; width: number; height: number },
    ocrTextBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null,
  ): { x: number; y: number; width: number; height: number } {
    const empty = { x: 0, y: 0, width: 0, height: 0 };
    const claude = claudeBox ? this.clampUnitBox(claudeBox) : null;
    const ocrExpanded = ocrTextBox ? this.expandOcrToGameBox(ocrTextBox) : null;

    if (!claude) return ocrExpanded ?? empty;
    if (!this.isReasonableGameBox(claude)) {
      return ocrExpanded ?? claude;
    }
    if (!ocrExpanded) return claude;

    const claudeArea = this.boxArea(claude);
    const ocrArea = this.boxArea(ocrExpanded);
    const overlap = this.intersectionArea(claude, ocrExpanded);
    const ocrOverlapRatio = ocrArea > 0 ? overlap / ocrArea : 0;

    // Claude can occasionally capture a whole shelf region. Prefer OCR-guided box
    // when Claude is much larger than the OCR-estimated single-box area.
    if (claudeArea > 0.22 && ocrArea > 0.0004 && ocrArea < claudeArea * 0.58) {
      return ocrExpanded;
    }

    // If both boxes mostly overlap, blend toward OCR to tighten outlines.
    if (
      ocrOverlapRatio >= 0.45 &&
      ocrArea > 0.0003 &&
      ocrArea < claudeArea * 1.4
    ) {
      return this.clampUnitBox({
        x: claude.x * 0.3 + ocrExpanded.x * 0.7,
        y: claude.y * 0.3 + ocrExpanded.y * 0.7,
        width: claude.width * 0.3 + ocrExpanded.width * 0.7,
        height: claude.height * 0.3 + ocrExpanded.height * 0.7,
      });
    }

    return claude;
  }

  private buildSearchQueryVariants(rawText: string): string[] {
    const normalized = this.normalizeTitle(rawText);
    if (!normalized) return [];
    const variants: string[] = [];
    const push = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length < 2) return;
      if (variants.includes(trimmed)) return;
      variants.push(trimmed);
    };

    push(rawText);
    push(normalized);

    const tokens = normalized.split(' ').filter(Boolean);
    const stopWords = new Set(['the', 'edition', 'game', 'board']);
    const filteredTokens = tokens.filter((token) => !stopWords.has(token));
    push(filteredTokens.join(' '));

    if (filteredTokens.length >= 2) {
      push(filteredTokens.slice(0, 2).join(' '));
    }
    if (filteredTokens.length >= 1) {
      const longestToken = [...filteredTokens].sort(
        (a, b) => b.length - a.length,
      )[0];
      push(longestToken);
    }

    return variants.slice(0, 3);
  }

  private async searchLocalCandidates(rawText: string): Promise<Game[]> {
    const variants = this.buildSearchQueryVariants(rawText);
    if (!variants.length) return [];
    const byId = new Map<string, Game>();
    for (const variant of variants) {
      const results = await this.searchGames(variant);
      for (const game of results) {
        byId.set(game.id, game);
      }
      if (byId.size >= 8) break;
    }
    return [...byId.values()];
  }

  private pickBestLocalMatch(query: string, games: Game[]): Game | null {
    const normalizedQuery = this.normalizeTitle(query);
    const ranked = games
      .map((game) => ({
        game,
        score: this.scoreTitleMatch(normalizedQuery, game.title),
      }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] && ranked[0].score >= LOCAL_MATCH_MIN_SCORE
      ? ranked[0].game
      : null;
  }

  private normalizeTitle(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private scoreTitleMatch(query: string, title: string): number {
    const normalizedQuery = this.normalizeTitle(query);
    const normalizedTitle = this.normalizeTitle(title);
    if (!normalizedQuery || !normalizedTitle) return 0;
    if (normalizedTitle === normalizedQuery) return 100;
    if (
      normalizedTitle.startsWith(normalizedQuery) ||
      normalizedQuery.startsWith(normalizedTitle)
    ) {
      return 82;
    }
    if (
      normalizedTitle.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTitle)
    ) {
      return 68;
    }
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const titleTokens = normalizedTitle.split(' ');
    if (!queryTokens.length || !titleTokens.length) return 0;

    let strongMatches = 0;
    let fuzzyMatches = 0;
    for (const token of queryTokens) {
      if (
        titleTokens.some(
          (titleToken) =>
            titleToken.startsWith(token) || token.startsWith(titleToken),
        )
      ) {
        strongMatches++;
        continue;
      }
      if (
        token.length >= 4 &&
        titleTokens.some(
          (titleToken) =>
            titleToken.length >= 4 &&
            this.withinEditDistanceOne(token, titleToken),
        )
      ) {
        fuzzyMatches++;
      }
    }
    const strongCoverage = strongMatches / queryTokens.length;
    const combinedCoverage =
      (strongMatches + fuzzyMatches) / queryTokens.length;
    const tokenCountPenalty =
      Math.max(0, Math.abs(queryTokens.length - titleTokens.length) - 1) * 3;
    const score = Math.max(
      Math.floor(strongCoverage * 62),
      Math.floor(combinedCoverage * 56),
    );
    return Math.max(0, score - tokenCountPenalty);
  }

  private withinEditDistanceOne(a: string, b: string): boolean {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;

    let i = 0;
    let j = 0;
    let edits = 0;

    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }

      edits++;
      if (edits > 1) return false;

      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    }

    if (i < a.length || j < b.length) edits++;
    return edits <= 1;
  }

  private getBggToken(): string | null {
    const token = this.config.get<string>('BGG_API_TOKEN');
    if (!token || token === 'your-bgg-api-token') return null;
    return token;
  }

  private async fetchBestBggMatch(
    query: string,
  ): Promise<{ bggId: number; title: string } | null> {
    const token = this.getBggToken();
    if (!token) return null;
    const variants = this.buildSearchQueryVariants(query).slice(0, 2);
    for (const variant of variants) {
      // Prefer exact match (precise); fall back to non-exact when exact finds nothing.
      const exactMatch = await this.doBggSearch(variant, true, token);
      if (exactMatch) return exactMatch;
      const broadMatch = await this.doBggSearch(variant, false, token);
      if (broadMatch) return broadMatch;
    }
    return null;
  }

  private async doBggSearch(
    query: string,
    exact: boolean,
    token: string,
  ): Promise<{ bggId: number; title: string } | null> {
    const qs = `query=${encodeURIComponent(query)}&type=boardgame${exact ? '&exact=1' : ''}`;
    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/search?${qs}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return null;
    const xml = await response.text();
    // For non-exact search BGG returns many results; pick the one whose primary
    // name best matches the query rather than blindly taking the first.
    const itemPattern =
      /<item[^>]*id="(\d+)"[^>]*>[\s\S]*?<name[^>]*type="primary"[^>]*value="([^"]+)"/g;
    const hits: Array<{ bggId: number; title: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = itemPattern.exec(xml)) !== null) {
      hits.push({
        bggId: Number.parseInt(m[1], 10),
        title: this.decodeXml(m[2]),
      });
      if (hits.length >= 10) break; // cap to avoid O(n) on huge result sets
    }
    if (!hits.length) return null;
    // Score all hits regardless of exact/non-exact mode.
    // BGG's exact=1 can match on an *alternate* name while the XML primary
    // name is completely different (e.g. searching "Century" may return a hit
    // whose primary name is "il Secolo di Ferro"). Scoring catches this.
    const normalizedQuery = this.normalizeTitle(query);
    const ranked = hits
      .map((h) => ({
        ...h,
        score: this.scoreTitleMatch(normalizedQuery, h.title),
      }))
      .sort((a, b) => b.score - a.score);
    return ranked[0].score >= BGG_MATCH_MIN_SCORE ? ranked[0] : null;
  }

  private async fetchBggThingById(
    bggId: number,
  ): Promise<Partial<Game> | null> {
    const token = this.getBggToken();
    if (!token) {
      throw new BadRequestException(
        'BGG_API_TOKEN is required for BGG imports',
      );
    }
    let response = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // BGG rate-limits heavily — retry once after a short back-off
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      response = await fetch(
        `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    }
    if (!response.ok) return null;
    const xml = await response.text();
    const title = xml.match(
      /<name[^>]*type="primary"[^>]*value="([^"]+)"/,
    )?.[1];
    if (!title) return null;
    const rawThumbnailUrl = xml.match(/<thumbnail>([^<]+)<\/thumbnail>/)?.[1];
    const rawImageUrl = xml.match(/<image>([^<]+)<\/image>/)?.[1];
    // BGG XML returns protocol-relative URLs like //cf.geekdo-images.com/...
    // and sometimes HTML-encoded entities — normalize both.
    const thumbnailUrl = rawThumbnailUrl
      ? this.normalizeBggImageUrl(rawThumbnailUrl)
      : undefined;
    const imageUrl = rawImageUrl
      ? this.normalizeBggImageUrl(rawImageUrl)
      : undefined;
    const minPlayers = xml.match(/<minplayers[^>]*value="(\d+)"/)?.[1];
    const maxPlayers = xml.match(/<maxplayers[^>]*value="(\d+)"/)?.[1];
    const playingTime = xml.match(/<playingtime[^>]*value="(\d+)"/)?.[1];
    const yearPublished = xml.match(/<yearpublished[^>]*value="(\d+)"/)?.[1];
    return {
      title: this.decodeXml(title),
      thumbnailUrl,
      imageUrl,
      minPlayers: minPlayers ? Number.parseInt(minPlayers, 10) : undefined,
      maxPlayers: maxPlayers ? Number.parseInt(maxPlayers, 10) : undefined,
      playingTime: playingTime ? Number.parseInt(playingTime, 10) : undefined,
      yearPublished: yearPublished
        ? Number.parseInt(yearPublished, 10)
        : undefined,
    };
  }

  private async fetchBggThingByIdWithRetry(
    bggId: number,
  ): Promise<Partial<Game> | null> {
    try {
      const first = await this.fetchBggThingById(bggId);
      if (first) return first;
    } catch {
      /* missing token or upstream error */
    }
    await new Promise((r) => setTimeout(r, 400));
    try {
      return await this.fetchBggThingById(bggId);
    } catch {
      return null;
    }
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  /**
   * Normalizes image URLs returned by the BGG XML API.
   * BGG returns protocol-relative URLs (e.g. //cf.geekdo-images.com/...) and
   * occasionally HTML-escaped characters. Browsers do support protocol-relative
   * URLs, but they fail when the frontend is loaded via file:// or from a
   * different scheme context, so we normalize to https explicitly.
   */
  private normalizeBggImageUrl(url: string): string {
    const decoded = this.decodeXml(url).trim();
    if (decoded.startsWith('//')) return `https:${decoded}`;
    if (decoded.startsWith('http://')) return `https://${decoded.slice(7)}`;
    return decoded;
  }

  async getOwnershipsByUsers(
    userIds: string[],
  ): Promise<Array<Pick<UserGameOwnership, 'userId' | 'gameId'>>> {
    if (!userIds.length) return [];
    const ownerships = await this.ownershipRepo.find({
      where: { userId: In(userIds) },
      select: ['userId', 'gameId'],
    });
    return ownerships.map((ownership) => ({
      userId: ownership.userId,
      gameId: ownership.gameId,
    }));
  }

  async getRatingsForGames(
    userIds: string[],
    gameIds: string[],
  ): Promise<UserGameRating[]> {
    if (!gameIds.length || !userIds.length) return [];
    return this.ratingsRepo.find({
      where: { userId: In(userIds), gameId: In(gameIds) },
    });
  }

  async getUserOwnedGamesByIds(
    userId: string,
    gameIds: string[],
  ): Promise<Game[]> {
    if (!gameIds.length) return [];
    const ownerships = await this.ownershipRepo.find({
      where: { userId, gameId: In(gameIds) },
      relations: ['game'],
    });
    return ownerships.map((ownership) => ownership.game);
  }

  async getDiscoveryGames(
    playerCount: number,
    excludeGameIds: string[],
    limit: number,
  ): Promise<Game[]> {
    const qb = this.gamesRepo
      .createQueryBuilder('game')
      .where('game.minPlayers <= :playerCount', { playerCount })
      .andWhere('game.maxPlayers >= :playerCount', { playerCount })
      .orderBy('game.bggRating', 'DESC', 'NULLS LAST')
      .addOrderBy('game.updatedAt', 'DESC')
      .limit(limit);

    if (excludeGameIds.length > 0) {
      qb.andWhere('game.id NOT IN (:...excludeGameIds)', { excludeGameIds });
    }

    return qb.getMany();
  }

  async getCatalogQualityStats(): Promise<{
    total: number;
    missingRating: number;
    missingWeight: number;
    missingYear: number;
    missingPoll: number;
    missingPlayingTime: number;
    missingThumbnail: number;
  }> {
    const rows = await this.gamesRepo.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "bggRating" IS NULL)::int AS "missingRating",
        COUNT(*) FILTER (WHERE weight IS NULL)::int AS "missingWeight",
        COUNT(*) FILTER (WHERE "yearPublished" IS NULL)::int AS "missingYear",
        COUNT(*) FILTER (WHERE "bggPlayerCountPoll" IS NULL OR "bggPlayerCountPoll" = '')::int AS "missingPoll",
        COUNT(*) FILTER (WHERE "playingTime" IS NULL OR "playingTime" <= 0)::int AS "missingPlayingTime",
        COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM("thumbnailUrl"), ''), NULLIF(TRIM("imageUrl"), '')) IS NULL)::int AS "missingThumbnail"
      FROM games
    `);
    return rows[0];
  }

  async getIncompleteBggIds(limit = 1000): Promise<number[]> {
    const rows: Array<{ bggId: number }> = await this.gamesRepo.query(
      `
        SELECT "bggId"
        FROM games
        WHERE "bggId" IS NOT NULL
          AND (
            "bggRating" IS NULL
            OR weight IS NULL
            OR "yearPublished" IS NULL
            OR "bggPlayerCountPoll" IS NULL
            OR "bggPlayerCountPoll" = ''
            OR "playingTime" IS NULL
            OR "playingTime" <= 0
            OR COALESCE(NULLIF(TRIM("thumbnailUrl"), ''), NULLIF(TRIM("imageUrl"), '')) IS NULL
          )
        ORDER BY "updatedAt" DESC
        LIMIT $1
      `,
      [Math.max(1, Math.floor(limit))],
    );
    return rows
      .map((row) => Number(row.bggId))
      .filter((id) => !Number.isNaN(id) && id > 0);
  }

  async getCatalogEntriesForAdmin(
    page = 1,
    pageSize = 100,
  ): Promise<{
    items: Array<{
      id: string;
      bggId: number | null;
      title: string;
      yearPublished: number | null;
      playingTime: number | null;
      bggRating: number | null;
      weight: number | null;
      missingPoll: boolean;
      missingYear: boolean;
      missingPlayingTime: boolean;
      missingRating: boolean;
      missingWeight: boolean;
      missingThumbnail: boolean;
      isIncomplete: boolean;
    }>;
    meta: { page: number; pageSize: number; total: number; hasNext: boolean };
  }> {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.min(200, Math.max(1, Math.floor(pageSize)));
    const offset = (normalizedPage - 1) * normalizedPageSize;

    const items = await this.gamesRepo.query(
      `
        SELECT
          id,
          "bggId",
          title,
          "yearPublished",
          "playingTime",
          "bggRating",
          weight,
          ("bggPlayerCountPoll" IS NULL OR "bggPlayerCountPoll" = '') AS "missingPoll",
          ("yearPublished" IS NULL) AS "missingYear",
          ("playingTime" IS NULL OR "playingTime" <= 0) AS "missingPlayingTime",
          ("bggRating" IS NULL) AS "missingRating",
          (weight IS NULL) AS "missingWeight",
          (COALESCE(NULLIF(TRIM("thumbnailUrl"), ''), NULLIF(TRIM("imageUrl"), '')) IS NULL) AS "missingThumbnail",
          (
            "yearPublished" IS NULL
            OR "playingTime" IS NULL
            OR "playingTime" <= 0
            OR "bggPlayerCountPoll" IS NULL
            OR "bggPlayerCountPoll" = ''
            OR "bggRating" IS NULL
            OR weight IS NULL
            OR COALESCE(NULLIF(TRIM("thumbnailUrl"), ''), NULLIF(TRIM("imageUrl"), '')) IS NULL
          ) AS "isIncomplete"
        FROM games
        ORDER BY "isIncomplete" DESC, title ASC
        LIMIT $1 OFFSET $2
      `,
      [normalizedPageSize, offset],
    );

    const totalRows: Array<{ total: string }> = await this.gamesRepo.query(
      `SELECT COUNT(*)::text AS total FROM games`,
    );
    const total = Number(totalRows[0]?.total ?? 0);

    return {
      items,
      meta: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        hasNext: normalizedPage * normalizedPageSize < total,
      },
    };
  }

  async deleteForAdmin(gameId: string): Promise<void> {
    const existing = await this.gamesRepo.findOne({
      where: { id: gameId },
      select: ['id'],
    });
    if (!existing) {
      throw new NotFoundException('Game not found');
    }
    await this.gamesRepo.delete(gameId);
  }
}
