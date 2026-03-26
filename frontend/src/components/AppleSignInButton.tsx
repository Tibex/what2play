'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { redirectPathAfterAuth } from '@/lib/auth-flow';

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

export default function AppleSignInButton({
  label = 'Sign in with Apple',
}: Readonly<{ label?: string }>) {
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID;
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  if (!clientId) return null;

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);

      if (!globalThis.window.AppleID) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src =
            'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Apple SDK'));
          document.body.appendChild(script);
        });
      }

      const origin = globalThis.window.location.origin;
      globalThis.window.AppleID?.auth.init({
        clientId,
        scope: 'name email',
        redirectURI: `${origin}/auth/callback`,
        usePopup: true,
      });

      const response = await globalThis.window.AppleID?.auth.signIn();
      const identityToken = response?.authorization?.id_token;
      if (!identityToken) {
        throw new Error('Apple identity token missing');
      }

      const data = await api.post<{
        user: {
          id: string;
          email: string;
          name: string;
          avatarUrl?: string;
          subscriptionTier: string;
        };
        accessToken: string;
        refreshToken: string;
      }>(
        '/auth/apple',
        {
          identityToken,
        },
        { auth: false },
      );

      login(data.user, data.accessToken, data.refreshToken);
      globalThis.window.location.href = redirectPathAfterAuth();
    } catch (error) {
      console.error(error);
      alert('Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAppleSignIn}
      disabled={loading}
      className="flex items-center justify-center gap-3 w-full border border-gray-900 rounded-lg px-3 py-2.5 font-medium text-white bg-gray-900 hover:bg-black disabled:opacity-60 transition-colors"
    >
      <span className="text-sm font-semibold">Apple</span>
      {loading ? 'Opening Apple...' : label}
    </button>
  );
}
