'use client';

import { useEffect, useState } from 'react';
import GameCard from '@/components/GameCard';
import { api } from '@/lib/api';
import { type DemoComplexity, type DemoDuration } from '@/lib/landing-demo-recommendations';
import { useLoginModalStore } from '@/lib/login-modal-store';
import { useRegisterModalStore } from '@/lib/register-modal-store';
import type { Game } from '@/lib/types';

const DURATION_OPTIONS: { value: DemoDuration; label: string }[] = [
  { value: 'short', label: 'Up to 60 min' },
  { value: 'medium', label: '60–120 min' },
  { value: 'long', label: '120+ min' },
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
  const [results, setResults] = useState<
    Array<{ game: Game; explanation: Record<string, string>; score: number }> | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const openLoginModal = useLoginModalStore((s) => s.open);
  const openRegisterModal = useRegisterModalStore((s) => s.open);

  useEffect(() => {
    if (!loading) return;
    const stageTimer = globalThis.setInterval(() => {
      setLoadingStage((prev) => Math.min(prev + 1, 2));
    }, 1100);
    const progressTimer = globalThis.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 89) return prev;
        if (prev < 30) return Math.min(89, prev + 3);
        if (prev < 60) return Math.min(89, prev + 1.8);
        return Math.min(89, prev + 0.8);
      });
    }, 180);

    return () => {
      globalThis.clearInterval(stageTimer);
      globalThis.clearInterval(progressTimer);
    };
  }, [loading]);

  const runDemo = async () => {
    setLoading(true);
    setLoadingProgress(0);
    setLoadingStage(0);
    setResults(null);
    setUnavailableMessage('');
    const startedAt = Date.now();
    try {
      const live = await api.get<
        Array<{ game: Game; explanation: Record<string, string>; score: number }>
      >(
        `/recommendations/demo?players=${players}&complexity=${complexity}&duration=${duration}`,
        { auth: false, showErrorToast: false },
      );
      const elapsed = Date.now() - startedAt;
      const minVisibleLoading = 1400;
      if (elapsed < minVisibleLoading) {
        await new Promise((resolve) => setTimeout(resolve, minVisibleLoading - elapsed));
      }
      setLoadingProgress(97);
      if (live.length === 0) {
        setResults(null);
        setUnavailableMessage(
          'Recommendation demo is temporarily unavailable. Please try again in a moment.',
        );
      } else {
        setResults(live);
      }
    } catch {
      setResults(null);
      setUnavailableMessage(
        'We could not reach the recommendation engine. Please try again shortly.',
      );
    } finally {
      setLoadingProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 150));
      setLoading(false);
      setLoadingProgress(0);
      setLoadingStage(0);
    }
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
              min={1}
              max={12}
              value={players}
              onChange={(e) => setPlayers(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
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
        <button type="button" onClick={() => void runDemo()} className="wt-btn wt-btn-primary w-full sm:w-auto px-6 py-2.5 font-semibold" disabled={loading}>
          {loading ? 'Generating recommendations...' : 'Get sample recommendations'}
        </button>
        {unavailableMessage ? (
          <div className="rounded-xl border border-[#ddb5ae] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
            {unavailableMessage}
          </div>
        ) : null}

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
                <strong>Sign up</strong>{' '}to get recommendations from your group&apos;s libraries, RSVP-aware weighting, voting, and
                feedback that improves the next night.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openRegisterModal}
                  className="wt-btn wt-btn-primary px-4 py-2 text-sm font-semibold no-underline text-white"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="wt-btn wt-btn-secondary px-4 py-2 text-sm font-semibold no-underline text-[var(--foreground)]"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {loading ? (
        <div className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-sm">
          <div className="mx-auto mt-24 max-w-md rounded-2xl border border-white/20 bg-[#0f1b2d] p-6 text-white shadow-2xl">
            <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">
              Recommendation Engine
            </div>
            <h3 className="text-lg font-semibold">
              {[
                'Collecting your constraints...',
                'Scoring the best fits...',
                'Ranking top recommendations...',
              ][loadingStage]}
            </h3>
            <p className="mt-2 text-sm text-white/75">
              Finding the best sample games for your settings.
            </p>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-200"
                style={{ width: `${Math.round(loadingProgress)}%` }}
              />
            </div>
            <div className="mt-2 text-right text-xs text-white/70">
              {Math.round(loadingProgress)}%
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
