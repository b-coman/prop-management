import type { MetadataRoute } from 'next';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const revalidate = 3600; // Revalidate every hour

function normalizeHost(): string {
  let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
  host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = normalizeHost();
  const entries: MetadataRoute.Sitemap = [];
  const subPages = ['gallery', 'location', 'details'];

  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const slug = doc.id;
      const customDomain = data.useCustomDomain && data.customDomain ? data.customDomain : null;

      // Use custom domain as canonical URL when available, otherwise use main app URL
      // This avoids duplicate content in the sitemap
      let propertyBase: string;
      if (customDomain) {
        const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        propertyBase = `https://${domain}`;
      } else {
        propertyBase = `${baseUrl}/properties/${slug}`;
      }

      // For custom domains: RO is at /ro, subpages at /page
      // For main app: RO is at /properties/slug/ro, subpages at /properties/slug/page
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
