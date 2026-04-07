'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { redirectPathAfterAuth } from '@/lib/auth-flow';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import AppleSignInButton from '@/components/AppleSignInButton';

type LoginFormProps = Readonly<{
  onSuccess?: () => void;
  onRequestRegister?: () => void;
}>;

export default function LoginForm({ onSuccess, onRequestRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    void (async () => {
      try {
        const data = await api.post<{
          user: {
            id: string;
            email: string;
            name: string;
            avatarUrl?: string;
            subscriptionTier: string;
            role: 'user' | 'admin';
          };
          accessToken: string;
          refreshToken: string;
        }>('/auth/login', { email, password });
        login(data.user, data.accessToken, data.refreshToken);
        onSuccess?.();
        router.push(redirectPathAfterAuth());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <form onSubmit={handleSubmit} className="wt-card space-y-5 p-8">
      {error && (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="wt-input"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="wt-input"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="wt-btn wt-btn-primary w-full py-2.5 font-medium disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="wt-muted bg-[var(--paper)] px-2">or</span>
        </div>
      </div>

      <GoogleSignInButton />
      <AppleSignInButton />

      <p className="wt-muted text-center text-sm">
        Don&apos;t have an account?{' '}
        {onRequestRegister ? (
          <button
            type="button"
            onClick={onRequestRegister}
            className="font-medium text-[var(--primary)] hover:underline"
          >
            Sign up
          </button>
        ) : (
          <Link href="/?m=register" className="font-medium text-[var(--primary)] hover:underline">
            Sign up
          </Link>
        )}
      </p>
    </form>
  );
}
