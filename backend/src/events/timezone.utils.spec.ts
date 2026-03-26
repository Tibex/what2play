import { resolveEventDateTime } from './timezone.utils';

describe('timezone utils', () => {
  it('converts local datetime with timezone to stable UTC instant', () => {
    const resolved = resolveEventDateTime(
      '2026-03-26T18:00',
      'Europe/Budapest',
    );
    const renderedHour = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Budapest',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(resolved);
    expect(renderedHour).toBe('18:00');
  });
});
