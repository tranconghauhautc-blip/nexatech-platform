import type { MetadataRoute } from 'next';
import { NAV_CATEGORIES } from '../lib/constants';
import { getAppBaseUrl } from '../lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/tim-kiem`, changeFrequency: 'daily', priority: 0.8 },
    ...NAV_CATEGORIES.map((c) => ({
      url: `${base}/danh-muc/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
