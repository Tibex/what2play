'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import EventForm, { type EventFormData } from '@/components/EventForm';
import type { GameEvent } from '@/lib/types';
import { toDateTimeLocalInTimeZone } from '@/lib/datetime';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<GameEvent>(`/events/${id}`).then((ev) => {
      setEvent(ev);
      setLoading(false);
    });
  }, [id]);

  if (loading || !event) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (user?.id !== event.hostId) {
    return (
      <div className="text-center py-20 text-gray-500">
        Only the host can edit this event.
      </div>
    );
  }

  const eventTimeZone = event.eventTimezone || 'UTC';
  const localDateTime = toDateTimeLocalInTimeZone(event.dateTime, eventTimeZone);

  const initial: EventFormData = {
    title: event.title,
    description: event.description || '',
    dateTime: localDateTime,
    eventTimezone: eventTimeZone,
    durationMinutes: event.durationMinutes || 180,
    location: event.location || '',
    capacity: event.capacity || 8,
    type: event.type || 'invite',
    discoveryMode: event.discoveryMode || false,
  };

  const handleSubmit = async (data: EventFormData) => {
    await api.patch(`/events/${id}`, {
      ...data,
      durationMinutes: Number(data.durationMinutes),
      capacity: Number(data.capacity),
    });
    toast.success('Event updated');
    router.push(`/events/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Game Night</h1>
      <EventForm
        initial={initial}
        submitLabel="Save Changes"
        submittingLabel="Saving..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
