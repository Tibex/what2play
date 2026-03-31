import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BggService } from './bgg.service';

@Injectable()
export class BggCatalogSyncService {
  private readonly logger = new Logger(BggCatalogSyncService.name);

  constructor(private readonly bggService: BggService) {}

  // Weekly on Monday at 03:00 UTC.
  @Cron('0 3 * * 1')
  async runWeeklyTopImport(): Promise<void> {
    const result = await this.bggService.runTopRankedImportWithCooldown({
      limit: 500,
      trigger: 'cron',
    });
    if (result.status === 'skipped') {
      const nextEligibleSuffix = result.nextEligibleAt
        ? `, next eligible: ${result.nextEligibleAt}`
        : '';
      this.logger.log(
        `Skipped weekly BGG top import (${result.reason})${nextEligibleSuffix}`,
      );
      return;
    }
    this.logger.log(
      `Weekly BGG top import executed: imported=${result.imported}, fetched=${result.fetched}, requested=${result.requested}`,
    );
  }
}
