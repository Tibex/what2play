import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventVote } from '../entities/event-vote.entity';
import { Event } from '../entities/event.entity';
import { VotingService } from './voting.service';
import { VotingController } from './voting.controller';
import { VotingGateway } from './voting.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([EventVote, Event])],
  providers: [VotingService, VotingGateway],
  controllers: [VotingController],
  exports: [VotingService],
})
export class VotingModule {}
