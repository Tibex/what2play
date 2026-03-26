export function formatEventDateTime(
  isoDateTime: string,
  timeZone: string,
): { date: string; time: string } {
  const date = new Date(isoDateTime);
  return {
    date: date.toLocaleDateString(undefined, {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString(undefined, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function toDateTimeLocalInTimeZone(
  isoDateTime: string,
  timeZone: string,
): string {
  const date = new Date(isoDateTime);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}
