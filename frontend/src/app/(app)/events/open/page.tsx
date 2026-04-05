'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { GameEvent } from '@/lib/types';

export default function OpenEventsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);

  const loadOpenEvents = useCallback(async () => {
    try {
      const data = await api.get<GameEvent[]>('/events/open');
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOpenEvents();
  }, [loadOpenEvents]);

  const handleJoin = async (eventId: string) => {
    setJoiningEventId(eventId);
    try {
      await api.post(`/events/${eventId}/rsvp`, { status: 'going' });
      toast.success('Joined event');
      await loadOpenEvents();
    } catch {
      /* toast handled by api client */
    } finally {
      setJoiningEventId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Open Events</h1>
          <p className="wt-muted text-sm">
            Discover public planning events and join a table.
          </p>
        </div>
        <Link
          href="/events/new"
          className="wt-btn wt-btn-primary inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium"
        >
          Host Open Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="wt-card-raised py-14 text-center">
          <h2 className="text-lg font-semibold">No open events right now</h2>
          <p className="wt-muted mt-2 text-sm">
            Check again later or create one for your local group.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const date = new Date(event.dateTime as string);
            const timeZone = event.eventTimezone || 'UTC';
            const shortDate = new Intl.DateTimeFormat(undefined, {
              month: 'short',
              day: 'numeric',
              timeZone,
            }).format(date);
            const shortTime = new Intl.DateTimeFormat(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              timeZone,
            }).format(date);
            const goingCount =
              event.attendees?.filter((a) => a.rsvpStatus === 'going').length ||
              0;
            const isGoing = Boolean(
              user?.id &&
                event.attendees?.some(
                  (attendee) =>
                    attendee.userId === user.id &&
                    attendee.rsvpStatus === 'going',
                ),
            );
            const isFull = Boolean(
              event.capacity && event.capacity > 0 && goingCount >= event.capacity,
            );

            return (
              <div
                key={event.id}
                className="wt-card-raised flex h-full cursor-pointer flex-col gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/events/${event.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/events/${event.id}`);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 text-base font-semibold text-[var(--foreground)]">
                    {event.title}
                  </h2>
                  <span className="rounded-full bg-[#dbe8d3] px-2 py-0.5 text-xs font-medium text-[#355f39]">
                    open
                  </span>
                </div>

                <p className="wt-muted text-sm">
                  Hosted by {event.host?.name || 'Unknown'}
                </p>
                <p className="wt-muted text-sm">
                  {shortDate} at {shortTime} ({timeZone})
                </p>
                {event.location ? (
                  <p className="wt-muted line-clamp-2 text-sm">{event.location}</p>
                ) : null}
                {event.description ? (
                  <p className="line-clamp-3 text-sm text-[var(--foreground)]">
                    {event.description}
                  </p>
                ) : null}

                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
                  <span className="wt-muted">
                    {goingCount}
                    {event.capacity ? `/${event.capacity}` : ''} going
                  </span>
                  {!isGoing ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleJoin(event.id);
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                      disabled={joiningEventId === event.id || isFull}
                      className="wt-btn wt-btn-primary px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {isFull
                        ? 'Full'
                        : joiningEventId === event.id
                          ? 'Joining...'
                          : 'Join'}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-[#3f6a3f]">Joined</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
