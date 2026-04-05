import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';

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

@Injectable()
export class GamesService {
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
