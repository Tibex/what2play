import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { BggPlayerCountPollEntry } from '../entities/game.entity';
import { BggCatalogSync } from '../entities/bgg-catalog-sync.entity';
import { GamesService } from '../games/games.service';

const TOP_CATALOG_JOB_KEY = 'bgg_top_catalog';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BGG_TOP_CSV_SNAPSHOT_URL =
  'https://gist.githubusercontent.com/stungeye/358bf7e10e11e42224a483990f64eed5/raw/board_games.csv';

type BggSearchHit = {
  bggId: number;
  title: string;
  yearPublished?: number;
  alternateTitles: string[];
  exactQueryMatch: boolean;
  sourceOrder: number;
};

type BggSearchDetail = {
  bggId: number;
  title: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  bggRating?: number;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  yearPublished?: number;
};

type SyncSelectedItem = { gameId?: string; bggId?: number };

@Injectable()
export class BggService {
  private readonly logger = new Logger(BggService.name);

  constructor(
    @InjectRepository(SyncAccount)
    private syncRepo: Repository<SyncAccount>,
    @InjectRepository(BggVerificationChallenge)
    private verifyRepo: Repository<BggVerificationChallenge>,
    @InjectRepository(BggCatalogSync)
    private bggCatalogSyncRepo: Repository<BggCatalogSync>,
    @InjectDataSource()
    private dataSource: DataSource,
    private gamesService: GamesService,
    private config: ConfigService,
  ) {}

  async linkAccount(userId: string, bggUsername: string): Promise<SyncAccount> {
    const existing = await this.syncRepo.findOne({
      where: { userId, provider: 'bgg' },
    });
    let account: SyncAccount;

    if (existing) {
      existing.externalUsername = bggUsername;
      existing.status = 'linked';
      account = await this.syncRepo.save(existing);
    } else {
      account = this.syncRepo.create({
        userId,
        provider: 'bgg',
        externalUsername: bggUsername,
        status: 'linked',
      });
      account = await this.syncRepo.save(account);
    }

    // Best effort auto-sync right after linking.
    try {
      await this.syncCollection(userId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown sync failure';
      this.logger.warn(
        `Auto-sync after linking failed for user ${userId}: ${message}`,
      );
    }

    return account;
  }

  async unlinkAccount(userId: string): Promise<void> {
    await this.syncRepo.delete({ userId, provider: 'bgg' });
  }

  async getLinkedAccount(userId: string): Promise<SyncAccount | null> {
    return this.syncRepo.findOne({ where: { userId, provider: 'bgg' } });
  }

  async createVerificationChallenge(
    userId: string,
  ): Promise<BggVerificationChallenge> {
    const token = `W2P-VERIFY-${uuid().slice(0, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const challenge = this.verifyRepo.create({ userId, token, expiresAt });
    return this.verifyRepo.save(challenge);
  }

  async syncCollection(
    userId: string,
  ): Promise<{ imported: number; fetched: number }> {
    const account = await this.syncRepo.findOne({
      where: { userId, provider: 'bgg' },
    });
    if (!account) throw new NotFoundException('No BGG account linked');
    if (!account.externalUsername) {
      throw new BadRequestException('BGG account is missing a linked username');
    }

    const bggGames = await this.fetchBggCollection(account.externalUsername);
    const enrichedGames = await this.enrichWithThingDetails(bggGames);
    let imported = 0;

    for (const bg of enrichedGames) {
      const game = await this.gamesService.findOrCreateByBggId(bg.bggId, {
        title: bg.title,
        imageUrl: bg.imageUrl,
        thumbnailUrl: bg.thumbnailUrl,
        bggRating: bg.bggRating,
        minPlayers: bg.minPlayers,
        maxPlayers: bg.maxPlayers,
        playingTime: bg.playingTime,
        yearPublished: bg.yearPublished,
        weight: bg.weight,
        isExpansion: bg.isExpansion,
        expansionForBggIds: bg.expansionForBggIds,
        bggPlayerCountPoll: bg.bggPlayerCountPoll,
      });
      await this.gamesService.addToCollection(userId, game.id);
      if (bg.userRating) {
        await this.gamesService.rateGame(userId, game.id, bg.userRating);
      }
      imported++;
    }

    account.lastSyncedAt = new Date();
    await this.syncRepo.save(account);
    return { imported, fetched: enrichedGames.length };
  }

  async importCollectionFromXml(
    userId: string,
    xml: string,
  ): Promise<{ imported: number; fetched: number }> {
    const bggGames = await this.enrichWithThingMetadata(this.parseBggXml(xml));
    const enrichedGames = await this.enrichWithThingDetails(bggGames);
    let imported = 0;

    for (const bg of enrichedGames) {
      const game = await this.gamesService.findOrCreateByBggId(bg.bggId, {
        title: bg.title,
        imageUrl: bg.imageUrl,
        thumbnailUrl: bg.thumbnailUrl,
        bggRating: bg.bggRating,
        minPlayers: bg.minPlayers,
        maxPlayers: bg.maxPlayers,
        playingTime: bg.playingTime,
        yearPublished: bg.yearPublished,
        weight: bg.weight,
        isExpansion: bg.isExpansion,
        expansionForBggIds: bg.expansionForBggIds,
        bggPlayerCountPoll: bg.bggPlayerCountPoll,
      });
      await this.gamesService.addToCollection(userId, game.id);
      if (bg.userRating) {
        await this.gamesService.rateGame(userId, game.id, bg.userRating);
      }
      imported++;
    }

    return { imported, fetched: enrichedGames.length };
  }

  private getBggHeaders(): Record<string, string> {
    const token = this.config.get<string>('BGG_API_TOKEN');
    if (!token || token === 'your-bgg-api-token') return {};
    return { Authorization: `Bearer ${token}` };
  }

  async searchBgg(query: string): Promise<
    Array<{
      bggId: number;
      title: string;
      yearPublished?: number;
      thumbnailUrl?: string;
      imageUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      bggRating?: number;
    }>
  > {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const headers = this.getBggHeaders();
    if (!Object.keys(headers).length) {
      throw new BadRequestException(
        'BGG_API_TOKEN is not configured. Register an app at boardgamegeek.com/applications and add your token to backend/.env.',
      );
    }

    const [exactSearch, broadSearch] = await Promise.allSettled([
      this.fetchSearchHits(normalizedQuery, headers, true),
      this.fetchSearchHits(normalizedQuery, headers, false),
    ]);

    if (broadSearch.status === 'rejected') {
      throw broadSearch.reason;
    }

    const exactHits =
      exactSearch.status === 'fulfilled' ? exactSearch.value : [];
    const mergedHits = this.mergeSearchHits(exactHits, broadSearch.value);
    if (!mergedHits.length) return [];

    const shortlistedHits = this.rankSearchHits(
      normalizedQuery,
      mergedHits,
    ).slice(0, 60);
    const enriched = await this.fetchThingDetails(
      shortlistedHits.map((hit) => hit.bggId),
    );
    const detailMap = new Map(enriched.map((detail) => [detail.bggId, detail]));
    const rankedHits = this.rankSearchHits(
      normalizedQuery,
      shortlistedHits,
      detailMap,
    ).slice(0, 25);

    return rankedHits.map((hit) => {
      const detail = detailMap.get(hit.bggId);
      return {
        bggId: hit.bggId,
        title: detail?.title ?? hit.title,
        yearPublished: detail?.yearPublished ?? hit.yearPublished,
        thumbnailUrl: detail?.thumbnailUrl,
        imageUrl: detail?.imageUrl,
        minPlayers: detail?.minPlayers,
        maxPlayers: detail?.maxPlayers,
        playingTime: detail?.playingTime,
        bggRating: detail?.bggRating,
      };
    });
  }

  async importOneGame(
    userId: string,
    bggId: number,
  ): Promise<{ game: import('../entities/game.entity').Game }> {
    const headers = this.getBggHeaders();
    if (!Object.keys(headers).length) {
      throw new BadRequestException('BGG_API_TOKEN is not configured.');
    }
    const details = await this.fetchThingDetails([bggId]);
    if (!details.length) {
      throw new NotFoundException(`No game found on BGG with id ${bggId}`);
    }
    const d = details[0];
    const game = await this.gamesService.findOrCreateByBggId(d.bggId, {
      title: d.title,
      imageUrl: d.imageUrl,
      thumbnailUrl: d.thumbnailUrl,
      bggRating: d.bggRating,
      weight: d.weight,
      minPlayers: d.minPlayers,
      maxPlayers: d.maxPlayers,
      playingTime: d.playingTime,
      yearPublished: d.yearPublished,
      bggPlayerCountPoll: d.bggPlayerCountPoll,
    });
    await this.gamesService.addToCollection(userId, game.id);
    return { game };
  }

  async syncSelectedToBggCollection(
    userId: string,
    selectedItems: SyncSelectedItem[],
  ): Promise<{
    added: number;
    skipped: Array<{ item: SyncSelectedItem; reason: string }>;
    failed: Array<{ item: SyncSelectedItem; reason: string }>;
  }> {
    const account = await this.getLinkedAccount(userId);
    if (!account?.externalUsername) {
      throw new BadRequestException('No linked BGG account found');
    }
    const targetIds = new Set<number>();
    for (const item of selectedItems) {
      if (item.bggId != null) {
        targetIds.add(item.bggId);
        continue;
      }
      if (!item.gameId) continue;
      const games = await this.gamesService.getUserOwnedGamesByIds(userId, [
        item.gameId,
      ]);
      const game = games[0];
      if (game?.bggId) targetIds.add(game.bggId);
    }
    const skipped: Array<{ item: SyncSelectedItem; reason: string }> = [];
    const failed: Array<{ item: SyncSelectedItem; reason: string }> = [];
    let added = 0;
    for (const item of selectedItems) {
      const bggId = item.bggId ?? null;
      if (!bggId && !item.gameId) {
        skipped.push({ item, reason: 'No gameId or bggId' });
        continue;
      }
      const resolvedId =
        bggId ??
        (
          await this.gamesService.getUserOwnedGamesByIds(userId, [
            item.gameId as string,
          ])
        )[0]?.bggId;
      if (!resolvedId) {
        skipped.push({ item, reason: 'Item has no BGG mapping' });
        continue;
      }
      try {
        await this.addGameToBggCollection(account.externalUsername, resolvedId);
        added++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'sync failed';
        failed.push({ item, reason: message });
      }
    }
    return { added, skipped, failed };
  }

  async exportSelectionAsCsv(
    userId: string,
    gameIds: string[],
  ): Promise<string> {
    const games = await this.gamesService.getUserOwnedGamesByIds(
      userId,
      gameIds,
    );
    const rows = ['gameId,bggId,title'];
    for (const game of games) {
      const title = `"${(game.title || '').replace(/"/g, '""')}"`;
      rows.push(`${game.id},${game.bggId ?? ''},${title}`);
    }
    return rows.join('\n');
  }

  async exportSelectionAsXml(
    userId: string,
    gameIds: string[],
  ): Promise<string> {
    const games = await this.gamesService.getUserOwnedGamesByIds(
      userId,
      gameIds,
    );
    const items = games
      .map((game) => {
        const escapedTitle = this.escapeXml(game.title || '');
        return `<item objecttype="thing" objectid="${game.bggId ?? ''}" subtype="boardgame"><name>${escapedTitle}</name></item>`;
      })
      .join('');
    return `<?xml version="1.0" encoding="utf-8"?><items>${items}</items>`;
  }

  async importTopRankedGames(
    limit = 500,
  ): Promise<{ imported: number; fetched: number; requested: number }> {
    const normalizedLimit = Math.max(1, Math.min(5000, Math.floor(limit)));
    const rankedIds = await this.fetchTopRankedBggIds(normalizedLimit);
    if (!rankedIds.length) {
      throw new BadRequestException(
        'Unable to fetch BGG ranked list (received no IDs). BGG browse pages are currently blocking server-side requests.',
      );
    }

    const details = await this.fetchThingDetails(rankedIds);
    let imported = 0;
    for (const d of details) {
      await this.gamesService.findOrCreateByBggId(d.bggId, {
        title: d.title,
        imageUrl: d.imageUrl,
        thumbnailUrl: d.thumbnailUrl,
        bggRating: d.bggRating,
        weight: d.weight,
        minPlayers: d.minPlayers,
        maxPlayers: d.maxPlayers,
        playingTime: d.playingTime,
        yearPublished: d.yearPublished,
        bggPlayerCountPoll: d.bggPlayerCountPoll,
      });
      imported++;
    }

    return {
      imported,
      fetched: details.length,
      requested: normalizedLimit,
    };
  }

  async runTopRankedImportWithCooldown(opts?: {
    limit?: number;
    force?: boolean;
    trigger?: 'manual' | 'cron';
  }): Promise<{
    status: 'executed' | 'skipped';
    reason?: 'cooldown' | 'already_running';
    imported?: number;
    fetched?: number;
    requested?: number;
    nextEligibleAt?: string;
  }> {
    const limit = opts?.limit ?? 500;
    const force = opts?.force ?? false;
    const trigger = opts?.trigger ?? 'manual';
    const now = new Date();

    const lockAcquired = await this.tryAcquirePgLock(TOP_CATALOG_JOB_KEY);
    if (!lockAcquired) {
      this.logger.log(
        `BGG top catalog import skipped (${trigger}): already running`,
      );
      return { status: 'skipped', reason: 'already_running' };
    }

    try {
      const state = await this.getOrCreateTopCatalogState();
      const cooldownUntil = state.lastSuccessAt
        ? new Date(state.lastSuccessAt.getTime() + ONE_WEEK_MS)
        : null;
      if (!force && cooldownUntil && cooldownUntil > now) {
        return {
          status: 'skipped',
          reason: 'cooldown',
          nextEligibleAt: cooldownUntil.toISOString(),
        };
      }

      state.lastAttemptAt = now;
      state.lastAttemptStatus = null;
      state.lastAttemptMessage = null;
      await this.bggCatalogSyncRepo.save(state);

      try {
        const result = await this.importTopRankedGames(limit);
        state.lastAttemptAt = new Date();
        state.lastAttemptStatus = 'success';
        state.lastAttemptMessage = `Imported ${result.imported} / fetched ${result.fetched}`;
        state.lastSuccessAt = state.lastAttemptAt;
        await this.bggCatalogSyncRepo.save(state);
        return { status: 'executed', ...result };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown catalog import error';
        state.lastAttemptAt = new Date();
        state.lastAttemptStatus = 'failed';
        state.lastAttemptMessage = message;
        await this.bggCatalogSyncRepo.save(state);
        throw error;
      }
    } finally {
      await this.releasePgLock(TOP_CATALOG_JOB_KEY);
    }
  }

  async shouldRunTopCatalogImportNow(): Promise<{
    shouldRun: boolean;
    nextEligibleAt?: string;
  }> {
    const state = await this.bggCatalogSyncRepo.findOne({
      where: { jobKey: TOP_CATALOG_JOB_KEY },
    });
    if (!state?.lastSuccessAt) return { shouldRun: true };
    const nextEligibleAt = new Date(
      state.lastSuccessAt.getTime() + ONE_WEEK_MS,
    );
    return {
      shouldRun: nextEligibleAt <= new Date(),
      nextEligibleAt: nextEligibleAt.toISOString(),
    };
  }

  async repairIncompleteCatalogData(limit = 200): Promise<{
    scanned: number;
    repaired: number;
  }> {
    const ids = await this.gamesService.getIncompleteBggIds(limit);
    if (!ids.length) return { scanned: 0, repaired: 0 };
    const details = await this.fetchThingDetails(ids);
    let repaired = 0;
    for (const d of details) {
      await this.gamesService.findOrCreateByBggId(d.bggId, {
        title: d.title,
        imageUrl: d.imageUrl,
        thumbnailUrl: d.thumbnailUrl,
        bggRating: d.bggRating,
        weight: d.weight,
        minPlayers: d.minPlayers,
        maxPlayers: d.maxPlayers,
        playingTime: d.playingTime,
        yearPublished: d.yearPublished,
        bggPlayerCountPoll: d.bggPlayerCountPoll,
      });
      repaired++;
    }
    return { scanned: ids.length, repaired };
  }

  async getAdminCatalogStats(): Promise<{
    syncState: {
      running: boolean;
      lastSuccessAt: string | null;
      lastAttemptAt: string | null;
      lastAttemptStatus: 'success' | 'failed' | null;
      lastAttemptMessage: string | null;
      nextEligibleAt: string | null;
    };
    quality: {
      total: number;
      missingRating: number;
      missingWeight: number;
      missingYear: number;
      missingPoll: number;
      missingPlayingTime: number;
    };
  }> {
    const state = await this.bggCatalogSyncRepo.findOne({
      where: { jobKey: TOP_CATALOG_JOB_KEY },
    });
    const running = await this.isPgLockHeld(TOP_CATALOG_JOB_KEY);
    const quality = await this.gamesService.getCatalogQualityStats();
    const nextEligibleAt = state?.lastSuccessAt
      ? new Date(state.lastSuccessAt.getTime() + ONE_WEEK_MS).toISOString()
      : null;
    return {
      syncState: {
        running,
        lastSuccessAt: state?.lastSuccessAt?.toISOString() || null,
        lastAttemptAt: state?.lastAttemptAt?.toISOString() || null,
        lastAttemptStatus: state?.lastAttemptStatus || null,
        lastAttemptMessage: state?.lastAttemptMessage || null,
        nextEligibleAt,
      },
      quality,
    };
  }

  async getAdminIncompleteCatalogEntries(page = 1, pageSize = 100) {
    return this.gamesService.getCatalogEntriesForAdmin(page, pageSize);
  }

  private async fetchSearchHits(
    query: string,
    headers: Record<string, string>,
    exact: boolean,
  ): Promise<BggSearchHit[]> {
    const exactParam = exact ? '&exact=1' : '';
    const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame${exactParam}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new BadRequestException(
        `BGG search failed (${response.status}). Check your BGG_API_TOKEN.`,
      );
    }
    const xml = await response.text();
    return this.parseBggSearchXml(xml, { exactQueryMatch: exact, limit: 150 });
  }

  private mergeSearchHits(
    exactHits: BggSearchHit[],
    broadHits: BggSearchHit[],
  ): BggSearchHit[] {
    const merged = new Map<number, BggSearchHit>();

    for (const hit of [...exactHits, ...broadHits]) {
      const existing = merged.get(hit.bggId);
      if (!existing) {
        merged.set(hit.bggId, {
          ...hit,
          alternateTitles: [...hit.alternateTitles],
        });
        continue;
      }
      existing.exactQueryMatch =
        existing.exactQueryMatch || hit.exactQueryMatch;
      existing.sourceOrder = Math.min(existing.sourceOrder, hit.sourceOrder);
      if (!existing.yearPublished && hit.yearPublished) {
        existing.yearPublished = hit.yearPublished;
      }
      if (
        existing.title.startsWith('Game ') &&
        !hit.title.startsWith('Game ')
      ) {
        existing.title = hit.title;
      }
      const seenAltTitles = new Set(
        existing.alternateTitles.map((title) =>
          this.normalizeSearchText(title),
        ),
      );
      for (const altTitle of hit.alternateTitles) {
        const normalizedAltTitle = this.normalizeSearchText(altTitle);
        if (seenAltTitles.has(normalizedAltTitle)) continue;
        seenAltTitles.add(normalizedAltTitle);
        existing.alternateTitles.push(altTitle);
      }
    }

    return [...merged.values()];
  }

  private rankSearchHits(
    query: string,
    hits: BggSearchHit[],
    detailsById: Map<number, BggSearchDetail> = new Map(),
  ): BggSearchHit[] {
    const normalizedQuery = this.normalizeSearchText(query);
    const queryTokens = this.tokenizeSearchText(normalizedQuery);
    const queryYearMatch = query.match(/\b(18|19|20)\d{2}\b/);
    const queryYear = queryYearMatch
      ? Number.parseInt(queryYearMatch[0], 10)
      : undefined;

    return [...hits].sort((a, b) => {
      const scoreA = this.computeSearchHitScore(
        a,
        normalizedQuery,
        queryTokens,
        queryYear,
        detailsById,
      );
      const scoreB = this.computeSearchHitScore(
        b,
        normalizedQuery,
        queryTokens,
        queryYear,
        detailsById,
      );
      if (scoreB !== scoreA) return scoreB - scoreA;

      const detailA = detailsById.get(a.bggId);
      const detailB = detailsById.get(b.bggId);
      const ratingDiff = (detailB?.bggRating ?? 0) - (detailA?.bggRating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;

      const yearDiff =
        (detailB?.yearPublished ?? b.yearPublished ?? 0) -
        (detailA?.yearPublished ?? a.yearPublished ?? 0);
      if (yearDiff !== 0) return yearDiff;

      if (a.sourceOrder !== b.sourceOrder) return a.sourceOrder - b.sourceOrder;
      return a.bggId - b.bggId;
    });
  }

  private computeSearchHitScore(
    hit: BggSearchHit,
    normalizedQuery: string,
    queryTokens: string[],
    queryYear: number | undefined,
    detailsById: Map<number, BggSearchDetail>,
  ): number {
    const detail = detailsById.get(hit.bggId);
    const candidateTitles = [
      hit.title,
      ...(hit.alternateTitles || []),
      detail?.title,
    ].filter((value): value is string => Boolean(value));
    const bestTitleScore = candidateTitles.reduce((best, title) => {
      return Math.max(
        best,
        this.computeTitleMatchScore(normalizedQuery, queryTokens, title),
      );
    }, 0);

    let score = bestTitleScore;
    if (hit.exactQueryMatch) score += 250;

    const yearPublished = detail?.yearPublished ?? hit.yearPublished;
    if (queryYear && yearPublished) {
      score += queryYear === yearPublished ? 120 : -60;
    }
    if (detail?.bggRating) {
      score += detail.bggRating * 10;
    }

    return score;
  }

  private computeTitleMatchScore(
    normalizedQuery: string,
    queryTokens: string[],
    title: string,
  ): number {
    const normalizedTitle = this.normalizeSearchText(title);
    if (!normalizedQuery || !normalizedTitle) return 0;

    let score = 0;

    if (normalizedTitle === normalizedQuery) score += 1000;
    if (normalizedTitle.startsWith(normalizedQuery)) score += 700;

    const queryIndex = normalizedTitle.indexOf(normalizedQuery);
    if (queryIndex >= 0) {
      score += 450;
      score -= Math.min(queryIndex * 8, 220);
    }

    const titleTokens = this.tokenizeSearchText(normalizedTitle);
    let exactTokenMatches = 0;
    let prefixTokenMatches = 0;
    for (const queryToken of queryTokens) {
      if (titleTokens.includes(queryToken)) {
        exactTokenMatches++;
        continue;
      }
      if (
        titleTokens.some(
          (titleToken) =>
            titleToken.startsWith(queryToken) ||
            queryToken.startsWith(titleToken),
        )
      ) {
        prefixTokenMatches++;
      }
    }

    score += exactTokenMatches * 90;
    score += prefixTokenMatches * 45;
    if (
      queryTokens.length > 0 &&
      exactTokenMatches + prefixTokenMatches === queryTokens.length
    ) {
      score += 200;
    }
    if (queryTokens.length > 1 && titleTokens[0] === queryTokens[0]) {
      score += 80;
    }

    const lengthPenalty = Math.abs(
      normalizedTitle.length - normalizedQuery.length,
    );
    score -= Math.min(lengthPenalty, 40) * 2;

    return score;
  }

  private normalizeSearchText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private tokenizeSearchText(value: string): string[] {
    if (!value) return [];
    return value.split(' ').filter((token) => token.length > 0);
  }

  private parseBggSearchXml(
    xml: string,
    options: { exactQueryMatch?: boolean; limit?: number } = {},
  ): BggSearchHit[] {
    const limit = options.limit ?? 150;
    const exactQueryMatch = options.exactQueryMatch ?? false;
    const results: BggSearchHit[] = [];

    const itemRegex = /<item[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    let sourceOrder = 0;

    while ((match = itemRegex.exec(xml)) !== null) {
      const bggId = parseInt(match[1], 10);
      const block = match[2];

      const nameMatch = block.match(
        /<name[^>]*type="primary"[^>]*value="([^"]+)"/,
      );
      const title = nameMatch
        ? this.decodeHtmlEntities(nameMatch[1])
        : `Game ${bggId}`;

      const yearMatch = block.match(/<yearpublished[^>]*value="(\d+)"/);
      const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

      const alternateTitleSet = new Set<string>();
      const alternateNameRegex =
        /<name[^>]*type="alternate"[^>]*value="([^"]+)"/g;
      let alternateNameMatch: RegExpExecArray | null;
      while ((alternateNameMatch = alternateNameRegex.exec(block)) !== null) {
        const alternateTitle = this.decodeHtmlEntities(alternateNameMatch[1]);
        const normalizedAlternateTitle =
          this.normalizeSearchText(alternateTitle);
        const normalizedPrimaryTitle = this.normalizeSearchText(title);
        if (
          normalizedAlternateTitle &&
          normalizedAlternateTitle !== normalizedPrimaryTitle
        ) {
          alternateTitleSet.add(alternateTitle);
        }
      }

      results.push({
        bggId,
        title,
        yearPublished,
        alternateTitles: [...alternateTitleSet],
        exactQueryMatch,
        sourceOrder: sourceOrder++,
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  private async fetchThingDetails(bggIds: number[]): Promise<
    Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }>
  > {
    if (!bggIds.length) return [];
    const results: Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }> = [];

    const headers = this.getBggHeaders();
    const chunkSize = 20;
    for (let i = 0; i < bggIds.length; i += chunkSize) {
      const chunk = bggIds.slice(i, i + chunkSize);
      try {
        const response = await fetch(
          `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(',')}&stats=1`,
          { headers },
        );
        if (!response.ok) continue;
        const xml = await response.text();
        results.push(...this.parseThingDetailsXml(xml));
      } catch {
        // Resilient: skip failed chunks.
      }
    }

    return results;
  }

  private parseThingDetailsXml(xml: string): Array<{
    bggId: number;
    title: string;
    thumbnailUrl?: string;
    imageUrl?: string;
    bggRating?: number;
    weight?: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    yearPublished?: number;
    bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
  }> {
    const results: Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }> = [];

    const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/g;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const attrs = itemMatch[1];
      const body = itemMatch[2];

      const idMatch = /(?:\s|^)id="(\d+)"/.exec(attrs);
      if (!idMatch) continue;
      const bggId = parseInt(idMatch[1], 10);

      const nameMatch = body.match(
        /<name[^>]*type="primary"[^>]*value="([^"]+)"/,
      );
      const title = nameMatch
        ? this.decodeHtmlEntities(nameMatch[1])
        : `Game ${bggId}`;
      const thumbnailUrl = this.extractTag(body, 'thumbnail');
      const imageUrl = this.extractTag(body, 'image');
      const bggRating = this.extractAverageRating(body);
      const weight = this.extractAverageWeight(body);
      const minPlayers = this.extractNumAttr(body, 'minplayers');
      const maxPlayers = this.extractNumAttr(body, 'maxplayers');
      const playingTime = this.extractNumAttr(body, 'playingtime');
      const yearPublished = this.extractNumAttr(body, 'yearpublished');
      const bggPlayerCountPoll = this.parsePlayerCountPoll(body);

      results.push({
        bggId,
        title,
        thumbnailUrl,
        imageUrl,
        bggRating,
        weight,
        minPlayers,
        maxPlayers,
        playingTime,
        yearPublished,
        bggPlayerCountPoll,
      });
    }

    return results;
  }

  private async fetchTopRankedBggIds(limit: number): Promise<number[]> {
    const fromBrowse = await this.fetchTopRankedBggIdsFromBrowsePages(limit);
    if (fromBrowse.length > 0) return fromBrowse;

    this.logger.warn(
      'BGG browse rank pages unavailable; falling back to curated CSV snapshot',
    );
    return this.fetchTopRankedBggIdsFromCsvSnapshot(
      BGG_TOP_CSV_SNAPSHOT_URL,
      limit,
    );
  }

  private extractRankedBggIdsFromBrowseHtml(html: string): number[] {
    const ids: number[] = [];
    const seen = new Set<number>();
    const linkRegex = /href="\/boardgame\/(\d+)\/[^"]*"/g;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const id = Number.parseInt(linkMatch[1], 10);
      if (Number.isNaN(id) || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }

    return ids;
  }

  private async fetchTopRankedBggIdsFromBrowsePages(
    limit: number,
  ): Promise<number[]> {
    const rankedIds: number[] = [];
    const seen = new Set<number>();
    const perPage = 100;
    const maxPages = Math.ceil(limit / perPage);
    const headers: Record<string, string> = {
      ...this.getBggHeaders(),
      'User-Agent': 'what2play-bot/1.0 (+https://what2play.games)',
      Accept: 'text/html,application/xhtml+xml',
    };

    for (let page = 1; page <= maxPages && rankedIds.length < limit; page++) {
      const url = `https://boardgamegeek.com/browse/boardgame/page/${page}`;
      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          this.logger.warn(
            `Failed fetching BGG top page ${page}: HTTP ${response.status}`,
          );
          continue;
        }
        const html = await response.text();
        const pageIds = this.extractRankedBggIdsFromBrowseHtml(html);
        for (const id of pageIds) {
          if (seen.has(id)) continue;
          seen.add(id);
          rankedIds.push(id);
          if (rankedIds.length >= limit) break;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`Failed fetching BGG top page ${page}: ${message}`);
      }
    }

    return rankedIds.slice(0, limit);
  }

  private async fetchTopRankedBggIdsFromCsvSnapshot(
    csvUrl: string,
    limit: number,
  ): Promise<number[]> {
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'what2play-bot/1.0 (+https://what2play.games)',
        Accept: 'text/csv,text/plain',
      },
    });
    if (!response.ok) {
      throw new BadRequestException(
        `Failed fetching fallback ranked snapshot (${response.status})`,
      );
    }
    const csv = await response.text();
    const lines = csv.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const header = lines[0].split(',');
    const gameIdIndex = header.indexOf('game_id');
    if (gameIdIndex < 0) return [];

    const output: number[] = [];
    const seen = new Set<number>();
    for (let i = 1; i < lines.length && output.length < limit; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(',');
      const raw = cols[gameIdIndex]?.trim();
      if (!raw) continue;
      const id = Number.parseInt(raw, 10);
      if (Number.isNaN(id) || seen.has(id)) continue;
      seen.add(id);
      output.push(id);
    }
    return output;
  }

  private async getOrCreateTopCatalogState(): Promise<BggCatalogSync> {
    const existing = await this.bggCatalogSyncRepo.findOne({
      where: { jobKey: TOP_CATALOG_JOB_KEY },
    });
    if (existing) return existing;
    return this.bggCatalogSyncRepo.save(
      this.bggCatalogSyncRepo.create({
        jobKey: TOP_CATALOG_JOB_KEY,
        lastAttemptAt: null,
        lastAttemptStatus: null,
        lastAttemptMessage: null,
        lastSuccessAt: null,
      }),
    );
  }

  private async tryAcquirePgLock(lockName: string): Promise<boolean> {
    const rows: Array<{ locked: boolean }> = await this.dataSource.query(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
      [lockName],
    );
    return Boolean(rows?.[0]?.locked);
  }

  private async releasePgLock(lockName: string): Promise<void> {
    await this.dataSource.query('SELECT pg_advisory_unlock(hashtext($1))', [
      lockName,
    ]);
  }

  private async isPgLockHeld(lockName: string): Promise<boolean> {
    const lockAcquired = await this.tryAcquirePgLock(lockName);
    if (!lockAcquired) return true;
    await this.releasePgLock(lockName);
    return false;
  }

  private async fetchBggCollection(username: string): Promise<
    Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }>
  > {
    const token = this.config.get<string>('BGG_API_TOKEN');
    if (!token || token === 'your-bgg-api-token') {
      throw new BadRequestException(
        'BGG_API_TOKEN is not configured. Add your approved BoardGameGeek app token in backend/.env.',
      );
    }

    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`;
    const maxAttempts = 6;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 202) {
        // BGG often queues collection generation; poll a few times.
        await this.sleep(1500 * attempt);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new BadRequestException(
          `BGG request failed (${response.status}). ${body.slice(0, 200)}`,
        );
      }

      const text = await response.text();
      const games = await this.enrichWithThingMetadata(this.parseBggXml(text));
      return games;
    }

    throw new BadRequestException(
      'BGG collection is still being prepared (202). Please try sync again in a few seconds.',
    );
  }

  private parseBggXml(xml: string): Array<{
    bggId: number;
    title: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    bggRating?: number;
    weight?: number;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    yearPublished?: number;
    userRating?: number;
    isExpansion?: boolean;
    expansionForBggIds?: string[];
    bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
  }> {
    const games: Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }> = [];

    const itemRegex = /<item[^>]*objectid="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const bggId = parseInt(match[1], 10);
      const block = match[2];

      const title = this.extractTag(block, 'name') || `Game ${bggId}`;
      const imageUrl = this.extractTag(block, 'image');
      const thumbnailUrl = this.extractTag(block, 'thumbnail');
      const yearPublished = this.extractNumAttr(block, 'yearpublished');
      const minPlayers =
        this.extractStatsNumAttr(block, 'minplayers') ??
        this.extractNumAttr(block, 'minplayers');
      const maxPlayers =
        this.extractStatsNumAttr(block, 'maxplayers') ??
        this.extractNumAttr(block, 'maxplayers');
      const playingTime =
        this.extractStatsNumAttr(block, 'playingtime') ??
        this.extractNumAttr(block, 'playingtime');

      const ratingMatch = block.match(/<rating\s+value="([\d.]+)"/);
      const userRating =
        ratingMatch && ratingMatch[1] !== 'N/A'
          ? parseFloat(ratingMatch[1])
          : undefined;

      games.push({
        bggId,
        title,
        imageUrl,
        thumbnailUrl,
        minPlayers,
        maxPlayers,
        playingTime,
        yearPublished,
        userRating,
        bggPlayerCountPoll: this.parsePlayerCountPoll(block),
      });
    }

    return games;
  }

  private extractTag(block: string, tag: string): string | undefined {
    const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return m ? this.decodeHtmlEntities(m[1].trim()) : undefined;
  }

  private extractNumAttr(block: string, attr: string): number | undefined {
    const m = block.match(new RegExp(`<${attr}[^>]*value="(\\d+)"`));
    return m ? parseInt(m[1], 10) : undefined;
  }

  private extractStatsNumAttr(block: string, attr: string): number | undefined {
    const m = block.match(new RegExp(`<stats[^>]*\\b${attr}="(\\d+)"`));
    return m ? parseInt(m[1], 10) : undefined;
  }

  private extractAverageRating(block: string): number | undefined {
    const match = /<average[^>]*value="([\d.]+)"/.exec(block);
    if (!match) return undefined;
    const parsed = Number.parseFloat(match[1]);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  private extractAverageWeight(block: string): number | undefined {
    const match = /<averageweight[^>]*value="([\d.]+)"/.exec(block);
    if (!match) return undefined;
    const parsed = Number.parseFloat(match[1]);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  private async enrichWithThingDetails<
    T extends {
      bggId: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      bggRating?: number;
      weight?: number;
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    },
  >(games: T[]): Promise<T[]> {
    if (!games.length) return games;
    const details = await this.fetchThingDetails(games.map((g) => g.bggId));
    if (!details.length) return games;
    const byId = new Map(details.map((d) => [d.bggId, d]));
    return games.map((game) => {
      const detail = byId.get(game.bggId);
      if (!detail) return game;
      return {
        ...game,
        minPlayers: detail.minPlayers ?? game.minPlayers,
        maxPlayers: detail.maxPlayers ?? game.maxPlayers,
        playingTime: detail.playingTime ?? game.playingTime,
        yearPublished: detail.yearPublished ?? game.yearPublished,
        bggRating: detail.bggRating ?? game.bggRating,
        weight: detail.weight ?? game.weight,
        bggPlayerCountPoll:
          detail.bggPlayerCountPoll ?? game.bggPlayerCountPoll,
      };
    });
  }

  private async enrichWithThingMetadata(
    games: Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }>,
  ): Promise<
    Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      bggRating?: number;
      weight?: number;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
      bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
    }>
  > {
    if (!games.length) return games;
    const token = this.config.get<string>('BGG_API_TOKEN');
    if (!token || token === 'your-bgg-api-token') return games;

    const metadata = new Map<
      number,
      {
        isExpansion: boolean;
        baseIds: string[];
        bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
      }
    >();
    const ids = games.map((g) => g.bggId);
    const chunkSize = 20;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      try {
        const response = await fetch(
          `https://boardgamegeek.com/xmlapi2/thing?id=${chunk.join(',')}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok) continue;
        const xml = await response.text();
        this.parseThingMetadata(xml, metadata);
      } catch {
        // Keep import resilient even if metadata enrichment fails.
      }
    }

    return games.map((game) => {
      const meta = metadata.get(game.bggId);
      if (!meta) return game;
      return {
        ...game,
        isExpansion: meta.isExpansion,
        expansionForBggIds: meta.baseIds,
        bggPlayerCountPoll: meta.bggPlayerCountPoll ?? game.bggPlayerCountPoll,
      };
    });
  }

  private parseThingMetadata(
    xml: string,
    target: Map<
      number,
      {
        isExpansion: boolean;
        baseIds: string[];
        bggPlayerCountPoll?: Record<string, BggPlayerCountPollEntry>;
      }
    >,
  ): void {
    const itemRegex = /<item\b([^>]*)>([\s\S]*?)<\/item>/g;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const attrs = itemMatch[1];
      const body = itemMatch[2];
      const idMatch = /(?:\s|^)id="(\d+)"/.exec(attrs);
      if (!idMatch) continue;
      const id = Number.parseInt(idMatch[1], 10);
      const typeMatch = /(?:\s|^)type="([^"]+)"/.exec(attrs);
      const type = typeMatch ? typeMatch[1] : '';

      const baseIds: string[] = [];
      const baseLinkRegex =
        /<link[^>]*type="boardgameexpansion"[^>]*id="(\d+)"[^>]*inbound="false"[^>]*\/?>/g;
      let baseLinkMatch: RegExpExecArray | null;
      while ((baseLinkMatch = baseLinkRegex.exec(body)) !== null) {
        baseIds.push(baseLinkMatch[1]);
      }

      const isExpansion = type === 'boardgameexpansion' || baseIds.length > 0;
      target.set(id, {
        isExpansion,
        baseIds,
        bggPlayerCountPoll: this.parsePlayerCountPoll(body),
      });
    }
  }

  private parsePlayerCountPoll(
    xmlBlock: string,
  ): Record<string, BggPlayerCountPollEntry> | undefined {
    const pollMatch = xmlBlock.match(
      /<poll[^>]*name="suggested_numplayers"[^>]*>([\s\S]*?)<\/poll>/,
    );
    if (!pollMatch) return undefined;

    const pollBody = pollMatch[1];
    const resultsRegex =
      /<results[^>]*numplayers="([^"]+)"[^>]*>([\s\S]*?)<\/results>/g;
    const output: Record<string, BggPlayerCountPollEntry> = {};
    let resultsMatch: RegExpExecArray | null;

    while ((resultsMatch = resultsRegex.exec(pollBody)) !== null) {
      const playerLabel = this.decodeHtmlEntities(resultsMatch[1].trim());
      const body = resultsMatch[2];
      const best = this.extractPollVotes(body, 'Best');
      const recommended = this.extractPollVotes(body, 'Recommended');
      const notRecommended = this.extractPollVotes(body, 'Not Recommended');
      const totalVotes = best + recommended + notRecommended;
      if (totalVotes === 0) continue;
      output[playerLabel] = { best, recommended, notRecommended, totalVotes };
    }

    return Object.keys(output).length ? output : undefined;
  }

  private extractPollVotes(resultsBody: string, value: string): number {
    const safeValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = resultsBody.match(
      new RegExp(
        `<result[^>]*value="${safeValue}"[^>]*numvotes="(\\d+)"[^>]*/?>`,
      ),
    );
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async addGameToBggCollection(
    username: string,
    bggId: number,
  ): Promise<void> {
    const token = this.getBggHeaders().Authorization?.replace('Bearer ', '');
    if (!token)
      throw new BadRequestException('BGG_API_TOKEN is not configured.');
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&id=${bggId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new BadRequestException(`BGG sync failed (${response.status})`);
    }
  }

  private decodeHtmlEntities(value: string): string {
    return value
      .replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'")
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }
}
