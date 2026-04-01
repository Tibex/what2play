import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const LAST_UPDATED = 'April 1, 2026';
const SUPPORT_URL = 'https://github.com/Tibex/what2play/issues';

export const metadata: Metadata = createPageMetadata({
  title: 'Contact What2Play',
  description:
    'How to contact the What2Play team for product feedback, account questions, and privacy requests.',
  path: '/contact',
  keywords: [
    'contact what2play',
    'what2play support',
    'board game app support',
  ],
});

export default function ContactPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact What2Play',
      url: absoluteUrl('/contact'),
      description:
        'Official contact page for What2Play support and product feedback.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'What2Play',
      url: absoluteUrl('/'),
      contactPoint: [
        {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: SUPPORT_URL,
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <p className="wt-chip">Contact</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          Contact the What2Play team
        </h1>
        <p className="mt-4 text-lg wt-muted">
          Use the channels below for product feedback, account questions, and policy requests.
        </p>
      </header>

      <section className="mt-8 grid gap-4 max-w-3xl">
        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Product support and bug reports</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            Open a ticket in our issue tracker and include your environment, steps to reproduce, and screenshots when possible.
          </p>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block wt-btn wt-btn-primary px-4 py-2 no-underline text-white"
          >
            Open support issue
          </a>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Privacy and data requests</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            For data-related questions, submit a support issue and mark it as a privacy request. Do not include passwords or sensitive payment information.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/privacy" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Privacy policy
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
