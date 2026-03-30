import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'What2Play',
    short_name: 'What2Play',
    description: 'Plan game nights, vote on games, and track your collection.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#365fb3',
    icons: [
      {
        src: '/meeple.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  };
}
