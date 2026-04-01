import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const LAST_UPDATED = 'April 1, 2026';

export const metadata: Metadata = createPageMetadata({
  title: 'Privacy Policy',
  description:
    'What data What2Play stores, why it is used, and what controls users have over their information.',
  path: '/privacy',
  keywords: [
    'what2play privacy',
    'board game app privacy policy',
    'what2play data policy',
  ],
});

export default function PrivacyPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'What2Play Privacy Policy',
    url: absoluteUrl('/privacy'),
    description:
      'Privacy policy describing data collection, usage, and user controls in What2Play.',
  } satisfies Record<string, unknown>;

  return (
    <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <p className="wt-chip">Policy</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-4 text-lg wt-muted">
          This page explains what information What2Play stores and how that information is used to run core features.
        </p>
      </header>

      <section className="mt-8 space-y-4 max-w-3xl">
        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Data we collect</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 wt-muted">
            <li>Account data such as name, email, and optional avatar</li>
            <li>Game data you add or sync, including collection and ratings</li>
            <li>Event data such as RSVPs, votes, and optional post-event feedback</li>
            <li>Operational logs needed to secure and maintain the service</li>
          </ul>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">How we use data</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 wt-muted">
            <li>Provide account access and authentication features</li>
            <li>Generate recommendations and support voting workflows</li>
            <li>Improve product reliability, security, and feature quality</li>
            <li>Operate notifications you explicitly opt into</li>
          </ul>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Sharing and third-party services</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            What2Play integrates with third-party providers such as BoardGameGeek and authentication providers. We do not sell personal data. Data is shared only when required to deliver requested features or comply with legal obligations.
          </p>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Your choices</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            You can update your profile details, unlink integrations, and request account-related support through our contact channel.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/contact" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Contact support
            </Link>
            <Link href="/terms" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Terms of use
            </Link>
          </div>
        </article>
      </section>

      <p className="mt-8 text-sm wt-muted">Last updated: {LAST_UPDATED}</p>
    </main>
  );
}
