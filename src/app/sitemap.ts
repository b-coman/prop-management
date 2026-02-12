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

      // Main app URLs under /properties/{slug}
      const mainUrl = `${baseUrl}/properties/${slug}`;
      entries.push({
        url: mainUrl,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
        alternates: {
          languages: { en: mainUrl, ro: `${mainUrl}/ro` },
        },
      });

      for (const page of subPages) {
        const pageUrl = `${mainUrl}/${page}`;
        entries.push({
          url: pageUrl,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.8,
          alternates: {
            languages: { en: pageUrl, ro: `${mainUrl}/ro/${page}` },
          },
        });
      }

      // Custom domain URLs (when property has a custom domain)
      if (customDomain) {
        const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const domainBase = `https://${domain}`;

        entries.push({
          url: domainBase,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 1.0,
          alternates: {
            languages: { en: domainBase, ro: `${domainBase}/ro` },
          },
        });

        for (const page of subPages) {
          const pageUrl = `${domainBase}/${page}`;
          entries.push({
            url: pageUrl,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
            alternates: {
              languages: { en: pageUrl, ro: `${domainBase}/ro/${page}` },
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
  }

  return entries;
}
