'use client';

import Link from 'next/link';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPageClient() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[var(--primary)]">
            <Link href="/" className="hover:underline">
              What2Play
            </Link>
          </h1>
          <p className="wt-muted mt-2">Sign in to plan your next game night</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
