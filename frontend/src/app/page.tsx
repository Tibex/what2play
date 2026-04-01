import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import HomeTokenRedirect from '@/components/landing/HomeTokenRedirect';
import { LandingMarketing } from '@/components/landing/LandingMarketing';
import { absoluteUrl, createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  title: 'Board Game Night Planner and Voting App',
  description:
    'Plan board game nights with recommendations, ranked voting, and collection-aware picks built for recurring groups.',
  path: '/',
  keywords: [
    'board game night planner',
    'board game voting app',
    'board game recommendation tool',
    'game night organizer',
    'boardgamegeek collection sync',
  ],
});

export default function Home() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'What2Play',
      url: absoluteUrl('/'),
      description:
        'Plan board game nights with recommendations, voting, and collection-aware game selection.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'What2Play',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      url: absoluteUrl('/'),
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: [
        'Board game night planning',
        'Collection-aware recommendations',
        'Ranked voting for game selection',
        'BoardGameGeek collection linking',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How does What2Play choose board game recommendations?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Recommendations consider player count, duration, complexity, and games your attendees can bring.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can groups vote on which board game to play?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. You can run ranked voting rounds so the group reaches a fair final choice.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I sync my BoardGameGeek collection?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. You can link your BoardGameGeek username and use owned games in planning and recommendation flows.',
          },
        },
      ],
    },
  ] satisfies Record<string, unknown>[];

  return (
    <>
      <JsonLd data={jsonLd} />
      <HomeTokenRedirect />
      <LandingMarketing />
    </>
  );
}
