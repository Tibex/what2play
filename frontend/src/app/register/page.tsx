import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Create account',
  description: 'Create your What2Play account to plan game nights.',
  path: '/register',
  noindex: true,
});

export default function RegisterPage() {
  redirect('/?m=register');
}
