'use client';

import { useState } from 'react';
import Link from 'next/link';
import GameCard from '@/components/GameCard';
import {
  getDemoRecommendations,
  type DemoComplexity,
  type DemoDuration,
} from '@/lib/landing-demo-recommendations';

const DURATION_OPTIONS: { value: DemoDuration; label: string }[] = [
  { value: 'short', label: 'Up to 45 min' },
  { value: 'medium', label: '45–90 min' },
  { value: 'long', label: '90+ min' },
];

const COMPLEXITY_OPTIONS: { value: DemoComplexity; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
];

export function GuestRecommendationDemo() {
  const [players, setPlayers] = useState(4);
  const [complexity, setComplexity] = useState<DemoComplexity>('medium');
  const [duration, setDuration] = useState<DemoDuration>('medium');
  const [results, setResults] = useState<ReturnType<typeof getDemoRecommendations> | null>(null);

  const runDemo = () => {
    setResults(getDemoRecommendations(players, complexity, duration));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="wt-card p-6 sm:p-8 space-y-6">
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <label htmlFor="demo-players" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Players
            </label>
            <input
              id="demo-players"
              type="number"
              min={2}
              max={12}
              value={players}
              onChange={(e) => setPlayers(Math.min(12, Math.max(2, Number(e.target.value) || 2)))}
              className="wt-input"
            />
          </div>
          <div>
            <label htmlFor="demo-complexity" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Complexity
            </label>
            <select
              id="demo-complexity"
              value={complexity}
              onChange={(e) => setComplexity(e.target.value as DemoComplexity)}
              className="wt-input"
            >
              {COMPLEXITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label htmlFor="demo-duration" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              Duration
            </label>
            <select
              id="demo-duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value as DemoDuration)}
              className="wt-input"
            >
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" onClick={runDemo} className="wt-btn wt-btn-primary w-full sm:w-auto px-6 py-2.5 font-semibold">
          Get sample recommendations
        </button>

        {results && (
          <div className="pt-2 border-t border-[var(--border)] space-y-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">Illustrative picks</p>
            <ul className="space-y-3 list-none p-0 m-0">
              {results.map((row) => (
                <li key={row.game.id}>
                  <GameCard
                    game={row.game}
                    explanation={row.explanation}
                    showScore={row.score}
                    bggUrl={row.game.bggId ? `https://boardgamegeek.com/boardgame/${row.game.bggId}` : undefined}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-soft)]/80 p-4 sm:p-5">
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                These picks are <strong>illustrative</strong> for your constraints.{' '}
                <strong>Sign up</strong> to get recommendations from your group&apos;s libraries, RSVP-aware weighting, voting, and
                feedback that improves the next night.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/register" className="wt-btn wt-btn-primary px-4 py-2 text-sm font-semibold no-underline text-white">
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="wt-btn wt-btn-secondary px-4 py-2 text-sm font-semibold no-underline text-[var(--foreground)]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
