'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { redirectPathAfterAuth } from '@/lib/auth-flow';

export default function AuthCallbackPage() {
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
      // Full navigation (not client-side router) to clear the redirect-chain
      // origin context — avoids stale CORS headers from the OAuth hop.
      window.location.href = redirectPathAfterAuth();
    } catch {
      window.location.href = '/login';
    }
  }, [params, login]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-gray-600">Signing you in...</p>
      </div>
    </div>
  );
}
