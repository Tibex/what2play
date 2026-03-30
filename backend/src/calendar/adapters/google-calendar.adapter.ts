import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { CalendarAdapter } from '../calendar.types';

@Injectable()
export class GoogleCalendarAdapter implements CalendarAdapter {
  provider = 'google' as const;
  private readonly logger = new Logger(GoogleCalendarAdapter.name);

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
    const calendarId = encodeURIComponent(params.calendarId || 'primary');
    const durationMinutes = params.event.durationMinutes ?? 120;
    const start = new Date(params.event.dateTime);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const body = {
      summary: params.event.title,
      description: params.event.description || '',
      location: params.event.location || '',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
    const method = params.remoteEventId ? 'PATCH' : 'POST';
    const remoteEventPath = params.remoteEventId
      ? `/events/${encodeURIComponent(params.remoteEventId)}`
      : '/events';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}${remoteEventPath}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.warn(
        `Google upsert failed for event ${params.event.id}: ${response.status} ${errorBody.slice(0, 200)}`,
      );
      throw new BadRequestException(
        `Google calendar upsert failed (${response.status})`,
      );
    }
    const payload = (await response.json()) as { id?: string; etag?: string };
    if (!payload.id) {
      throw new BadRequestException('Google calendar did not return event id');
    }
    return {
      remoteEventId: payload.id,
      etag: payload.etag,
    };
  }

  async deleteEvent(params: {
    accessToken: string;
    calendarId?: string | null;
    remoteEventId: string;
  }): Promise<void> {
    const calendarId = encodeURIComponent(params.calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(params.remoteEventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
        },
      },
    );
    if (!response.ok && response.status !== 404) {
      const errorBody = await response.text();
      this.logger.warn(
        `Google delete failed for remote event ${params.remoteEventId}: ${response.status} ${errorBody.slice(0, 200)}`,
      );
      throw new BadRequestException(
        `Google calendar delete failed (${response.status})`,
      );
    }
  }
}
