'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { redirectPathAfterAuth } from '@/lib/auth-flow';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import AppleSignInButton from '@/components/AppleSignInButton';

export default function RegisterPageClient() {
  const [name, setName] = useState('');
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
        }>('/auth/register', { name, email, password });
        login(data.user, data.accessToken, data.refreshToken);
        router.push(redirectPathAfterAuth());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--primary)]">
            <Link href="/" className="hover:underline">
              What2Play
            </Link>
          </h1>
          <p className="wt-muted mt-2">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="wt-card space-y-5 p-8">
          {error && (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">{error}</div>
          )}
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="wt-input"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="wt-input"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="wt-input"
              placeholder="Min 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="wt-btn wt-btn-primary w-full py-2.5 font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="wt-muted bg-[var(--paper)] px-2">or</span>
            </div>
          </div>

          <GoogleSignInButton label="Sign up with Google" />
          <AppleSignInButton label="Sign up with Apple" />

          <p className="wt-muted text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-[var(--primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
