'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import AdminAccessGate from '@/components/admin/AdminAccessGate';
import AdminPagination from '@/components/admin/AdminPagination';
import { adminApi } from '@/lib/admin/api';
import type { AdminCatalogStats, AdminIncompleteCatalogEntry } from '@/lib/types';

export default function AdminCatalogPage() {
  const [catalogStats, setCatalogStats] = useState<AdminCatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [repairingCatalog, setRepairingCatalog] = useState(false);
  const [message, setMessage] = useState('');
  const [incompleteItems, setIncompleteItems] = useState<AdminIncompleteCatalogEntry[]>(
    [],
  );
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogHasNext, setCatalogHasNext] = useState(false);
  const [pendingDeleteGame, setPendingDeleteGame] =
    useState<AdminIncompleteCatalogEntry | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);

  const loadCatalogStats = useCallback(async () => {
    const data = await adminApi.getCatalogStats();
    setCatalogStats(data);
  }, []);

  const loadIncompleteCatalog = useCallback(async () => {
    const data = await adminApi.getIncompleteCatalog(catalogPage, 50);
    setIncompleteItems(data.items || []);
    setCatalogHasNext(!!data.meta?.hasNext);
  }, [catalogPage]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void (async () => {
      try {
        await loadCatalogStats();
        await loadIncompleteCatalog();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load catalog stats');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCatalogStats, loadIncompleteCatalog]);

  useEffect(() => {
    if (!catalogStats?.syncState.running) return;
    const interval = setInterval(() => {
      void loadCatalogStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [catalogStats?.syncState.running, loadCatalogStats]);

  return (
    <AdminAccessGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Catalog Operations</h1>
          <p className="wt-muted text-sm">BGG sync and metadata quality tools</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSyncingCatalog(true);
              setError('');
              setMessage('');
              void adminApi
                .syncCatalogTop500()
                .then((result) => {
                  if (result.status === 'queued') {
                    setMessage(
                      'Catalog sync started in background. Check sync status for progress.',
                    );
                  } else if (result.status === 'executed') {
                    setMessage(
                      `Catalog sync finished: imported ${result.imported ?? 0} games (fetched ${result.fetched ?? 0}).`,
                    );
                  } else {
                    setMessage(
                      `Catalog sync skipped: ${
                        result.reason === 'already_running'
                          ? 'a sync is already running'
                          : 'cooldown active'
                      }.`,
                    );
                  }
                })
                .then(() => Promise.all([loadCatalogStats(), loadIncompleteCatalog()]))
                .catch((err: unknown) => {
                  setError(
                    err instanceof Error ? err.message : 'Failed to trigger top catalog sync',
                  );
                })
                .finally(() => setSyncingCatalog(false));
            }}
            disabled={syncingCatalog}
            className="wt-btn rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {syncingCatalog ? 'Syncing BGG Top 500...' : 'Sync BGG Top 500'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRepairingCatalog(true);
              setError('');
              setMessage('');
              void adminApi
                .repairCatalogIncomplete()
                .then((result) =>
                  setMessage(
                    `Catalog repair finished: repaired ${result.repaired} of ${result.scanned} scanned incomplete games.`,
                  ),
                )
                .then(() => Promise.all([loadCatalogStats(), loadIncompleteCatalog()]))
                .catch((err: unknown) => {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Failed to trigger incomplete catalog repair',
                  );
                })
                .finally(() => setRepairingCatalog(false));
            }}
            disabled={repairingCatalog}
            className="wt-btn rounded border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {repairingCatalog ? 'Repairing Metadata...' : 'Repair Incomplete'}
          </button>
        </div>

        {loading ? <p className="wt-muted">Loading...</p> : null}
        {message ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3 text-sm">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {catalogStats ? (
          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3 text-sm">
            <div className="font-medium">Catalog quality</div>
            <div className="wt-muted">
              Total: {catalogStats.quality.total} | Missing rating:{' '}
              {catalogStats.quality.missingRating} | Missing weight:{' '}
              {catalogStats.quality.missingWeight} | Missing year:{' '}
              {catalogStats.quality.missingYear} | Missing poll:{' '}
              {catalogStats.quality.missingPoll} | Missing playtime:{' '}
              {catalogStats.quality.missingPlayingTime}
            </div>
            <div className="wt-muted">
              Last success:{' '}
              {catalogStats.syncState.lastSuccessAt
                ? new Date(catalogStats.syncState.lastSuccessAt).toLocaleString()
                : 'never'}
              {' | '}Last attempt:{' '}
              {catalogStats.syncState.lastAttemptAt
                ? new Date(catalogStats.syncState.lastAttemptAt).toLocaleString()
                : 'never'}
              {' | '}Status:{' '}
              {catalogStats.syncState.running
                ? 'running'
                : catalogStats.syncState.lastAttemptStatus || 'n/a'}
            </div>
          </div>
        ) : null}

        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Catalog entries (incomplete first)</h2>
            <button
              type="button"
              onClick={() => {
                setError('');
                void loadIncompleteCatalog().catch((err: unknown) => {
                  setError(
                    err instanceof Error
                      ? err.message
                      : 'Failed to load incomplete catalog entries',
                  );
                });
              }}
              className="wt-btn rounded border px-2 py-1 text-xs"
            >
              Refresh list
            </button>
          </div>
          <div className="wt-muted text-xs">All catalog games, incomplete entries first.</div>
          <div className="overflow-x-auto rounded border border-[var(--border)]">
            <table className="min-w-[860px] w-full table-fixed text-xs">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="w-[34%] px-2 py-1.5 text-left">Title</th>
                  <th className="w-[11%] px-2 py-1.5 text-left">BGG ID</th>
                  <th className="w-[9%] px-2 py-1.5 text-left">Year</th>
                  <th className="w-[10%] px-2 py-1.5 text-left">Time</th>
                  <th className="w-[10%] px-2 py-1.5 text-left">Rating</th>
                  <th className="w-[10%] px-2 py-1.5 text-left">Weight</th>
                  <th className="w-[6%] px-2 py-1.5 text-left">P?</th>
                  <th className="w-[10%] px-2 py-1.5 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {incompleteItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-t ${item.isIncomplete ? 'bg-[var(--surface)]/40' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <div className="truncate" title={item.title}>
                        {item.title}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">{item.bggId ?? '—'}</td>
                    <td className="px-2 py-1.5">{item.yearPublished ?? '—'}</td>
                    <td className="px-2 py-1.5">{item.playingTime ?? '—'}</td>
                    <td className="px-2 py-1.5">{item.bggRating ?? '—'}</td>
                    <td className="px-2 py-1.5">{item.weight ?? '—'}</td>
                    <td className="px-2 py-1.5">{item.missingPoll ? 'yes' : 'no'}</td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        disabled={deletingGameId === item.id}
                        onClick={() => setPendingDeleteGame(item)}
                        className="wt-btn rounded border border-[#ddb5ae] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-50"
                      >
                        {deletingGameId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!incompleteItems.length ? (
                  <tr>
                    <td className="px-3 py-3 wt-muted" colSpan={8}>
                      No incomplete games found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <AdminPagination
            page={catalogPage}
            hasNext={catalogHasNext}
            onPrev={() => setCatalogPage((p) => Math.max(1, p - 1))}
            onNext={() => setCatalogPage((p) => p + 1)}
          />
        </section>
      </div>
      <ConfirmModal
        isOpen={pendingDeleteGame !== null}
        title="Delete game?"
        message={
          pendingDeleteGame
            ? `Delete "${pendingDeleteGame.title}" from catalog? This is permanent.`
            : ''
        }
        confirmLabel="Delete game"
        isConfirming={
          pendingDeleteGame ? deletingGameId === pendingDeleteGame.id : false
        }
        onCancel={() => setPendingDeleteGame(null)}
        onConfirm={() => {
          if (!pendingDeleteGame) return;
          setDeletingGameId(pendingDeleteGame.id);
          setError('');
          void adminApi
            .deleteGame(pendingDeleteGame.id)
            .then(() => Promise.all([loadCatalogStats(), loadIncompleteCatalog()]))
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Failed to delete game');
            })
            .finally(() => {
              setDeletingGameId(null);
              setPendingDeleteGame(null);
            });
        }}
      />
    </AdminAccessGate>
  );
}
