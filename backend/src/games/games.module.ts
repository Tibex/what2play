import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';
import { Event } from '../entities/event.entity';
import { EventFeedback } from '../entities/event-feedback.entity';
import { EventVote } from '../entities/event-vote.entity';
import { EventGameCandidate } from '../entities/event-game-candidate.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { VisionModule } from '../vision/vision.module';

@Module({
  imports: [
    VisionModule,
    TypeOrmModule.forFeature([
      Game,
      UserGameOwnership,
      UserGameRating,
      Event,
      EventFeedback,
      EventVote,
      EventGameCandidate,
    ]),
  ],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule {}
