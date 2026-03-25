'use client';

import { useState } from 'react';

export interface EventFormData {
  title: string;
  description: string;
  dateTime: string;
  durationMinutes: number;
  location: string;
  capacity: number;
  type: string;
  discoveryMode: boolean;
}

const DURATION_OPTIONS = [60, 120, 180, 240, 300, 360];

function durationLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

export default function EventForm({
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
}: Readonly<{
  initial: EventFormData;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (data: EventFormData) => Promise<void>;
}>) {
  const [form, setForm] = useState<EventFormData>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder="123 Main St or Online"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setForm({ ...form, durationMinutes: mins })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                form.durationMinutes === mins
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300'
              }`}
            >
              {durationLabel(mins)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Capacity</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, capacity: Math.max(2, form.capacity - 1) })}
            className="w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 text-lg font-bold hover:border-indigo-300 transition flex items-center justify-center"
          >
            −
          </button>
          <span className="text-2xl font-semibold text-gray-900 w-12 text-center tabular-nums">
            {form.capacity}
          </span>
          <button
            type="button"
            onClick={() => setForm({ ...form, capacity: form.capacity + 1 })}
            className="w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 text-lg font-bold hover:border-indigo-300 transition flex items-center justify-center"
          >
            +
          </button>
          <span className="text-sm text-gray-500">players</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        {loading ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
