import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const LAST_UPDATED = 'April 1, 2026';

export const metadata: Metadata = createPageMetadata({
  title: 'Terms of Use',
  description:
    'Terms of use for What2Play, including account responsibilities and acceptable usage.',
  path: '/terms',
  keywords: [
    'what2play terms',
    'what2play terms of use',
    'board game app terms',
  ],
});

export default function TermsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'What2Play Terms of Use',
    url: absoluteUrl('/terms'),
    description:
      'Terms governing access and use of the What2Play web application.',
  } satisfies Record<string, unknown>;

  return (
    <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <p className="wt-chip">Policy</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          Terms of Use
        </h1>
        <p className="mt-4 text-lg wt-muted">
          These terms describe the basic rules for using What2Play.
        </p>
      </header>

      <section className="mt-8 space-y-4 max-w-3xl">
        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Accounts and access</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            You are responsible for activity on your account and for keeping your credentials secure. You must provide accurate account information.
          </p>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Acceptable use</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 wt-muted">
            <li>Do not abuse the service, scrape private data, or attempt unauthorized access</li>
            <li>Do not submit malicious content or spam through events, invites, or feedback</li>
            <li>Follow applicable laws when using the platform</li>
          </ul>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Third-party services</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            Some features rely on third-party providers (for example BoardGameGeek and social login providers). Their services and policies may change independently.
          </p>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Service changes</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            We may update features, limits, or these terms over time. Material changes will be reflected by an updated date on this page.
          </p>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Contact and related policies</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/contact" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Contact
            </Link>
            <Link href="/privacy" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Privacy policy
            </Link>
          </div>
        </article>
      </section>

      <p className="mt-8 text-sm wt-muted">Last updated: {LAST_UPDATED}</p>
    </main>
  );
}
