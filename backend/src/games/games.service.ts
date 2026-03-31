import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game)
    private gamesRepo: Repository<Game>,
    @InjectRepository(UserGameOwnership)
    private ownershipRepo: Repository<UserGameOwnership>,
    @InjectRepository(UserGameRating)
    private ratingsRepo: Repository<UserGameRating>,
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

  async getUserCollection(
    userId: string,
  ): Promise<(UserGameOwnership & { game: Game })[]> {
    return this.ownershipRepo.find({
      where: { userId },
      relations: ['game'],
      order: { createdAt: 'DESC' },
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

  async getRatingsForGames(
    userIds: string[],
    gameIds: string[],
  ): Promise<UserGameRating[]> {
    if (!gameIds.length || !userIds.length) return [];
    return this.ratingsRepo.find({
      where: { userId: In(userIds), gameId: In(gameIds) },
    });
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
}
