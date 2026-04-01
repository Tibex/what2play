import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { KEYWORD_CLUSTERS } from '@/lib/keyword-clusters';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Board Game Planning Resources',
  description:
    'Explore board game night planning guides for voting, recommendations, BoardGameGeek sync, and practical event checklists.',
  path: '/resources',
  keywords: [
    'board game night resources',
    'board game planning guide',
    'board game voting app guide',
    'board game recommendation tool guide',
  ],
});

export default function ResourcesPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Board Game Planning Resources',
      url: absoluteUrl('/resources'),
      description:
        'Guides and landing pages focused on board game night planning workflows.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: KEYWORD_CLUSTERS.map((cluster, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl(cluster.path),
        name: cluster.pageTitle,
      })),
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
          name: 'Resources',
          item: absoluteUrl('/resources'),
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <div className="min-h-screen">
      <JsonLd data={jsonLd} />
      <main className="wt-page px-4 sm:px-6 py-12 sm:py-16">
        <header className="max-w-3xl">
          <p className="wt-chip">Topic hub</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            Board game night planning resources
          </h1>
          <p className="mt-4 text-lg wt-muted">
            This hub maps our highest-intent search topics to dedicated pages so each query has one clear primary destination.
          </p>
        </header>

        <section className="mt-10">
          <ul className="grid gap-4 md:grid-cols-2 list-none p-0">
            {KEYWORD_CLUSTERS.map((cluster) => (
              <li key={cluster.id} className="wt-card p-6">
                <p className="wt-chip mb-3">{cluster.intent}</p>
                <h2 className="text-xl font-semibold">
                  <Link href={cluster.path} className="hover:text-[var(--primary)]">
                    {cluster.pageTitle}
                  </Link>
                </h2>
                <p className="mt-2 text-sm wt-muted">{cluster.summary}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Primary keyword: {cluster.primaryKeyword}
                </p>
                <Link
                  href={cluster.path}
                  className="mt-4 inline-block wt-btn wt-btn-secondary px-4 py-2 text-sm no-underline text-[var(--foreground)]"
                >
                  Open guide
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 wt-card-raised p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Want the full workflow in one app?</h2>
          <p className="mt-3 wt-muted">
            Create an account to run events, gather RSVPs, generate recommendations, and lock decisions with ranked voting.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/register" className="wt-btn wt-btn-primary px-5 py-2.5 no-underline text-white">
              Create free account
            </Link>
            <Link href="/" className="wt-btn wt-btn-secondary px-5 py-2.5 no-underline text-[var(--foreground)]">
              Back to homepage
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
