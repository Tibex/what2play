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
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">My Collection</h1>

        <Link
          href="/collection/add"
          className="wt-btn wt-btn-primary px-3 py-1.5 text-sm font-medium"
        >
          + Add
        </Link>
      </div>

      {collection.length === 0 ? (
        <p className="wt-muted py-10 text-center">
          No games in your collection yet.
        </p>
      ) : (
        <div className="wt-card mb-6 p-6">
          <h2 className="wt-muted mb-4 font-semibold">
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
                    className="text-xs text-[var(--danger)] transition hover:text-[#8b332b]"
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

