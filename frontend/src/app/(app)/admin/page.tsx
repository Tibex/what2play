'use client';

import { useCallback, useEffect, useState } from 'react';
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-sm text-gray-500">Users and events overview</p>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'events'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Events
        </button>
      </div>

      {loading ? <p className="text-gray-500">Loading...</p> : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && activeTab === 'users' ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Subscription</th>
                </tr>
              </thead>
              <tbody>
                {(usersData?.items || []).map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.email}</td>
                    <td className="px-4 py-2">{item.role}</td>
                    <td className="px-4 py-2">{item.subscriptionTier}</td>
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
          <div className="rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Host</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {(eventsData?.items || []).map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-2">{item.title}</td>
                    <td className="px-4 py-2">{item.host?.name || item.hostId}</td>
                    <td className="px-4 py-2">{item.status}</td>
                    <td className="px-4 py-2">
                      {new Date(item.dateTime).toLocaleString()}
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
      <span className="text-sm text-gray-600">Page {page}</span>
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
