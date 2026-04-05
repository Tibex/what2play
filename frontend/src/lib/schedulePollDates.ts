/** Local calendar date as `YYYY-MM-DD` (no timezone conversion). */
export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKeyLocal(key: string): Date {
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

/** Inclusive range of date keys between a and b (chronological). */
export function eachDateKeyInRange(a: string, b: string): string[] {
  let start = a;
  let end = b;
  if (start > end) [start, end] = [end, start];
  const out: string[] = [];
  let cur = parseDateKeyLocal(start);
  const endDate = parseDateKeyLocal(end);
  while (cur <= endDate) {
    out.push(formatDateKey(cur));
    const next = new Date(cur);
    next.setDate(next.getDate() + 1);
    cur = next;
  }
  return out;
}

/** Build ISO timestamp from local date key + `HH:mm` in the user's local timezone. */
export function localDateKeyAndTimeToIso(dateKey: string, hm: string): string {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const dt = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
  return dt.toISOString();
}

export function addMinutesToIso(iso: string, minutes: number): Date {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}
