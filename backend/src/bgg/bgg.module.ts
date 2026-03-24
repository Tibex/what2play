import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { GamesModule } from '../games/games.module';
import { BggService } from './bgg.service';
import { BggController } from './bgg.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncAccount, BggVerificationChallenge]),
    GamesModule,
  ],
  providers: [BggService],
  controllers: [BggController],
  exports: [BggService],
})
export class BggModule {}
