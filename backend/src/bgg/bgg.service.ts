import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { GamesService } from '../games/games.service';

@Injectable()
export class BggService {
  private readonly logger = new Logger(BggService.name);

  constructor(
    @InjectRepository(SyncAccount)
    private syncRepo: Repository<SyncAccount>,
    @InjectRepository(BggVerificationChallenge)
    private verifyRepo: Repository<BggVerificationChallenge>,
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
    const token = `BGN-VERIFY-${uuid().slice(0, 8).toUpperCase()}`;
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

    const bggGames = await this.fetchBggCollection(account.externalUsername);
    let imported = 0;

    for (const bg of bggGames) {
      const game = await this.gamesService.findOrCreateByBggId(bg.bggId, {
        title: bg.title,
        imageUrl: bg.imageUrl,
        thumbnailUrl: bg.thumbnailUrl,
        minPlayers: bg.minPlayers,
        maxPlayers: bg.maxPlayers,
        playingTime: bg.playingTime,
        yearPublished: bg.yearPublished,
        isExpansion: bg.isExpansion,
        expansionForBggIds: bg.expansionForBggIds,
      });
      await this.gamesService.addToCollection(userId, game.id);
      if (bg.userRating) {
        await this.gamesService.rateGame(userId, game.id, bg.userRating);
      }
      imported++;
    }

    account.lastSyncedAt = new Date();
    await this.syncRepo.save(account);
    return { imported, fetched: bggGames.length };
  }

  async importCollectionFromXml(
    userId: string,
    xml: string,
  ): Promise<{ imported: number; fetched: number }> {
    const bggGames = await this.enrichWithThingMetadata(this.parseBggXml(xml));
    let imported = 0;

    for (const bg of bggGames) {
      const game = await this.gamesService.findOrCreateByBggId(bg.bggId, {
        title: bg.title,
        imageUrl: bg.imageUrl,
        thumbnailUrl: bg.thumbnailUrl,
        minPlayers: bg.minPlayers,
        maxPlayers: bg.maxPlayers,
        playingTime: bg.playingTime,
        yearPublished: bg.yearPublished,
        isExpansion: bg.isExpansion,
        expansionForBggIds: bg.expansionForBggIds,
      });
      await this.gamesService.addToCollection(userId, game.id);
      if (bg.userRating) {
        await this.gamesService.rateGame(userId, game.id, bg.userRating);
      }
      imported++;
    }

    return { imported, fetched: bggGames.length };
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
    }>
  > {
    if (!query.trim()) return [];

    const headers = this.getBggHeaders();
    if (!Object.keys(headers).length) {
      throw new BadRequestException(
        'BGG_API_TOKEN is not configured. Register an app at boardgamegeek.com/applications and add your token to backend/.env.',
      );
    }

    const url = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(query)}&type=boardgame`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new BadRequestException(
        `BGG search failed (${response.status}). Check your BGG_API_TOKEN.`,
      );
    }

    const xml = await response.text();
    const hits = this.parseBggSearchXml(xml);
    if (!hits.length) return [];

    const enriched = await this.fetchThingDetails(hits.map((h) => h.bggId));
    const detailMap = new Map(enriched.map((d) => [d.bggId, d]));

    return hits.map((hit) => {
      const detail = detailMap.get(hit.bggId);
      if (detail) return { ...hit, ...detail };
      return hit;
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
      minPlayers: d.minPlayers,
      maxPlayers: d.maxPlayers,
      playingTime: d.playingTime,
      yearPublished: d.yearPublished,
    });
    await this.gamesService.addToCollection(userId, game.id);
    return { game };
  }

  private parseBggSearchXml(
    xml: string,
  ): Array<{ bggId: number; title: string; yearPublished?: number }> {
    const results: Array<{
      bggId: number;
      title: string;
      yearPublished?: number;
    }> = [];

    const itemRegex = /<item[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null) {
      const bggId = parseInt(match[1], 10);
      const block = match[2];

      const nameMatch = block.match(
        /<name[^>]*type="primary"[^>]*value="([^"]+)"/,
      );
      const title = nameMatch ? nameMatch[1] : `Game ${bggId}`;

      const yearMatch = block.match(/<yearpublished[^>]*value="(\d+)"/);
      const yearPublished = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

      results.push({ bggId, title, yearPublished });
      if (results.length >= 25) break;
    }

    return results;
  }

  private async fetchThingDetails(bggIds: number[]): Promise<
    Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
    }>
  > {
    if (!bggIds.length) return [];
    const results: Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
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
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    yearPublished?: number;
  }> {
    const results: Array<{
      bggId: number;
      title: string;
      thumbnailUrl?: string;
      imageUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
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
      const title = nameMatch ? nameMatch[1] : `Game ${bggId}`;
      const thumbnailUrl = this.extractTag(body, 'thumbnail');
      const imageUrl = this.extractTag(body, 'image');
      const minPlayers = this.extractNumAttr(body, 'minplayers');
      const maxPlayers = this.extractNumAttr(body, 'maxplayers');
      const playingTime = this.extractNumAttr(body, 'playingtime');
      const yearPublished = this.extractNumAttr(body, 'yearpublished');

      results.push({
        bggId,
        title,
        thumbnailUrl,
        imageUrl,
        minPlayers,
        maxPlayers,
        playingTime,
        yearPublished,
      });
    }

    return results;
  }

  private async fetchBggCollection(username: string): Promise<
    Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
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
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    yearPublished?: number;
    userRating?: number;
    isExpansion?: boolean;
    expansionForBggIds?: string[];
  }> {
    const games: Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
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
      });
    }

    return games;
  }

  private extractTag(block: string, tag: string): string | undefined {
    const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return m ? m[1].trim() : undefined;
  }

  private extractNumAttr(block: string, attr: string): number | undefined {
    const m = block.match(new RegExp(`<${attr}[^>]*value="(\\d+)"`));
    return m ? parseInt(m[1], 10) : undefined;
  }

  private extractStatsNumAttr(block: string, attr: string): number | undefined {
    const m = block.match(new RegExp(`<stats[^>]*\\b${attr}="(\\d+)"`));
    return m ? parseInt(m[1], 10) : undefined;
  }

  private async enrichWithThingMetadata(
    games: Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
    }>,
  ): Promise<
    Array<{
      bggId: number;
      title: string;
      imageUrl?: string;
      thumbnailUrl?: string;
      minPlayers?: number;
      maxPlayers?: number;
      playingTime?: number;
      yearPublished?: number;
      userRating?: number;
      isExpansion?: boolean;
      expansionForBggIds?: string[];
    }>
  > {
    if (!games.length) return games;
    const token = this.config.get<string>('BGG_API_TOKEN');
    if (!token || token === 'your-bgg-api-token') return games;

    const metadata = new Map<
      number,
      { isExpansion: boolean; baseIds: string[] }
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
      };
    });
  }

  private parseThingMetadata(
    xml: string,
    target: Map<number, { isExpansion: boolean; baseIds: string[] }>,
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
      target.set(id, { isExpansion, baseIds });
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
