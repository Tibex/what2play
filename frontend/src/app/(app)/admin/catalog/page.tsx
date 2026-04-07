'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminAccessGate from '@/components/admin/AdminAccessGate';
import { adminApi } from '@/lib/admin/api';
import type { AdminCatalogStats } from '@/lib/types';

export default function AdminCatalogPage() {
  const [catalogStats, setCatalogStats] = useState<AdminCatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [repairingCatalog, setRepairingCatalog] = useState(false);
  const [message, setMessage] = useState('');

  const loadCatalogStats = useCallback(async () => {
    const data = await adminApi.getCatalogStats();
    setCatalogStats(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    void (async () => {
      try {
        await loadCatalogStats();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load catalog stats');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCatalogStats]);

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
                .then(() => loadCatalogStats())
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
                .then(() => loadCatalogStats())
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
      </div>
    </AdminAccessGate>
  );
}
