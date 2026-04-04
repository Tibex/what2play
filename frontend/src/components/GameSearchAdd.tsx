'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { Game, BggSearchResult } from '@/lib/types';

export type GameSearchAddResult = {
  key: string;
  title: string;
  thumbnailUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  yearPublished?: number;
  bggRating?: number;
  gameId?: string;
  bggId?: number;
  isMarked?: boolean;
};

type GameSearchAddProps = {
  heading: string;
  placeholder?: string;
  searchButtonLabel?: string;
  searchingButtonLabel?: string;
  addButtonLabel?: string;
  addingButtonLabel?: string;
  markedLabel?: string;
  noResultsMessage?: (query: string) => string;
  excludedGameIds?: string[];
  excludedBggIds?: number[];
  markedGameIds?: string[];
  markedBggIds?: number[];
  onAdd: (result: GameSearchAddResult) => Promise<void>;
  containerClassName?: string;
  headingClassName?: string;
  inputClassName?: string;
  searchButtonClassName?: string;
  resultsContainerClassName?: string;
  addButtonClassName?: string;
  markedChipClassName?: string;
};

const dedupeKeyFor = (item: {
  title: string;
  bggId?: number;
  yearPublished?: number;
}) => {
  if (item.bggId != null) return `bgg:${item.bggId}`;
  const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
  return `title:${normalizedTitle}:${item.yearPublished ?? 'na'}`;
};

export default function GameSearchAdd({
  heading,
  placeholder = 'Search by title...',
  searchButtonLabel = 'Find',
  searchingButtonLabel = 'Searching...',
  addButtonLabel = '+ Add',
  addingButtonLabel = 'Adding...',
  markedLabel = 'Already added',
  noResultsMessage = (query) => `No results found for “${query}”`,
  excludedGameIds = [],
  excludedBggIds = [],
  markedGameIds = [],
  markedBggIds = [],
  onAdd,
  containerClassName = 'wt-card p-6',
  headingClassName = 'font-semibold mb-3',
  inputClassName = 'wt-input flex-1 py-2 text-sm',
  searchButtonClassName = 'wt-btn wt-btn-primary px-3 py-1.5 text-sm font-medium disabled:opacity-50',
  resultsContainerClassName = 'space-y-2',
  addButtonClassName = 'wt-btn inline-flex items-center gap-1 rounded-full border border-[#afc6a1] bg-[#dbe8d3] px-3 py-1 text-xs text-[#355f39] disabled:opacity-50',
  markedChipClassName = 'wt-chip px-3 py-1',
}: GameSearchAddProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GameSearchAddResult[]>([]);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const excludedGameIdSet = useMemo(
    () => new Set(excludedGameIds),
    [excludedGameIds],
  );
  const excludedBggIdSet = useMemo(
    () => new Set(excludedBggIds),
    [excludedBggIds],
  );
  const markedGameIdSet = useMemo(() => new Set(markedGameIds), [markedGameIds]);
  const markedBggIdSet = useMemo(() => new Set(markedBggIds), [markedBggIds]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setHasSubmittedSearch(true);
    setSubmittedQuery(q);
    setSearching(true);
    setResults([]);
    try {
      const [local, bgg] = await Promise.all([
        api.get<Game[]>(`/games/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
        api.get<BggSearchResult[]>(`/bgg/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
      ]);

      const merged = new Map<string, GameSearchAddResult>();

      for (const game of local) {
        if (excludedGameIdSet.has(game.id)) continue;
        if (game.bggId != null && excludedBggIdSet.has(game.bggId)) continue;

        const isMarked =
          markedGameIdSet.has(game.id) ||
          (game.bggId != null && markedBggIdSet.has(game.bggId));
        const item: GameSearchAddResult = {
          key: `game:${game.id}`,
          title: game.title,
          thumbnailUrl: game.thumbnailUrl,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          playingTime: game.playingTime,
          yearPublished: game.yearPublished,
          bggRating: game.bggRating,
          gameId: game.id,
          bggId: game.bggId,
          isMarked,
        };
        merged.set(dedupeKeyFor(item), item);
      }

      for (const item of bgg) {
        if (excludedBggIdSet.has(item.bggId)) continue;
        const dedupeKey = dedupeKeyFor(item);
        if (merged.has(dedupeKey)) continue;

        merged.set(dedupeKey, {
          key: `bgg:${item.bggId}`,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          minPlayers: item.minPlayers,
          maxPlayers: item.maxPlayers,
          playingTime: item.playingTime,
          yearPublished: item.yearPublished,
          bggRating: item.bggRating,
          bggId: item.bggId,
          isMarked: markedBggIdSet.has(item.bggId),
        });
      }

      setResults([...merged.values()]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (result: GameSearchAddResult) => {
    if (result.isMarked) return;
    setAddingKey(result.key);
    try {
      await onAdd(result);
      setResults((prev) =>
        prev.filter(
          (row) =>
            row.key !== result.key &&
            (result.gameId ? row.gameId !== result.gameId : true),
        ),
      );
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div className={containerClassName}>
      <h3 className={headingClassName}>{heading}</h3>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          onClick={() => void handleSearch()}
          disabled={searching}
          className={searchButtonClassName}
        >
          {searching ? searchingButtonLabel : searchButtonLabel}
        </button>
      </div>

      {results.length > 0 && (
        <div className={resultsContainerClassName}>
          {results.map((result) => (
            <GameCard
              key={result.key}
              game={{
                id: result.gameId || result.key,
                bggId: result.bggId,
                title: result.title,
                thumbnailUrl: result.thumbnailUrl,
                imageUrl: result.thumbnailUrl,
                minPlayers: result.minPlayers ?? 1,
                maxPlayers: result.maxPlayers ?? 4,
                playingTime: result.playingTime,
                yearPublished: result.yearPublished,
              }}
              bggUrl={
                result.bggId != null
                  ? `https://boardgamegeek.com/boardgame/${result.bggId}`
                  : undefined
              }
              actionsPlacement="right"
              actions={
                result.isMarked ? (
                  <span className={markedChipClassName}>{markedLabel}</span>
                ) : (
                  <button
                    onClick={() => {
                      void handleAdd(result);
                    }}
                    disabled={addingKey === result.key}
                    className={addButtonClassName}
                  >
                    {addingKey === result.key && (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-b-2 border-[#355f39]" />
                    )}
                    {addingKey === result.key
                      ? addingButtonLabel
                      : addButtonLabel}
                  </button>
                )
              }
            />
          ))}
        </div>
      )}

      {!searching &&
        hasSubmittedSearch &&
        results.length === 0 &&
        submittedQuery === searchQuery.trim() && (
          <p className="wt-muted text-sm">{noResultsMessage(submittedQuery)}</p>
      )}
    </div>
  );
}
