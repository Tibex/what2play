import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { SessionTiming } from '../entities/session-timing.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { GamesModule } from '../games/games.module';
import { EventsModule } from '../events/events.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventGameCandidate, SessionTiming, EventFeedback]),
    GamesModule,
    EventsModule,
  ],
  providers: [RecommendationsService],
  controllers: [RecommendationsController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
