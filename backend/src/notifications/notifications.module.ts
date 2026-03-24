import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../entities/event.entity';
import { EventVote } from '../entities/event-vote.entity';
import { NotificationsService } from './notifications.service';
import { VotingModule } from '../voting/voting.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventVote]), VotingModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
