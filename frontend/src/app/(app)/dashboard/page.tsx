'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatEventDateTime } from '@/lib/datetime';
import type { GameEvent } from '@/lib/types';

export default function DashboardPage() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<GameEvent[]>('/events').then(setEvents).finally(() => setLoading(false));
  }, []);

  const upcoming = events.filter((e) => new Date(e.dateTime) >= new Date());
  const past = events.filter((e) => new Date(e.dateTime) < new Date());

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Your Game Nights</h1>
        <Link
          href="/events/new"
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Game Night
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="text-5xl mb-4">🎲</div>
          <h2 className="text-xl font-semibold mb-2">No game nights yet</h2>
          <p className="text-gray-500 mb-6">Create your first game night in under 60 seconds</p>
          <Link
            href="/events/new"
            className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Create Game Night
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Upcoming</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Past</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({ event }: { event: GameEvent }) {
  const date = new Date(event.dateTime);
  const timeZone = event.eventTimezone || 'UTC';
  const formatted = formatEventDateTime(event.dateTime, timeZone);
  const isPast = date < new Date();
  const attendeeCount = event.attendees?.filter((a) => a.rsvpStatus === 'going').length || 0;

  const formatDurationMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const statusColors: Record<string, string> = {
    planning: 'bg-yellow-100 text-yellow-700',
    voting: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    active: 'bg-purple-100 text-purple-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <Link href={`/events/${event.id}`}>
      <div className={`bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow ${isPast ? 'opacity-75' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[event.status] || 'bg-gray-100'}`}>
            {event.status}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {formatted.date}
          {' · '}
          {formatted.time}
          {' · '}
          {timeZone}
        </p>
        {event.location && <p className="text-sm text-gray-500 mt-1">{event.location}</p>}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <span>{attendeeCount} going</span>
          {event.durationMinutes && (
            <span>{formatDurationMinutes(event.durationMinutes)}</span>
          )}
          <span className={event.type === 'open' ? 'text-green-600' : 'text-gray-400'}>
            {event.type === 'open' ? 'Open' : 'Invite only'}
          </span>
        </div>
      </div>
    </Link>
  );
}
