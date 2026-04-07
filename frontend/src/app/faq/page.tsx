import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const FAQ_ITEMS = [
  {
    question: 'How does What2Play choose board game recommendations?',
    answer:
      'Recommendations consider attendee count, available time, preferred complexity, and which games attendees can actually bring.',
  },
  {
    question: 'Can groups vote on which board game to play?',
    answer:
      'Yes. What2Play uses ranked voting so attendees can order preferences and reach a fair final pick.',
  },
  {
    question: 'Can we poll dates before locking a game night?',
    answer:
      'Yes. Invite-only events can use availability polling first, then hosts can lock the final date and time.',
  },
  {
    question: 'What happens if attendees drop after voting?',
    answer:
      'Hosts can keep fallback options ready so the confirmed event can adapt if player count changes.',
  },
  {
    question: 'Can I sync my BoardGameGeek collection?',
    answer:
      'Yes. Link your BoardGameGeek username to sync owned games and use them in recommendations and planning.',
  },
  {
    question: 'Can I host private and open game nights?',
    answer:
      'Yes. You can run invite-only events for your regular group or create open events that others can discover.',
  },
  {
    question: 'Can I see which games in my collection performed best?',
    answer:
      'Yes. Collection insights show how often each game was picked, average vote position, voting-pool appearances, and average enjoyment ratings.',
  },
] as const;

export const metadata: Metadata = createPageMetadata({
  title: 'Frequently Asked Questions',
  description:
    'Answers about planning game nights, ranked voting, recommendations, schedule polls, and BoardGameGeek sync in What2Play.',
  path: '/faq',
  keywords: [
    'what2play faq',
    'board game night planner faq',
    'board game voting app faq',
    'boardgamegeek sync faq',
    'board game availability poll',
    'board game collection stats',
    'which board games get picked most',
  ],
});

export default function FaqPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
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
          name: 'FAQ',
          item: absoluteUrl('/faq'),
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <div className="min-h-screen">
      <JsonLd data={jsonLd} />
      <main className="wt-page px-4 sm:px-6 py-12 sm:py-16 max-w-3xl">
        <header>
          <p className="wt-chip">Help center</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-lg wt-muted">
            Quick answers about planning, recommendations, voting, and event setup in What2Play.
          </p>
        </header>

        <section className="mt-10 space-y-4">
          {FAQ_ITEMS.map((item, index) => (
            <details key={item.question} className="wt-card p-5" open={index === 0}>
              <summary className="font-semibold">{item.question}</summary>
              <p className="mt-2 text-sm wt-muted">{item.answer}</p>
            </details>
          ))}
        </section>

        <section className="mt-10 wt-card-raised p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Still have a question?</h2>
          <p className="mt-2 wt-muted">
            Reach out and we will help you set up your next game night flow.
          </p>
          <div className="mt-4">
            <Link href="/contact" className="wt-btn wt-btn-secondary px-4 py-2 no-underline">
              Contact support
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
