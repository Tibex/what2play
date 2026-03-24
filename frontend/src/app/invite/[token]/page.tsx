'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PENDING_INVITE_STORAGE_KEY } from '@/lib/auth-flow';
import type { GameEvent } from '@/lib/types';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<GameEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<GameEvent>(`/events/invite/${token}`, { auth: false })
      .then(setEvent)
      .catch(() => setError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    const hasToken = localStorage.getItem('accessToken');
    if (!hasToken) {
      localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
      router.push('/login');
      return;
    }
    try {
      await api.post(`/events/invite/${token}/join`);
      router.push(`/events/${event?.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link
            href="/login"
            className="text-indigo-600 hover:underline"
            onClick={() => localStorage.setItem(PENDING_INVITE_STORAGE_KEY, token)}
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const date = new Date(event.dateTime);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-4">🎲</div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re Invited!</h1>
        <h2 className="text-xl font-semibold text-indigo-700 mb-4">{event.title}</h2>
        <p className="text-gray-600 mb-1">
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          {' at '}
          {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
        </p>
        {event.location && <p className="text-gray-500 text-sm mb-1">{event.location}</p>}
        {event.description && <p className="text-gray-500 text-sm mt-3">{event.description}</p>}
        <button onClick={handleJoin} className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
          Join Game Night
        </button>
        <p className="text-xs text-gray-400 mt-3">You&apos;ll need an account to RSVP and vote</p>
      </div>
    </div>
  );
}
