import { MetadataRoute } from 'next';

const locales = ['en', 'ko', 'ja', 'zh-CN', 'es', 'de', 'fr', 'pt'];
const BASE_URL = 'https://stockalarm.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/how-to-use'];
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: page === '' ? 1.0 : 0.7,
      });
    }
  }

  return entries;
}
