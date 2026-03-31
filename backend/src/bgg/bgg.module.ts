import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncAccount } from '../entities/sync-account.entity';
import { BggVerificationChallenge } from '../entities/bgg-verification-challenge.entity';
import { BggCatalogSync } from '../entities/bgg-catalog-sync.entity';
import { GamesModule } from '../games/games.module';
import { BggService } from './bgg.service';
import { BggController } from './bgg.controller';
import { BggCatalogSyncService } from './bgg-catalog-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncAccount,
      BggVerificationChallenge,
      BggCatalogSync,
    ]),
    GamesModule,
  ],
  providers: [BggService, BggCatalogSyncService],
  controllers: [BggController],
  exports: [BggService],
})
export class BggModule {}
