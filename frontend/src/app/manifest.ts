import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'What2Play',
    short_name: 'What2Play',
    description: 'Plan game nights, vote on games, and track your collection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      {
        src: '/next.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
