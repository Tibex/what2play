'use client';

import { useEffect, useRef, useState } from 'react';

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
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-script';

let googleMapsPlacesLoader: Promise<void> | null = null;
type GoogleGlobal = typeof globalThis & {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          options?: Record<string, unknown>,
        ) => {
          addListener: (
            eventName: string,
            handler: () => void,
          ) => { remove: () => void };
          getPlace: () => { formatted_address?: string; name?: string };
        };
      };
    };
  };
};

function getGoogleGlobal() {
  return globalThis as GoogleGlobal;
}

function loadGoogleMapsPlaces(apiKey: string): Promise<void> {
  if (typeof globalThis.window === 'undefined') return Promise.resolve();

  if (getGoogleGlobal().google?.maps?.places) return Promise.resolve();
  if (googleMapsPlacesLoader) return googleMapsPlacesLoader;

  googleMapsPlacesLoader = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as
      | HTMLScriptElement
      | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Failed to load Google Maps Places script')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Google Maps Places script')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return googleMapsPlacesLoader;
}

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
  const [placesReady, setPlacesReady] = useState(false);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const [datePart, timePart = '19:00'] = form.dateTime.split('T');

  const setDateTime = (nextDate: string, nextTime: string) => {
    setForm({ ...form, dateTime: `${nextDate}T${nextTime}` });
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !locationInputRef.current) return;

    let cancelled = false;
    let listener: { remove: () => void } | undefined;

    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        const google = getGoogleGlobal().google;
        if (cancelled || !locationInputRef.current || !google?.maps?.places)
          return;

        const autocomplete = new google.maps.places.Autocomplete(
          locationInputRef.current,
          {
            fields: ['formatted_address', 'name'],
            types: ['geocode', 'establishment'],
          },
        );
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const nextLocation =
            place.formatted_address || place.name || locationInputRef.current?.value || '';
          setForm((prev) => ({ ...prev, location: nextLocation }));
        });
        setPlacesReady(true);
      })
      .catch(() => {
        if (!cancelled) setPlacesReady(false);
      });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
        <div className="rounded-xl border border-gray-200 p-3 sm:p-4 bg-gray-50/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={datePart}
              onChange={(e) => setDateTime(e.target.value, timePart)}
              required
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
            <input
              type="time"
              value={timePart}
              onChange={(e) => setDateTime(datePart, e.target.value)}
              step={900}
              required
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            ref={locationInputRef}
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition"
            placeholder={placesReady ? 'Search for a place or type manually' : '123 Main St or Online'}
          />
          {placesReady && (
            <p className="mt-1 text-xs text-gray-500">Google Places autocomplete enabled.</p>
          )}
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
        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm sm:text-base font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
