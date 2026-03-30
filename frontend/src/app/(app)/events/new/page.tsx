'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import EventForm, { type EventFormData } from '@/components/EventForm';

export default function NewEventPage() {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const localDateTime = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const initial: EventFormData = {
    title: '',
    description: '',
    dateTime: localDateTime,
    eventTimezone: browserTimeZone,
    durationMinutes: 180,
    location: '',
    capacity: 8,
    type: 'invite',
    discoveryMode: false,
  };

  const handleSubmit = async (data: EventFormData) => {
    const event = await api.post<{ id: string }>('/events', {
      ...data,
      durationMinutes: Number(data.durationMinutes),
      capacity: Number(data.capacity),
    });
    router.push(`/events/${event.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">New Game Night</h1>
      <EventForm
        initial={initial}
        submitLabel="Create Night"
        submittingLabel="Creating..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
