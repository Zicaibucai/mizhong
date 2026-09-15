import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';
import { site } from '@/lib/site-config';

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.map((locale) => ({
    url: `${site.url}/${locale}`,
    changeFrequency: 'monthly',
    priority: 1,
  }));
}
