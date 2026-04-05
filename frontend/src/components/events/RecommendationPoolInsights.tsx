'use client';

import { useMemo, useState } from 'react';
import type { RecommendationPoolStats } from '@/lib/types';

const SLICE_COLORS = [
  '#4a7b90',
  '#b88733',
  '#6a8f5c',
  '#8f5b7a',
  '#b35f43',
  '#5f7cb3',
  '#6b6f8f',
  '#3f8a77',
];

type RecommendationPoolInsightsProps = {
  stats: RecommendationPoolStats | null;
  loading: boolean;
  embedded?: boolean;
};

export default function RecommendationPoolInsights({
  stats,
  loading,
  embedded = false,
}: RecommendationPoolInsightsProps) {
  const [expanded, setExpanded] = useState(false);
  const shares = useMemo(() => stats?.attendeeShares ?? [], [stats]);
  const chartBackground = useMemo(() => {
    if (!shares.length) return null;

    const reduced = shares.reduce(
      (acc, share, idx) => {
        const end = Math.min(100, acc.running + share.weightedSharePercent);
        const color = SLICE_COLORS[idx % SLICE_COLORS.length];
        return {
          running: end,
          slices: [
            ...acc.slices,
            `${color} ${acc.running.toFixed(2)}% ${end.toFixed(2)}%`,
          ],
        };
      },
      { running: 0, slices: [] as string[] },
    );
    if (reduced.running <= 0) return null;

    const slices =
      reduced.running < 100
        ? [...reduced.slices, `#e8ebf0 ${reduced.running.toFixed(2)}% 100%`]
        : reduced.slices;

    if (!slices.length) return null;
    return `conic-gradient(${slices.join(', ')})`;
  }, [shares]);

  return (
    <div
      className={
        embedded ? 'mt-4 border-t border-[var(--border)] pt-4' : 'wt-card mb-4 p-4 sm:mb-6 sm:p-5'
      }
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="wt-btn wt-btn-secondary flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-[var(--primary)]"
      >
        <span>Recommendation pool</span>
        <span className="flex items-center gap-2">
          <span className="wt-chip px-2 py-0.5 text-xs">
            {stats?.uniquePoolGames ?? 0} shared
          </span>
          <span aria-hidden>{expanded ? '▾' : '▸'}</span>
        </span>
      </button>

      {expanded &&
        (loading && !stats ? (
          <p className="wt-muted mt-3 text-sm">Loading pool data...</p>
        ) : !stats || stats.uniquePoolGames === 0 ? (
          <p className="wt-muted mt-3 text-sm">
            No shared collection games from current going attendees yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative mx-auto h-40 w-40 shrink-0">
              <div
                className="h-40 w-40 rounded-full border border-[var(--border)]"
                style={{ background: chartBackground ?? '#e8ebf0' }}
                aria-label="Recommendation pool attendee contribution pie chart"
              />
              <div className="absolute inset-0 m-auto flex h-24 w-24 items-center justify-center rounded-full bg-[var(--paper)] border border-[var(--border)]">
                <span className="text-center text-xs font-semibold text-[var(--primary)]">
                  {stats.uniquePoolGames}
                  <br />
                  games
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              {shares.map((share, idx) => (
                <div
                  key={share.userId}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          SLICE_COLORS[idx % SLICE_COLORS.length],
                      }}
                    />
                    <span className="truncate font-medium text-[var(--foreground)]">
                      {share.name}
                    </span>
                  </div>
                  <span className="wt-muted shrink-0">
                    {share.weightedSharePercent.toFixed(1)}% ·{' '}
                    {share.ownedPoolGames} owned
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
