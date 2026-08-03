import type { MetadataRoute } from 'next';
import { loadNavCategories } from '../lib/categories';
import { getAppBaseUrl } from '../lib/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getAppBaseUrl();
  const { categories } = await loadNavCategories();

  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/tim-kiem`, changeFrequency: 'daily', priority: 0.8 },
    ...categories.map((c) => ({
      url: `${base}/danh-muc/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
