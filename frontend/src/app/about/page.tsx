import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const LAST_UPDATED = 'April 1, 2026';

export const metadata: Metadata = createPageMetadata({
  title: 'About What2Play',
  description:
    'Learn what What2Play is, who it is for, and how it helps groups plan better board game nights.',
  path: '/about',
  keywords: [
    'about what2play',
    'board game night planner app',
    'group board game recommendations',
  ],
});

export default function AboutPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About What2Play',
      url: absoluteUrl('/about'),
      description:
        'What2Play helps groups plan board game nights with recommendations, voting, and event workflows.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'What2Play',
      url: absoluteUrl('/'),
      sameAs: ['https://github.com/Tibex/what2play'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'About',
          item: absoluteUrl('/about'),
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
      <JsonLd data={jsonLd} />

      <header className="max-w-3xl">
        <p className="wt-chip">About</p>
        <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
          What2Play helps groups plan better game nights
        </h1>
        <p className="mt-4 text-lg wt-muted">
          What2Play is a web app for recurring board game groups that want a clear way to plan events, shortlist games, vote fairly, and track what worked.
        </p>
      </header>

      <section className="mt-8 space-y-4 max-w-3xl">
        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">What problem we solve</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            Group chats are good for coordination, but they break down when it is time to choose one game that matches the actual players and time available.
          </p>
          <p className="mt-3 wt-muted leading-relaxed">
            What2Play combines collection data, event constraints, and ranked voting so groups can move from discussion to a final decision with less friction.
          </p>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Who it is for</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2 wt-muted">
            <li>Recurring friend groups that host game nights often</li>
            <li>Organizers that need quicker, fairer game decisions</li>
            <li>Players who want recommendations based on real constraints</li>
          </ul>
        </article>

        <article className="wt-card p-6">
          <h2 className="text-2xl font-semibold">Transparency and trust</h2>
          <p className="mt-3 wt-muted leading-relaxed">
            We document what data is stored and how it is used for core planning features such as events, RSVPs, recommendations, and votes.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/privacy" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Privacy policy
            </Link>
            <Link href="/terms" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Terms of use
            </Link>
            <Link href="/contact" className="wt-btn wt-btn-secondary px-4 py-2 no-underline text-[var(--foreground)]">
              Contact
            </Link>
          </div>
        </article>
      </section>

      <p className="mt-8 text-sm wt-muted">Last updated: {LAST_UPDATED}</p>
    </main>
  );
}
