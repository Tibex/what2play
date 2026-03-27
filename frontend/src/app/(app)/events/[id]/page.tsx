'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatEventDateTime } from '@/lib/datetime';
import GameCard from '@/components/GameCard';
import FeedbackSection from './feedback-section';
import type {
  Game,
  GameEvent,
  User,
  EventGameCandidate,
  BggSearchResult,
  VoteResult,
  EventVote,
  VotingStatus,
  FeedbackStatus,
  InviteFriendsResponse,
  FriendRequestByUserIdResponse,
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
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [requestedFriendIds, setRequestedFriendIds] = useState<string[]>([]);
  const [addingFriendUserId, setAddingFriendUserId] = useState<string | null>(null);
  const [inviteableFriends, setInviteableFriends] = useState<User[]>([]);
  const [loadingInviteableFriends, setLoadingInviteableFriends] = useState(false);
  const [invitingFriends, setInvitingFriends] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowTs] = useState(() => Date.now());
  const [savingFallback, setSavingFallback] = useState(false);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);
  const [eventTab, setEventTab] = useState<'results' | 'fallback'>('results');

  const loadEvent = useCallback(async () => {
    const ev = await api.get<GameEvent>(`/events/${id}`);
    setEvent(ev);
    try {
      const friends = await api.get<User[]>('/friends', { showErrorToast: false });
      setFriendIds(friends.map((f) => f.id));
    } catch {
      /* best effort for attendee friend actions */
    }
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
  const votingStartAttendeeCount = event.votingStartedAttendeeCount ?? attendeeCount;
  const showFallbackControls =
    isHost &&
    event.status === 'confirmed' &&
    votingStartAttendeeCount > 0 &&
    attendeeCount < votingStartAttendeeCount;
  const myAttendee = event.attendees?.find((a) => a.userId === user?.id);
  const isPlanning = event.status === 'planning';
  const isPastEvent = event.status === 'past' || event.status === 'completed';
  const canRemoveAttendees =
    isHost && !isPastEvent && event.status !== 'cancelled';
  const canManageEvent =
    !isPastEvent && event.status !== 'cancelled';
  const canRsvp = !isPastEvent && event.status !== 'cancelled';
  const eventTimeZone = event.eventTimezone || 'UTC';
  const formattedEventDateTime = formatEventDateTime(event.dateTime, eventTimeZone);
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
    if (!canRsvp) {
      toast.error('RSVP is closed for this event');
      return;
    }
    try {
      const cancellationReason =
        status === 'not_going'
          ? window.prompt(
              'Optional: why are you cancelling? (transport, sick, conflict...)',
            ) || undefined
          : undefined;
      await api.post(`/events/${id}/rsvp`, { status, cancellationReason });
      toast.success(`RSVP updated to ${status}`);
      loadEvent();
    } catch { /* toast auto-shown */ }
  };

  const handleSetFallbackGame = async (gameId: string) => {
    setSavingFallback(true);
    try {
      await api.patch(`/events/${id}`, { fallbackGameId: gameId });
      toast.success('Fallback game saved');
      loadEvent();
    } catch {
      /* toast auto-shown */
    } finally {
      setSavingFallback(false);
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    if (!isHost) return;
    if (!confirm('Remove this attendee from the event?')) return;
    try {
      await api.delete(`/events/${id}/attendees/${attendeeId}`);
      toast.success('Attendee removed');
      loadEvent();
    } catch {
      /* toast auto-shown */
    }
  };

  const handleGenerateRecommendations = async () => {
    setGeneratingRecommendations(true);
    try {
      await api.post<EventGameCandidate[]>(`/events/${id}/recommendations/generate`);
      const c = await api.get<EventGameCandidate[]>(`/events/${id}/recommendations`);
      setCandidates(c);
      if (c.length === 0) {
        toast('No recommendations found for the current attendees');
      } else {
        toast.success('Recommendations generated');
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to generate recommendations',
      );
    } finally {
      setGeneratingRecommendations(false);
    }
  };

  const handleCreateInvite = async () => {
    try {
      const inv = await api.post<{ token: string }>(`/events/${id}/invite-link`);
      setInviteLink(`${window.location.origin}/invite/${inv.token}`);
      toast.success('Invite link created');
    } catch { /* toast auto-shown */ }
  };

  const loadInviteableFriends = async () => {
    if (!isHost) return;
    setLoadingInviteableFriends(true);
    try {
      const list = await api.get<User[]>(`/events/${id}/inviteable-friends`);
      setInviteableFriends(list);
    } catch {
      /* toast auto-shown */
    } finally {
      setLoadingInviteableFriends(false);
    }
  };

  const handleOpenInviteFriends = async () => {
    await loadInviteableFriends();
  };

  const handleInviteFriend = async (userId: string) => {
    setInvitingFriends(true);
    try {
      const result = await api.post<InviteFriendsResponse>(`/events/${id}/invite-friends`, {
        userIds: [userId],
      });

      if (result.invitedUserIds.length > 0) {
        toast.success('Friend invited');
      } else if (result.alreadyAttendingUserIds.length > 0) {
        toast('Already attending');
      } else if (result.notFriendsUserIds.length > 0) {
        toast.error('Only friends can be invited');
      }

      await Promise.all([loadEvent(), loadInviteableFriends()]);
    } catch {
      /* toast auto-shown */
    } finally {
      setInvitingFriends(false);
    }
  };

  const handleAddFriendFromAttendee = async (userId: string) => {
    if (!userId || friendIds.includes(userId) || requestedFriendIds.includes(userId)) {
      return;
    }
    setAddingFriendUserId(userId);
    try {
      const result = await api.post<FriendRequestByUserIdResponse>(
        '/friends/request-by-user-id',
        { userId },
      );
      if (result.status === 'already_friends') {
        setFriendIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
        toast('Already in your friends list');
      } else {
        setRequestedFriendIds((prev) =>
          prev.includes(userId) ? prev : [...prev, userId],
        );
        toast.success(
          result.status === 'sent'
            ? 'Friend request sent'
            : 'Friend request already pending',
        );
      }
    } catch {
      /* toast auto-shown */
    } finally {
      setAddingFriendUserId(null);
    }
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              {isHost && canManageEvent && (
                <Link
                  href={`/events/${id}/edit`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                  title="Edit event"
                  aria-label="Edit event"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M5.44 13.94a.75.75 0 0 0 .53-.22l7.56-7.56a1.75 1.75 0 1 0-2.47-2.47L3.5 11.25a.75.75 0 0 0-.2.36l-.75 3a.75.75 0 0 0 .91.91l3-.75a.75.75 0 0 0 .36-.2l.62-.63Z" />
                    <path d="M3 16.25a.75.75 0 0 0 .75.75h12.5a.75.75 0 0 0 0-1.5H3.75a.75.75 0 0 0-.75.75Z" />
                  </svg>
                </Link>
              )}
              {isHost && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition"
                  title="Delete event"
                  aria-label="Delete event"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.75 2.75a1.25 1.25 0 0 1 2.5 0V3h3.5a.75.75 0 0 1 0 1.5h-.69l-.62 10.03A2 2 0 0 1 11.45 16.5h-2.9a2 2 0 0 1-1.99-1.97L5.94 4.5h-.69a.75.75 0 0 1 0-1.5h3.5v-.25Zm-.81 1.75.61 9.95a.5.5 0 0 0 .5.49h2.9a.5.5 0 0 0 .5-.49l.61-9.95H7.94Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-gray-500 mt-1">
              Hosted by {event.host?.name || 'Unknown'}
              {' · '}
              {formattedEventDateTime.date}
              {' at '}
              {formattedEventDateTime.time}
              {' · '}
              {eventTimeZone}
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
          <span>
            {event.status === 'completed'
              ? '🗂 Past event'
              : event.type === 'open'
                ? '🌐 Open'
                : '🔒 Invite only'}
          </span>
          {event.lateCancellationCount ? (
            <span>⚠ {event.lateCancellationCount} late cancellations</span>
          ) : null}
        </div>

        <div className="mb-4">
          <AttendeesSection
            attendees={event.attendees}
            isHost={isHost}
            canRemoveAttendees={canRemoveAttendees}
            hostUserId={event.hostId}
            currentUserId={user?.id}
            friendIds={friendIds}
            requestedFriendIds={requestedFriendIds}
            addingFriendUserId={addingFriendUserId}
            onAddFriend={handleAddFriendFromAttendee}
            inviteableFriends={inviteableFriends}
            loadingInviteableFriends={loadingInviteableFriends}
            invitingFriends={invitingFriends}
            onInviteFriend={handleInviteFriend}
            onOpenInviteFriends={handleOpenInviteFriends}
            onRemove={handleRemoveAttendee}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {!myAttendee && (
            <button onClick={() => handleRsvp('going')} disabled={!canRsvp} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
              Join
            </button>
          )}
          {myAttendee && myAttendee.rsvpStatus !== 'going' && (
            <button onClick={() => handleRsvp('going')} disabled={!canRsvp} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition">
              Going
            </button>
          )}
          {myAttendee && myAttendee.rsvpStatus === 'going' && canRsvp && (
            <button onClick={() => handleRsvp('not_going')} disabled={!canRsvp} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50 transition">
              Can&apos;t make it
            </button>
          )}
          {isHost && canManageEvent && (
            <>
              {isPlanning && (
                <button onClick={handleCreateInvite} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-200 transition">
                  Create Invite Link
                </button>
              )}
              {event.status === 'planning' && (
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={generatingRecommendations}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                >
                  {generatingRecommendations
                    ? 'Generating...'
                    : 'Generate Recommendations'}
                </button>
              )}
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

      <div className="mt-6">
        {hasPassed ? (
          <div id="feedback">
            <FeedbackSection
              eventId={id}
              feedbackStatus={feedbackStatus}
              onSubmitted={loadEvent}
              games={candidates
                .map((c) => c.game)
                .filter((g): g is Game => Boolean(g))}
              isHost={isHost}
              eventDateTime={event.dateTime}
              eventTimezone={eventTimeZone}
              eventDurationMinutes={event.durationMinutes}
            />
          </div>
        ) : event.status === 'voting' || event.status === 'confirmed' ? (
          <>
            {event.status === 'confirmed' && showFallbackControls && (
              <div className="mb-4 flex items-center gap-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setEventTab('results')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                    eventTab === 'results'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Results
                </button>
                <button
                  type="button"
                  onClick={() => setEventTab('fallback')}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition ${
                    eventTab === 'fallback'
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Fallback options
                </button>
              </div>
            )}
            {event.status === 'confirmed' && showFallbackControls && eventTab === 'fallback' ? (
              <FallbackOptionsSection
                candidates={candidates}
                attendeeCount={attendeeCount}
                votingStartAttendeeCount={votingStartAttendeeCount}
                savingFallback={savingFallback}
                selectedFallbackGameId={event.fallbackGameId}
                onSetFallback={handleSetFallbackGame}
              />
            ) : (
              <VotingSection
                eventId={id}
                candidates={candidates}
                results={results}
                myVotes={myVotes}
                votingStatus={votingStatus}
                status={event.status}
                canSubmitVotes={myAttendee?.rsvpStatus === 'going'}
                onVoted={loadEvent}
              />
            )}
          </>
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

function AttendeesSection({
  attendees,
  isHost,
  canRemoveAttendees,
  hostUserId,
  currentUserId,
  friendIds,
  requestedFriendIds,
  addingFriendUserId,
  onAddFriend,
  inviteableFriends,
  loadingInviteableFriends,
  invitingFriends,
  onInviteFriend,
  onOpenInviteFriends,
  onRemove,
}: {
  attendees: GameEvent['attendees'];
  isHost: boolean;
  canRemoveAttendees: boolean;
  hostUserId: string;
  currentUserId?: string;
  friendIds: string[];
  requestedFriendIds: string[];
  addingFriendUserId: string | null;
  onAddFriend: (userId: string) => void;
  inviteableFriends: User[];
  loadingInviteableFriends: boolean;
  invitingFriends: boolean;
  onInviteFriend: (userId: string) => void;
  onOpenInviteFriends: () => void;
  onRemove: (attendeeId: string) => void;
}) {
  const [inviteDropdownOpen, setInviteDropdownOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const inviteDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!inviteDropdownRef.current) return;
      if (!inviteDropdownRef.current.contains(event.target as Node)) {
        setInviteDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, []);

  const openInviteDropdown = async () => {
    setInviteDropdownOpen(true);
    await onOpenInviteFriends();
  };

  const visibleInviteableFriends = inviteableFriends.filter((friend) => {
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      friend.name.toLowerCase().includes(q) ||
      friend.email.toLowerCase().includes(q)
    );
  });

  const groups = {
    going: attendees.filter((a) => a.rsvpStatus === 'going'),
    maybe: attendees.filter((a) => a.rsvpStatus === 'maybe'),
    not_going: attendees.filter((a) => a.rsvpStatus === 'not_going'),
  };
  const total =
    groups.going.length +
    groups.maybe.length +
    groups.not_going.length;
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
              <span key={a.id} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-sm inline-flex items-center gap-2">
                <span>{a.user?.name || a.guestName || 'Guest'}</span>
                {a.userId &&
                  !a.isGuest &&
                  a.userId !== currentUserId &&
                  (friendIds.includes(a.userId) ? (
                    <span
                      className="inline-flex items-center justify-center text-green-600"
                      title="Already friends"
                      aria-label="Already friends"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path d="M10 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM4.25 16.5A5.75 5.75 0 0 1 10 10.75a5.75 5.75 0 0 1 5.75 5.75.75.75 0 0 1-.75.75H5a.75.75 0 0 1-.75-.75Z" />
                      </svg>
                    </span>
                  ) : requestedFriendIds.includes(a.userId) ? (
                    <span
                      className="inline-flex items-center justify-center text-amber-600"
                      title="Request pending"
                      aria-label="Request pending"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm.75 3.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 .3.6l2.5 1.875a.75.75 0 1 0 .9-1.2l-2.2-1.65V5.75Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddFriend(a.userId!)}
                      disabled={addingFriendUserId === a.userId}
                      className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    >
                      {addingFriendUserId === a.userId ? 'Adding...' : '+'}
                    </button>
                  ))}
                {a.cancellationReason ? (
                  <span className="text-xs text-gray-500" title={a.cancellationReason}>
                    ({a.cancellationReason})
                  </span>
                ) : null}
                {isHost && canRemoveAttendees && a.userId !== hostUserId && (
                  <button
                    type="button"
                    onClick={() => onRemove(a.id)}
                    className="text-sm font-bold leading-none text-red-600 hover:text-red-700"
                    title="Remove attendee"
                    aria-label="Remove attendee"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {isHost && status === 'going' && (
              <div ref={inviteDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (inviteDropdownOpen) {
                      setInviteDropdownOpen(false);
                      return;
                    }
                    void openInviteDropdown();
                  }}
                  className="bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full px-3 py-1 text-sm font-medium hover:bg-indigo-200 transition"
                  title="Invite friend"
                  aria-label="Invite friend"
                >
                  +
                </button>
                {inviteDropdownOpen && (
                  <div className="absolute z-20 mt-2 right-0 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
                    <input
                      type="text"
                      value={inviteQuery}
                      onChange={(e) => setInviteQuery(e.target.value)}
                      placeholder="Search friends..."
                      className="w-full mb-2 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <div className="max-h-56 overflow-y-auto">
                      {loadingInviteableFriends ? (
                        <p className="text-xs text-gray-500 px-1 py-2">Loading...</p>
                      ) : visibleInviteableFriends.length === 0 ? (
                        <p className="text-xs text-gray-500 px-1 py-2">No matching friends</p>
                      ) : (
                        visibleInviteableFriends.map((friend) => (
                          <button
                            key={friend.id}
                            type="button"
                            onClick={() => {
                              onInviteFriend(friend.id);
                            }}
                            disabled={invitingFriends}
                            className="w-full text-left rounded px-2 py-1.5 hover:bg-gray-100 disabled:opacity-50"
                          >
                            <span className="block text-sm text-gray-800 truncate">{friend.name}</span>
                            <span className="block text-xs text-gray-500 truncate">{friend.email}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
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
  type SearchResultItem = {
    key: string;
    title: string;
    thumbnailUrl?: string;
    minPlayers?: number;
    maxPlayers?: number;
    playingTime?: number;
    yearPublished?: number;
    gameId?: string;
    bggId?: number;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const safeCandidates = candidates.filter((c) => c?.game);
  const candidateGameIds = new Set(safeCandidates.map((c) => c.gameId));
  const candidateBggIds = new Set(
    safeCandidates.map((c) => c.game?.bggId).filter((id): id is number => id != null),
  );

  const dedupeKeyFor = (item: {
    title: string;
    bggId?: number;
    yearPublished?: number;
  }) => {
    if (item.bggId != null) return `bgg:${item.bggId}`;
    const normalizedTitle = item.title.trim().toLowerCase().replace(/\s+/g, ' ');
    return `title:${normalizedTitle}:${item.yearPublished ?? 'na'}`;
  };

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const [local, bgg] = await Promise.all([
        api.get<Game[]>(`/games/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
        api.get<BggSearchResult[]>(`/bgg/search?q=${encodeURIComponent(q)}`, {
          showErrorToast: false,
        }),
      ]);

      const merged = new Map<string, SearchResultItem>();
      for (const game of local) {
        if (candidateGameIds.has(game.id)) continue;
        const item: SearchResultItem = {
          key: `game:${game.id}`,
          title: game.title,
          thumbnailUrl: game.thumbnailUrl,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          playingTime: game.playingTime,
          yearPublished: game.yearPublished,
          gameId: game.id,
          bggId: game.bggId,
        };
        merged.set(dedupeKeyFor(item), item);
      }

      for (const item of bgg) {
        if (candidateBggIds.has(item.bggId)) continue;
        const dedupeKey = dedupeKeyFor(item);
        if (merged.has(dedupeKey)) continue;
        merged.set(dedupeKey, {
          key: `bgg:${item.bggId}`,
          title: item.title,
          thumbnailUrl: item.thumbnailUrl,
          minPlayers: item.minPlayers,
          maxPlayers: item.maxPlayers,
          playingTime: item.playingTime,
          yearPublished: item.yearPublished,
          bggId: item.bggId,
        });
      }

      setSearchResults(
        [...merged.values()].sort((a, b) => a.title.localeCompare(b.title)),
      );
    } catch { /* toast auto-shown */ }
    finally { setSearching(false); }
  };

  const handleAdd = async (result: SearchResultItem) => {
    setAdding(result.key);
    try {
      let gameId = result.gameId;
      if (!gameId && result.bggId != null) {
        const imported = await api.post<{ game: Game }>('/bgg/import-one', {
          bggId: result.bggId,
        });
        gameId = imported.game.id;
      }
      if (!gameId) return;

      await api.post(`/events/${eventId}/recommendations/add`, { gameId });
      toast.success('Game added to recommendations');
      setSearchResults((prev) =>
        prev.filter(
          (r) => r.key !== result.key && (r.gameId ? r.gameId !== gameId : true),
        ),
      );
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
              placeholder="Search games..."
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
              {searchResults.map((result) => (
                <div key={result.key} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                  {result.thumbnailUrl && (
                    <img src={result.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.title}</p>
                    <p className="text-xs text-gray-500">
                      {result.minPlayers}-{result.maxPlayers} players
                      {result.playingTime ? ` · ${result.playingTime} min` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdd(result)}
                    disabled={adding === result.key}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 disabled:opacity-50 transition"
                  >
                    {adding === result.key ? 'Adding...' : '+ Add'}
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

function VotingSection({ eventId, candidates, results, myVotes, votingStatus, status, canSubmitVotes, onVoted }: {
  eventId: string;
  candidates: EventGameCandidate[];
  results: VoteResult[];
  myVotes: EventVote[];
  votingStatus: VotingStatus | null;
  status: string;
  canSubmitVotes: boolean;
  onVoted: () => void;
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
    if (hasSubmittedVotes || !canSubmitVotes) return;
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
          {!canSubmitVotes ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Only attendees marked as going can submit votes.
            </div>
          ) : !hasSubmittedVotes ? (
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
                  <span className="text-sm text-gray-500">
                    {r.totalScore} pts
                    {r.firstPlaceCount > 0
                      ? ` · #1 votes: ${r.firstPlaceCount}`
                      : ''}
                  </span>
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

function FallbackOptionsSection({
  candidates,
  attendeeCount,
  votingStartAttendeeCount,
  savingFallback,
  selectedFallbackGameId,
  onSetFallback,
}: {
  candidates: EventGameCandidate[];
  attendeeCount: number;
  votingStartAttendeeCount: number;
  savingFallback: boolean;
  selectedFallbackGameId?: string;
  onSetFallback: (gameId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm text-gray-700">
          Sorry to hear some people could not make it. Here are games you might
          still enjoy with the current group size ({attendeeCount}, down from{' '}
          {votingStartAttendeeCount} when voting started).
        </p>
      </div>
      {!candidates.length ? (
        <p className="text-gray-500 text-center py-8">
          No fallback options available yet.
        </p>
      ) : (
        <div className="space-y-3">
          {candidates
            .filter((c) => c?.game)
            .map((c) => (
              <GameCard
                key={c.id}
                game={c.game}
                explanation={c.explanation}
                showScore={Number(c.score)}
                bggUrl={c.game.bggId ? `https://boardgamegeek.com/boardgame/${c.game.bggId}` : undefined}
                actions={
                  <button
                    onClick={() => onSetFallback(c.gameId)}
                    disabled={savingFallback}
                    className={`text-xs px-3 py-1 rounded-full transition ${
                      selectedFallbackGameId === c.gameId
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                    }`}
                  >
                    {selectedFallbackGameId === c.gameId
                      ? 'Selected fallback'
                      : 'Use as fallback'}
                  </button>
                }
              />
            ))}
        </div>
      )}
    </div>
  );
}
