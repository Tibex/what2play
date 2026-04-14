/**
 * Origin for Socket.IO (namespaces like `/voting`, `/shelf-parse`).
 *
 * When `NEXT_PUBLIC_API_URL` is a relative rewrite such as `/api`, HTTP requests
 * go through Next, but WebSockets do not — set `NEXT_PUBLIC_REALTIME_URL`
 * (e.g. `http://127.0.0.1:3001`) or rely on the dev fallback below.
 */
export function getRealtimeBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  if (/^https?:\/\//i.test(rawApiUrl)) {
    const trimmed = rawApiUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://127.0.0.1:3001';
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }

  return '';
}
