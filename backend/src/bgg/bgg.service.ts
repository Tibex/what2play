import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
    if (existing) {
      existing.externalUsername = bggUsername;
      existing.status = 'linked';
      return this.syncRepo.save(existing);
    }
    const account = this.syncRepo.create({
      userId,
      provider: 'bgg',
      externalUsername: bggUsername,
      status: 'linked',
    });
    return this.syncRepo.save(account);
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
    const bggGames = this.parseBggXml(xml);
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
      });
      await this.gamesService.addToCollection(userId, game.id);
      if (bg.userRating) {
        await this.gamesService.rateGame(userId, game.id, bg.userRating);
      }
      imported++;
    }

    return { imported, fetched: bggGames.length };
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
      const games = this.parseBggXml(text);
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
      const minPlayers = this.extractNumAttr(block, 'minplayers');
      const maxPlayers = this.extractNumAttr(block, 'maxplayers');
      const playingTime = this.extractNumAttr(block, 'playingtime');

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

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
