import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventVote } from '../entities/event-vote.entity';
import { Event } from '../entities/event.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { VotingService } from './voting.service';
import { VotingController } from './voting.controller';
import { VotingGateway } from './voting.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventAttendee } from '../entities/event-attendee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventVote,
      Event,
      EventGameCandidate,
      EventAttendee,
    ]),
    forwardRef(() => NotificationsModule),
  ],
  providers: [VotingService, VotingGateway],
  controllers: [VotingController],
  exports: [VotingService, VotingGateway],
})
export class VotingModule {}
