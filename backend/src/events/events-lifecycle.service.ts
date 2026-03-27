import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from './events.service';

@Injectable()
export class EventsLifecycleService {
  private readonly logger = new Logger(EventsLifecycleService.name);

  constructor(private readonly eventsService: EventsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async completePastEvents(): Promise<void> {
    const updated = await this.eventsService.markPastEventsAsCompleted();
    if (updated > 0) {
      this.logger.log(`Marked ${updated} past events as completed`);
    }
  }
}
