'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { io, type Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import GameSearchAdd, {
  type GameSearchAddResult,
} from '@/components/GameSearchAdd';
import ShelfPhotoUpload from '@/components/ShelfPhotoUpload';
import ShelfDetectionOverlay from '@/components/ShelfDetectionOverlay';
import ShelfParseReview from '@/components/ShelfParseReview';
import { getRealtimeBaseUrl } from '@/lib/socketBaseUrl';
import type {
  Game,
  GameOwnership,
  ParseShelfPhotoJobResponse,
  ParseShelfPhotoResponse,
  ShelfParseCandidate,
  ShelfParseProgressPayload,
} from '@/lib/types';

export default function CollectionAddPage() {
  const [collection, setCollection] = useState<GameOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [shelfCandidates, setShelfCandidates] = useState<ShelfParseCandidate[]>([]);
  const [shelfImageUrl, setShelfImageUrl] = useState('');
  const [shelfAnnotatedSrc, setShelfAnnotatedSrc] = useState<string | null>(null);
  const shelfImageUrlRef = useRef('');

  const [shelfParsing, setShelfParsing] = useState(false);
  const [shelfParseProgress, setShelfParseProgress] = useState(0);
  const [shelfParseMessage, setShelfParseMessage] = useState('');
  const [shelfParseStage, setShelfParseStage] = useState<ShelfParseProgressPayload['stage']>('prepare');
  const [shelfParseDetail, setShelfParseDetail] = useState<
    ShelfParseProgressPayload['detail'] | null
  >(null);
  const [shelfParseError, setShelfParseError] = useState<string | null>(null);
  const [shelfParseDelayed, setShelfParseDelayed] = useState(false);

  useEffect(() => {
    shelfImageUrlRef.current = shelfImageUrl;
  }, [shelfImageUrl]);

  useEffect(() => {
    return () => {
      const url = shelfImageUrlRef.current;
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, []);

  const refreshCollection = async () => {
    const data = await api.get<GameOwnership[]>('/games/collection');
    setCollection(data);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    api
      .get<GameOwnership[]>('/games/collection')
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
    } else if (typeof result.bggId === 'number') {
      await api.post<{ game: Game }>('/bgg/import-one', { bggId: result.bggId });
    } else {
      return;
    }
    toast.success('Added to collection');
    await refreshCollection();
  };

  const handleShelfUpload = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const baseUrl = getRealtimeBaseUrl();
    const token = localStorage.getItem('accessToken');
    if (!token) {
      URL.revokeObjectURL(objectUrl);
      const message = 'Please sign in before scanning your shelf.';
      setShelfParseError(message);
      toast.error(message);
      return;
    }

    setShelfParseError(null);
    setShelfParsing(true);
    setShelfParseProgress(0);
    setShelfParseMessage('Uploading photo…');
    setShelfParseStage('prepare');
    setShelfParseDetail(null);
    setShelfParseDelayed(false);

    let socket: Socket | null = null;
    const cleanupSocket = () => {
      if (!socket) return;
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    };

    try {
      const formData = new FormData();
      formData.append('photo', file);
      const { jobId } = await api.postForm<ParseShelfPhotoJobResponse>(
        '/games/collection/parse-shelf-async',
        formData,
      );

      await new Promise<void>((resolve, reject) => {
        const longScanNoticeTimeoutId = window.setTimeout(() => {
          setShelfParseDelayed(true);
          setShelfParseMessage(
            'This scan is taking longer than expected. We are still processing your shelf.',
          );
        }, 90_000);
        let recoveryAttempted = false;

        socket = io(`${baseUrl}/shelf-parse`, {
          transports: ['websocket'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 1,
          reconnectionDelay: 1_000,
          timeout: 10_000,
        });

        const fail = (err: unknown) => {
          window.clearTimeout(longScanNoticeTimeoutId);
          cleanupSocket();
          reject(err instanceof Error ? err : new Error('Shelf parse failed'));
        };

        socket.io.on('reconnect_attempt', () => {
          setShelfParseMessage('Connection interrupted. Reconnecting to continue your scan…');
        });

        socket.io.on('reconnect_failed', () => {
          fail(new Error('Connection to shelf scan was interrupted. Please retry.'));
        });

        socket.on('connect_error', (err) => {
          if (socket?.active) {
            setShelfParseMessage('Trying to reconnect to your scan…');
            return;
          }
          fail(err);
        });

        socket.on('disconnect', (reason) => {
          if (reason === 'io client disconnect') return;
          if (reason === 'io server disconnect' && !recoveryAttempted) {
            recoveryAttempted = true;
            setShelfParseMessage('Rejoining your scan…');
            socket?.connect();
            return;
          }
          if (reason === 'io server disconnect') {
            fail(new Error('Lost connection to shelf scan. Please retry.'));
          }
        });

        socket.on('shelfParseProgress', (payload: ShelfParseProgressPayload) => {
          setShelfParseProgress(Math.max(0, Math.min(100, payload.percent ?? 0)));
          setShelfParseStage(payload.stage ?? 'prepare');
          setShelfParseMessage(payload.message);
          setShelfParseDetail(payload.detail ?? null);
        });

        socket.on('shelfParseComplete', (parsed: ParseShelfPhotoResponse) => {
          cleanupSocket();
          setShelfCandidates(parsed.candidates);
          setShelfAnnotatedSrc(parsed.annotatedImageBase64 ?? null);
          setShelfParseProgress(100);
          setShelfParseStage('finalize');
          setShelfParseMessage('Done');
          if (parsed.candidates.length === 0) {
            URL.revokeObjectURL(objectUrl);
            setShelfImageUrl((prev) => {
              if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
              return '';
            });
          } else {
            setShelfImageUrl((prev) => {
              if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
              return objectUrl;
            });
          }
          window.clearTimeout(longScanNoticeTimeoutId);
          resolve();
        });

        socket.on('shelfParseError', (payload: { message?: string }) => {
          fail(new Error(payload?.message || 'Shelf parse failed'));
        });

        const join = () => {
          socket?.emit('joinJob', { jobId });
        };
        socket.on('connect', join);
        if (socket.connected) join();
      });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      cleanupSocket();

      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not finish shelf scan. Please try again.';
      setShelfParseError(message);
      toast.error(message);
    } finally {
      cleanupSocket();
      setShelfParsing(false);
      setShelfParseStage('prepare');
      setShelfParseDetail(null);
      setShelfParseDelayed(false);
    }
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

  const sourcePassesDone = shelfParseDetail?.sourcesDone ?? 0;
  const sourcePassesTotal = shelfParseDetail?.sourcesTotal ?? 0;
  const matchDone = shelfParseDetail?.done ?? 0;
  const matchTotal = shelfParseDetail?.total ?? 0;
  const rawDetectionsSoFar =
    (shelfParseDetail?.geminiUpright ?? 0) +
    (shelfParseDetail?.geminiSpine ?? 0) +
    (shelfParseDetail?.claude ?? 0);

  const overlayPrimaryMessage = (() => {
    if (shelfParseStage === 'detect' && sourcePassesTotal > 0) {
      return `Looking for game boxes (${sourcePassesDone}/${sourcePassesTotal} passes)`;
    }
    if (shelfParseStage === 'merge' && shelfParseDetail?.mergedTitles != null) {
      const count = shelfParseDetail.mergedTitles;
      return `Found ${count} likely game title${count === 1 ? '' : 's'}`;
    }
    if (shelfParseStage === 'match' && matchTotal > 0) {
      return `Matching titles to games (${matchDone}/${matchTotal})`;
    }
    if (shelfParseStage === 'annotate') return 'Drawing clean outlines';
    if (shelfParseStage === 'finalize') return shelfCandidates.length > 0 ? `Scan complete — found ${shelfCandidates.length} game${shelfCandidates.length === 1 ? '' : 's'}` : 'Preparing your results';
    return shelfParseMessage || 'Scanning your shelf...';
  })();

  const overlaySecondaryMessage =
    shelfParseDelayed
      ? 'Large or crowded shelves can take a few minutes. You can keep this open while we finish.'
      : shelfParseStage === 'detect'
      ? 'Running multiple scan passes for better accuracy on crowded shelves.'
      : 'This usually takes 20-60 seconds for full shelves.';

  return (
    <div>
      {shelfParsing && (
        <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
          <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/20 bg-[#0f1b2d] p-6 text-white shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              Shelf Scan
            </p>
            <h3 className="mt-2 text-xl font-semibold leading-tight">{overlayPrimaryMessage}</h3>
            <p className="mt-2 text-sm text-white/75">{overlaySecondaryMessage}</p>

            {(sourcePassesTotal > 0 || matchTotal > 0) && (
              <div className="mt-4 space-y-2 rounded-lg border border-white/15 bg-white/5 p-3 text-sm text-white/80">
                {sourcePassesTotal > 0 && (
                  <p>
                    Scan passes: <span className="font-semibold text-white">{sourcePassesDone}/{sourcePassesTotal}</span>
                  </p>
                )}
                {shelfParseStage === 'detect' && rawDetectionsSoFar > 0 && (
                  <p className="text-sm text-white/80">
                    Raw detections: <span className="font-semibold text-white">{rawDetectionsSoFar}</span> (duplicates merged later)
                  </p>
                )}
                {matchTotal > 0 && (
                  <p>
                    Games matched: <span className="font-semibold text-white">{matchDone}/{matchTotal}</span>
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-200"
                style={{ width: `${Math.round(shelfParseProgress)}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs font-medium text-white/70">
              {Math.round(shelfParseProgress)}%
            </div>
          </div>
        </div>
      )}
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
      {shelfParseError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {shelfParseError}
        </p>
      ) : null}
      {shelfImageUrl && shelfCandidates.length > 0 && (
        <div className="space-y-4">
          <ShelfDetectionOverlay
            imageUrl={shelfImageUrl}
            annotatedSrc={shelfAnnotatedSrc}
            candidates={shelfCandidates}
          />
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
