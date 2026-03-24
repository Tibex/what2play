'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import GameCard from '@/components/GameCard';
import type { GameEvent, EventGameCandidate, VoteResult, EventVote } from '@/lib/types';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [candidates, setCandidates] = useState<EventGameCandidate[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [myVotes, setMyVotes] = useState<EventVote[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'recommend' | 'vote' | 'feedback'>('details');

  const loadEvent = useCallback(async () => {
    const ev = await api.get<GameEvent>(`/events/${id}`);
    setEvent(ev);
    try {
      const c = await api.get<EventGameCandidate[]>(`/events/${id}/recommendations`);
      setCandidates(c);
    } catch { /* no candidates yet */ }
    try {
      const r = await api.get<VoteResult[]>(`/events/${id}/voting/results`);
      setResults(r);
      const mv = await api.get<EventVote[]>(`/events/${id}/voting/my-votes`);
      setMyVotes(mv);
    } catch { /* no votes yet */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  if (loading || !event) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const isHost = user?.id === event.hostId;
  const attendeeCount = event.attendees?.filter((a) => a.rsvpStatus === 'going').length || 0;
  const myAttendee = event.attendees?.find((a) => a.userId === user?.id);
  const date = new Date(event.dateTime);

  const handleRsvp = async (status: string) => {
    await api.post(`/events/${id}/rsvp`, { status });
    loadEvent();
  };

  const handleGenerateRecommendations = async () => {
    await api.post<EventGameCandidate[]>(`/events/${id}/recommendations/generate`);
    const c = await api.get<EventGameCandidate[]>(`/events/${id}/recommendations`);
    setCandidates(c);
    setTab('recommend');
  };

  const handleCreateInvite = async () => {
    const inv = await api.post<{ token: string }>(`/events/${id}/invite-link`);
    setInviteLink(`${window.location.origin}/invite/${inv.token}`);
  };

  const handleStartVoting = async () => {
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await api.patch(`/events/${id}`, { status: 'voting', votingDeadline: deadline });
    loadEvent();
    setTab('vote');
  };

  const handleSelectWinner = async (gameId?: string) => {
    await api.post(`/events/${id}/voting/select-winner`, { gameId });
    loadEvent();
  };

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <p className="text-gray-500 mt-1">
              Hosted by {event.host?.name || 'Unknown'}
              {' · '}
              {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' at '}
              {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <StatusBadge status={event.status} />
        </div>

        {event.description && <p className="text-gray-700 mb-4">{event.description}</p>}

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
          {event.location && <span>📍 {event.location}</span>}
          {event.durationMinutes && <span>⏱ {event.durationMinutes} min</span>}
          <span>👥 {attendeeCount}{event.capacity ? `/${event.capacity}` : ''} going</span>
          <span>{event.type === 'open' ? '🌐 Open' : '🔒 Invite only'}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {!myAttendee && (
            <button onClick={() => handleRsvp('going')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Join
            </button>
          )}
          {myAttendee && myAttendee.rsvpStatus !== 'going' && (
            <button onClick={() => handleRsvp('going')} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
              Going
            </button>
          )}
          {myAttendee && myAttendee.rsvpStatus === 'going' && (
            <button onClick={() => handleRsvp('not_going')} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition">
              Can&apos;t make it
            </button>
          )}
          {isHost && (
            <>
              <button onClick={handleCreateInvite} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200 transition">
                Create Invite Link
              </button>
              <button onClick={handleGenerateRecommendations} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                Generate Recommendations
              </button>
              {candidates.length > 0 && event.status === 'planning' && (
                <button onClick={handleStartVoting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                  Start Voting
                </button>
              )}
            </>
          )}
        </div>

        {inviteLink && (
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
            <p className="text-sm text-indigo-700 font-medium mb-1">Invite Link</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 bg-white border rounded px-3 py-1.5 text-sm" />
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 transition">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {(['details', 'recommend', 'vote', 'feedback'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
              tab === t ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'details' ? 'Attendees' : t === 'recommend' ? 'Recommendations' : t === 'vote' ? 'Voting' : 'Feedback'}
          </button>
        ))}
      </div>

      {tab === 'details' && <AttendeesSection attendees={event.attendees} />}
      {tab === 'recommend' && <RecommendationsSection candidates={candidates} />}
      {tab === 'vote' && (
        <VotingSection
          eventId={id}
          candidates={candidates}
          results={results}
          myVotes={myVotes}
          isHost={isHost}
          status={event.status}
          onVoted={loadEvent}
          onSelectWinner={handleSelectWinner}
        />
      )}
      {tab === 'feedback' && <FeedbackSection eventId={id} onSubmitted={loadEvent} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-700',
    voting: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    active: 'bg-purple-100 text-purple-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
}

function AttendeesSection({ attendees }: { attendees: GameEvent['attendees'] }) {
  const groups = { going: attendees.filter((a) => a.rsvpStatus === 'going'), maybe: attendees.filter((a) => a.rsvpStatus === 'maybe'), not_going: attendees.filter((a) => a.rsvpStatus === 'not_going') };
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([status, list]) => list.length > 0 && (
        <div key={status}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">{status.replace('_', ' ')} ({list.length})</h3>
          <div className="flex flex-wrap gap-2">
            {list.map((a) => (
              <span key={a.id} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-sm">
                {a.user?.name || a.guestName || 'Guest'}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationsSection({ candidates }: { candidates: EventGameCandidate[] }) {
  const safeCandidates = candidates.filter((c) => c?.game);

  if (!safeCandidates.length) {
    return <p className="text-gray-500 text-center py-10">No recommendations generated yet. The host can generate them.</p>;
  }
  return (
    <div className="space-y-3">
      {safeCandidates.map((c) => (
        <GameCard key={c.id} game={c.game} explanation={c.explanation} showScore={Number(c.score)} />
      ))}
    </div>
  );
}

function VotingSection({ eventId, candidates, results, myVotes, isHost, status, onVoted, onSelectWinner }: {
  eventId: string;
  candidates: EventGameCandidate[];
  results: VoteResult[];
  myVotes: EventVote[];
  isHost: boolean;
  status: string;
  onVoted: () => void;
  onSelectWinner: (gameId?: string) => void;
}) {
  const [rankings, setRankings] = useState<{ gameId: string; rank: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (myVotes.length > 0) {
      setRankings(myVotes.map((v) => ({ gameId: v.gameId, rank: v.rank })));
    } else if (candidates.length > 0) {
      setRankings(candidates.map((c, i) => ({ gameId: c.gameId, rank: i + 1 })));
    }
  }, [candidates, myVotes]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...rankings];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRankings(next.map((r, i) => ({ ...r, rank: i + 1 })));
  };

  const moveDown = (idx: number) => {
    if (idx >= rankings.length - 1) return;
    const next = [...rankings];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRankings(next.map((r, i) => ({ ...r, rank: i + 1 })));
  };

  const submitVotes = async () => {
    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/voting`, { rankings });
      onVoted();
    } finally {
      setSubmitting(false);
    }
  };

  const gameMap = new Map(candidates.map((c) => [c.gameId, c.game]));

  return (
    <div className="space-y-6">
      {(status === 'voting' || status === 'planning') && candidates.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Rank your preferences (most wanted at top)</h3>
          <div className="space-y-2">
            {rankings.map((r, idx) => {
              const game = gameMap.get(r.gameId);
              return (
                <div key={r.gameId} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-lg font-bold text-gray-400 w-8 text-center">{idx + 1}</span>
                  <span className="flex-1 font-medium">{game?.title || r.gameId}</span>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx >= rankings.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30">▼</button>
                </div>
              );
            })}
          </div>
          <button onClick={submitVotes} disabled={submitting} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
            {submitting ? 'Submitting...' : 'Submit Votes'}
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Current Results</h3>
          <div className="space-y-2">
            {results.map((r, idx) => {
              const game = gameMap.get(r.gameId);
              return (
                <div key={r.gameId} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
                  <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                    {idx === 0 ? '🏆' : `#${idx + 1}`}
                  </span>
                  <span className="flex-1 font-medium">{game?.title || r.gameId}</span>
                  <span className="text-sm text-gray-500">{r.totalScore} pts · {r.voteCount} votes</span>
                  {isHost && (
                    <button onClick={() => onSelectWinner(r.gameId)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition">
                      Select
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackSection({ eventId, onSubmitted }: { eventId: string; onSubmitted: () => void }) {
  const [enjoyment, setEnjoyment] = useState(3);
  const [finished, setFinished] = useState(false);
  const [durationFeel, setDurationFeel] = useState('just_right');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/feedback`, {
        enjoymentRating: enjoyment,
        finishedGame: finished,
        durationFeel,
        notes: notes || undefined,
      });
      setSubmitted(true);
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <p className="text-center text-green-600 font-medium py-10">Thanks for your feedback!</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg mx-auto space-y-5">
      <h3 className="font-semibold text-lg">How was the game night?</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Enjoyment (1-5)</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
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
        <input type="checkbox" checked={finished} onChange={(e) => setFinished(e.target.checked)} className="rounded border-gray-300 text-indigo-600" />
        We finished at least one game
      </label>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">How did the duration feel?</label>
        <select value={durationFeel} onChange={(e) => setDurationFeel(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="too_short">Too short</option>
          <option value="just_right">Just right</option>
          <option value="too_long">Too long</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button onClick={handleSubmit} disabled={submitting} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition">
        {submitting ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}
