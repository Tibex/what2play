import type { Metadata } from 'next';
import AppShellClient from '@/components/AppShellClient';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'App Workspace',
  description: 'Authenticated What2Play app workspace.',
  path: '/dashboard',
  noindex: true,
});

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShellClient>{children}</AppShellClient>;
}
