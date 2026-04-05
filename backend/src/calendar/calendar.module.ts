import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncAccount } from '../entities/sync-account.entity';
import { EventCalendarSync } from '../entities/event-calendar-sync.entity';
import { Event } from '../entities/event.entity';
import { EventAttendee } from '../entities/event-attendee.entity';
import { CalendarChangeLog } from '../entities/calendar-change-log.entity';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarController } from './calendar.controller';
import { CalendarWebhookService } from './calendar-webhook.service';
import { TokenCryptoService } from './token-crypto.service';
import { GoogleCalendarAdapter } from './adapters/google-calendar.adapter';
import { AppleCalendarAdapter } from './adapters/apple-calendar.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SyncAccount,
      EventCalendarSync,
      Event,
      EventAttendee,
      CalendarChangeLog,
    ]),
  ],
  providers: [
    CalendarSyncService,
    CalendarWebhookService,
    TokenCryptoService,
    GoogleCalendarAdapter,
    AppleCalendarAdapter,
  ],
  controllers: [CalendarController],
  exports: [CalendarSyncService],
})
export class CalendarModule {}
