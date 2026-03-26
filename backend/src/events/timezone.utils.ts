import { BadRequestException } from '@nestjs/common';

const LOCAL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  } catch {
    throw new BadRequestException('Invalid event timezone');
  }
}

function parseLocalDateTimeParts(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function formatInTimeZoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function localDateTimeToUtc(localDateTime: string, timeZone: string): Date {
  const target = parseLocalDateTimeParts(localDateTime);
  let utcMillis = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );

  // Two-pass adjustment to handle DST offsets robustly.
  for (let i = 0; i < 2; i += 1) {
    const zoned = formatInTimeZoneParts(new Date(utcMillis), timeZone);
    const zonedAsUtcMillis = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
    );
    const targetAsUtcMillis = Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
    );
    utcMillis += targetAsUtcMillis - zonedAsUtcMillis;
  }

  return new Date(utcMillis);
}

export function resolveEventDateTime(input: string, eventTimezone?: string): Date {
  if (LOCAL_DATETIME_REGEX.test(input)) {
    if (!eventTimezone) {
      throw new BadRequestException(
        'eventTimezone is required when dateTime has no timezone offset',
      );
    }
    assertValidTimeZone(eventTimezone);
    return localDateTimeToUtc(input, eventTimezone);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid dateTime value');
  }

  return parsed;
}

export function resolveEventTimezone(eventTimezone?: string): string {
  if (!eventTimezone) return 'UTC';
  assertValidTimeZone(eventTimezone);
  return eventTimezone;
}
