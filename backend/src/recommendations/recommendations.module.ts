import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { Event } from '../entities/event.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { RecommendationTelemetry } from '../entities/recommendation-telemetry.entity';
import { GamesModule } from '../games/games.module';
import { EventsModule } from '../events/events.module';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsPublicController } from './recommendations-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventGameCandidate,
      Event,
      EventFeedback,
      RecommendationTelemetry,
    ]),
    GamesModule,
    forwardRef(() => EventsModule),
  ],
  providers: [RecommendationsService],
  controllers: [RecommendationsController, RecommendationsPublicController],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
