'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import GameCard from '@/components/GameCard';
import type {
  Game,
  GameEvent,
  EventGameCandidate,
  EventFeedback,
  VoteResult,
  EventVote,
  VotingStatus,
  FeedbackStatus,
} from '@/lib/types';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [candidates, setCandidates] = useState<EventGameCandidate[]>([]);
  const [results, setResults] = useState<VoteResult[]>([]);
  const [myVotes, setMyVotes] = useState<EventVote[]>([]);
  const [votingStatus, setVotingStatus] = useState<VotingStatus | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [nowTs] = useState(() => Date.now());

  const loadEvent = useCallback(async () => {
    const ev = await api.get<GameEvent>(`/events/${id}`);
    setEvent(ev);
    try {
      const c = await api.get<EventGameCandidate[]>(`/events/${id}/recommendations`, { showErrorToast: false });
      setCandidates(c);
    } catch { /* no candidates yet */ }
    try {
      const r = await api.get<VoteResult[]>(`/events/${id}/voting/results`, { showErrorToast: false });
      setResults(r);
      const mv = await api.get<EventVote[]>(`/events/${id}/voting/my-votes`, { showErrorToast: false });
      setMyVotes(mv);
      const vs = await api.get<VotingStatus>(`/events/${id}/voting/status`, { showErrorToast: false });
      setVotingStatus(vs);
    } catch { /* no votes yet */ }
    try {
      const fs = await api.get<FeedbackStatus>(`/events/${id}/feedback/status`, { showErrorToast: false });
      setFeedbackStatus(fs);
    } catch { /* no feedback status yet */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // Defer to microtask queue to satisfy react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      void loadEvent();
    });
  }, [loadEvent]);

  if (loading || !event) {
    return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const isHost = user?.id === event.hostId;
  const attendeeCount = event.attendees?.filter((a) => a.rsvpStatus === 'going').length || 0;
  const myAttendee = event.attendees?.find((a) => a.userId === user?.id);
  const date = new Date(event.dateTime);
  const eventEndsAt =
    new Date(event.dateTime).getTime() +
    (event.durationMinutes ?? 0) * 60_000;
  const hasPassed = nowTs >= eventEndsAt;
  const formatDurationMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const handleRsvp = async (status: string) => {
    try {
      await api.post(`/events/${id}/rsvp`, { status });
      toast.success(`RSVP updated to ${status}`);
      loadEvent();
    } catch { /* toast auto-shown */ }
  };

  const handleGenerateRecommendations = async () => {
    try {
      await api.post<EventGameCandidate[]>(`/events/${id}/recommendations/generate`);
      const c = await api.get<EventGameCandidate[]>(`/events/${id}/recommendations`);
      setCandidates(c);
      toast.success('Recommendations generated');
    } catch { /* toast auto-shown */ }
  };

  const handleCreateInvite = async () => {
    try {
      const inv = await api.post<{ token: string }>(`/events/${id}/invite-link`);
      setInviteLink(`${window.location.origin}/invite/${inv.token}`);
      toast.success('Invite link created');
    } catch { /* toast auto-shown */ }
  };

  const handleStartVoting = async () => {
    try {
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      // Optimistic UI: lock recommendations immediately.
      setEvent((prev) => (prev ? { ...prev, status: 'voting', votingDeadline: deadline } : prev));
      await api.patch(`/events/${id}`, { status: 'voting', votingDeadline: deadline });
      toast.success('Voting started!');
      loadEvent();
    } catch { /* toast auto-shown */ }
  };

  const handleSelectWinner = async (gameId?: string) => {
    try {
      await api.post(`/events/${id}/voting/select-winner`, { gameId });
      toast.success('Winner selected!');
      loadEvent();
    } catch { /* toast auto-shown */ }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      router.push('/dashboard');
    } catch { /* toast auto-shown */ }
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
          {event.durationMinutes && (
            <span>⏱ {formatDurationMinutes(event.durationMinutes)}</span>
          )}
          <span>👥 {attendeeCount}{event.capacity ? `/${event.capacity}` : ''} going</span>
          <span>{event.type === 'open' ? '🌐 Open' : '🔒 Invite only'}</span>
        </div>

        <div className="mb-4">
          <AttendeesSection attendees={event.attendees} />
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
              <Link href={`/events/${id}/edit`} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
                Edit Event
              </Link>
              <button onClick={handleCreateInvite} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200 transition">
                Create Invite Link
              </button>
              {event.status === 'planning' && (
                <button
                  onClick={handleGenerateRecommendations}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                >
                  Generate Recommendations
                </button>
              )}
              {candidates.length > 0 && event.status === 'planning' && (
                <button onClick={handleStartVoting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                  Start Voting
                </button>
              )}
              <button onClick={handleDelete} className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition">
                Delete Event
              </button>
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

      <div className="mt-6">
        {hasPassed ? (
          <FeedbackSection
            eventId={id}
            feedbackStatus={feedbackStatus}
            onSubmitted={loadEvent}
          />
        ) : event.status === 'voting' ? (
          <VotingSection
            eventId={id}
            candidates={candidates}
            results={results}
            myVotes={myVotes}
            votingStatus={votingStatus}
            isHost={isHost}
            status={event.status}
            onVoted={loadEvent}
            onSelectWinner={handleSelectWinner}
          />
        ) : (
          <RecommendationsSection
            eventId={id}
            candidates={candidates}
            isPlanning={event.status === 'planning'}
            onChanged={loadEvent}
          />
        )}
      </div>
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
  const total = groups.going.length + groups.maybe.length + groups.not_going.length;
  if (total === 0) {
    return <div className="text-sm text-gray-500">No attendees yet.</div>;
  }
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

function RecommendationsSection({
  eventId,
  candidates,
  isPlanning,
  onChanged,
}: {
  eventId: string;
  candidates: EventGameCandidate[];
  isPlanning: boolean;
  onChanged: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Game[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const safeCandidates = candidates.filter((c) => c?.game);
  const candidateGameIds = new Set(safeCandidates.map((c) => c.gameId));

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const results = await api.get<Game[]>(`/games/search?q=${encodeURIComponent(q)}`);
      setSearchResults(results.filter((g) => !candidateGameIds.has(g.id)));
    } catch { /* toast auto-shown */ }
    finally { setSearching(false); }
  };

  const handleAdd = async (gameId: string) => {
    setAdding(gameId);
    try {
      await api.post(`/events/${eventId}/recommendations/add`, { gameId });
      toast.success('Game added to recommendations');
      setSearchResults((prev) => prev.filter((g) => g.id !== gameId));
      onChanged();
    } catch { /* toast auto-shown */ }
    finally { setAdding(null); }
  };

  const handleRemove = async (candidateId: string) => {
    setRemoving(candidateId);
    try {
      await api.delete(`/events/${eventId}/recommendations/${candidateId}`);
      toast.success('Game removed from recommendations');
      onChanged();
    } catch { /* toast auto-shown */ }
    finally { setRemoving(null); }
  };

  return (
    <div className="space-y-6">
      {isPlanning && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Add a game manually</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search games in database..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((game) => (
                <div key={game.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                  {game.thumbnailUrl && (
                    <img src={game.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{game.title}</p>
                    <p className="text-xs text-gray-500">
                      {game.minPlayers}-{game.maxPlayers} players
                      {game.playingTime ? ` · ${game.playingTime} min` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdd(game.id)}
                    disabled={adding === game.id}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 disabled:opacity-50 transition"
                  >
                    {adding === game.id ? 'Adding...' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!safeCandidates.length ? (
        <p className="text-gray-500 text-center py-10">No recommendations yet. The host can generate them or add games manually.</p>
      ) : (
        <div className="space-y-3">
          {safeCandidates.map((c) => (
            <GameCard
              key={c.id}
              game={c.game}
              explanation={c.explanation}
              showScore={Number(c.score)}
              bggUrl={c.game.bggId ? `https://boardgamegeek.com/boardgame/${c.game.bggId}` : undefined}
              actions={
                isPlanning ? (
                  <button
                    onClick={() => handleRemove(c.id)}
                    disabled={removing === c.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition"
                  >
                    {removing === c.id ? 'Removing...' : 'Remove'}
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VotingSection({ eventId, candidates, results, myVotes, votingStatus, isHost, status, onVoted, onSelectWinner }: {
  eventId: string;
  candidates: EventGameCandidate[];
  results: VoteResult[];
  myVotes: EventVote[];
  votingStatus: VotingStatus | null;
  isHost: boolean;
  status: string;
  onVoted: () => void;
  onSelectWinner: (gameId?: string) => void;
}) {
  const [rankings, setRankings] = useState<{ gameId: string; rank: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draggingGameId, setDraggingGameId] = useState<string | null>(null);
  const hasSubmittedVotes = myVotes.length > 0;
  const [showMyVotes, setShowMyVotes] = useState(false);

  useEffect(() => {
    // Collapse the ranked tiles by default once the user has submitted.
    setShowMyVotes(!hasSubmittedVotes);
  }, [hasSubmittedVotes]);

  useEffect(() => {
    if (!candidates.length) return;
    const candidateIds = new Set(candidates.map((c) => c.gameId));
    const validMyVotes = myVotes
      .filter((v) => candidateIds.has(v.gameId))
      .sort((a, b) => a.rank - b.rank);

    if (validMyVotes.length > 0) {
      const rankedFromVotes = validMyVotes.map((v, i) => ({ gameId: v.gameId, rank: i + 1 }));
      const missingCandidates = candidates
        .filter((c) => !validMyVotes.some((v) => v.gameId === c.gameId))
        .map((c, i) => ({ gameId: c.gameId, rank: rankedFromVotes.length + i + 1 }));
      setRankings([...rankedFromVotes, ...missingCandidates]);
      return;
    }

    setRankings(candidates.map((c, i) => ({ gameId: c.gameId, rank: i + 1 })));
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
    if (hasSubmittedVotes) return;
    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/voting`, { rankings });
      onVoted();
    } finally {
      setSubmitting(false);
    }
  };

  const reorderByGameId = (fromGameId: string, toGameId: string) => {
    if (fromGameId === toGameId) return;
    const fromIndex = rankings.findIndex((r) => r.gameId === fromGameId);
    const toIndex = rankings.findIndex((r) => r.gameId === toGameId);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...rankings];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setRankings(next.map((r, i) => ({ ...r, rank: i + 1 })));
  };

  const gameMap = new Map([
    ...candidates.map((c) => [c.gameId, c.game] as const),
    ...myVotes.filter((v) => v.game).map((v) => [v.gameId, v.game] as const),
  ]);

  const myVotesSorted = myVotes.slice().sort((a, b) => a.rank - b.rank);
  const displayedRankings = hasSubmittedVotes
    ? myVotesSorted.map((v) => ({ gameId: v.gameId, rank: v.rank }))
    : rankings;

  const voteTiles = displayedRankings.map((r, idx) => {
    const game = gameMap.get(r.gameId);
    const bggUrl =
      game?.bggId != null ? `https://boardgamegeek.com/boardgame/${game.bggId}` : undefined;

    return (
      <div
        key={r.gameId}
        draggable={!hasSubmittedVotes}
        onDragStart={() => {
          if (!hasSubmittedVotes) setDraggingGameId(r.gameId);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!hasSubmittedVotes && draggingGameId) reorderByGameId(draggingGameId, r.gameId);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDraggingGameId(null);
        }}
        onDragEnd={() => setDraggingGameId(null)}
        className={`flex items-center gap-3 bg-white border rounded-xl p-3 transition ${
          draggingGameId === r.gameId ? 'border-indigo-300 opacity-60' : 'border-gray-200'
        }`}
        title="Drag to reorder"
      >
        <span className="text-lg font-bold text-gray-400 w-8 text-center">
          {idx + 1}
        </span>
        <span className="cursor-grab select-none text-gray-400">≡</span>

        {game?.thumbnailUrl && bggUrl ? (
          <a
            href={bggUrl}
            target="_blank"
            rel="noreferrer"
            className="block flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={game.thumbnailUrl}
              alt={game.title}
              className="w-10 h-10 object-cover rounded"
            />
          </a>
        ) : game?.thumbnailUrl ? (
          <img
            src={game.thumbnailUrl}
            alt={game.title}
            className="w-10 h-10 object-cover rounded flex-shrink-0"
          />
        ) : null}

        <div className="flex-1 min-w-0">
          {bggUrl ? (
            <a
              href={bggUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-gray-900 truncate hover:underline block"
              title="Open on BoardGameGeek"
            >
              {game?.title || r.gameId}
            </a>
          ) : (
            <span className="font-medium text-gray-900 truncate block">
              {game?.title || r.gameId}
            </span>
          )}

          <p className="text-xs text-gray-500 mt-0.5">
            {game?.minPlayers != null && game?.maxPlayers != null
              ? `${game.minPlayers}-${game.maxPlayers} players`
              : ''}
            {game?.playingTime != null ? ` · ${game.playingTime} min` : ''}
            {game?.yearPublished != null ? ` · ${game.yearPublished}` : ''}
          </p>
        </div>

        {!hasSubmittedVotes && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              type="button"
            >
              ▲
            </button>
            <button
              onClick={() => moveDown(idx)}
              disabled={idx >= displayedRankings.length - 1}
              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
              type="button"
            >
              ▼
            </button>
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="space-y-6">
      {status === 'voting' && candidates.length > 0 && (
        <div>
          {!hasSubmittedVotes ? (
            <>
              <h3 className="font-semibold mb-3">Rank your preferences (most wanted at top)</h3>
              <div className="space-y-2">{voteTiles}</div>
              <button
                onClick={submitVotes}
                disabled={submitting || hasSubmittedVotes}
                className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                type="button"
              >
                {submitting ? 'Submitting...' : 'Submit Votes'}
              </button>
            </>
          ) : (
            <></>
          )}
        </div>
      )}

      {votingStatus && !votingStatus.allVoted && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Results are hidden until everyone votes ({votingStatus.submittedVoters}/{votingStatus.expectedVoters} submitted).
        </div>
      )}

      {results.length > 0 && votingStatus?.allVoted && (
        <div>
          <h3 className="font-semibold mb-3">Current Results</h3>
          <div className="space-y-2">
            {results.map((r, idx) => {
              const game = gameMap.get(r.gameId);
              const bggUrl =
                game?.bggId != null
                  ? `https://boardgamegeek.com/boardgame/${game.bggId}`
                  : undefined;
              return (
                <div
                  key={r.gameId}
                  className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3"
                >
                  <span className={`text-lg font-bold w-8 text-center ${idx === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                    {idx === 0 ? '🏆' : `#${idx + 1}`}
                  </span>
                  {game?.thumbnailUrl ? (
                    <img
                      src={game.thumbnailUrl}
                      alt={game.title}
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                    />
                  ) : null}
                  {bggUrl ? (
                    <a
                      href={bggUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 font-medium truncate hover:underline"
                      title="Open on BoardGameGeek"
                    >
                      {game?.title || r.gameId}
                    </a>
                  ) : (
                    <span className="flex-1 font-medium truncate">
                      {game?.title || r.gameId}
                    </span>
                  )}
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

      {hasSubmittedVotes && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowMyVotes((v) => !v)}
            className="w-full flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium hover:bg-gray-50 transition"
          >
            <span>My votes</span>
            <span aria-hidden className="text-gray-500">
              {showMyVotes ? '▾' : '▸'}
            </span>
          </button>

          {showMyVotes && <div className="space-y-2 mt-3">{voteTiles}</div>}
        </div>
      )}
    </div>
  );
}

function FeedbackSection({
  eventId,
  feedbackStatus,
  onSubmitted,
}: {
  eventId: string;
  feedbackStatus: FeedbackStatus | null;
  onSubmitted: () => void;
}) {
  const [enjoyment, setEnjoyment] = useState(3);
  const [finished, setFinished] = useState(false);
  const [durationFeel, setDurationFeel] = useState('just_right');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const alreadySubmitted = feedbackStatus?.alreadySubmitted || submitted;
  const canSubmit = feedbackStatus?.canSubmit ?? false;
  const canViewFeedback = alreadySubmitted || feedbackStatus?.eventEnded;

  const [feedbackEntries, setFeedbackEntries] = useState<EventFeedback[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    if (!canViewFeedback) return;
    setLoadingEntries(true);
    api
      .get<EventFeedback[]>(`/events/${eventId}/feedback`, { showErrorToast: false })
      .then(setFeedbackEntries)
      .catch(() => {})
      .finally(() => setLoadingEntries(false));
  }, [canViewFeedback, eventId]);

  const noteTextCount = feedbackEntries.filter((f) =>
    (f.notes ?? '').trim(),
  ).length;

  const avgEnjoyment =
    feedbackEntries.length > 0
      ? feedbackEntries.reduce(
          (sum, f) => sum + Number(f.enjoymentRating),
          0,
        ) / feedbackEntries.length
      : null;

  const completionRate =
    feedbackEntries.length > 0
      ? feedbackEntries.filter((f) => f.finishedGame).length / feedbackEntries.length
      : null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
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

  if (!canViewFeedback && feedbackStatus && !feedbackStatus.eventEnded) {
    return (
      <p className="text-center text-gray-500 py-10">
        Feedback opens after the event date.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {canSubmit && !alreadySubmitted && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-lg mx-auto space-y-5">
          <h3 className="font-semibold text-lg">How was the game night?</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enjoyment (1-5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setEnjoyment(n)}
                  className={`w-10 h-10 rounded-full text-lg font-bold transition ${
                    enjoyment >= n
                      ? 'bg-yellow-400 text-white'
                      : 'bg-gray-100 text-gray-400'
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How did the duration feel?
            </label>
            <select
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      )}

      {canViewFeedback && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-3xl mx-auto space-y-4">
          {alreadySubmitted && (
            <p className="text-center text-green-600 font-medium">
              Thanks for your feedback!
            </p>
          )}

          {loadingEntries ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : feedbackEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-6">
              No feedback entries yet.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                  <div className="text-xs text-indigo-700 font-medium">
                    Avg enjoyment
                  </div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {avgEnjoyment != null ? avgEnjoyment.toFixed(1) : '—'}
                    /5
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                  <div className="text-xs text-indigo-700 font-medium">
                    Completion rate
                  </div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {completionRate != null
                      ? `${Math.round(completionRate * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                  <div className="text-xs text-indigo-700 font-medium">
                    Entries / Notes
                  </div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {feedbackEntries.length} / {noteTextCount}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {feedbackEntries.map((f) => {
                  const note = (f.notes ?? '').trim();
                  const bggUrl =
                    f.game?.bggId != null
                      ? `https://boardgamegeek.com/boardgame/${f.game.bggId}`
                      : undefined;

                  return (
                    <div
                      key={f.id}
                      className="flex gap-3 bg-gray-50 border border-gray-100 rounded-lg p-3"
                    >
                      {f.game?.thumbnailUrl ? (
                        <img
                          src={f.game.thumbnailUrl}
                          alt={f.game.title}
                          className="w-14 h-14 object-cover rounded flex-shrink-0"
                        />
                      ) : null}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {f.user?.name || 'Guest'}
                            </div>
                            {f.game?.title ? (
                              bggUrl ? (
                                <a
                                  href={bggUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-indigo-700 hover:underline truncate block mt-0.5"
                                >
                                  {f.game.title}
                                </a>
                              ) : (
                                <div className="text-xs text-gray-600 truncate block mt-0.5">
                                  {f.game.title}
                                </div>
                              )
                            ) : (
                              <div className="text-xs text-gray-500 truncate block mt-0.5">
                                General feedback
                              </div>
                            )}
                          </div>

                          <span className="flex-shrink-0 bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded-lg">
                            {f.enjoymentRating}/5
                          </span>
                        </div>

                        <div className="text-xs text-gray-600 mt-1">
                          {f.finishedGame ? 'Finished game' : 'Did not finish'}
                          {f.durationFeel ? ` · ${f.durationFeel}` : ''}
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
          )}
        </div>
      )}
    </div>
  );
}
