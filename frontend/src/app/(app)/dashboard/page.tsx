'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { GameEvent } from '@/lib/types';

type DashboardView = 'cards' | 'calendar';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusStyles: Record<
  string,
  { badge: string; accent: string; dot: string; border: string }
> = {
  planning: {
    badge: 'bg-[#f1e0b8] text-[#6b521f]',
    accent: 'bg-yellow-50',
    dot: 'bg-[#b88733]',
    border: 'border-[#d8ba7a]',
  },
  voting: {
    badge: 'bg-[#d8e4ea] text-[#2f586b]',
    accent: 'bg-blue-50',
    dot: 'bg-[#4a7b90]',
    border: 'border-[#a6c0cd]',
  },
  confirmed: {
    badge: 'bg-[#dbe8d3] text-[#355f39]',
    accent: 'bg-emerald-50',
    dot: 'bg-[#4f7e4f]',
    border: 'border-[#afc6a1]',
  },
  active: {
    badge: 'bg-[#e1d8ea] text-[#5a3f78]',
    accent: 'bg-purple-50',
    dot: 'bg-[#7c5aa6]',
    border: 'border-[#c5b3dd]',
  },
  completed: {
    badge: 'bg-[#e5dccf] text-[#5d5345]',
    accent: 'bg-gray-50',
    dot: 'bg-[#7c7163]',
    border: 'border-[#cabca8]',
  },
  cancelled: {
    badge: 'bg-[#efd8d3] text-[#8a4137]',
    accent: 'bg-red-50',
    dot: 'bg-[#a35247]',
    border: 'border-[#ddb5ae]',
  },
};

const FALLBACK_STATUS = {
  badge: 'bg-[#e5dccf] text-[#5d5345]',
  accent: 'bg-gray-50',
  dot: 'bg-[#7c7163]',
  border: 'border-[#cabca8]',
};

function getDateKey(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMondayFirstIndex(day: number): number {
  return (day + 6) % 7;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DashboardView>('cards');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

  useEffect(() => {
    api.get<GameEvent[]>('/events').then(setEvents).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const isPastEvent = (event: GameEvent) =>
    event.status === 'completed' || new Date(event.dateTime) < now;
  const upcoming = events.filter((event) => !isPastEvent(event));
  const past = events.filter((event) => isPastEvent(event));
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, GameEvent[]>();
    for (const event of events) {
      const key = getDateKey(event.dateTime);
      const list = grouped.get(key) || [];
      list.push(event);
      grouped.set(key, list);
    }
    for (const [, list] of grouped.entries()) {
      list.sort(
        (a, b) =>
          new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
      );
    }
    return grouped;
  }, [events]);

  useEffect(() => {
    if (!selectedDateKey && events.length > 0) {
      queueMicrotask(() => {
        setSelectedDateKey(getDateKey(events[0].dateTime));
      });
    }
  }, [events, selectedDateKey]);

  const monthDays = useMemo(() => {
    const days: Array<{
      key: string;
      dayNumber: number;
      inCurrentMonth: boolean;
      events: GameEvent[];
    }> = [];
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = toMondayFirstIndex(firstDay.getDay());
    const gridStart = new Date(year, month, 1 - startOffset);
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + i);
      const key = getDateKey(current);
      days.push({
        key,
        dayNumber: current.getDate(),
        inCurrentMonth: current.getMonth() === month,
        events: eventsByDate.get(key) || [],
      });
    }
    return days;
  }, [eventsByDate, monthCursor]);

  const selectedDayEvents = selectedDateKey ? eventsByDate.get(selectedDateKey) || [] : [];
  const selectedUpcoming = selectedDayEvents.filter((event) => !isPastEvent(event));
  const selectedPast = selectedDayEvents.filter((event) => isPastEvent(event));
  const shouldShowEmptyState = events.length === 0;
  const shouldShowCards = !shouldShowEmptyState && view === 'cards';
  let content: React.ReactNode;

  if (shouldShowEmptyState) {
    content = (
      <div className="wt-card-raised py-20 text-center">
        <div className="text-5xl mb-4">🎲</div>
        <h2 className="text-xl font-semibold mb-2">No game nights yet</h2>
        <p className="wt-muted mb-6">Create your first game night in under 60 seconds</p>
        <Link
          href="/events/new"
          className="wt-btn wt-btn-primary inline-block px-4 py-2 text-sm font-medium"
        >
          Create Night
        </Link>
      </div>
    );
  } else if (shouldShowCards) {
    content = (
      <>
        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="wt-muted mb-4 text-lg font-semibold">Upcoming</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
        {past.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowPastEvents((prev) => !prev)}
              className="wt-muted mb-4 inline-flex items-center gap-2 text-lg font-semibold hover:text-[var(--foreground)]"
              aria-expanded={showPastEvents}
              aria-controls="past-events-grid"
            >
              <span>Past</span>
              <span className="wt-muted text-sm">
                ({past.length}) {showPastEvents ? 'Hide' : 'Show'}
              </span>
            </button>
            {showPastEvents && (
              <div
                id="past-events-grid"
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 items-stretch"
              >
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </section>
        )}
      </>
    );
  } else {
    content = (
      <section className="space-y-4">
        <div className="wt-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {monthCursor.toLocaleString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() - 1,
                      1,
                    ),
                  )
                }
                className="wt-btn wt-btn-secondary px-2.5 py-1.5 text-sm"
                aria-label="Previous month"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() =>
                  setMonthCursor(
                    new Date(
                      monthCursor.getFullYear(),
                      monthCursor.getMonth() + 1,
                      1,
                    ),
                  )
                }
                className="wt-btn wt-btn-secondary px-2.5 py-1.5 text-sm"
                aria-label="Next month"
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-xs font-medium text-gray-500 mb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-1 text-center">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day) => {
              const isSelected = day.key === selectedDateKey;
              const upcomingCount = day.events.filter((e) => !isPastEvent(e)).length;
              const pastCount = day.events.length - upcomingCount;
              return (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => setSelectedDateKey(day.key)}
                  className={`min-h-20 rounded-lg border p-2 text-left transition-colors ${
                    day.inCurrentMonth
                      ? 'bg-white border-gray-200 hover:border-indigo-300'
                      : 'bg-gray-50 border-gray-100 text-gray-400'
                  } ${isSelected ? 'ring-2 ring-[var(--primary)] border-[var(--primary)]' : ''}`}
                >
                  <div className="text-xs font-semibold">{day.dayNumber}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {day.events.slice(0, 3).map((event) => {
                      const status = statusStyles[event.status] || FALLBACK_STATUS;
                      return (
                        <span
                          key={event.id}
                          className={`h-2 w-2 rounded-full ${status.dot}`}
                          title={event.title}
                        />
                      );
                    })}
                  </div>
                  {day.events.length > 0 && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      {upcomingCount > 0 && <span>{upcomingCount} upcoming</span>}
                      {upcomingCount > 0 && pastCount > 0 && <span> · </span>}
                      {pastCount > 0 && <span>{pastCount} past</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="wt-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {selectedDateKey
              ? `Events on ${new Date(selectedDateKey).toLocaleDateString()}`
              : 'Pick a day'}
          </h3>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-500">No events on this day.</p>
          ) : (
            <div className="space-y-4">
              {selectedUpcoming.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Upcoming
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                    {selectedUpcoming.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
              {selectedPast.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Past
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
                    {selectedPast.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Your Game Nights</h1>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--paper)] p-1"
            role="tablist"
            aria-label="Dashboard view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === 'cards'}
              onClick={() => setView('cards')}
              className={`h-7 px-3 rounded-md text-sm font-medium transition-colors ${
                view === 'cards'
                  ? 'bg-[var(--primary)] text-[#fff9ef]'
                  : 'wt-muted hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'calendar'}
              onClick={() => setView('calendar')}
              className={`h-7 px-3 rounded-md text-sm font-medium transition-colors ${
                view === 'calendar'
                  ? 'bg-[var(--primary)] text-[#fff9ef]'
                  : 'wt-muted hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
              }`}
            >
              Calendar
            </button>
          </div>
          <Link
            href="/events/new"
              className="wt-btn wt-btn-primary inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium"
          >
            + New Night
          </Link>
        </div>
      </div>

      {content}
    </div>
  );
}

function EventCard({ event }: Readonly<{ event: GameEvent }>) {
  const date = new Date(event.dateTime);
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
  const isPast = event.status === 'completed' || date < new Date();
  const attendeeCount = event.attendees?.filter((a) => a.rsvpStatus === 'going').length || 0;
  const isCompleted = event.status === 'completed';
  let typeLabel = 'Invite only';
  let typeLabelClass = 'text-[var(--muted)]';
  if (isCompleted) {
    typeLabel = 'Past event';
    typeLabelClass = 'text-[#7c7163]';
  } else if (event.type === 'open') {
    typeLabel = 'Open';
    typeLabelClass = 'text-[#3f6a3f]';
  }

  const formatDurationMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  const status = statusStyles[event.status] || FALLBACK_STATUS;

  return (
    <Link
      href={`/events/${event.id}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
    >
      <div
        className={`h-full min-h-40 rounded-xl border bg-[var(--paper)] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] ${status.border} ${isPast ? 'opacity-85' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="min-w-0 flex-1 pr-2 font-semibold text-gray-900 truncate">
            {event.title}
          </h3>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${status.badge}`}
          >
            {event.status}
          </span>
        </div>
        <p className="text-sm text-gray-600 flex items-start gap-2">
          <span aria-hidden="true">🕒</span>
          <span className="line-clamp-1">{shortDate} · {shortTime}</span>
        </p>
        {event.location && (
          <p className="text-sm text-gray-600 mt-0.5 flex items-start gap-2">
            <span aria-hidden="true">📍</span>
            <span className="line-clamp-1">{event.location}</span>
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap mt-auto pt-3">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">👥</span>
            {attendeeCount} going
          </span>
          {event.durationMinutes && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true">⏱</span>
              {formatDurationMinutes(event.durationMinutes)}
            </span>
          )}
          <span className={typeLabelClass}>{typeLabel}</span>
        </div>
      </div>
    </Link>
  );
}
