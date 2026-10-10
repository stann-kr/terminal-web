import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { SITE_ORIGIN } from '@/features/events/metadata';

/**
 * Search engines index the public site only; the development Worker and previews answer with the
 * same pages under other hosts, so they are closed to crawlers. Guest forms repeat their session.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  if ((await headers()).get('host') !== new URL(SITE_ORIGIN).host) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/events/*/request'] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
