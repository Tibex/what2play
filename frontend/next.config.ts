import type { NextConfig } from 'next';

const backendOrigin =
  process.env.BACKEND_PROXY_ORIGIN || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  experimental: {
    // Shelf parse hits 3 AI providers + 30+ BGG lookups — needs more than the 30s default
    proxyTimeout: 120_000,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
