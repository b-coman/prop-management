import type { MetadataRoute } from 'next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { headers } from 'next/headers';

function normalizeHost(): string {
  let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
  host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = normalizeHost();
  const entries: MetadataRoute.Sitemap = [];
  const subPages = ['gallery', 'location', 'details', 'booking', 'area-guide', 'reviews', 'privacy-policy', 'terms-of-service'];

  // Detect requesting domain to filter sitemap per custom domain
  const headersList = await headers();
  const forwardedHost = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const requestHost = forwardedHost.replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^www\./, '');
  const mainAppHost = (process.env.NEXT_PUBLIC_MAIN_APP_HOST || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const isCustomDomainRequest = requestHost && requestHost !== mainAppHost && !requestHost.includes('localhost');

  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const slug = doc.id;
      const customDomain = data.useCustomDomain && data.customDomain ? data.customDomain : null;
      const normalizedCustomDomain = customDomain?.replace(/^https?:\/\//, '').replace(/\/+$/, '');

      // If accessed from a custom domain, only include that domain's property
      if (isCustomDomainRequest && normalizedCustomDomain !== requestHost) {
        continue;
      }

      // Use custom domain as canonical URL when available, otherwise use main app URL
      let propertyBase: string;
      if (customDomain) {
        const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        propertyBase = `https://${domain}`;
      } else {
        propertyBase = `${baseUrl}/properties/${slug}`;
      }

      const roBase = `${propertyBase}/ro`;

      // Homepage
      entries.push({
        url: propertyBase,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
        alternates: {
          languages: {
            en: propertyBase,
            ro: roBase,
            'x-default': propertyBase,
          },
        },
      });

      // Subpages
      for (const page of subPages) {
        const pageUrl = `${propertyBase}/${page}`;
        const roPageUrl = `${roBase}/${page}`;
        entries.push({
          url: pageUrl,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.8,
          alternates: {
            languages: {
              en: pageUrl,
              ro: roPageUrl,
              'x-default': pageUrl,
            },
          },
        });
      }
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return entries;
}
