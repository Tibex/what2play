'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { GameEvent, PaginatedResponse, User } from '@/lib/types';

type AdminTab = 'users' | 'events';

export default function AdminPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usersData, setUsersData] = useState<PaginatedResponse<User> | null>(null);
  const [eventsData, setEventsData] = useState<PaginatedResponse<GameEvent> | null>(
    null,
  );
  const [usersPage, setUsersPage] = useState(1);
  const [eventsPage, setEventsPage] = useState(1);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [pendingUserDelete, setPendingUserDelete] = useState<User | null>(null);
  const [pendingEventDelete, setPendingEventDelete] = useState<GameEvent | null>(null);

  const loadUsers = useCallback(async () => {
    const data = await api.get<PaginatedResponse<User>>(
      `/users?page=${usersPage}&pageSize=20`,
    );
    setUsersData(data);
  }, [usersPage]);

  const loadEvents = useCallback(async () => {
    const data = await api.get<PaginatedResponse<GameEvent>>(
      `/events/admin/all?page=${eventsPage}&pageSize=20`,
    );
    setEventsData(data);
  }, [eventsPage]);

  const deleteUser = useCallback(
    async (targetUser: User) => {
      setDeletingUserId(targetUser.id);
      setError('');
      try {
        await api.delete(`/users/${targetUser.id}`);
        await Promise.all([loadUsers(), loadEvents()]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete user');
      } finally {
        setDeletingUserId(null);
      }
    },
    [loadEvents, loadUsers],
  );

  const deleteEvent = useCallback(
    async (event: GameEvent) => {
      setDeletingEventId(event.id);
      setError('');
      try {
        await api.delete(`/events/admin/${event.id}`);
        await loadEvents();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete event');
      } finally {
        setDeletingEventId(null);
      }
    },
    [loadEvents],
  );

  useEffect(() => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        await Promise.all([loadUsers(), loadEvents()]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadEvents, loadUsers, user?.role]);

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-4 text-[var(--danger)]">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="wt-muted text-sm">Users and events overview</p>
      </div>

      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'users'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'events'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Events
        </button>
      </div>

      {loading ? <p className="wt-muted">Loading...</p> : null}
      {error ? (
        <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'users' ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Subscription</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(usersData?.items || []).map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.email}</td>
                    <td className="px-4 py-2">{item.role}</td>
                    <td className="px-4 py-2">{item.subscriptionTier}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPendingUserDelete(item)}
                        disabled={deletingUserId === item.id || item.id === user.id}
                        className="wt-btn rounded border border-[#ddb5ae] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-50"
                      >
                        {deletingUserId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={usersPage}
            hasNext={!!usersData?.meta?.hasNext}
            onPrev={() => setUsersPage((p) => Math.max(1, p - 1))}
            onNext={() => setUsersPage((p) => p + 1)}
          />
        </section>
      ) : null}

      {!loading && !error && activeTab === 'events' ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Host</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
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
                    <td className="px-4 py-2">
                      {new Date(item.dateTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPendingEventDelete(item)}
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
          <Pagination
            page={eventsPage}
            hasNext={!!eventsData?.meta?.hasNext}
            onPrev={() => setEventsPage((p) => Math.max(1, p - 1))}
            onNext={() => setEventsPage((p) => p + 1)}
          />
        </section>
      ) : null}

      <ConfirmModal
        isOpen={pendingUserDelete !== null}
        title="Delete user?"
        message={
          pendingUserDelete
            ? `Delete user "${pendingUserDelete.name || pendingUserDelete.email}"? This also deletes events hosted by this user.`
            : ''
        }
        confirmLabel="Delete user"
        isConfirming={pendingUserDelete ? deletingUserId === pendingUserDelete.id : false}
        onCancel={() => setPendingUserDelete(null)}
        onConfirm={() => {
          if (!pendingUserDelete) return;
          void deleteUser(pendingUserDelete).finally(() => {
            setPendingUserDelete(null);
          });
        }}
      />

      <ConfirmModal
        isOpen={pendingEventDelete !== null}
        title="Delete event?"
        message={
          pendingEventDelete
            ? `Delete event "${pendingEventDelete.title}" scheduled for ${new Date(pendingEventDelete.dateTime).toLocaleString()}?`
            : ''
        }
        confirmLabel="Delete event"
        isConfirming={pendingEventDelete ? deletingEventId === pendingEventDelete.id : false}
        onCancel={() => setPendingEventDelete(null)}
        onConfirm={() => {
          if (!pendingEventDelete) return;
          void deleteEvent(pendingEventDelete).finally(() => {
            setPendingEventDelete(null);
          });
        }}
      />
    </div>
  );
}

function Pagination({
  page,
  hasNext,
  onPrev,
  onNext,
}: Readonly<{
  page: number;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}>) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Prev
      </button>
      <span className="wt-muted text-sm">Page {page}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="rounded border px-3 py-1 text-sm disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
