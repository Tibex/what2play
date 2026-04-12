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
  ): Promise<{
    candidates: Array<{
      detectionNumber: number;
      rawText: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      title?: string;
      gameId?: string;
      bggId?: number;
      thumbnailUrl?: string;
      imageUrl?: string;
      source: 'local' | 'bgg';
      isOwned: boolean;
    }>;
    annotatedImageBase64?: string;
  }> {
    const owned = await this.getUserCollection(userId);
    const ownedGameIds = new Set(owned.map((o) => o.gameId));
    const ownedBggIds = new Set(
      owned.map((o) => o.game.bggId).filter((id): id is number => id != null),
    );

    // Run Claude vision and OCR in parallel; Claude is primary when available
    const [claudeResults, ocrBlocks] = await Promise.all([
      this.claudeVision.detectBoardGames(imageBuffer, mediaType),
      this.vision.detectTextBlocks(imageBuffer).catch(() => []),
    ]);

    const cleanedOcr = this.cleanOcrBlocks(ocrBlocks).sort((a, b) =>
      a.boundingBox.y === b.boundingBox.y
        ? a.boundingBox.x - b.boundingBox.x
        : a.boundingBox.y - b.boundingBox.y,
    );

    // Use Claude results when available; fall back to OCR text blocks
    const titlesToSearch: Array<{
      title: string;
      claudeBox?: { x: number; y: number; width: number; height: number };
    }> =
      claudeResults.length > 0
        ? claudeResults.map((r) => ({
            title: r.title,
            claudeBox: r.boundingBox,
          }))
        : cleanedOcr.map((b) => ({ title: b.text }));

    const candidates: Array<{
      detectionNumber: number;
      rawText: string;
      confidence?: number;
      boundingBox: { x: number; y: number; width: number; height: number };
      title?: string;
      gameId?: string;
      bggId?: number;
      thumbnailUrl?: string;
      imageUrl?: string;
      source: 'local' | 'bgg';
      isOwned: boolean;
    }> = [];

    // Process all detected titles in parallel — sequential BGG calls per game
    // were causing 90 s+ timeouts when Claude detects 20+ games.
    const settled = await Promise.allSettled(
      titlesToSearch.map(async ({ title: rawText, claudeBox }, i) => {
        // Box selection: prefer a plausible Claude box, else expand OCR region
        const ocrMatch = this.findBestOcrMatch(rawText, cleanedOcr);
        const rawOcrBox = ocrMatch?.boundingBox ?? null;
        const claudeBoxIsReasonable =
          claudeBox != null && this.isReasonableGameBox(claudeBox);
        const boundingBox = claudeBoxIsReasonable
          ? claudeBox
          : rawOcrBox != null
            ? this.expandOcrToGameBox(rawOcrBox)
            : (claudeBox ?? { x: 0, y: 0, width: 0, height: 0 });
        const confidence = ocrMatch?.confidence ?? undefined;

        const local = await this.searchGames(rawText);
        const localBest = this.pickBestLocalMatch(rawText, local);
        if (localBest) {
          return {
            detectionNumber: i + 1,
            rawText,
            confidence,
            boundingBox,
            title: localBest.title,
            gameId: localBest.id,
            bggId: localBest.bggId ?? undefined,
            thumbnailUrl: localBest.thumbnailUrl ?? undefined,
            imageUrl: undefined,
            source: 'local' as const,
            isOwned:
              ownedGameIds.has(localBest.id) ||
              (localBest.bggId != null && ownedBggIds.has(localBest.bggId)),
          };
        }

        const bgg = await this.fetchBestBggMatch(rawText);
        if (!bgg) return null;

        // Fetch full BGG details — concurrency limited to avoid 429s
        await bggSemaphore.acquire();
        const details = await this.fetchBggThingById(bgg.bggId)
          .catch(() => null)
          .finally(() => bggSemaphore.release());
        return {
          detectionNumber: i + 1,
          rawText,
          confidence,
          boundingBox,
          title: bgg.title,
          gameId: undefined,
          bggId: bgg.bggId,
          thumbnailUrl: details?.thumbnailUrl ?? undefined,
          imageUrl: details?.imageUrl ?? undefined,
          source: 'bgg' as const,
          isOwned: ownedBggIds.has(bgg.bggId),
        };
      }),
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

    // Draw bounding boxes directly on the image so the frontend can display
    // an annotated photo without fragile CSS overlay positioning.
    const annotatedBuffer = await this.claudeVision
      .drawAnnotations(imageBuffer, renumbered)
      .catch((err) => {
        this.logger.warn('Failed to draw shelf annotations', err);
        return null;
      });
    const annotatedImageBase64 = annotatedBuffer
      ? `data:image/jpeg;base64,${annotatedBuffer.toString('base64')}`
      : undefined;

    return { candidates: renumbered, annotatedImageBase64 };
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
    return (
      (box.width >= 0.02 ||
        (box.width >= 0.005 && box.height / box.width >= 3)) &&
      box.height >= 0.03 &&
      // A single game box can legitimately fill most of a close-up frame.
      // Only reject degenerate boxes that cover effectively the whole image.
      box.width <= 0.95 &&
      box.height <= 0.95 &&
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
    const expandedWidth = Math.min(1, textBox.width * 1.4);
    const expandedHeight = Math.min(1, Math.max(textBox.height * 5, 0.12));
    const centerX = textBox.x + textBox.width / 2;
    const centerY = textBox.y + textBox.height / 2;
    const x = Math.max(0, centerX - expandedWidth / 2);
    const y = Math.max(0, centerY - expandedHeight / 2);
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
      if (score >= 40 && (!best || score > best.score)) {
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
    const noiseWords = new Set(['edition', 'game', 'board', 'the']);
    return blocks
      .map((block) => ({
        ...block,
        text: block.text.replace(/\s+/g, ' ').trim(),
      }))
      .filter((block) => block.text.length >= 3)
      .filter((block) => {
        const normalized = block.text.toLowerCase().replace(/[^a-z0-9 ]+/g, '');
        return !noiseWords.has(normalized);
      });
  }

  private pickBestLocalMatch(query: string, games: Game[]): Game | null {
    const normalizedQuery = this.normalizeTitle(query);
    const ranked = games
      .map((game) => ({
        game,
        score: this.scoreTitleMatch(normalizedQuery, game.title),
      }))
      .sort((a, b) => b.score - a.score);
    return ranked[0] && ranked[0].score >= 40 ? ranked[0].game : null;
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
    const normalizedTitle = this.normalizeTitle(title);
    if (normalizedTitle === query) return 100;
    if (normalizedTitle.startsWith(query)) return 80;
    if (normalizedTitle.includes(query)) return 65;
    const queryTokens = query.split(' ');
    const titleTokens = normalizedTitle.split(' ');
    let matches = 0;
    for (const token of queryTokens) {
      if (titleTokens.some((titleToken) => titleToken.startsWith(token)))
        matches++;
    }
    return Math.floor((matches / Math.max(queryTokens.length, 1)) * 60);
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
    // Prefer exact match (precise); fall back to non-exact when exact finds nothing
    return (
      (await this.doBggSearch(query, true, token)) ??
      (await this.doBggSearch(query, false, token))
    );
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
    if (exact) return hits[0]; // exact search: first hit is the only hit
    // Non-exact: score each candidate by title similarity and pick the best
    const normalizedQuery = this.normalizeTitle(query);
    const ranked = hits
      .map((h) => ({
        ...h,
        score: this.scoreTitleMatch(normalizedQuery, h.title),
      }))
      .sort((a, b) => b.score - a.score);
    return ranked[0].score >= 30 ? ranked[0] : null;
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
    const response = await fetch(
      `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&stats=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
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
  }> {
    const rows = await this.gamesRepo.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE "bggRating" IS NULL)::int AS "missingRating",
        COUNT(*) FILTER (WHERE weight IS NULL)::int AS "missingWeight",
        COUNT(*) FILTER (WHERE "yearPublished" IS NULL)::int AS "missingYear",
        COUNT(*) FILTER (WHERE "bggPlayerCountPoll" IS NULL OR "bggPlayerCountPoll" = '')::int AS "missingPoll",
        COUNT(*) FILTER (WHERE "playingTime" IS NULL OR "playingTime" <= 0)::int AS "missingPlayingTime"
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
          (
            "yearPublished" IS NULL
            OR "playingTime" IS NULL
            OR "playingTime" <= 0
            OR "bggPlayerCountPoll" IS NULL
            OR "bggPlayerCountPoll" = ''
            OR "bggRating" IS NULL
            OR weight IS NULL
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
