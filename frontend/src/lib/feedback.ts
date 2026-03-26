export interface PlayedGameInputRow {
  gameId: string;
  enjoymentRating: number;
  finishedGame: boolean;
  durationFeel: string;
  notes: string;
}

export interface PlayedGamePayloadRow {
  gameId: string;
  enjoymentRating: number;
  finishedGame: boolean;
  durationFeel: string;
  notes?: string;
}

export function buildPlayedGamesPayload(
  rows: PlayedGameInputRow[],
): PlayedGamePayloadRow[] {
  const byGameId = new Map<string, PlayedGamePayloadRow>();
  for (const row of rows) {
    const gameId = row.gameId?.trim();
    if (!gameId) continue;
    if (!byGameId.has(gameId)) {
      byGameId.set(gameId, {
        gameId,
        enjoymentRating: row.enjoymentRating,
        finishedGame: row.finishedGame,
        durationFeel: row.durationFeel,
        notes: row.notes.trim() || undefined,
      });
    }
  }
  return [...byGameId.values()];
}
