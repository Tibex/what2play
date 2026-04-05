'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_DURATION_OPTIONS_MINUTES,
  formatDurationMinutes,
} from '@/lib/duration';
import DragSelectCalendar from '@/components/events/DragSelectCalendar';
import { localDateKeyAndTimeToIso } from '@/lib/schedulePollDates';

export interface EventFormData {
  title: string;
  description: string;
  dateTime: string;
  durationMinutes: number;
  location: string;
  capacity: number;
  type: 'invite' | 'open';
  discoveryMode: boolean;
  scheduleMode: 'fixed' | 'poll';
  /** Filled when scheduleMode is poll at submit */
  availabilitySlots: { start: string; label?: string }[];
}

const POLL_DEFAULT_START = '19:00';

const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-places-script';
const PLACES_READY_TIMEOUT_MS = 4000;
const PLACE_SHADOW_STYLE_ID = 'wt-place-shadow-overrides';

let googleMapsPlacesLoader: Promise<void> | null = null;
type GoogleGlobal = typeof globalThis & {
  google?: {
    maps?: {
      places?: {
        Autocomplete?: new (
          inputField: HTMLInputElement,
          options?: Record<string, unknown>,
        ) => {
          addListener?: (
            eventName: string,
            handler: () => void,
          ) => { remove?: () => void };
          getPlace?: () => {
            formatted_address?: string;
            name?: string;
          };
        };
        PlaceAutocompleteElement?: new (
          options?: Record<string, unknown>,
        ) => HTMLElement & { value?: string };
      };
    };
  };
};
type ShadowPatchGlobal = typeof globalThis & {
  __wtPlaceAutocompleteShadowPatched?: boolean;
  __wtPlaceAutocompleteOriginalAttachShadow?: Element['attachShadow'];
};

function getGoogleGlobal() {
  return globalThis as GoogleGlobal;
}

function installPlaceAutocompleteShadowOverride(): void {
  if (typeof globalThis.window === 'undefined') return;

  const rootGlobal = globalThis as ShadowPatchGlobal;
  if (rootGlobal.__wtPlaceAutocompleteShadowPatched) return;

  const originalAttachShadow =
    rootGlobal.__wtPlaceAutocompleteOriginalAttachShadow ??
    Element.prototype.attachShadow;

  rootGlobal.__wtPlaceAutocompleteOriginalAttachShadow =
    originalAttachShadow;

  Element.prototype.attachShadow = function (
    this: Element,
    init: ShadowRootInit,
  ) {
    const isPlaceAutocomplete = this.localName === 'gmp-place-autocomplete';
    const shadow = originalAttachShadow.call(
      this,
      isPlaceAutocomplete ? { ...init, mode: 'open' } : init,
    );

    if (
      isPlaceAutocomplete &&
      !shadow.getElementById(PLACE_SHADOW_STYLE_ID)
    ) {
      const style = document.createElement('style');
      style.id = PLACE_SHADOW_STYLE_ID;
      style.textContent = `
        .widget-container,
        .input-container,
        .text-input {
          border: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .input-container {
          padding: 0 !important;
          min-height: 32px !important;
          height: 32px !important;
        }
        .focus-ring {
          display: none !important;
          border: 0 !important;
          box-shadow: none !important;
          opacity: 0 !important;
        }
        .text-input,
        input {
          border: 0 !important;
          outline: none !important;
          box-shadow: none !important;
          min-height: 32px !important;
          height: 32px !important;
          padding: 0.22rem 0.56rem !important;
          background: transparent !important;
        }
        ul[role='listbox'],
        .prediction-list {
          border: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        ul[role='listbox'] > li,
        .prediction-list > li {
          min-height: 32px !important;
          height: 32px !important;
          padding: 4px 8px !important;
          margin: 0 !important;
          border: 0 !important;
        }
        .attributions {
          min-height: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          padding: 0 8px !important;
          margin: 0 !important;
          border-top: 0 !important;
        }
        .attributions .container {
          min-height: 32px !important;
          height: 32px !important;
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 4px !important;
        }
        .attributions .info-button {
          width: 20px !important;
          height: 20px !important;
          min-height: 20px !important;
          min-width: 20px !important;
        }
        .attributions .tap-area {
          width: 20px !important;
          height: 20px !important;
        }
      `;
      shadow.appendChild(style);
    }

    return shadow;
  };

  rootGlobal.__wtPlaceAutocompleteShadowPatched = true;
}

function waitForPlacesNamespace(
  timeoutMs: number = PLACES_READY_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (getGoogleGlobal().google?.maps?.places) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Google Maps loaded but Places namespace not ready'));
        return;
      }
      globalThis.setTimeout(check, 50);
    };
    check();
  });
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
      const placesReady = Boolean(getGoogleGlobal().google?.maps?.places);
      if (placesReady) {
        resolve();
        return;
      }

      const existingLoaded = existing.dataset.loaded === 'true';
      const existingHasPlaces = existing.src.includes('libraries=places');

      if (existingLoaded && !existingHasPlaces) {
        existing.remove();
      } else {
        if (existingLoaded && existingHasPlaces) {
          void waitForPlacesNamespace().then(resolve).catch(reject);
          return;
        }
        existing.addEventListener(
          'load',
          () => {
            existing.dataset.loaded = 'true';
            void waitForPlacesNamespace().then(resolve).catch(reject);
          },
          { once: true },
        );
        existing.addEventListener(
          'error',
          () => reject(new Error('Failed to load Google Maps Places script')),
          { once: true },
        );
        return;
      }
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      '&libraries=places&loading=async';
    script.async = true;
    script.defer = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        void waitForPlacesNamespace().then(resolve).catch(reject);
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Google Maps Places script')),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPlacesLoader = null;
    throw error;
  });

  return googleMapsPlacesLoader;
}

function toTimeInputValue(value: Date): string {
  const hh = String(value.getHours()).padStart(2, '0');
  const mm = String(value.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  const [usePlacesElement, setUsePlacesElement] = useState(false);
  const latestLocationRef = useRef(initial.location);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const placesContainerRef = useRef<HTMLDivElement | null>(null);
  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>([]);
  const [startTimeByDay, setStartTimeByDay] = useState<Record<string, string>>(
    {},
  );

  const setSelectedKeys = useCallback((keys: string[]) => {
    setSelectedDayKeys(keys);
    setStartTimeByDay((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        if (next[k] === undefined) next[k] = POLL_DEFAULT_START;
      }
      for (const k of Object.keys(next)) {
        if (!keys.includes(k)) delete next[k];
      }
      return next;
    });
  }, []);

  const sortedPollDays = useMemo(
    () => [...selectedDayKeys].sort(),
    [selectedDayKeys],
  );

  const [datePart, timePart = POLL_DEFAULT_START] = form.dateTime.split('T');

  const setDateTime = (nextDate: string, nextTime: string) => {
    setForm({ ...form, dateTime: `${nextDate}T${nextTime}` });
  };

  useEffect(() => {
    latestLocationRef.current = form.location;
  }, [form.location]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setUsePlacesElement(false);
      return;
    }

    let cancelled = false;
    let removeListener: (() => void) | null = null;
    let elementListenerCleanup: (() => void) | null = null;
    let mountedElement:
      | (HTMLElement & { value?: string })
      | null = null;

    const debugLog = (...args: unknown[]) => {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[EventForm][Places]', ...args);
      }
    };
    const debugWarn = (...args: unknown[]) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[EventForm][Places]', ...args);
      }
    };

    installPlaceAutocompleteShadowOverride();

    const mountLegacyAutocomplete = () => {
      const google = getGoogleGlobal().google;
      const Autocomplete = google?.maps?.places?.Autocomplete;
      if (!Autocomplete || !locationInputRef.current) {
        debugWarn(
          'Places loaded but no supported autocomplete constructor found',
        );
        return;
      }
      const autocomplete = new Autocomplete(locationInputRef.current, {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'name'],
      });
      const handlePlaceChanged = () => {
        const place = autocomplete.getPlace?.();
        if (!place) return;
        const nextLocation = place.formatted_address || place.name || '';
        if (nextLocation)
          setForm((prev) => ({ ...prev, location: nextLocation }));
      };
      const listener = autocomplete.addListener?.(
        'place_changed',
        handlePlaceChanged,
      );
      removeListener = () => listener?.remove?.();
      setUsePlacesElement(false);
      debugLog('Using Autocomplete');
    };

    loadGoogleMapsPlaces(apiKey)
      .then(() => {
        const google = getGoogleGlobal().google;
        if (cancelled) return;
        if (!google?.maps?.places) {
          debugWarn('Places namespace unavailable after loader');
          return;
        }

        const PlaceAutocompleteElement =
          google.maps.places.PlaceAutocompleteElement;
        if (PlaceAutocompleteElement && placesContainerRef.current) {
          try {
            const element = new PlaceAutocompleteElement({
              types: ['geocode', 'establishment'],
            });
            element.classList.add('wt-place-input');
            element.setAttribute('placeholder', '123 Main St or Online');
            if (latestLocationRef.current) {
              element.value = latestLocationRef.current;
            }

            const onPlaceSelect = async (event: Event) => {
              const e = event as Event & {
                placePrediction?: {
                  toPlace?: () => {
                    fetchFields?: (opts: { fields: string[] }) => Promise<void>;
                    formattedAddress?: string;
                    displayName?: string;
                  };
                };
                prediction?: {
                  toPlace?: () => {
                    fetchFields?: (opts: { fields: string[] }) => Promise<void>;
                    formattedAddress?: string;
                    displayName?: string;
                  };
                };
              };
              const prediction = e.placePrediction || e.prediction;
              const place = prediction?.toPlace?.();
              if (!place) return;
              if (place.fetchFields) {
                await place.fetchFields({
                  fields: ['displayName', 'formattedAddress'],
                });
              }
              const nextLocation =
                place.formattedAddress || place.displayName || '';
              if (nextLocation) {
                setForm((prev) => ({ ...prev, location: nextLocation }));
              }
            };
            const syncTypedValue = (event: Event) => {
              const nextLocation =
                ((event.target as { value?: string } | null)?.value ??
                  element.value ??
                  '') || '';
              setForm((prev) =>
                prev.location === nextLocation
                  ? prev
                  : { ...prev, location: nextLocation },
              );
            };

            element.addEventListener(
              'gmp-select',
              onPlaceSelect as EventListener,
            );
            element.addEventListener(
              'gmp-placeselect',
              onPlaceSelect as EventListener,
            );
            element.addEventListener('input', syncTypedValue as EventListener);
            element.addEventListener('change', syncTypedValue as EventListener);

            placesContainerRef.current.replaceChildren(element);
            mountedElement = element;
            elementListenerCleanup = () => {
              element.removeEventListener(
                'gmp-select',
                onPlaceSelect as EventListener,
              );
              element.removeEventListener(
                'gmp-placeselect',
                onPlaceSelect as EventListener,
              );
              element.removeEventListener(
                'input',
                syncTypedValue as EventListener,
              );
              element.removeEventListener(
                'change',
                syncTypedValue as EventListener,
              );
            };
            setUsePlacesElement(true);
            debugLog('Using PlaceAutocompleteElement');
            return;
          } catch (err) {
            debugWarn(
              'PlaceAutocompleteElement init failed, falling back to Autocomplete',
              err,
            );
            if (placesContainerRef.current) {
              placesContainerRef.current.replaceChildren();
            }
          }
        }

        mountLegacyAutocomplete();
      })
      .catch((err: unknown) => {
        setUsePlacesElement(false);
        debugWarn('Failed to initialize Google Places', err);
      });

    return () => {
      cancelled = true;
      removeListener?.();
      elementListenerCleanup?.();
      if (mountedElement && placesContainerRef.current) {
        placesContainerRef.current.replaceChildren();
      }
    };
  }, [initial.location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (form.scheduleMode === 'poll') {
        if (sortedPollDays.length < 1) {
          setError('Select at least one day on the calendar');
          setLoading(false);
          return;
        }
        if (sortedPollDays.length > 32) {
          setError('Maximum 32 time options — remove some days');
          setLoading(false);
          return;
        }
        const availabilitySlots = sortedPollDays.map((dateKey) => ({
          start: localDateKeyAndTimeToIso(
            dateKey,
            startTimeByDay[dateKey] || POLL_DEFAULT_START,
          ),
        }));
        await onSubmit({ ...form, availabilitySlots });
        return;
      }
      await onSubmit({ ...form, availabilitySlots: [] });
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
        <label className="mb-1.5 block text-sm font-medium">When</label>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, scheduleMode: 'fixed' }))}
            className={`wt-btn px-3 py-1.5 text-sm font-medium ${
              form.scheduleMode === 'fixed' ? 'wt-btn-primary' : 'wt-btn-secondary'
            }`}
          >
            Set date &amp; time
          </button>
          <button
            type="button"
            disabled={form.type === 'open'}
            title={
              form.type === 'open'
                ? 'Open nights need a fixed time'
                : undefined
            }
            onClick={() => setForm((f) => ({ ...f, scheduleMode: 'poll' }))}
            className={`wt-btn px-3 py-1.5 text-sm font-medium disabled:opacity-45 ${
              form.scheduleMode === 'poll' ? 'wt-btn-primary' : 'wt-btn-secondary'
            }`}
          >
            Poll availability
          </button>
        </div>

        {form.scheduleMode === 'fixed' ? (
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
        ) : (
          <div className="wt-subtle space-y-4 p-3 sm:p-4">
            <DragSelectCalendar
              selectedKeys={selectedDayKeys}
              onChange={setSelectedKeys}
            />
            {sortedPollDays.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--muted)]">
                  Start time per day (in your timezone)
                </p>
                <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_8.75rem_8.75rem] items-center gap-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  <span>Date</span>
                  <span>Start</span>
                  <span>End</span>
                </div>
                <ul className="space-y-2">
                  {sortedPollDays.map((dateKey) => {
                    const startTime =
                      startTimeByDay[dateKey] || POLL_DEFAULT_START;
                    const start = new Date(
                      localDateKeyAndTimeToIso(dateKey, startTime),
                    );
                    const end = new Date(start);
                    end.setMinutes(end.getMinutes() + form.durationMinutes);
                    return (
                      <li
                        key={dateKey}
                        className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface)]/45 p-2 text-sm sm:grid sm:grid-cols-[minmax(0,1fr)_8.75rem_8.75rem] sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
                      >
                        <input
                          type="date"
                          value={dateKey}
                          disabled
                          aria-label={`Date for ${dateKey}`}
                          className="wt-input w-full py-1 text-sm tabular-nums disabled:cursor-not-allowed disabled:bg-[var(--surface)] disabled:text-[var(--muted)]"
                        />
                        <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:hidden">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              Start
                            </span>
                            <input
                              type="time"
                              step={900}
                              value={startTime}
                              onChange={(e) =>
                                setStartTimeByDay((prev) => ({
                                  ...prev,
                                  [dateKey]: e.target.value,
                                }))
                              }
                              aria-label={`Start time for ${dateKey}`}
                              className="wt-input w-full py-1 text-sm"
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              End
                            </span>
                            <input
                              type="time"
                              value={toTimeInputValue(end)}
                              disabled
                              aria-label={`End time for ${dateKey}`}
                              className="wt-input w-full py-1 text-sm disabled:cursor-not-allowed disabled:bg-[var(--surface)] disabled:text-[var(--muted)]"
                            />
                          </label>
                        </div>
                        <input
                          type="time"
                          step={900}
                          value={startTime}
                          onChange={(e) =>
                            setStartTimeByDay((prev) => ({
                              ...prev,
                              [dateKey]: e.target.value,
                            }))
                          }
                          aria-label={`Start time for ${dateKey}`}
                          className="hidden wt-input w-full py-1 text-sm sm:block"
                        />
                        <input
                          type="time"
                          value={toTimeInputValue(end)}
                          disabled
                          aria-label={`End time for ${dateKey}`}
                          className="hidden wt-input w-full py-1 text-sm disabled:cursor-not-allowed disabled:bg-[var(--surface)] disabled:text-[var(--muted)] sm:block"
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div>
          <label className="mb-1 block text-sm font-medium">Location</label>
          <div
            ref={placesContainerRef}
            className={usePlacesElement ? 'w-full' : 'hidden'}
          />
          <input
            ref={locationInputRef}
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={usePlacesElement ? 'hidden' : 'wt-input'}
            placeholder="123 Main St or Online"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Duration</label>
        <div className="flex flex-wrap gap-2">
          {GAME_DURATION_OPTIONS_MINUTES.map((mins) => (
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
              {formatDurationMinutes(mins)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div>
          <label className="mb-1 block text-sm font-medium">Event Type</label>
          <select
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as EventFormData['type'];
              setForm((prev) => ({
                ...prev,
                type,
                scheduleMode: type === 'open' ? 'fixed' : prev.scheduleMode,
              }));
            }}
            className="wt-input"
          >
            <option value="invite">Invite Only</option>
            <option value="open">Open</option>
          </select>
        </div>
      </div>

      {form.type === 'open' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Max Capacity</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, capacity: Math.max(2, form.capacity - 1) })
              }
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
      )}

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
