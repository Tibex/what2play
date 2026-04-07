'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameCard from '@/components/GameCard';
import type { GameOwnership } from '@/lib/types';

export default function CollectionPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const sortedCollection = useMemo(
    () =>
      [...collection].sort((a, b) => {
        const aPicked = a.performance?.pickedCount ?? 0;
        const bPicked = b.performance?.pickedCount ?? 0;
        if (bPicked !== aPicked) return bPicked - aPicked;

        const aPool = a.performance?.votingPoolCount ?? 0;
        const bPool = b.performance?.votingPoolCount ?? 0;
        if (bPool !== aPool) return bPool - aPool;

        const aAuto = a.performance?.autoRecommendedCount ?? 0;
        const bAuto = b.performance?.autoRecommendedCount ?? 0;
        if (bAuto !== aAuto) return bAuto - aAuto;

        const aPos = a.performance?.avgVotingRank ?? Number.POSITIVE_INFINITY;
        const bPos = b.performance?.avgVotingRank ?? Number.POSITIVE_INFINITY;
        if (aPos !== bPos) return aPos - bPos;

        const aEnjoy = a.performance?.avgEnjoyment ?? Number.NEGATIVE_INFINITY;
        const bEnjoy = b.performance?.avgEnjoyment ?? Number.NEGATIVE_INFINITY;
        if (bEnjoy !== aEnjoy) return bEnjoy - aEnjoy;

        return a.game.title.localeCompare(b.game.title);
      }),
    [collection],
  );
  const pagedCollection = useMemo(
    () => sortedCollection.slice((page - 1) * pageSize, page * pageSize),
    [page, sortedCollection],
  );
  const hasNext = page * pageSize < sortedCollection.length;

  const loadCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setPage(1);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const data = await api.get<GameOwnership[]>('/games/collection');
      setCollection(data);
      setPage(1);
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
            {pagedCollection.map((ownership) => (
              <GameCard
                key={ownership.id}
                game={ownership.game}
                metaBadges={
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className="wt-chip px-2 py-0.5 text-[0.65rem]"
                      title="Times this game was the final picked game."
                    >
                      Picked {ownership.performance?.pickedCount ?? 0}
                    </span>
                    <span
                      className="wt-chip px-2 py-0.5 text-[0.65rem]"
                      title="Average vote rank when this game was voted. Lower is better."
                    >
                      Pos{' '}
                      {ownership.performance?.avgVotingRank != null
                        ? ownership.performance.avgVotingRank.toFixed(2)
                        : '—'}
                    </span>
                    <span
                      className="wt-chip px-2 py-0.5 text-[0.65rem]"
                      title="Number of events where this game appeared in the voting pool."
                    >
                      Pool {ownership.performance?.votingPoolCount ?? 0}
                    </span>
                    <span
                      className="wt-chip px-2 py-0.5 text-[0.65rem]"
                      title="Number of events where this game was auto-recommended (not manually added)."
                    >
                      Auto {ownership.performance?.autoRecommendedCount ?? 0}
                    </span>
                    <span
                      className="wt-chip px-2 py-0.5 text-[0.65rem]"
                      title="Average post-event enjoyment score for this game (1-5)."
                    >
                      Enjoy{' '}
                      {ownership.performance?.avgEnjoyment != null
                        ? `${ownership.performance.avgEnjoyment.toFixed(1)}/5`
                        : '—'}
                    </span>
                  </div>
                }
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
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="wt-muted text-sm">Page {page}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
