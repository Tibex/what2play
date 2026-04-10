import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../entities/event.entity';
import { Game } from '../entities/game.entity';
import { EventsService } from './events.service';
import { RunMultiTableOptimizerDto } from './dto/run-multi-table-optimizer.dto';
import {
  EventMultiTableRun,
  MultiTablePlayerGameLock,
} from '../entities/event-multi-table-run.entity';
import { EventVote } from '../entities/event-vote.entity';

type PlannerAttendee = {
  userId: string;
  name: string;
};

type PlannerTable = {
  tableIndex: number;
  gameId: string;
  gameTitle: string;
  minPlayers: number;
  maxPlayers: number;
  players: Array<{
    userId: string;
    name: string;
    fitScore: number;
    reasons: string[];
  }>;
};

type UnseatedPlayer = {
  userId: string;
  name: string;
  reasonCode: 'no_table_capacity';
  reason: string;
};

export type MultiTableOptimizerResult = {
  eventId: string;
  mode: 'multi_table_optimizer';
  objective: {
    strategy: 'coverage_then_fit';
    seatedCount: number;
    totalAttendees: number;
    seatCoverageRate: number;
    totalFitScore: number;
  };
  config: {
    tableCount: number;
    candidateGameCount: number;
  };
  tables: PlannerTable[];
  unseated: UnseatedPlayer[];
  warnings: string[];
};

const MIN_ATTENDEES_FOR_MULTI_TABLE = 9;

@Injectable()
export class MultiTableOptimizerService {
  constructor(
    private readonly eventsService: EventsService,
    @InjectRepository(EventMultiTableRun)
    private readonly runsRepo: Repository<EventMultiTableRun>,
    @InjectRepository(EventVote)
    private readonly votesRepo: Repository<EventVote>,
  ) {}

  async runForEvent(
    eventId: string,
    hostUserId: string,
    dto: RunMultiTableOptimizerDto,
    locks: MultiTablePlayerGameLock[] = [],
  ): Promise<MultiTableOptimizerResult> {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const event = await this.eventsService.findById(eventId);
    if (event.status !== 'confirmed') {
      throw new BadRequestException(
        'Multi-table optimizer is available only after voting is finalized',
      );
    }
    const attendees = this.collectGoingAttendees(event);
    if (attendees.length < MIN_ATTENDEES_FOR_MULTI_TABLE) {
      throw new BadRequestException(
        `Need at least ${MIN_ATTENDEES_FOR_MULTI_TABLE} going attendees for multi-table optimizer`,
      );
    }

    const candidateGames = this.resolveCandidateGames(
      event,
      dto.candidateGameIds,
    );
    if (!candidateGames.length) {
      throw new BadRequestException(
        'No candidate games available. Generate or add recommendations first.',
      );
    }

    const voteWeightsByGameId = await this.getVoteWeightsByGameId(eventId);
    const voteProfileByUser = await this.getVoteProfileByUser(eventId);
    const tableCount =
      dto.tableCount != null
        ? Math.max(1, dto.tableCount)
        : this.selectOptimizedTableCount(
            attendees,
            candidateGames,
            locks,
            voteWeightsByGameId,
            voteProfileByUser,
          );
    const warnings: string[] = [];
    if (tableCount > attendees.length) {
      warnings.push(
        'Table count exceeds attendee count; some tables will be unused.',
      );
    }

    const plan = this.buildPlan(
      attendees,
      candidateGames,
      tableCount,
      warnings,
      locks,
      voteWeightsByGameId,
      voteProfileByUser,
    );
    return {
      eventId,
      mode: 'multi_table_optimizer',
      objective: {
        strategy: 'coverage_then_fit',
        seatedCount: plan.tables.reduce((sum, t) => sum + t.players.length, 0),
        totalAttendees: attendees.length,
        seatCoverageRate:
          attendees.length > 0
            ? plan.tables.reduce((sum, t) => sum + t.players.length, 0) /
              attendees.length
            : 0,
        totalFitScore: Number(
          plan.tables
            .flatMap((t) => t.players)
            .reduce((sum, p) => sum + p.fitScore, 0)
            .toFixed(3),
        ),
      },
      config: {
        tableCount,
        candidateGameCount: candidateGames.length,
      },
      tables: plan.tables,
      unseated: plan.unseated,
      warnings,
    };
  }

  async createRun(
    eventId: string,
    hostUserId: string,
    dto: RunMultiTableOptimizerDto,
  ) {
    const result = await this.runForEvent(eventId, hostUserId, dto, []);
    const run = await this.runsRepo.save(
      this.runsRepo.create({
        eventId,
        tableCount: result.config.tableCount,
        candidateGameIds: dto.candidateGameIds ?? null,
        locks: [],
        result,
      }),
    );
    return this.decorateRun(run);
  }

  async getLatestRun(eventId: string, hostUserId: string) {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const run = await this.runsRepo.findOne({
      where: { eventId },
      order: { createdAt: 'DESC' },
    });
    return run ? this.decorateRun(run) : null;
  }

  async getRun(eventId: string, runId: string, hostUserId: string) {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const run = await this.runsRepo.findOne({ where: { id: runId, eventId } });
    if (!run) {
      throw new BadRequestException('Run not found');
    }
    return this.decorateRun(run);
  }

  async rerun(
    eventId: string,
    runId: string,
    hostUserId: string,
    preserveLocks = true,
  ) {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const previous = await this.runsRepo.findOne({
      where: { id: runId, eventId },
    });
    if (!previous) {
      throw new BadRequestException('Run not found');
    }
    const locks = preserveLocks ? previous.locks || [] : [];
    const result = await this.runForEvent(
      eventId,
      hostUserId,
      {
        tableCount: previous.tableCount,
        candidateGameIds: previous.candidateGameIds || undefined,
      },
      locks,
    );
    const run = await this.runsRepo.save(
      this.runsRepo.create({
        eventId,
        tableCount: result.config.tableCount,
        candidateGameIds: previous.candidateGameIds || null,
        locks,
        parentRunId: previous.id,
        result,
      }),
    );
    return this.decorateRun(run);
  }

  async updateLocks(
    eventId: string,
    runId: string,
    hostUserId: string,
    add: MultiTablePlayerGameLock[] = [],
    remove: MultiTablePlayerGameLock[] = [],
  ) {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const run = await this.runsRepo.findOne({ where: { id: runId, eventId } });
    if (!run) {
      throw new BadRequestException('Run not found');
    }
    const current = run.locks || [];
    const removed = current.filter(
      (lock) =>
        !remove.some(
          (r) =>
            r.type === lock.type &&
            r.userId === lock.userId &&
            r.gameId === lock.gameId,
        ),
    );
    const merged = [...removed];
    for (const lock of add) {
      if (
        !merged.some(
          (existing) =>
            existing.type === lock.type &&
            existing.userId === lock.userId &&
            existing.gameId === lock.gameId,
        )
      ) {
        merged.push(lock);
      }
    }
    const result = await this.runForEvent(
      eventId,
      hostUserId,
      {
        tableCount: run.tableCount,
        candidateGameIds: run.candidateGameIds || undefined,
      },
      merged,
    );
    const next = await this.runsRepo.save(
      this.runsRepo.create({
        eventId,
        tableCount: run.tableCount,
        candidateGameIds: run.candidateGameIds || null,
        locks: merged,
        parentRunId: run.id,
        result,
      }),
    );
    return this.decorateRun(next);
  }

  async commitRun(eventId: string, runId: string, hostUserId: string) {
    await this.eventsService.assertHostAccess(eventId, hostUserId);
    const run = await this.runsRepo.findOne({ where: { id: runId, eventId } });
    if (!run) {
      throw new BadRequestException('Run not found');
    }
    await this.runsRepo
      .createQueryBuilder()
      .update(EventMultiTableRun)
      .set({ committedAt: null })
      .where(`"eventId" = :eventId`, { eventId })
      .execute();
    run.committedAt = new Date();
    const saved = await this.runsRepo.save(run);
    return this.decorateRun(saved);
  }

  private collectGoingAttendees(event: Event): PlannerAttendee[] {
    return (event.attendees || [])
      .filter(
        (a): a is typeof a & { userId: string } =>
          a.rsvpStatus === 'going' && typeof a.userId === 'string',
      )
      .map((a) => ({
        userId: a.userId,
        name: a.user?.name || 'Unknown attendee',
      }));
  }

  private resolveCandidateGames(event: Event, requestedIds?: string[]): Game[] {
    const allGames = (event.candidates || [])
      .map((candidate) => candidate.game)
      .filter((game): game is Game => Boolean(game));
    if (!requestedIds?.length) {
      return this.uniqueGamesById(allGames);
    }
    const requested = new Set(requestedIds);
    return this.uniqueGamesById(allGames).filter((g) => requested.has(g.id));
  }

  private uniqueGamesById(games: Game[]): Game[] {
    const seen = new Set<string>();
    const unique: Game[] = [];
    for (const game of games) {
      if (!game?.id || seen.has(game.id)) continue;
      seen.add(game.id);
      unique.push(game);
    }
    return unique;
  }

  private buildPlan(
    attendees: PlannerAttendee[],
    games: Game[],
    tableCount: number,
    warnings: string[],
    locks: MultiTablePlayerGameLock[],
    voteWeightsByGameId: Map<string, number>,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): { tables: PlannerTable[]; unseated: UnseatedPlayer[] } {
    const candidateTables = this.seedTables(
      attendees.length,
      games,
      tableCount,
      locks,
      voteWeightsByGameId,
    );
    if (!candidateTables.length) {
      warnings.push('No viable table seeds from candidate games.');
      return {
        tables: [],
        unseated: attendees.map((a) => ({
          userId: a.userId,
          name: a.name,
          reasonCode: 'no_table_capacity',
          reason: 'No viable table/game combination could be formed.',
        })),
      };
    }

    const lockByUser = new Map(
      locks.map((lock) => [lock.userId, lock.gameId] as const),
    );
    const pool = [...attendees];
    const tables: PlannerTable[] = candidateTables.map((seed, index) => ({
      tableIndex: index + 1,
      gameId: seed.id,
      gameTitle: seed.title,
      minPlayers: Math.max(1, seed.minPlayers || 1),
      maxPlayers: Math.max(1, seed.maxPlayers || 1),
      players: [],
    }));

    for (const table of tables) {
      const lockedForTable = pool.filter(
        (attendee) => lockByUser.get(attendee.userId) === table.gameId,
      );
      for (const lockedPlayer of lockedForTable) {
        if (table.players.length >= table.maxPlayers) break;
        table.players.push({
          userId: lockedPlayer.userId,
          name: lockedPlayer.name,
          fitScore: this.computeFitScore(
            table,
            lockedPlayer,
            voteProfileByUser,
          ),
          reasons: [
            ...this.fitReasons(table, lockedPlayer, voteProfileByUser),
            'host lock preserved',
          ],
        });
      }
      for (const lockedPlayer of lockedForTable) {
        const idx = pool.findIndex((a) => a.userId === lockedPlayer.userId);
        if (idx >= 0) pool.splice(idx, 1);
      }
    }

    for (const table of tables) {
      while (table.players.length < table.maxPlayers && pool.length > 0) {
        const nextIdx = this.selectBestPlayerForTable(
          pool,
          table,
          voteProfileByUser,
        );
        const next = nextIdx >= 0 ? pool.splice(nextIdx, 1)[0] : pool.shift();
        if (!next) break;
        table.players.push({
          userId: next.userId,
          name: next.name,
          fitScore: this.computeFitScore(table, next, voteProfileByUser),
          reasons: this.fitReasons(table, next, voteProfileByUser),
        });
      }
    }

    const unseated = pool.map((player) => ({
      userId: player.userId,
      name: player.name,
      reasonCode: 'no_table_capacity' as const,
      reason: 'All selected tables are full for this run.',
    }));

    const underfilled = tables.filter((t) => t.players.length < t.minPlayers);
    if (underfilled.length > 0) {
      return this.rebalanceUnderfilledTables(
        tables,
        underfilled,
        unseated,
        warnings,
        voteProfileByUser,
      );
    }

    return { tables, unseated };
  }

  private seedTables(
    attendeeCount: number,
    games: Game[],
    tableCount: number,
    locks: MultiTablePlayerGameLock[],
    voteWeightsByGameId: Map<string, number>,
  ): Game[] {
    const lockedGameIds = new Set(locks.map((lock) => lock.gameId));
    const lockedFirst = games.filter((game) => lockedGameIds.has(game.id));
    const ranked = [...games].sort((a, b) => {
      const voteDelta =
        (voteWeightsByGameId.get(b.id) || 0) -
        (voteWeightsByGameId.get(a.id) || 0);
      if (voteDelta !== 0) return voteDelta;
      const aCap = this.capacityScore(a, attendeeCount);
      const bCap = this.capacityScore(b, attendeeCount);
      if (bCap !== aCap) return bCap - aCap;
      return (b.bggRating || 0) - (a.bggRating || 0);
    });
    const merged = [
      ...lockedFirst,
      ...ranked.filter((game) => !lockedGameIds.has(game.id)),
    ];
    return this.uniqueGamesById(merged).slice(0, tableCount);
  }

  private capacityScore(game: Game, attendeeCount: number): number {
    const max = Math.max(1, game.maxPlayers || 1);
    const min = Math.max(1, game.minPlayers || 1);
    const midpoint = (min + max) / 2;
    return (
      1 - Math.abs(midpoint - Math.min(attendeeCount, max)) / Math.max(max, 1)
    );
  }

  private computeFitScore(
    table: PlannerTable,
    player: PlannerAttendee,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): number {
    const base = 0.3;
    const playerFit =
      Math.min(1, table.maxPlayers / Math.max(table.minPlayers, 1)) * 0.2;
    const votePreferenceFit = this.getVotePreferenceFit(
      player,
      table.gameId,
      voteProfileByUser,
    );
    const crowdingPenalty =
      table.players.length >= table.maxPlayers - 1 ? 0.05 : 0;
    return Number(
      (base + playerFit + votePreferenceFit * 0.45 - crowdingPenalty).toFixed(
        3,
      ),
    );
  }

  private fitReasons(
    table: PlannerTable,
    player: PlannerAttendee,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): string[] {
    const reasons = [`fits ${table.minPlayers}-${table.maxPlayers} players`];
    const voteProfile = voteProfileByUser.get(player.userId);
    const rank = voteProfile?.get(table.gameId);
    if (rank != null) {
      reasons.push(`voted rank #${rank} for this game`);
    } else if (voteProfile && voteProfile.size > 0) {
      reasons.push('no explicit vote for this game');
    } else {
      reasons.push('balanced for seat coverage first');
    }
    return reasons;
  }

  private decorateRun(run: EventMultiTableRun) {
    return {
      runId: run.id,
      eventId: run.eventId,
      tableCount: run.tableCount,
      candidateGameIds: run.candidateGameIds || [],
      locks: run.locks || [],
      parentRunId: run.parentRunId,
      committedAt: run.committedAt,
      createdAt: run.createdAt,
      result: run.result,
    };
  }

  private selectOptimizedTableCount(
    attendees: PlannerAttendee[],
    games: Game[],
    locks: MultiTablePlayerGameLock[],
    voteWeightsByGameId: Map<string, number>,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): number {
    const attendeeCount = attendees.length;
    const maxTableCount = Math.min(24, attendeeCount);
    const minTableCount = Math.max(2, Math.ceil(attendeeCount / 8));
    const baseline = Math.max(2, Math.ceil(attendeeCount / 4));
    let bestTableCount = Math.min(
      Math.max(baseline, minTableCount),
      maxTableCount,
    );
    let bestSeated = -1;
    let bestFit = Number.NEGATIVE_INFINITY;
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (
      let tableCount = minTableCount;
      tableCount <= maxTableCount;
      tableCount += 1
    ) {
      const plan = this.buildPlan(
        attendees,
        games,
        tableCount,
        [],
        locks,
        voteWeightsByGameId,
        voteProfileByUser,
      );
      const seated = plan.tables.reduce(
        (sum, table) => sum + table.players.length,
        0,
      );
      const fit = plan.tables
        .flatMap((table) => table.players)
        .reduce((sum, player) => sum + player.fitScore, 0);
      const sizePenalty = Math.abs(tableCount - baseline);

      if (
        seated > bestSeated ||
        (seated === bestSeated && fit > bestFit) ||
        (seated === bestSeated && fit === bestFit && sizePenalty < bestPenalty)
      ) {
        bestSeated = seated;
        bestFit = fit;
        bestPenalty = sizePenalty;
        bestTableCount = tableCount;
      }
    }

    return bestTableCount;
  }

  private rebalanceUnderfilledTables(
    tables: PlannerTable[],
    underfilled: PlannerTable[],
    unseated: UnseatedPlayer[],
    warnings: string[],
    voteProfileByUser: Map<string, Map<string, number>>,
  ): { tables: PlannerTable[]; unseated: UnseatedPlayer[] } {
    warnings.push(
      'Some games could not meet minimum players; optimizer consolidated seating.',
    );
    const underfilledIndexes = new Set(underfilled.map((t) => t.tableIndex));
    const reclaimed = tables
      .filter((t) => underfilledIndexes.has(t.tableIndex))
      .flatMap((t) => t.players)
      .map((p) => ({ userId: p.userId, name: p.name }));
    const kept = tables.filter((t) => !underfilledIndexes.has(t.tableIndex));
    const refillPool = [...reclaimed, ...unseated];

    for (const table of kept) {
      while (table.players.length < table.maxPlayers && refillPool.length > 0) {
        const next = refillPool.shift();
        if (!next) break;
        table.players.push({
          userId: next.userId,
          name: next.name,
          fitScore: this.computeFitScore(table, next, voteProfileByUser),
          reasons: this.fitReasons(table, next, voteProfileByUser),
        });
      }
    }

    return {
      tables: kept,
      unseated: refillPool.map((p) => ({
        userId: p.userId,
        name: p.name,
        reasonCode: 'no_table_capacity',
        reason: 'All selected tables are full for this run.',
      })),
    };
  }

  private async getVoteWeightsByGameId(
    eventId: string,
  ): Promise<Map<string, number>> {
    const votes = await this.votesRepo.find({
      where: { eventId },
      select: ['gameId', 'rank'],
    });
    if (!votes.length) return new Map();
    const maxRank = Math.max(...votes.map((vote) => vote.rank), 1);
    const scoreByGameId = new Map<string, number>();
    for (const vote of votes) {
      const points = maxRank - vote.rank + 1;
      scoreByGameId.set(
        vote.gameId,
        (scoreByGameId.get(vote.gameId) || 0) + points,
      );
    }
    return scoreByGameId;
  }

  private async getVoteProfileByUser(
    eventId: string,
  ): Promise<Map<string, Map<string, number>>> {
    const votes = await this.votesRepo.find({
      where: { eventId },
      select: ['userId', 'gameId', 'rank'],
    });
    const byUser = new Map<string, Map<string, number>>();
    for (const vote of votes) {
      if (!vote.userId) continue;
      const userVotes = byUser.get(vote.userId) || new Map<string, number>();
      userVotes.set(vote.gameId, vote.rank);
      byUser.set(vote.userId, userVotes);
    }
    return byUser;
  }

  private getVotePreferenceFit(
    player: PlannerAttendee,
    gameId: string,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): number {
    const userVotes = voteProfileByUser.get(player.userId);
    if (!userVotes || userVotes.size < 1) return 0.5;
    const rank = userVotes.get(gameId);
    if (rank == null) return 0.2;
    const maxRank = Math.max(...userVotes.values(), 1);
    if (maxRank <= 1) return 1;
    return this.clamp(1 - (rank - 1) / (maxRank - 1), 0, 1);
  }

  private selectBestPlayerForTable(
    pool: PlannerAttendee[],
    table: PlannerTable,
    voteProfileByUser: Map<string, Map<string, number>>,
  ): number {
    let bestIdx = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let idx = 0; idx < pool.length; idx += 1) {
      const score = this.computeFitScore(table, pool[idx], voteProfileByUser);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
