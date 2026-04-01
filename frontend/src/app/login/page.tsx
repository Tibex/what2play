import type { Metadata } from 'next';
import LoginPageClient from '@/components/auth/LoginPageClient';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Sign in',
  description: 'Sign in to your What2Play account.',
  path: '/login',
  noindex: true,
});

export default function LoginPage() {
  return <LoginPageClient />;
}
