import type { Metadata } from 'next';
import InvitePageClient from '@/components/invite/InvitePageClient';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Invite',
  description: 'Private event invite page.',
  path: '/invite',
  noindex: true,
});

export default async function InvitePage({
  params,
}: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <InvitePageClient token={token} />;
}
