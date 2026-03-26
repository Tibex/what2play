'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { Game, GameOwnership, BggSearchResult } from '@/lib/types';

type SearchResultItem = {
  key: string;
  title: string;
  thumbnailUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
  playingTime?: number;
  yearPublished?: number;
  gameId?: string;
  bggId?: number;
  inCollection?: boolean;
};

export default function CollectionAddPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dedupeKeyFor = (item: {
    title: string;
    bggId?: number;
    yearPublished?: number;
  }) => {
    if (item.bggId != null) return `bgg:${item.bggId}`;
    const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
    return `title:${normalizedTitle}:${item.yearPublished ?? 'na'}`;
  };

  useEffect(() => {
    void loadCollection();
  }, []);

  const loadCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setResults([]);
    const collectionGameIds = new Set(collection.map((o) => o.gameId));
    const collectionBggIds = new Set(collection.map((o) => o.game.bggId).filter(Boolean));

    try {
      const [local, bgg] = await Promise.all([
        api.get<Game[]>(`/games/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
        api.get<BggSearchResult[]>(`/bgg/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
      ]);

      const merged = new Map<string, SearchResultItem>();

      for (const game of local) {
        const item: SearchResultItem = {
          key: `game:${game.id}`,
          title: game.title,
          thumbnailUrl: game.thumbnailUrl,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          playingTime: game.playingTime,
          yearPublished: game.yearPublished,
          gameId: game.id,
          bggId: game.bggId,
          inCollection: collectionGameIds.has(game.id),
        };
        merged.set(dedupeKeyFor(item), item);
      }

      for (const result of bgg) {
        const existing = merged.get(dedupeKeyFor(result));
        if (existing) continue;
        merged.set(dedupeKeyFor(result), {
          key: `bgg:${result.bggId}`,
          title: result.title,
          thumbnailUrl: result.thumbnailUrl,
          minPlayers: result.minPlayers,
          maxPlayers: result.maxPlayers,
          playingTime: result.playingTime,
          yearPublished: result.yearPublished,
          bggId: result.bggId,
          inCollection: collectionBggIds.has(result.bggId),
        });
      }

      setResults(
        [...merged.values()].sort((a, b) => a.title.localeCompare(b.title)),
      );
    } finally {
      setSearching(false);
    }
  }, [collection, searchQuery]);

  const addToCollection = async (gameId: string) => {
    try {
      await api.post(`/games/collection/${gameId}`);
      toast.success('Added to collection');
      loadCollection();
      setResults((prev) => prev.filter((r) => r.gameId !== gameId));
    } catch {
      /* toast auto-shown by api.ts */
    }
  };

  const importAndAdd = async (bggId: number, key: string) => {
    setAddingKey(key);
    try {
      await api.post<{ game: Game }>('/bgg/import-one', { bggId });
      toast.success('Added to collection');
      setResults((prev) => prev.filter((r) => r.key !== key));
      await loadCollection();
    } catch {
      /* toast auto-shown by api.ts */
    } finally {
      setAddingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add Games</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold mb-3">Search & Add</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
            placeholder="Search by title..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
          <button
            onClick={() => void handleSearch()}
            disabled={searching}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
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
                actions={
                  result.inCollection ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                      Already in collection
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        if (result.gameId) {
                          setAddingKey(result.key);
                          void addToCollection(result.gameId).finally(() =>
                            setAddingKey(null),
                          );
                          return;
                        }
                        if (result.bggId != null) {
                          void importAndAdd(result.bggId, result.key);
                        }
                      }}
                      disabled={addingKey === result.key}
                      className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 disabled:opacity-50 transition inline-flex items-center gap-1"
                    >
                      {addingKey === result.key && (
                        <span className="animate-spin inline-block h-3 w-3 border-b-2 border-green-700 rounded-full" />
                      )}
                      {addingKey === result.key ? 'Adding...' : '+ Add'}
                    </button>
                  )
                }
              />
            ))}
          </div>
        )}

        {!searching && searchQuery && results.length === 0 && (
          <p className="text-sm text-gray-500">
            No results found for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

