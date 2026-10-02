import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { publicOriginForProperty } from '@/lib/domain-map';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import {
  requestHostFrom,
  resolvePropertySlugForHost,
  loadPropertySite,
  pageUrl,
  type PropertySite,
} from '@/lib/site-property';

const logger = loggers.contentData;

/**
 * Every page of a property in every language as its own <loc>, each carrying the full hreflang
 * set. Only pages the property shows, and a lastmod only when the data records a real edit.
 */
function entriesFor(site: PropertySite): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const pageName of site.visiblePages) {
    const languages: Record<string, string> = {};
    for (const lang of SUPPORTED_LANGUAGES) languages[lang] = pageUrl(site.baseUrl, pageName, lang);
    languages['x-default'] = pageUrl(site.baseUrl, pageName, DEFAULT_LANGUAGE);

    for (const lang of SUPPORTED_LANGUAGES) {
      entries.push({
        url: pageUrl(site.baseUrl, pageName, lang),
        ...(site.lastModified && { lastModified: site.lastModified }),
        changeFrequency: pageName === 'homepage' ? 'weekly' : 'monthly',
        priority: pageName === 'homepage' ? 1.0 : 0.8,
        alternates: { languages },
      });
    }
  }
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = requestHostFrom(await headers());

  try {
    // A property's own domain lists that property only.
    const servedSlug = await resolvePropertySlugForHost(host);
    if (servedSlug) {
      const site = await loadPropertySite(servedSlug);
      return site ? entriesFor(site) : [];
    }

    // Any other host (the app host, *.hosted.app, localhost): list only properties whose public
    // address is known to work. A property with a custom domain that is not wired up in the domain
    // map is skipped rather than advertised: a domain saved on the property doc may not resolve yet.
    const db = await getAdminDb();
    const snapshot = await db.collection('properties').get();
    const sites = await Promise.all(
      snapshot.docs
        .filter((doc) => (doc.data().status ?? 'active') === 'active')
        .filter((doc) => {
          const data = doc.data();
          const hasCustomDomain = !!(data.useCustomDomain && data.customDomain);
          return hasCustomDomain ? !!publicOriginForProperty(doc.id) : true;
        })
        .map((doc) => loadPropertySite(doc.id, doc.data())),
    );
    return sites
      .filter((site): site is PropertySite => !!site)
      // Pages on the App Hosting default domain are noindex (see middleware), so never list them
      .filter((site) => !new URL(site.baseUrl).hostname.endsWith('.hosted.app'))
      .flatMap(entriesFor);
  } catch (error) {
    logger.error('Error generating sitemap', error as Error, { host });
    return [];
  }
}
