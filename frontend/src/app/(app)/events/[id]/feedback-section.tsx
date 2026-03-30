'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { buildPlayedGamesPayload, type PlayedGameInputRow } from '@/lib/feedback';
import { toDateTimeLocalInTimeZone } from '@/lib/datetime';
import type {
  EventFeedback,
  EventFeedbackAnalytics,
  FeedbackStatus,
  Game,
} from '@/lib/types';

type FeedbackSectionProps = {
  eventId: string;
  feedbackStatus: FeedbackStatus | null;
  onSubmitted: () => void;
  games: Game[];
  isHost: boolean;
  isGoingAttendee: boolean;
  eventDateTime: string;
  eventTimezone: string;
  eventDurationMinutes?: number;
};

const DEFAULT_DURATION_MINUTES = 180;

function durationFeelLabel(value: string | null): string {
  if (!value) return '—';
  if (value === 'too_short') return 'Too short';
  if (value === 'too_long') return 'Too long';
  if (value === 'just_right') return 'Just right';
  return value;
}

type PlayedGamesEditorProps = {
  games: Game[];
  playedRows: PlayedGameInputRow[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<PlayedGameInputRow>) => void;
  onRemove: (idx: number) => void;
};

function PlayedGamesEditor({
  games,
  playedRows,
  onAdd,
  onUpdate,
  onRemove,
}: PlayedGamesEditorProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Played games</span>
        <button
          type="button"
          onClick={onAdd}
          className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded hover:bg-indigo-200"
        >
          + Add played game
        </button>
      </div>
      {playedRows.length === 0 ? (
        <p className="text-xs text-gray-500">
          No played games added. You can still submit quick feedback.
        </p>
      ) : (
        <div className="space-y-3">
          {playedRows.map((row, idx) => (
            <div
              key={`${idx}-${row.gameId}`}
              className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
            >
              <div className="flex gap-2 items-center">
                <select
                  value={row.gameId}
                  onChange={(e) => onUpdate(idx, { gameId: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">Select game</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={row.enjoymentRating}
                  onChange={(e) =>
                    onUpdate(idx, { enjoymentRating: Number(e.target.value) })
                  }
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Rating: {n}/5
                    </option>
                  ))}
                </select>
                <select
                  value={row.durationFeel}
                  onChange={(e) => onUpdate(idx, { durationFeel: e.target.value })}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="too_short">Too short</option>
                  <option value="just_right">Just right</option>
                  <option value="too_long">Too long</option>
                </select>
                <label className="flex items-center gap-2 text-sm px-2">
                  <input
                    type="checkbox"
                    checked={row.finishedGame}
                    onChange={(e) => onUpdate(idx, { finishedGame: e.target.checked })}
                  />
                  Finished
                </label>
              </div>
              <textarea
                value={row.notes}
                onChange={(e) => onUpdate(idx, { notes: e.target.value })}
                rows={2}
                placeholder="Notes (optional)"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type FeedbackAnalyticsProps = {
  analytics: EventFeedbackAnalytics | null;
  loadingAnalytics: boolean;
};

function FeedbackAnalytics({ analytics, loadingAnalytics }: FeedbackAnalyticsProps) {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-indigo-800 mb-2">Recommendation outcomes</h4>
      {loadingAnalytics || !analytics ? (
        <p className="text-sm text-indigo-700">Loading analytics...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-indigo-700">Winner played rate</div>
            <div className="text-xl font-bold text-indigo-900">
              {analytics.winnerPlayedRate != null
                ? `${Math.round(analytics.winnerPlayedRate * 100)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-indigo-700">Recommended / played</div>
            <div className="text-xl font-bold text-indigo-900">
              {analytics.recommendedGames.length} / {analytics.playedGames.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-indigo-700">Feedback entries</div>
            <div className="text-xl font-bold text-indigo-900">
              {analytics.totalFeedbackEntries}
            </div>
          </div>
          <div>
            <div className="text-xs text-indigo-700">Unique players</div>
            <div className="text-xl font-bold text-indigo-900">{analytics.totalUniquePlayers}</div>
          </div>
        </div>
      )}
    </div>
  );
}

type FeedbackEntriesListProps = {
  feedbackEntries: EventFeedback[];
  games: Game[];
  loadingEntries: boolean;
};

function FeedbackEntriesList({ feedbackEntries, games, loadingEntries }: FeedbackEntriesListProps) {
  const noteTextCount = feedbackEntries.filter((f) => (f.notes ?? '').trim()).length;
  const avgEnjoyment =
    feedbackEntries.length > 0
      ? feedbackEntries.reduce((sum, f) => sum + Number(f.enjoymentRating), 0) /
        feedbackEntries.length
      : null;
  const completionRate =
    feedbackEntries.length > 0
      ? feedbackEntries.filter((f) => f.finishedGame).length / feedbackEntries.length
      : null;
  const topDurationFeel = (() => {
    const counts = new Map<string, number>();
    for (const f of feedbackEntries) {
      const key = (f.durationFeel ?? '').trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best: { key: string; count: number } | null = null;
    for (const [key, count] of counts.entries()) {
      if (!best || count > best.count) best = { key, count };
    }
    return best?.key ?? null;
  })();

  if (loadingEntries) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (feedbackEntries.length === 0) {
    return <p className="text-center text-gray-500 py-6">No feedback entries yet.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <div className="text-xs text-indigo-700 font-medium">Avg rating</div>
          <div className="text-2xl font-bold text-indigo-900">
            {avgEnjoyment != null ? avgEnjoyment.toFixed(1) : '—'}/5
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <div className="text-xs text-indigo-700 font-medium">Completion rate</div>
          <div className="text-2xl font-bold text-indigo-900">
            {completionRate != null ? `${Math.round(completionRate * 100)}%` : '—'}
          </div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <div className="text-xs text-indigo-700 font-medium">Top duration feel</div>
          <div className="text-lg font-bold text-indigo-900">{durationFeelLabel(topDurationFeel)}</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <div className="text-xs text-indigo-700 font-medium">Feedback entries / notes</div>
          <div className="text-2xl font-bold text-indigo-900">
            {feedbackEntries.length} / {noteTextCount}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {feedbackEntries.map((f) => {
          const note = (f.notes ?? '').trim();
          const gameForDisplay = f.game ?? games.find((g) => g.id === f.gameId);
          const bggUrl =
            gameForDisplay?.bggId != null
              ? `https://boardgamegeek.com/boardgame/${gameForDisplay.bggId}`
              : undefined;

          return (
            <div key={f.id} className="flex gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3">
              {gameForDisplay?.thumbnailUrl ? (
                <img
                  src={gameForDisplay.thumbnailUrl}
                  alt={gameForDisplay.title}
                  className="w-14 h-14 object-cover rounded shrink-0"
                />
              ) : null}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {f.user?.name || 'Guest'}
                    </div>
                    {gameForDisplay?.title ? (
                      bggUrl ? (
                        <a
                          href={bggUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-700 hover:underline truncate block mt-0.5"
                        >
                          {gameForDisplay.title}
                        </a>
                      ) : (
                        <div className="text-xs text-gray-600 truncate block mt-0.5">
                          {gameForDisplay.title}
                        </div>
                      )
                    ) : (
                      <div className="text-xs text-gray-500 truncate block mt-0.5">
                        General feedback
                      </div>
                    )}
                  </div>

                  <span className="shrink-0 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-lg">
                    {f.enjoymentRating}/5
                  </span>
                </div>

                <div className="text-xs text-gray-600 mt-1">
                  {f.finishedGame ? 'Finished game' : 'Did not finish'}
                  {f.durationFeel ? ` · ${durationFeelLabel(f.durationFeel)}` : ''}
                </div>

                <div className="text-sm text-gray-800 mt-2">
                  {note ? note : <span className="text-gray-400">No comments</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type FeedbackFormProps = {
  eventId: string;
  canSubmit: boolean;
  games: Game[];
  onSubmitted: () => void;
  eventDateTime: string;
  eventTimezone: string;
  eventDurationMinutes?: number;
};

function FeedbackForm({
  eventId,
  canSubmit,
  games,
  onSubmitted,
  eventDateTime,
  eventTimezone,
  eventDurationMinutes,
}: FeedbackFormProps) {
  const [enjoyment, setEnjoyment] = useState(3);
  const [finished, setFinished] = useState(true);
  const [durationFeel, setDurationFeel] = useState('just_right');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [playedRows, setPlayedRows] = useState<PlayedGameInputRow[]>([]);

  const fallbackStartLocal = useMemo(
    () => toDateTimeLocalInTimeZone(eventDateTime, eventTimezone),
    [eventDateTime, eventTimezone],
  );
  const [nightStartedTime, setNightStartedTime] = useState(
    fallbackStartLocal.slice(11, 16),
  );
  const [nightDurationHours, setNightDurationHours] = useState(
    Math.max(1, Math.round((eventDurationMinutes ?? DEFAULT_DURATION_MINUTES) / 60)),
  );

  const addPlayedRow = () =>
    setPlayedRows((prev) => [
      ...prev,
      {
        gameId: '',
        enjoymentRating: 3,
        finishedGame: true,
        durationFeel: 'just_right',
        notes: '',
      },
    ]);
  const updatePlayedRow = (idx: number, patch: Partial<PlayedGameInputRow>) =>
    setPlayedRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removePlayedRow = (idx: number) =>
    setPlayedRows((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const sanitizedRows = buildPlayedGamesPayload(playedRows);
      await api.post(`/events/${eventId}/feedback`, {
        enjoymentRating: enjoyment,
        finishedGame: finished,
        durationFeel,
        notes: notes.trim() || undefined,
        gameId: undefined,
        playedGames: sanitizedRows,
      });
      toast.success('Feedback submitted');
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h3 className="font-semibold text-lg">Quick feedback</h3>
      </div>

      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Enjoyment (1-5)</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEnjoyment(n)}
              className={`w-10 h-10 rounded-full text-lg font-bold transition ${
                enjoyment >= n ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={finished}
          onChange={(e) => setFinished(e.target.checked)}
          className="rounded border-gray-300 text-indigo-600"
        />
        We finished at least one game
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="feedback-night-started" className="block text-sm font-medium text-gray-700 mb-1">Night started</label>
          <input
            id="feedback-night-started"
            type="time"
            value={nightStartedTime}
            onChange={(e) => setNightStartedTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="feedback-night-duration" className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
          <select
            id="feedback-night-duration"
            value={nightDurationHours}
            onChange={(e) => setNightDurationHours(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hour{hours > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="feedback-duration-feel" className="block text-sm font-medium text-gray-700 mb-1">How did the duration feel?</label>
        <select
          id="feedback-duration-feel"
          value={durationFeel}
          onChange={(e) => setDurationFeel(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="too_short">Too short</option>
          <option value="just_right">Just right</option>
          <option value="too_long">Too long</option>
        </select>
      </div>

      <div>
        <label htmlFor="feedback-overall-notes" className="block text-sm font-medium text-gray-700 mb-1">Overall notes (optional)</label>
        <textarea
          id="feedback-overall-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 transition"
        >
          <span>Optional details by played game</span>
          <span aria-hidden className="text-gray-500">{showDetails ? '▾' : '▸'}</span>
        </button>
        {showDetails && (
          <div className="mt-3">
            <PlayedGamesEditor
              games={games}
              playedRows={playedRows}
              onAdd={addPlayedRow}
              onUpdate={updatePlayedRow}
              onRemove={removePlayedRow}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !canSubmit}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {submitting ? 'Submitting...' : 'Submit feedback'}
      </button>
    </div>
  );
}

export default function FeedbackSection({
  eventId,
  feedbackStatus,
  onSubmitted,
  games,
  isHost,
  isGoingAttendee,
  eventDateTime,
  eventTimezone,
  eventDurationMinutes,
}: FeedbackSectionProps) {
  const [submitted, setSubmitted] = useState(false);
  const [feedbackEntries, setFeedbackEntries] = useState<EventFeedback[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [analytics, setAnalytics] = useState<EventFeedbackAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEntries, setShowEntries] = useState(true);

  const alreadySubmitted = feedbackStatus?.alreadySubmitted || submitted;
  const canSubmit = feedbackStatus?.canSubmit ?? false;
  const canSubmitForThisUser = isGoingAttendee && canSubmit;
  const canViewFeedback = alreadySubmitted;

  const refresh = async () => {
    setSubmitted(true);
    onSubmitted();
  };

  useEffect(() => {
    if (!canViewFeedback) return;
    queueMicrotask(() => {
      setLoadingEntries(true);
      api
        .get<EventFeedback[]>(`/events/${eventId}/feedback`, { showErrorToast: false })
        .then((entries) => setFeedbackEntries(entries))
        .catch(() => {})
        .finally(() => setLoadingEntries(false));
    });
  }, [canViewFeedback, eventId]);

  useEffect(() => {
    if (!canViewFeedback) return;
    queueMicrotask(() => {
      setLoadingAnalytics(true);
      api
        .get<EventFeedbackAnalytics>(`/events/${eventId}/feedback/analytics`, {
          showErrorToast: false,
        })
        .then((data) => setAnalytics(data))
        .catch(() => {})
        .finally(() => setLoadingAnalytics(false));
    });
  }, [canViewFeedback, eventId]);

  if (!alreadySubmitted && feedbackStatus?.eventEnded && !canSubmitForThisUser) {
    return (
      <p className="text-center text-gray-500 py-10">
        Feedback is only available to attendees who marked the event as <span className="font-semibold">Going</span>.
      </p>
    );
  }

  if (!canViewFeedback && feedbackStatus && !feedbackStatus.eventEnded) {
    return (
      <p className="text-center text-gray-500 py-10">
        Feedback opens after the event date.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {canSubmitForThisUser && !alreadySubmitted && (
        <FeedbackForm
          eventId={eventId}
          canSubmit={canSubmitForThisUser}
          games={games}
          onSubmitted={refresh}
          eventDateTime={eventDateTime}
          eventTimezone={eventTimezone}
          eventDurationMinutes={eventDurationMinutes}
        />
      )}

      {canViewFeedback && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-3xl mx-auto space-y-4">
          {isHost && (
            <div>
              <button
                type="button"
                onClick={() => setShowAnalytics((v) => !v)}
                className="w-full flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm font-medium text-indigo-800 hover:bg-indigo-100 transition"
              >
                <span>Host insights</span>
                <span aria-hidden>{showAnalytics ? '▾' : '▸'}</span>
              </button>
              {showAnalytics && (
                <div className="mt-3">
                  <FeedbackAnalytics analytics={analytics} loadingAnalytics={loadingAnalytics} />
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowEntries((v) => !v)}
              className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium hover:bg-gray-100 transition"
            >
              <span>Feedback history</span>
              <span aria-hidden className="text-gray-500">{showEntries ? '▾' : '▸'}</span>
            </button>
            {showEntries && (
              <div className="mt-3 space-y-4">
                <FeedbackEntriesList
                  feedbackEntries={feedbackEntries}
                  games={games}
                  loadingEntries={loadingEntries}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
