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

/** Format a Date or ISO string for `<input type="datetime-local" />` in the user's local timezone. */
export function isoToDatetimeLocalValue(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
