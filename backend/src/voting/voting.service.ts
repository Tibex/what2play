import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventVote } from '../entities/event-vote.entity';
import { Event } from '../entities/event.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';

export interface VoteResult {
  gameId: string;
  totalScore: number;
  firstPlaceCount: number;
  averageRank: number;
}

export interface VotingStatus {
  expectedVoters: number;
  submittedVoters: number;
  allVoted: boolean;
}

export interface VotingEventSnapshot {
  status: string;
  selectedGameId: string | null;
}

@Injectable()
export class VotingService {
  constructor(
    @InjectRepository(EventVote)
    private readonly votesRepo: Repository<EventVote>,
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(EventGameCandidate)
    private readonly candidatesRepo: Repository<EventGameCandidate>,
  ) {}

  async submitVotes(
    eventId: string,
    userId: string,
    rankings: { gameId: string; rank: number }[],
  ): Promise<EventVote[]> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['attendees'],
    });
    if (!event) throw new BadRequestException('Event not found');
    if (event.status !== 'voting') {
      throw new BadRequestException('Voting is not open for this event yet');
    }
    const attendee = (event.attendees || []).find(
      (row) => row.userId === userId,
    );
    if (attendee?.rsvpStatus !== 'going') {
      throw new BadRequestException('Only attendees marked as going can vote');
    }

    if (event.votingDeadline && new Date() > new Date(event.votingDeadline)) {
      throw new BadRequestException('Voting has closed');
    }

    const voterKey = this.createUserVoterKey(userId);
    const existingVote = await this.votesRepo.findOne({
      where: { eventId, voterKey },
      select: ['id'],
    });
    if (existingVote) {
      throw new BadRequestException(
        'You have already submitted votes for this event',
      );
    }

    const validGameIds = await this.getValidCandidateGameIds(eventId);
    const filteredRankings = rankings.filter((r) => validGameIds.has(r.gameId));
    if (!filteredRankings.length) {
      throw new BadRequestException(
        'No valid votes submitted for current candidate list',
      );
    }

    const votes = filteredRankings.map((r) =>
      this.votesRepo.create({
        eventId,
        userId,
        voterKey,
        gameId: r.gameId,
        rank: r.rank,
      }),
    );

    return this.votesRepo.save(votes);
  }

  async getResults(eventId: string): Promise<VoteResult[]> {
    const status = await this.getVotingStatus(eventId);
    if (!status.allVoted) return [];
    return this.computeResults(eventId);
  }

  async getVotingStatus(eventId: string): Promise<VotingStatus> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      relations: ['attendees'],
    });
    if (!event) throw new BadRequestException('Event not found');

    const expectedVoterKeys = new Set<string>();
    expectedVoterKeys.add(this.createUserVoterKey(event.hostId));
    for (const attendee of event.attendees || []) {
      if (attendee.userId && attendee.rsvpStatus === 'going') {
        expectedVoterKeys.add(this.createUserVoterKey(attendee.userId));
      }
    }

    const validGameIds = await this.getValidCandidateGameIds(eventId);
    if (!validGameIds.size) {
      return {
        expectedVoters: expectedVoterKeys.size,
        submittedVoters: 0,
        allVoted: false,
      };
    }

    const votes = await this.votesRepo.find({ where: { eventId } });
    const submittedVoterIds = new Set(
      votes
        .filter((v) => validGameIds.has(v.gameId))
        .map(
          (v) =>
            v.voterKey ?? (v.userId ? this.createUserVoterKey(v.userId) : null),
        )
        .filter((key): key is string => Boolean(key)),
    );

    const expectedVoters = expectedVoterKeys.size;
    let submittedVoters = 0;
    for (const voterKey of expectedVoterKeys) {
      if (submittedVoterIds.has(voterKey)) submittedVoters++;
    }

    return {
      expectedVoters,
      submittedVoters,
      allVoted: expectedVoters > 0 && submittedVoters >= expectedVoters,
    };
  }

  async getEventSnapshot(eventId: string): Promise<VotingEventSnapshot> {
    const event = await this.eventsRepo.findOne({
      where: { id: eventId },
      select: ['status', 'selectedGameId'],
    });
    if (!event) throw new BadRequestException('Event not found');
    return {
      status: event.status,
      selectedGameId: event.selectedGameId ?? null,
    };
  }

  private async computeResults(eventId: string): Promise<VoteResult[]> {
    const validGameIds = await this.getValidCandidateGameIds(eventId);
    if (!validGameIds.size) return [];
    const votes = await this.votesRepo.find({
      where: { eventId },
      relations: ['game'],
    });
    const validVotes = votes.filter((v) => validGameIds.has(v.gameId));

    const totalVoters = new Set(
      validVotes
        .map(
          (v) =>
            v.voterKey ?? (v.userId ? this.createUserVoterKey(v.userId) : null),
        )
        .filter((key): key is string => Boolean(key)),
    ).size;
    if (totalVoters === 0) return [];

    const maxRank = Math.max(...validVotes.map((v) => v.rank), 1);

    const gameScores = new Map<
      string,
      { totalScore: number; ranks: number[]; firstPlaceCount: number }
    >();

    for (const vote of validVotes) {
      const entry = gameScores.get(vote.gameId) || {
        totalScore: 0,
        ranks: [],
        firstPlaceCount: 0,
      };
      const bordaScore = maxRank - vote.rank + 1;
      entry.totalScore += bordaScore;
      entry.ranks.push(vote.rank);
      if (vote.rank === 1) {
        entry.firstPlaceCount += 1;
      }
      gameScores.set(vote.gameId, entry);
    }

    const results: VoteResult[] = [];
    for (const [gameId, data] of gameScores) {
      results.push({
        gameId,
        totalScore: data.totalScore,
        firstPlaceCount: data.firstPlaceCount,
        averageRank: data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length,
      });
    }

    results.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.averageRank !== b.averageRank) return a.averageRank - b.averageRank;
      return b.firstPlaceCount - a.firstPlaceCount;
    });

    return results;
  }

  async getUserVotes(eventId: string, userId: string): Promise<EventVote[]> {
    return this.votesRepo.find({
      where: { eventId, userId },
      relations: ['game'],
      order: { rank: 'ASC' },
    });
  }

  async selectWinner(
    eventId: string,
    userId: string,
    gameId?: string,
  ): Promise<Event> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');
    if (event.hostId !== userId)
      throw new ForbiddenException('Only host can select');

    if (gameId) {
      event.selectedGameId = gameId;
    } else {
      const results = await this.computeResults(eventId);
      if (results.length > 0) {
        event.selectedGameId = results[0].gameId;
      }
    }

    event.status = 'confirmed';
    return this.eventsRepo.save(event);
  }

  async autoCloseVoting(eventId: string): Promise<void> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (event?.status !== 'voting') return;

    const results = await this.computeResults(eventId);
    if (results.length > 0) {
      event.selectedGameId = results[0].gameId;
      event.status = 'confirmed';
      await this.eventsRepo.save(event);
    }
  }

  private async getValidCandidateGameIds(
    eventId: string,
  ): Promise<Set<string>> {
    const candidates = await this.candidatesRepo.find({
      where: { eventId },
      select: ['gameId'],
    });
    return new Set(candidates.map((candidate) => candidate.gameId));
  }

  private createUserVoterKey(userId: string): string {
    return `user:${userId}`;
  }
}
