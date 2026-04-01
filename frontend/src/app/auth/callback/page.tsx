import type { Metadata } from 'next';
import AuthCallbackPageClient from '@/components/auth/AuthCallbackPageClient';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Authentication callback',
  description: 'Authentication callback route.',
  path: '/auth/callback',
  noindex: true,
});

export default function AuthCallbackPage() {
  return <AuthCallbackPageClient />;
}
