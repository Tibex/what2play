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
        PlaceAutocompleteElement?: new (options?: Record<string, unknown>) => HTMLElement;
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
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
  const placesContainerRef = useRef<HTMLDivElement | null>(null);
  const [datePart, timePart = '19:00'] = form.dateTime.split('T');

  const setDateTime = (nextDate: string, nextTime: string) => {
    setForm({ ...form, dateTime: `${nextDate}T${nextTime}` });
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !placesContainerRef.current) return;

    let cancelled = false;
    let autocompleteElement: HTMLElement | null = null;
    let onPlaceSelect: ((event: Event) => Promise<void>) | null = null;

    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        const google = getGoogleGlobal().google;
        if (cancelled || !placesContainerRef.current || !google?.maps?.places)
          return;

        const PlaceAutocompleteElement = google.maps.places.PlaceAutocompleteElement;
        if (!PlaceAutocompleteElement) {
          setPlacesReady(false);
          return;
        }

        const element = new PlaceAutocompleteElement({
          types: ['geocode', 'establishment'],
        });
        element.setAttribute('placeholder', 'Search for a place');
        element.classList.add('wt-input');
        placesContainerRef.current.replaceChildren(element);
        autocompleteElement = element;
        onPlaceSelect = async (event: Event) => {
          const e = event as Event & {
            placePrediction?: { toPlace?: () => { fetchFields?: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string; displayName?: string } };
            prediction?: { toPlace?: () => { fetchFields?: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string; displayName?: string } };
          };
          const prediction = e.placePrediction || e.prediction;
          const place = prediction?.toPlace?.();
          if (!place) return;
          if (place.fetchFields) {
            await place.fetchFields({ fields: ['displayName', 'formattedAddress'] });
          }
          const nextLocation = place.formattedAddress || place.displayName || '';
          if (nextLocation) setForm((prev) => ({ ...prev, location: nextLocation }));
        };
        element.addEventListener('gmp-select', onPlaceSelect as EventListener);
        element.addEventListener('gmp-placeselect', onPlaceSelect as EventListener);
        setPlacesReady(true);
      })
      .catch(() => {
        if (!cancelled) setPlacesReady(false);
      });

    return () => {
      cancelled = true;
      if (autocompleteElement && onPlaceSelect) {
        autocompleteElement.removeEventListener(
          'gmp-select',
          onPlaceSelect as EventListener,
        );
        autocompleteElement.removeEventListener(
          'gmp-placeselect',
          onPlaceSelect as EventListener,
        );
      }
      if (placesContainerRef.current) {
        placesContainerRef.current.replaceChildren();
      }
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
    <form onSubmit={handleSubmit} className="wt-card space-y-5 p-8">
      {error && <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{error}</div>}

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          className="wt-input"
          placeholder="Friday Night Board Games"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Date & Time</label>
        <div className="wt-subtle space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={datePart}
              onChange={(e) => setDateTime(e.target.value, timePart)}
              required
              className="wt-input"
            />
            <input
              type="time"
              value={timePart}
              onChange={(e) => setDateTime(datePart, e.target.value)}
              step={900}
              required
              className="wt-input"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <div ref={placesContainerRef} className="mb-2" />
          <input
            ref={locationInputRef}
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="wt-input"
            placeholder={
              placesReady
                ? 'Selected place appears here (you can edit manually)'
                : '123 Main St or Online'
            }
          />
          {placesReady && (
            <p className="wt-muted mt-1 text-xs">
              Google Places autocomplete enabled (manual edit still available).
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Duration</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setForm({ ...form, durationMinutes: mins })}
              className={`wt-btn px-4 py-2 text-sm font-medium ${
                form.durationMinutes === mins
                  ? 'wt-btn-primary'
                  : 'wt-btn-secondary'
              }`}
            >
              {durationLabel(mins)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Max Capacity</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, capacity: Math.max(2, form.capacity - 1) })}
            className="wt-btn wt-btn-secondary flex h-10 w-10 items-center justify-center text-lg font-bold"
          >
            −
          </button>
          <span className="w-12 text-center text-2xl font-semibold tabular-nums">
            {form.capacity}
          </span>
          <button
            type="button"
            onClick={() => setForm({ ...form, capacity: form.capacity + 1 })}
            className="wt-btn wt-btn-secondary flex h-10 w-10 items-center justify-center text-lg font-bold"
          >
            +
          </button>
          <span className="wt-muted text-sm">players</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Event Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="wt-input"
          >
            <option value="invite">Invite Only</option>
            <option value="open">Open</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="wt-input"
          placeholder="What kind of night are we having?"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.discoveryMode}
          onChange={(e) => setForm({ ...form, discoveryMode: e.target.checked })}
          className="rounded border-[var(--border)] text-[var(--primary)]"
        />
        <span>Include game suggestions beyond what attendees own</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="wt-btn wt-btn-primary w-full py-2 text-sm font-medium disabled:opacity-50 sm:text-base"
      >
        {loading ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
