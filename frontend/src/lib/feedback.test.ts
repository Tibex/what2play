import { describe, expect, it } from 'vitest';
import { buildPlayedGamesPayload } from './feedback';

describe('buildPlayedGamesPayload', () => {
  it('removes empty rows and trims optional notes', () => {
    const payload = buildPlayedGamesPayload([
      {
        gameId: '',
        enjoymentRating: 5,
        finishedGame: true,
        durationFeel: 'just_right',
        notes: 'ignore',
      },
      {
        gameId: 'g1',
        enjoymentRating: 4,
        finishedGame: false,
        durationFeel: 'too_long',
        notes: '  ',
      },
    ]);

    expect(payload).toEqual([
      {
        gameId: 'g1',
        enjoymentRating: 4,
        finishedGame: false,
        durationFeel: 'too_long',
        notes: undefined,
      },
    ]);
  });

  it('deduplicates duplicate game rows by first occurrence', () => {
    const payload = buildPlayedGamesPayload([
      {
        gameId: 'g1',
        enjoymentRating: 3,
        finishedGame: true,
        durationFeel: 'just_right',
        notes: 'first',
      },
      {
        gameId: 'g1',
        enjoymentRating: 5,
        finishedGame: false,
        durationFeel: 'too_short',
        notes: 'second',
      },
    ]);

    expect(payload).toHaveLength(1);
    expect(payload[0].enjoymentRating).toBe(3);
  });
});
