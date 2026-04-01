import type { MetadataRoute } from 'next';
import { INDEXABLE_MARKETING_PATHS } from '@/lib/keyword-clusters';
import { absoluteUrl } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return INDEXABLE_MARKETING_PATHS.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/resources' ? 0.9 : 0.8,
  }));
}
