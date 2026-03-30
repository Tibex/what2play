import { Injectable, Logger } from '@nestjs/common';
import type { CalendarAdapter } from '../calendar.types';

@Injectable()
export class AppleCalendarAdapter implements CalendarAdapter {
  provider = 'apple' as const;
  private readonly logger = new Logger(AppleCalendarAdapter.name);

  async upsertEvent(params: {
    accessToken: string;
    calendarId?: string | null;
    remoteEventId?: string | null;
    event: {
      id: string;
      title: string;
      description?: string;
      location?: string;
      dateTime: string;
      durationMinutes?: number;
    };
  }): Promise<{ remoteEventId: string; etag?: string }> {
    this.logger.debug(
      `Apple upsert placeholder for token ${params.accessToken.slice(0, 6)}..., event ${params.event.id}`,
    );
    return {
      remoteEventId:
        params.remoteEventId || `apple:${params.event.id}:${Date.now()}`,
      etag: `apple-etag-${Date.now()}`,
    };
  }

  async deleteEvent(params: {
    accessToken: string;
    calendarId?: string | null;
    remoteEventId: string;
  }): Promise<void> {
    this.logger.debug(
      `Apple delete placeholder for token ${params.accessToken.slice(0, 6)}..., remote event ${params.remoteEventId}`,
    );
  }
}
