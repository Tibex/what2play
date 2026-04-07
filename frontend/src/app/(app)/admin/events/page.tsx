'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import AdminAccessGate from '@/components/admin/AdminAccessGate';
import AdminPagination from '@/components/admin/AdminPagination';
import { adminApi } from '@/lib/admin/api';
import type { GameEvent, PaginatedResponse } from '@/lib/types';

export default function AdminEventsPage() {
  const [eventsData, setEventsData] = useState<PaginatedResponse<GameEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<GameEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    const data = await adminApi.getEvents(page);
    setEventsData(data);
  }, [page]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void (async () => {
      try {
        await loadEvents();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadEvents]);

  return (
    <AdminAccessGate>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Events</h1>
        </div>
        {loading ? <p className="wt-muted">Loading...</p> : null}
        {error ? (
          <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Host</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Created</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(eventsData?.items || []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">
                        <div className="max-w-[11rem] sm:max-w-[16rem] truncate" title={item.title}>
                          {item.title}
                        </div>
                      </td>
                      <td className="px-4 py-2">{item.host?.name || item.hostId}</td>
                      <td className="px-4 py-2">{item.status}</td>
                      <td className="px-4 py-2">{item.type}</td>
                      <td className="px-4 py-2">
                        {item.dateTime ? new Date(item.dateTime).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          disabled={deletingEventId === item.id}
                          className="wt-btn rounded border border-[#ddb5ae] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-50"
                        >
                          {deletingEventId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={page}
              hasNext={!!eventsData?.meta?.hasNext}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}
      </div>
      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete event?"
        message={
          pendingDelete
            ? `Delete event "${pendingDelete.title}"${
                pendingDelete.dateTime
                  ? ` scheduled for ${new Date(pendingDelete.dateTime).toLocaleString()}`
                  : ''
              }?`
            : ''
        }
        confirmLabel="Delete event"
        isConfirming={pendingDelete ? deletingEventId === pendingDelete.id : false}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          setDeletingEventId(pendingDelete.id);
          setError('');
          void adminApi
            .deleteEvent(pendingDelete.id)
            .then(() => loadEvents())
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Failed to delete event');
            })
            .finally(() => {
              setDeletingEventId(null);
              setPendingDelete(null);
            });
        }}
      />
    </AdminAccessGate>
  );
}
