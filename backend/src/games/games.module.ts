import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../entities/game.entity';
import { UserGameOwnership } from '../entities/user-game-ownership.entity';
import { UserGameRating } from '../entities/user-game-rating.entity';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Game, UserGameOwnership, UserGameRating])],
  providers: [GamesService],
  controllers: [GamesController],
  exports: [GamesService],
})
export class GamesModule {}
