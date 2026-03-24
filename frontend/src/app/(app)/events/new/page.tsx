'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function NewEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  const defaultDate = tomorrow.toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: '',
    description: '',
    dateTime: defaultDate,
    durationMinutes: 180,
    location: '',
    capacity: 8,
    type: 'invite',
    discoveryMode: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const event = await api.post<{ id: string }>('/events', {
        ...form,
        durationMinutes: Number(form.durationMinutes),
        capacity: Number(form.capacity),
      });
      router.push(`/events/${event.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Game Night</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-8 space-y-5">
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="Friday Night Board Games"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={form.dateTime}
              onChange={(e) => setForm({ ...form, dateTime: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
            <input
              type="number"
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="123 Main St or Online"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              min={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            >
              <option value="invite">Invite Only</option>
              <option value="open">Open</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="What kind of night are we having?"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.discoveryMode}
            onChange={(e) => setForm({ ...form, discoveryMode: e.target.checked })}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>Include game suggestions beyond what attendees own</span>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Game Night'}
        </button>
      </form>
    </div>
  );
}
