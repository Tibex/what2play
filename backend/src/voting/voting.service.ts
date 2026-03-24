import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventVote } from '../entities/event-vote.entity';
import { Event } from '../entities/event.entity';

export interface VoteResult {
  gameId: string;
  totalScore: number;
  voteCount: number;
  averageRank: number;
}

@Injectable()
export class VotingService {
  constructor(
    @InjectRepository(EventVote)
    private votesRepo: Repository<EventVote>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
  ) {}

  async submitVotes(
    eventId: string,
    userId: string,
    rankings: { gameId: string; rank: number }[],
  ): Promise<EventVote[]> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');

    if (event.votingDeadline && new Date() > new Date(event.votingDeadline)) {
      throw new BadRequestException('Voting has closed');
    }

    await this.votesRepo.delete({ eventId, userId });

    const votes = rankings.map((r) =>
      this.votesRepo.create({
        eventId,
        userId,
        gameId: r.gameId,
        rank: r.rank,
      }),
    );

    return this.votesRepo.save(votes);
  }

  async getResults(eventId: string): Promise<VoteResult[]> {
    const votes = await this.votesRepo.find({
      where: { eventId },
      relations: ['game'],
    });

    const totalVoters = new Set(votes.map((v) => v.userId)).size;
    if (totalVoters === 0) return [];

    const maxRank = Math.max(...votes.map((v) => v.rank), 1);

    const gameScores = new Map<string, { totalScore: number; ranks: number[] }>();

    for (const vote of votes) {
      const entry = gameScores.get(vote.gameId) || { totalScore: 0, ranks: [] };
      const bordaScore = maxRank - vote.rank + 1;
      entry.totalScore += bordaScore;
      entry.ranks.push(vote.rank);
      gameScores.set(vote.gameId, entry);
    }

    const results: VoteResult[] = [];
    for (const [gameId, data] of gameScores) {
      results.push({
        gameId,
        totalScore: data.totalScore,
        voteCount: data.ranks.length,
        averageRank: data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length,
      });
    }

    results.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.averageRank - b.averageRank;
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

  async selectWinner(eventId: string, userId: string, gameId?: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');
    if (event.hostId !== userId) throw new ForbiddenException('Only host can select');

    if (gameId) {
      event.selectedGameId = gameId;
    } else {
      const results = await this.getResults(eventId);
      if (results.length > 0) {
        event.selectedGameId = results[0].gameId;
      }
    }

    event.status = 'confirmed';
    return this.eventsRepo.save(event);
  }

  async autoCloseVoting(eventId: string): Promise<void> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event || event.status !== 'voting') return;

    const results = await this.getResults(eventId);
    if (results.length > 0) {
      event.selectedGameId = results[0].gameId;
      event.status = 'confirmed';
      await this.eventsRepo.save(event);
    }
  }
}
