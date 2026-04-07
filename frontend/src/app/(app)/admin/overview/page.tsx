'use client';

import { useEffect, useState } from 'react';
import AdminAccessGate from '@/components/admin/AdminAccessGate';
import AdminPagination from '@/components/admin/AdminPagination';
import { adminApi } from '@/lib/admin/api';
import type {
  AdminActivityItem,
  AdminEventsSummary,
  AdminUsersSummary,
  PaginatedResponse,
} from '@/lib/types';

export default function AdminOverviewPage() {
  const [usersSummary, setUsersSummary] = useState<AdminUsersSummary | null>(null);
  const [eventsSummary, setEventsSummary] = useState<AdminEventsSummary | null>(null);
  const [activity, setActivity] = useState<PaginatedResponse<AdminActivityItem> | null>(
    null,
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const [users, events, timeline] = await Promise.all([
          adminApi.getUsersSummary(),
          adminApi.getEventsSummary(),
          adminApi.getUsersActivity(page),
        ]);
        setUsersSummary(users);
        setEventsSummary(events);
        setActivity(timeline);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  return (
    <AdminAccessGate>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Overview</h1>
          <p className="wt-muted text-sm">Operational dashboard and recent users activity</p>
        </div>

        {loading ? <p className="wt-muted">Loading...</p> : null}
        {error ? (
          <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Total users" value={usersSummary?.totalUsers ?? 0} />
              <MetricCard label="New users (7d)" value={usersSummary?.usersLast7d ?? 0} />
              <MetricCard label="Total events" value={eventsSummary?.totalEvents ?? 0} />
              <MetricCard label="Open events" value={eventsSummary?.openEvents ?? 0} />
            </section>

            <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
              <h2 className="text-lg font-semibold">Recent users activity</h2>
              <ul className="space-y-2">
                {(activity?.items || []).map((item) => (
                  <li key={item.id} className="rounded-md border border-[var(--border)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{item.title}</span>
                      <span className="wt-muted text-xs">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="wt-muted mt-1 text-sm">
                      {item.subtitle} | User ID: {item.userId}
                    </p>
                  </li>
                ))}
              </ul>
              <AdminPagination
                page={page}
                hasNext={!!activity?.meta?.hasNext}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
              />
            </section>
          </>
        ) : null}
      </div>
    </AdminAccessGate>
  );
}

function MetricCard({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--paper)] p-4">
      <p className="wt-muted text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
