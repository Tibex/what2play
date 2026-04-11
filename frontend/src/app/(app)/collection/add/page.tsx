'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import GameSearchAdd, {
  type GameSearchAddResult,
} from '@/components/GameSearchAdd';
import ShelfPhotoUpload from '@/components/ShelfPhotoUpload';
import ShelfParseReview from '@/components/ShelfParseReview';
import ShelfDetectionOverlay from '@/components/ShelfDetectionOverlay';
import type {
  Game,
  GameOwnership,
  ParseShelfPhotoResponse,
  ShelfParseCandidate,
} from '@/lib/types';

export default function CollectionAddPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [shelfCandidates, setShelfCandidates] = useState<ShelfParseCandidate[]>([]);
  const [shelfImageUrl, setShelfImageUrl] = useState('');

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

  const handleShelfUpload = async (file: File, previewUrl: string) => {
    const formData = new FormData();
    formData.append('photo', file);
    const parsed = await api.postForm<ParseShelfPhotoResponse>(
      '/games/collection/parse-shelf',
      formData,
    );
    setShelfCandidates(parsed.candidates);
    setShelfImageUrl(previewUrl);
  };

  const handleShelfConfirm = async (selected: ShelfParseCandidate[]) => {
    const payload = {
      items: selected.map((candidate) => ({
        gameId: candidate.gameId,
        bggId: candidate.bggId,
        title: candidate.title,
      })),
    };
    const result = await api.post<{ addedGameIds: string[] }>('/games/collection/batch-add', payload);
    await api.post('/bgg/collection/sync-selected', {
      items: payload.items.map((item) => ({ gameId: item.gameId, bggId: item.bggId })),
    });
    toast.success(`Added ${result.addedGameIds.length} game(s)`);
    await refreshCollection();
  };

  const exportSelected = async (selected: ShelfParseCandidate[], format: 'csv' | 'xml') => {
    const gameIds = selected.map((candidate) => candidate.gameId).filter(Boolean).join(',');
    if (!gameIds) return;
    const blob = await api.download(`/bgg/collection/export.${format}?gameIds=${encodeURIComponent(gameIds)}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bgg-export.${format}`;
    link.click();
    URL.revokeObjectURL(url);
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
      <ShelfPhotoUpload onUpload={handleShelfUpload} />
      {shelfImageUrl && shelfCandidates.length > 0 && (
        <div className="space-y-4">
          <ShelfDetectionOverlay imageUrl={shelfImageUrl} candidates={shelfCandidates} />
          <ShelfParseReview
            candidates={shelfCandidates}
            onConfirm={handleShelfConfirm}
            onExportCsv={(selected) => exportSelected(selected, 'csv')}
            onExportXml={(selected) => exportSelected(selected, 'xml')}
          />
        </div>
      )}
    </div>
  );
}
