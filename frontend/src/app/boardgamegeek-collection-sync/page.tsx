import type { Metadata } from 'next';
import GuideShell, { type GuideFaq, type GuideSection } from '@/components/seo/GuideShell';
import JsonLd from '@/components/seo/JsonLd';
import { getKeywordCluster } from '@/lib/keyword-clusters';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

const cluster = getKeywordCluster('boardgamegeek-collection-sync');

export const metadata: Metadata = createPageMetadata({
  title: cluster.pageTitle,
  description: cluster.metaDescription,
  path: cluster.path,
  keywords: [
    cluster.primaryKeyword,
    'sync bgg collection',
    'boardgamegeek integration',
    'import board game library',
  ],
});

const sections: GuideSection[] = [
  {
    heading: 'Why collection sync matters for recommendations',
    paragraphs: [
      'Planning quality drops when your game list is outdated. Syncing BoardGameGeek collections keeps owned titles available for recommendation and voting flows.',
      'The more accurate your availability data, the fewer dead-end options appear during event planning.',
    ],
  },
  {
    heading: 'Keep your event shortlist realistic',
    paragraphs: [
      'Collection sync helps your group focus on games that can be played now, not titles someone might buy later. This is especially helpful for recurring groups with overlapping libraries.',
      'What2Play treats collection data as one input in recommendation scoring so practical options stay visible.',
    ],
    bullets: [
      'Import owned games from BGG usernames',
      'Use synced data while building candidate lists',
      'Reduce recommendation noise from unavailable titles',
    ],
  },
  {
    heading: 'Use sync with host controls and voting',
    paragraphs: [
      'Even with synced libraries, hosts still need controls for discovery mode, final lock-in, and fallback choices. The best workflow combines data quality with operational flexibility.',
      'That balance keeps planning efficient without forcing one rigid selection strategy.',
    ],
  },
];

const faqs: GuideFaq[] = [
  {
    question: 'Do I need to share my BoardGameGeek password?',
    answer:
      'No. Linking uses your public BGG username and does not require password sharing inside What2Play.',
  },
  {
    question: 'Can multiple attendees use synced collections in one event?',
    answer:
      'Yes. Event recommendations can account for libraries across all confirmed attendees.',
  },
  {
    question: 'Is BoardGameGeek affiliation required?',
    answer:
      'No. BGG integration is optional, and manual collection management is also supported.',
  },
];

export default function BoardGameGeekCollectionSyncPage() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: cluster.pageTitle,
      url: absoluteUrl(cluster.path),
      description: cluster.metaDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    },
  ] satisfies Record<string, unknown>[];

  return (
    <>
      <JsonLd data={jsonLd} />
      <GuideShell
        title={cluster.pageTitle}
        keyword={cluster.primaryKeyword}
        intro="Connect your BoardGameGeek profile so planning and recommendation flows use real collection availability."
        sections={sections}
        faqs={faqs}
        relatedPaths={[
          '/board-game-recommendation-tool',
          '/board-game-night-planner',
          '/how-to-plan-a-board-game-night',
        ]}
      />
    </>
  );
}
