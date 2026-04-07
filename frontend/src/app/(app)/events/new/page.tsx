'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import EventForm, { type EventFormData } from '@/components/EventForm';
import { isoToDatetimeLocalValue } from '@/lib/datetime';
import type { Group } from '@/lib/types';

function defaultLocalDateTime(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
}

function NewEventPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>('');

  const browserTimeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      : 'UTC';

  const initial: EventFormData = useMemo(() => {
    const qpDate = searchParams.get('dateTime');
    const qpTitle = searchParams.get('title');
    const fromIso = searchParams.get('fromIso');
    let dateTime = defaultLocalDateTime();
    if (qpDate?.trim()) dateTime = qpDate.trim();
    else if (fromIso) {
      const local = isoToDatetimeLocalValue(fromIso);
      if (local) dateTime = local;
    }

    const qpDur = searchParams.get('durationMinutes');
    const parsedDur = qpDur ? Number(qpDur) : NaN;
    const durationMinutes =
      Number.isFinite(parsedDur) && parsedDur >= 30 && parsedDur <= 720
        ? parsedDur
        : 180;

    return {
      title: qpTitle?.trim() ? qpTitle.trim() : '',
      description: '',
      dateTime,
      durationMinutes,
      location: '',
      capacity: 8,
      type: 'invite',
      discoveryMode: false,
      scheduleMode: 'fixed',
      availabilitySlots: [],
    };
  }, [searchParams]);

  useEffect(() => {
    api
      .get<Group[]>('/groups', { showErrorToast: false })
      .then((rows) => setGroups(rows))
      .catch(() => setGroups([]));
  }, []);

  const handleSubmit = async (data: EventFormData) => {
    const usePoll = data.scheduleMode === 'poll';
    const base = {
      title: data.title,
      description: data.description || undefined,
      eventTimezone: browserTimeZone,
      durationMinutes: Number(data.durationMinutes),
      location: data.location || undefined,
      type: data.type,
      discoveryMode: data.discoveryMode,
      capacity: data.type === 'open' ? Number(data.capacity) : null,
    };

    const event = await api.post<{ id: string }>('/events', {
      ...base,
      groupId: groupId || undefined,
      ...(usePoll
        ? { useAvailabilityPoll: true, availabilitySlots: data.availabilitySlots }
        : { dateTime: data.dateTime }),
    });
    router.push(`/events/${event.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">New Game Night</h1>
      {groups.length > 0 && (
        <div className="wt-card mb-4 p-4">
          <label htmlFor="group-select" className="mb-1 block text-sm font-medium">
            Create for group (optional)
          </label>
          <select
            id="group-select"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="wt-input"
          >
            <option value="">No group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <p className="wt-muted mt-2 text-xs">
            Group members are auto-invited as pending attendees.
          </p>
        </div>
      )}
      <EventForm
        initial={initial}
        submitLabel="Create Night"
        submittingLabel="Creating..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export default function NewEventPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto">
          <p className="text-[var(--muted)]">Loading…</p>
        </div>
      }
    >
      <NewEventPageInner />
    </Suspense>
  );
}
