'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PENDING_INVITE_STORAGE_KEY } from '@/lib/auth-flow';
import { formatEventDateTime } from '@/lib/datetime';
import type { EventGameCandidate, GameEvent } from '@/lib/types';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const [guestSubmitted, setGuestSubmitted] = useState(false);
  const [candidates, setCandidates] = useState<EventGameCandidate[]>([]);
  const [rankings, setRankings] = useState<Record<string, number>>({});
  const [submittingVotes, setSubmittingVotes] = useState(false);
  const [guestVoted, setGuestVoted] = useState(false);
  const voteButtonLabel = guestVoted
    ? 'Vote Submitted'
    : submittingVotes
      ? 'Submitting Vote...'
      : 'Submit Guest Vote';

  useEffect(() => {
    api
      .get<GameEvent>(`/events/invite/${token}`, { auth: false })
      .then(setEvent)
      .catch(() => setLoadError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (event?.status !== 'voting') return;
    api
      .get<EventGameCandidate[]>(`/events/invite/${token}/recommendations`, {
        auth: false,
        showErrorToast: false,
      })
      .then((rows) => {
        setCandidates(rows);
        const initialRankings: Record<string, number> = {};
        rows.forEach((row, index) => {
          initialRankings[row.gameId] = index + 1;
        });
        setRankings(initialRankings);
      })
      .catch(() => {
        setCandidates([]);
      });
  }, [event?.status, token]);

  const handleJoin = async () => {
    const hasToken = localStorage.getItem('accessToken');
    if (!hasToken) {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
      router.push('/login');
      return;
    }
    try {
      await api.post(`/events/invite/${token}/join`);
      router.push(`/events/${event?.id}`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  const handleGuestRsvp = async (status: 'going' | 'not_going') => {
    const name = guestName.trim();
    if (name.length < 2) {
      setActionError('Please enter your name (at least 2 characters)');
      return;
    }

    setSubmittingGuest(true);
    setActionError('');
    try {
      await api.post(
        `/events/invite/${token}/guest-rsvp`,
        { guestName: name, status },
        { auth: false },
      );
      setGuestSubmitted(true);
      setActionError('');
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to RSVP as guest',
      );
    } finally {
      setSubmittingGuest(false);
    }
  };

  const handleGuestVote = async () => {
    const name = guestName.trim();
    if (name.length < 2) {
      setActionError('Please enter your name (at least 2 characters)');
      return;
    }

    const rankingRows = Object.entries(rankings)
      .filter(([, rank]) => rank > 0)
      .map(([gameId, rank]) => ({ gameId, rank }))
      .sort((a, b) => a.rank - b.rank);
    if (!rankingRows.length) {
      setActionError('Please rank at least one game');
      return;
    }

    const uniqueRanks = new Set(rankingRows.map((r) => r.rank));
    if (uniqueRanks.size !== rankingRows.length) {
      setActionError('Please use each rank only once');
      return;
    }

    setSubmittingVotes(true);
    setActionError('');
    try {
      await api.post(
        `/events/invite/${token}/guest-voting`,
        { guestName: name, rankings: rankingRows },
        { auth: false },
      );
      setGuestSubmitted(true);
      setGuestVoted(true);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to submit guest vote',
      );
    } finally {
      setSubmittingVotes(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{loadError}</p>
          <Link
            href="/login"
            className="text-indigo-600 hover:underline"
            onClick={() => localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token)}
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const timeZone = event.eventTimezone || 'UTC';
  const formatted = formatEventDateTime(event.dateTime, timeZone);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">🎲</div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Invited!</h1>
        <h2 className="text-xl font-semibold text-indigo-700 mb-4">{event.title}</h2>
        <p className="text-gray-600 mb-1">
          {formatted.date}
          {' at '}
          {formatted.time}
          {' · '}
          {timeZone}
        </p>
        {event.location && <p className="text-gray-500 text-sm mb-1">{event.location}</p>}
        {event.description && <p className="text-gray-500 text-sm mt-3">{event.description}</p>}
        {actionError && (
          <p className="mt-3 text-sm text-red-600">{actionError}</p>
        )}
        <button onClick={handleJoin} className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
          Join With Account
        </button>
        <p className="text-xs text-gray-400 mt-3">
          Account join supports RSVP plus voting
        </p>

        <div className="mt-5 border-t border-gray-100 pt-5 text-left">
          <p className="text-sm font-medium text-gray-800 mb-2">Quick guest RSVP</p>
          <p className="text-xs text-gray-500 mb-2">
            RSVP now without creating an account. Voting still requires login.
          </p>
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => handleGuestRsvp('going')}
            disabled={submittingGuest}
            className="mt-2 w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition disabled:opacity-60"
          >
            {submittingGuest ? 'Submitting...' : 'RSVP Going as Guest'}
          </button>
          <button
            onClick={() => handleGuestRsvp('not_going')}
            disabled={submittingGuest}
            className="mt-2 w-full bg-gray-200 text-gray-800 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-300 transition disabled:opacity-60"
          >
            {submittingGuest ? 'Submitting...' : "Can’t Attend as Guest"}
          </button>
          {guestSubmitted && (
            <p className="mt-2 text-xs text-green-700">
              Guest RSVP submitted. Ask the host to share voting updates.
            </p>
          )}
        </div>
        {event.status === 'voting' && candidates.length > 0 && (
          <div className="mt-5 border-t border-gray-100 pt-5 text-left">
            <p className="text-sm font-medium text-gray-800 mb-2">
              Guest ranked voting
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Rank games from 1 (best) to {candidates.length}. You can leave a game
              unranked.
            </p>
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex items-center gap-2">
                  <div className="flex-1 text-sm text-gray-800 truncate">
                    {candidate.game.title}
                  </div>
                  <select
                    value={rankings[candidate.gameId] ?? 0}
                    onChange={(e) =>
                      setRankings((prev) => ({
                        ...prev,
                        [candidate.gameId]: Number(e.target.value),
                      }))
                    }
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value={0}>Unranked</option>
                    {Array.from({ length: candidates.length }, (_, i) => i + 1).map(
                      (rank) => (
                        <option key={rank} value={rank}>
                          Rank {rank}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              ))}
            </div>
            <button
              onClick={handleGuestVote}
              disabled={submittingVotes || guestVoted}
              className="mt-3 w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
            >
              {voteButtonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
