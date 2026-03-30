export const CALENDAR_PROVIDERS = ['google', 'apple'] as const;
export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];

export interface CalendarEventPayload {
  id: string;
  title: string;
  description?: string;
  location?: string;
  dateTime: string;
  durationMinutes?: number;
}

export interface CalendarAdapter {
  provider: CalendarProvider;
  upsertEvent(params: {
    accessToken: string;
    calendarId?: string | null;
    remoteEventId?: string | null;
    event: CalendarEventPayload;
  }): Promise<{ remoteEventId: string; etag?: string }>;
  deleteEvent(params: {
    accessToken: string;
    calendarId?: string | null;
    remoteEventId: string;
  }): Promise<void>;
}
