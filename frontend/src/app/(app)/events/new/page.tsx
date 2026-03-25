'use client';

import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import EventForm, { type EventFormData } from '@/components/EventForm';

export default function NewEventPage() {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const initial: EventFormData = {
    title: '',
    description: '',
    dateTime: tomorrow.toISOString().slice(0, 16),
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
      <h1 className="text-2xl font-bold mb-6">New Game Night</h1>
      <EventForm
        initial={initial}
        submitLabel="Create Game Night"
        submittingLabel="Creating..."
        onSubmit={handleSubmit}
      />
    </div>
  );
}
