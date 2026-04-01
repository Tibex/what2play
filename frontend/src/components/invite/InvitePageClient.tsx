'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PENDING_INVITE_STORAGE_KEY } from '@/lib/auth-flow';
import { formatEventDateTime } from '@/lib/datetime';
import type { GameEvent } from '@/lib/types';

type InvitePageClientProps = {
  token: string;
};

export default function InvitePageClient({ token }: Readonly<InvitePageClientProps>) {
  const router = useRouter();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [currentUserId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const userRaw = localStorage.getItem('user');
    if (!userRaw) return null;
    try {
      const parsed = JSON.parse(userRaw) as { id?: string };
      return parsed?.id ?? null;
    } catch {
      return null;
    }
  });
  const [hasAuthToken] = useState(
    () => typeof window !== 'undefined' && Boolean(localStorage.getItem('accessToken')),
  );
  const [isExistingMember, setIsExistingMember] = useState(false);

  useEffect(() => {
    api
      .get<GameEvent>(`/events/invite/${token}`, { auth: false })
      .then(setEvent)
      .catch(() => setLoadError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!event?.id || !hasAuthToken) return;
    let cancelled = false;
    api
      .get<GameEvent[]>('/events', { showErrorToast: false })
      .then((events) => {
        if (cancelled) return;
        setIsExistingMember(events.some((userEvent) => userEvent.id === event.id));
      })
      .catch(() => {
        if (cancelled) return;
        setIsExistingMember(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event?.id, hasAuthToken]);

  const alreadyJoinedWithAccount = Boolean(
    isExistingMember ||
      (currentUserId &&
        event?.attendees?.some((attendee) => attendee.userId === currentUserId)),
  );

  useEffect(() => {
    if (!event?.id || !alreadyJoinedWithAccount) return;
    router.replace(`/events/${event.id}`);
  }, [alreadyJoinedWithAccount, event?.id, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-[var(--danger)]">{loadError}</p>
          <Link
            href="/login"
            className="text-[var(--primary)] hover:underline"
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
      <div className="wt-card-raised w-full max-w-md p-8 text-center">
        <div className="text-4xl mb-4">🎲</div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Invited!</h1>
        <h2 className="mb-4 text-xl font-semibold text-[var(--primary)]">
          {event.title}
        </h2>
        <p className="wt-muted mb-1">
          {formatted.date}
          {' at '}
          {formatted.time}
          {' · '}
          {timeZone}
        </p>
        {event.location && (
          <p className="wt-muted mb-1 text-sm">{event.location}</p>
        )}
        {event.description && (
          <p className="wt-muted mt-3 text-sm">{event.description}</p>
        )}
        {actionError && (
          <p className="mt-3 text-sm text-[var(--danger)]">{actionError}</p>
        )}
        {alreadyJoinedWithAccount ? (
          <>
            <button
              onClick={() => router.push(`/events/${event.id}`)}
              className="wt-btn wt-btn-primary mt-6 w-full py-3 font-semibold"
            >
              Open Event
            </button>
            <p className="wt-muted mt-3 text-xs">
              You are already joined with this account
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleJoin}
              className="wt-btn wt-btn-primary mt-6 w-full py-3 font-semibold"
            >
              {hasAuthToken ? 'Join With Account' : 'Login and Join'}
            </button>
            <p className="wt-muted mt-3 text-xs">
              Login with your account to join this event
            </p>
          </>
        )}
      </div>
    </div>
  );
}
