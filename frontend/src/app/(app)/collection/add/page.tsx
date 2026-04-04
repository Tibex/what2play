'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameSearchAdd, {
  type GameSearchAddResult,
} from '@/components/GameSearchAdd';
import type { Game, GameOwnership } from '@/lib/types';

export default function CollectionAddPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    api.get<GameOwnership[]>('/games/collection')
      .then((data) => {
        if (!active) return;
        setCollection(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const collectionGameIds = useMemo(
    () => collection.map((ownership) => ownership.gameId),
    [collection],
  );
  const collectionBggIds = useMemo(
    () =>
      collection
        .map((ownership) => ownership.game.bggId)
        .filter((id): id is number => id != null),
    [collection],
  );

  const handleAdd = async (result: GameSearchAddResult) => {
    if (result.gameId) {
      await api.post(`/games/collection/${result.gameId}`);
    } else if (result.bggId != null) {
      await api.post<{ game: Game }>('/bgg/import-one', { bggId: result.bggId });
    } else {
      return;
    }
    toast.success('Added to collection');
    await refreshCollection();
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
      <h1 className="text-xl sm:text-2xl font-bold mb-4">Add Games</h1>

      <GameSearchAdd
        heading="Search & Add"
        placeholder="Search by title..."
        markedLabel="Already in collection"
        markedGameIds={collectionGameIds}
        markedBggIds={collectionBggIds}
        onAdd={handleAdd}
        containerClassName="wt-card mb-6 p-6"
      />
    </div>
  );
}
