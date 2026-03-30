'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { GameOwnership } from '@/lib/types';

export default function CollectionPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const data = await api.get<GameOwnership[]>('/games/collection');
      setCollection(data);
      setLoading(false);
    };
    void init();
  }, []);

  const removeFromCollection = async (gameId: string) => {
    try {
      await api.delete(`/games/collection/${gameId}`);
      toast.success('Removed from collection');
      await loadCollection();
    } catch {
      /* toast auto-shown by api.ts */
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">My Collection</h1>

        <Link
          href="/collection/add"
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          + Add
        </Link>
      </div>

      {collection.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No games in your collection yet.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">
            Your Games ({collection.length})
          </h2>

          <div className="space-y-3">
            {collection.map((ownership) => (
              <GameCard
                key={ownership.id}
                game={ownership.game}
                actions={
                  <button
                    onClick={() => void removeFromCollection(ownership.gameId)}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Remove
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

