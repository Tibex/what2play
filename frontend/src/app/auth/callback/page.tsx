'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { redirectPathAfterAuth } from '@/lib/auth-flow';

function CallbackHandler() {
  const params = useSearchParams();
  const { login } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userRaw = params.get('user');

    if (!accessToken || !refreshToken || !userRaw) {
      window.location.href = '/login';
      return;
    }

    try {
      const user = JSON.parse(userRaw);
      login(user, accessToken, refreshToken);
      window.location.href = redirectPathAfterAuth();
    } catch {
      window.location.href = '/login';
    }
  }, [params, login]);

  return null;
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        <p className="wt-muted mt-4">Signing you in...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
