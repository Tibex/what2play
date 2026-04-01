import type { Metadata } from 'next';

const FALLBACK_SITE_URL = 'https://what2play.games';

function normalizeSiteUrl(rawUrl: string): string {
  const withProtocol =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function getSiteUrl(): string {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      FALLBACK_SITE_URL,
  );
}

export function absoluteUrl(path = '/'): string {
  const siteUrl = getSiteUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

type MetadataType = 'website' | 'article';

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noindex?: boolean;
  type?: MetadataType;
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords,
  noindex = false,
  type = 'website',
}: PageMetadataOptions): Metadata {
  const canonicalUrl = absoluteUrl(path);

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type,
      url: canonicalUrl,
      title,
      description,
      siteName: 'What2Play',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        }
      : undefined,
  };
}
