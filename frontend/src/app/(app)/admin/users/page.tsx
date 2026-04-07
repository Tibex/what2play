'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';
import AdminAccessGate from '@/components/admin/AdminAccessGate';
import AdminPagination from '@/components/admin/AdminPagination';
import { adminApi } from '@/lib/admin/api';
import { useAuthStore } from '@/lib/store';
import type { PaginatedResponse, User } from '@/lib/types';

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [usersData, setUsersData] = useState<PaginatedResponse<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    const data = await adminApi.getUsers(page, search);
    setUsersData(data);
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void (async () => {
      try {
        await loadUsers();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadUsers]);

  return (
    <AdminAccessGate>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Users</h1>
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search name or email"
            className="w-full sm:w-72 rounded-md border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-sm"
          />
        </div>
        {loading ? <p className="wt-muted">Loading...</p> : null}
        {error ? (
          <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--paper)]">
              <table className="min-w-[860px] w-full table-fixed text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="w-[24%] px-4 py-2 text-left">Name</th>
                    <th className="w-[34%] px-4 py-2 text-left">Email</th>
                    <th className="w-[12%] px-4 py-2 text-left">Role</th>
                    <th className="w-[15%] px-4 py-2 text-left">Subscription</th>
                    <th className="w-[15%] px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersData?.items || []).map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2">
                        <div className="truncate" title={item.name}>
                          {item.name}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate" title={item.email}>
                          {item.email}
                        </div>
                      </td>
                      <td className="px-4 py-2">{item.role}</td>
                      <td className="px-4 py-2">{item.subscriptionTier}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          disabled={deletingUserId === item.id || item.id === user?.id}
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
            <AdminPagination
              page={page}
              hasNext={!!usersData?.meta?.hasNext}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}
      </div>
      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete user?"
        message={
          pendingDelete
            ? `Delete user "${pendingDelete.name || pendingDelete.email}"? This also deletes events hosted by this user.`
            : ''
        }
        confirmLabel="Delete user"
        isConfirming={pendingDelete ? deletingUserId === pendingDelete.id : false}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          setDeletingUserId(pendingDelete.id);
          setError('');
          void adminApi
            .deleteUser(pendingDelete.id)
            .then(() => loadUsers())
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Failed to delete user');
            })
            .finally(() => {
              setDeletingUserId(null);
              setPendingDelete(null);
            });
        }}
      />
    </AdminAccessGate>
  );
}
