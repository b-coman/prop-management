// src/app/properties/[slug]/[[...path]]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { PropertyNotFoundPage } from '@/components/property/property-not-found-page';
import { websiteTemplateSchema, propertyOverridesSchema } from '@/lib/overridesSchemas-multipage';
import { LanguageProvider } from '@/lib/language-system';
import { getServerTranslations } from '@/lib/language-system/server-translations';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { buildVacationRentalJsonLd, buildBreadcrumbJsonLd, buildLodgingBusinessJsonLd, buildImageGalleryJsonLd, buildFAQPageJsonLd, buildAreaGuideJsonLd, buildReviewPageJsonLd, getCanonicalUrl, getBaseUrl, buildPropertyTagline, buildSameAs, propertyEntityId } from '@/lib/structured-data';
import { serverT } from '@/lib/language-system/server-translations';
import { getPublicListings } from '@/services/channelService';
import { textInLanguage, getPageLabel } from '@/lib/site-property';
import { resolveOgImage } from '@/lib/og-image';
import { getAmenitiesByRefs } from '@/lib/amenity-utils';
import { TrackViewItem } from '@/components/tracking/track-page-view';
import blurMapData from '@/data/blur-map.json';
import { headers } from 'next/headers';
import { loggers } from '@/lib/logger';

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Import the utility function
import type { Review, RichReview } from '@/types';
import { getPropertyBySlug, getPublishedReviewCount } from '@/lib/property-utils';
import { toClientProperty } from '@/lib/client-property';
import { getPublishedReviewsForProperty, getAllPublishedReviewsForProperty } from '@/services/reviewService';

// Alias for backward compatibility
const getProperty = getPropertyBySlug;


// Helper function to serialize timestamps in any object (from [slug]/page.tsx - more robust version)
const serializeTimestamps = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeTimestamps(item));
  }
  
  // Handle dates and objects with toJSON method
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle objects with toJSON method (like Firestore Timestamps)
  if (typeof obj.toJSON === 'function') {
    return serializeTimestamps(obj.toJSON());
  }
  
  // Handle timestamp-like objects
  if (('seconds' in obj || '_seconds' in obj) && 
      ('nanoseconds' in obj || '_nanoseconds' in obj)) {
    try {
      const seconds = Number('seconds' in obj ? obj.seconds : obj._seconds);
      const nanoseconds = Number('nanoseconds' in obj ? obj.nanoseconds : obj._nanoseconds);
      if (!isNaN(seconds) && !isNaN(nanoseconds)) {
        return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
      }
    } catch {
      return null;
    }
  }
  
  // Handle Firestore Timestamp instances
  if (obj instanceof Timestamp) {
    return obj.toDate().toISOString();
  }
  
  // Recursively process object properties
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip functions and undefined values
    if (typeof value === 'function' || value === undefined) {
      continue;
    }
    result[key] = serializeTimestamps(value);
  }
  
  return result;
};

// Function to get website template data
async function getTemplate(templateId: string) {
  if (!templateId) return null;
  const templateRef = doc(db, 'websiteTemplates', templateId);
  try {
    const docSnap = await getDoc(templateRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      // Serialize and clean any timestamps
      const serialized = serializeTimestamps(data);
      return JSON.parse(JSON.stringify(serialized));
    } else {
      loggers.error.warn('Template document not found', { templateId });
      return null;
    }
  } catch (error) {
    loggers.error.error('Error fetching website template', error, { templateId });
    return null;
  }
}

// Function to get property overrides data
async function getPropertyOverrides(slug: string) {
  if (!slug) {
    loggers.error.warn('Attempted to fetch overrides with empty slug');
    return null;
  }
  const overridesRef = doc(db, 'propertyOverrides', slug);
  try {
    const docSnap = await getDoc(overridesRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() };
      // Serialize all timestamps in the overrides data
      const serialized = serializeTimestamps(data);
      // Extra safety: parse and stringify to ensure complete serialization
      return JSON.parse(JSON.stringify(serialized));
    } else {
      loggers.error.warn('No overrides document found', { slug });
      return null;
    }
  } catch (error) {
    loggers.error.error('Error fetching property overrides', error, { slug });
    return null;
  }
}

/**
 * Resolves amenityRefs in all override pages to full amenity objects.
 * Walks all pages, finds blocks with categories[].amenityRefs,
 * batch-fetches from the amenities collection, and maps back.
 */
async function resolveOverrideAmenityRefs(overrides: any): Promise<any> {
  if (!overrides) return overrides;

  // Collect all unique amenity ref IDs across all pages
  const allRefs = new Set<string>();
  for (const [pageKey, pageData] of Object.entries(overrides)) {
    if (!pageData || typeof pageData !== 'object') continue;
    for (const [blockKey, blockData] of Object.entries(pageData as Record<string, any>)) {
      if (!blockData?.categories || !Array.isArray(blockData.categories)) continue;
      for (const cat of blockData.categories) {
        if (Array.isArray(cat.amenityRefs)) {
          cat.amenityRefs.forEach((ref: string) => allRefs.add(ref));
        }
      }
    }
  }

  if (allRefs.size === 0) return overrides;

  // Batch-fetch all amenity documents
  const amenityMap = new Map<string, { icon: string; name: any }>();
  await Promise.all(
    Array.from(allRefs).map(async (refId) => {
      try {
        const docSnap = await getDoc(doc(db, 'amenities', refId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          amenityMap.set(refId, { icon: data.icon || 'Building', name: data.name });
        }
      } catch {
        // Skip missing amenities
      }
    })
  );

  // Walk overrides again and populate amenities arrays from refs
  const enriched = { ...overrides };
  for (const [pageKey, pageData] of Object.entries(enriched)) {
    if (!pageData || typeof pageData !== 'object') continue;
    const pageCopy = { ...(pageData as Record<string, any>) };
    let pageModified = false;
    for (const [blockKey, blockData] of Object.entries(pageCopy)) {
      if (!blockData?.categories || !Array.isArray(blockData.categories)) continue;
      const newCategories = blockData.categories.map((cat: any) => {
        if (!Array.isArray(cat.amenityRefs)) return cat;
        const resolved = cat.amenityRefs
          .map((ref: string) => amenityMap.get(ref))
          .filter(Boolean);
        return { ...cat, amenities: resolved };
      });
      pageCopy[blockKey] = { ...blockData, categories: newCategories };
      pageModified = true;
    }
    if (pageModified) {
      enriched[pageKey] = pageCopy;
    }
  }

  return enriched;
}

/**
 * The slice of the overrides doc the renderer reads (see PropertyPageRenderer): visibility, menu,
 * footer, propertyMeta, the current page, and the location page for the homepage preview. The rest
 * - the guest guide above all, with its WiFi password and arrival instructions - stays on the server.
 */
function overridesForClient(overrides: any, pageName: string): any {
  const keys = ['visiblePages', 'menuItems', 'footer', 'propertyMeta', pageName];
  if (pageName === 'homepage') keys.push('location');
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (overrides?.[key] !== undefined) result[key] = overrides[key];
  }
  return result;
}

/**
 * The slice of the template the renderer reads for this page. The full template carries demo
 * content for every block on every page (a 14-day cancellation policy, contact@example.com, the
 * example.com social links) and all of it was shipping in the page HTML, where crawlers read it as
 * this property's terms. Kept: the current page (and the homepage it falls back to), the header and
 * footer fallbacks the overrides do not already replace, and only the defaults of blocks rendered
 * here, minus any fields every one of those blocks overrides.
 */
function templateForClient(template: any, overrides: any, pageName: string): any {
  const pages: Record<string, unknown> = {};
  if (template.pages?.[pageName]) pages[pageName] = template.pages[pageName];
  if (template.pages?.homepage) pages.homepage = template.pages.homepage;

  const page = template.pages?.[pageName] || template.pages?.homepage;
  const pageOverrides = (overrides?.[pageName] || {}) as Record<string, any>;
  const blocks: Array<{ id: string; type: string }> = page?.blocks || [];
  const visibleBlocks: string[] = pageOverrides.visibleBlocks || blocks.map((b) => b.id);

  // Which blocks use which default (same lookup as the renderer: by id, then by type)
  const users = new Map<string, Array<Record<string, any> | undefined>>();
  for (const block of blocks) {
    if (!visibleBlocks.includes(block.id)) continue;
    const key = template.defaults?.[block.id] !== undefined ? block.id
      : template.defaults?.[block.type] !== undefined ? block.type
      : null;
    if (!key) continue;
    users.set(key, [...(users.get(key) || []), pageOverrides[block.id]]);
  }

  const defaults: Record<string, unknown> = {};
  for (const [key, blockOverrides] of users) {
    const value = template.defaults[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      defaults[key] = value;
      continue;
    }
    // A field is dead weight only when every block using this default overrides it
    const trimmed: Record<string, unknown> = {};
    for (const [field, fieldValue] of Object.entries(value)) {
      const overriddenEverywhere = blockOverrides.every(
        (o) => o && typeof o === 'object' && o[field] !== undefined,
      );
      if (!overriddenEverywhere) trimmed[field] = fieldValue;
    }
    defaults[key] = trimmed;
  }

  const header = { ...template.header };
  if (overrides?.menuItems) delete header.menuItems;
  const footer: Record<string, unknown> = {};
  if (!overrides?.footer?.quickLinks && template.footer?.quickLinks) footer.quickLinks = template.footer.quickLinks;
  if (!overrides?.footer?.contactInfo && template.footer?.contactInfo) footer.contactInfo = template.footer.contactInfo;

  return {
    templateId: template.templateId,
    name: template.name,
    pages,
    header,
    footer,
    defaults,
  };
}

interface PropertyPageProps {
  params: Promise<{
    slug: string;
    path?: string[];
  }>;
}

// Generate metadata for SEO (Open Graph, Twitter Cards, canonical URL)
export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { slug, path = [] } = await params;

  let language = DEFAULT_LANGUAGE;
  let actualPath = path;
  if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
    language = actualPath[0];
    actualPath = actualPath.slice(1);
  }

  // Determine page name from path
  const pageName = actualPath.length > 0 ? actualPath[0] : 'homepage';

  const [property, overrides] = await Promise.all([
    getProperty(slug),
    getPropertyOverrides(slug),
  ]);
  if (!property) {
    return { title: 'Property Not Found' };
  }

  const template = pageName !== 'homepage' ? await getTemplate(property.templateId) : null;

  // Prefer bilingual overrides for name/description, fall back to property fields
  const propertyName = serverTranslateContent(
    overrides?.propertyMeta?.name || property.name,
    language,
  );
  // "Mountain chalet rental in Comarnic, Prahova" / "Cabană de închiriat în Comarnic, Prahova"
  const tagline = buildPropertyTagline(property, language);
  // First description that exists in THIS language. Falling back to another language's text is
  // how the Romanian homepage ended up with English metadata.
  const propertyDescription = [
    overrides?.propertyMeta?.shortDescription,
    overrides?.propertyMeta?.description,
    property.shortDescription,
    property.description,
  ].map((value) => textInLanguage(value, language)).find(Boolean)
    || serverT(language, 'seo.homeDescriptionFallback', `${tagline}. Book ${propertyName} directly.`, {
      tagline,
      name: propertyName,
    });

  // Build page-specific meta description
  const city = property.location?.city || '';
  const region = property.location?.state || '';
  const imageCount = property.images?.length || 0;
  const bedrooms = property.bedrooms || 0;
  const bathrooms = property.bathrooms || 0;
  const maxGuests = property.maxGuests || 0;

  const description = (() => {
    switch (pageName) {
      case 'gallery':
        return language === 'ro'
          ? `Descoperă ${imageCount} fotografii cu ${propertyName}${city ? ` în ${city}` : ''} - camere, spații exterioare și facilități.`
          : `Browse ${imageCount} photos of ${propertyName}${city ? ` in ${city}` : ''} - rooms, outdoor spaces, and amenities.`;
      case 'location':
        return language === 'ro'
          ? `Localizează ${propertyName}${city ? ` în ${city}` : ''}${region ? `, ${region}` : ''}. Indicații de orientare, atracții din zonă și opțiuni de transport.`
          : `Find ${propertyName}${city ? ` in ${city}` : ''}${region ? `, ${region}` : ''}. Directions, nearby attractions, and transportation options.`;
      case 'details':
        return language === 'ro'
          ? `${propertyName} oferă ${bedrooms} dormitoare, ${bathrooms} băi, capacitate de până la ${maxGuests} oaspeți.${city ? ` Situat în ${city}.` : ''}`
          : `${propertyName} features ${bedrooms} bedrooms, ${bathrooms} bathrooms, accommodating up to ${maxGuests} guests.${city ? ` Located in ${city}.` : ''}`;
      case 'booking':
        return language === 'ro'
          ? `Reguli de cazare la ${propertyName}${city ? ` în ${city}` : ''} - politica de anulare, check-in/check-out, reguli casă.`
          : `House rules for ${propertyName}${city ? ` in ${city}` : ''} - cancellation policy, check-in/check-out times, and property guidelines.`;
      case 'area-guide':
        return language === 'ro'
          ? `Ghid local${city ? ` ${city}` : ''}${region ? `, ${region}` : ''} - activități, restaurante, atracții turistice lângă ${propertyName}.`
          : `Area guide${city ? ` for ${city}` : ''}${region ? `, ${region}` : ''} - activities, restaurants, and attractions near ${propertyName}.`;
      case 'reviews':
        return language === 'ro'
          ? `Recenzii de la oaspeți pentru ${propertyName}${city ? ` în ${city}` : ''} - evaluări și experiențe reale.`
          : `Guest reviews for ${propertyName}${city ? ` in ${city}` : ''} - real ratings and experiences.`;
      case 'privacy-policy':
        return language === 'ro'
          ? `Politica de confidențialitate pentru ${propertyName} - cum colectăm, folosim și protejăm datele dumneavoastră.`
          : `Privacy policy for ${propertyName} - how we collect, use, and protect your data.`;
      case 'terms-of-service':
        return language === 'ro'
          ? `Termeni și condiții pentru ${propertyName} - regulile de rezervare, plată și utilizare.`
          : `Terms of service for ${propertyName} - booking rules, payment terms, and usage guidelines.`;
      default:
        return propertyDescription;
    }
  })();

  // Build page-specific title with location keywords for SEO
  // Homepage: "Property Name - <what it is> in City, Region" | Subpages: "Page Label - Property Name, City"
  const locationCity = city || '';
  let pageTitle = propertyName;
  if (pageName === 'homepage') {
    pageTitle = `${propertyName} - ${tagline}`;
  } else {
    const pageLabel = getPageLabel(pageName, language, template, overrides);
    if (pageLabel) {
      pageTitle = locationCity
        ? `${pageLabel} - ${propertyName}, ${locationCity}`
        : `${pageLabel} - ${propertyName}`;
    }
  }

  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const enUrl = getCanonicalUrl(slug, customDomain, pageName);
  const pageSuffix = pageName && pageName !== 'homepage' ? `/${pageName}` : '';
  const roUrl = `${getCanonicalUrl(slug, customDomain)}/ro${pageSuffix}`;
  // Self-referencing canonical: each language version points to itself
  const canonicalUrl = language === 'ro' ? roUrl : enUrl;

  const featuredImage = property.images?.find(img => img.isFeatured)?.url
    || property.images?.[0]?.url
    || overrides?.homepage?.hero?.backgroundImage;

  // Resolve the social-share image: per-property override -> dedicated
  // /public convention asset -> generic featured/hero photo. Always returns
  // an absolute URL (required for Facebook/Twitter server-side scrapers).
  const baseUrl = getBaseUrl(customDomain);
  const ogImage = resolveOgImage({
    property,
    slug,
    baseUrl,
    propertyName,
    fallbackImageUrl: featuredImage,
  });

  const locale = language === 'ro' ? 'ro_RO' : 'en_US';
  const localeAlternate = language === 'ro' ? 'en_US' : 'ro_RO';

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      siteName: propertyName,
      url: canonicalUrl,
      type: 'website',
      images: ogImage ? [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }] : [],
      locale,
      alternateLocale: [localeAlternate],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: ogImage ? [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }] : [],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en': enUrl,
        'ro': roUrl,
        'x-default': enUrl,
      },
    },
  };
}

// Export functions for importing elsewhere
export async function getWebsiteTemplate(templateId: string) {
  return getTemplate(templateId);
}

export { getPropertyOverrides };

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug, path = [] } = await params;

  // Extract language from path if present
  let language = DEFAULT_LANGUAGE;
  let actualPath = path;
  
  // Check if the first path segment is a supported language
  if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
    language = actualPath[0];
    actualPath = actualPath.slice(1); // Remove language from path
  }

  // Determine page name based on path
  let pageName = 'homepage';
  
  if (actualPath.length > 0) {
    const pathString = actualPath.join('/');
    
    // Common path mappings
    if (pathString === 'details') {
      pageName = 'details';
    } else if (pathString === 'location') {
      pageName = 'location';
    } else if (pathString === 'gallery') {
      pageName = 'gallery';
    } else if (pathString === 'booking') {
      pageName = 'booking';
    } else {
      // For any other path, use the first segment as page name
      pageName = actualPath[0];
    }
  }

  // Proper error handling from [slug]/page.tsx
  if (!slug) {
    loggers.error.error('PropertyPage: slug is missing from params');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Invalid Request</h1>
          <p className="text-lg mb-6">
            We're sorry, but the property identifier is missing.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Please check the URL and try again, or contact support if the problem persists.
          </p>
          <p className="text-sm">
            Error reference: MISSING_PROPERTY_SLUG
          </p>
        </div>
      </div>
    );
  }

  // Fetch property and overrides in parallel (both only need slug)
  const [property, initialOverrides] = await Promise.all([
    getProperty(slug),
    getPropertyOverrides(slug),
  ]);

  if (!property) {
    loggers.error.error('PropertyPage: property not found', { slug });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Property Not Found</h1>
          <p className="text-lg mb-6">
            We're sorry, but we couldn't find the property you're looking for.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Please check the URL and try again, or contact support if the problem persists.
          </p>
          <p className="text-sm">
            Error reference: PROPERTY_NOT_FOUND_{slug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  const template = await getTemplate(property.templateId);
  if (!template) {
    loggers.error.error('PropertyPage: template not found', { templateId: property.templateId, slug });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Temporarily Unavailable</h1>
          <p className="text-lg mb-6">
            We're sorry, but this property is currently unavailable due to a technical issue.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Our team has been notified and is working on resolving this issue as quickly as possible.
          </p>
          <p className="text-sm">
            Error reference: TEMPLATE_NOT_FOUND_{slug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  if (!initialOverrides) {
    loggers.error.error('PropertyPage: overrides not found', { slug });
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Configuration Issue</h1>
          <p className="text-lg mb-6">
            We're sorry, but this property is currently unavailable due to a configuration issue.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Our team has been notified and is working on resolving this issue as quickly as possible.
          </p>
          <p className="text-sm">
            Error reference: OVERRIDES_NOT_FOUND_{slug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  // Resolve amenityRefs to full amenity objects in all override pages
  let overrides = await resolveOverrideAmenityRefs(initialOverrides);

  // Detect if request came through a custom domain (needed for 404 and normal rendering)
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const isCustomDomain = !!(property.useCustomDomain && property.customDomain &&
    (host === property.customDomain || host === `www.${property.customDomain}`));

  // Check if the page exists in the template or is hidden — show branded 404
  const pageNotInTemplate = pageName !== 'homepage' && template.pages && !template.pages[pageName];
  const pageNotVisible = pageName !== 'homepage' && overrides.visiblePages && !overrides.visiblePages.includes(pageName);

  if (pageNotInTemplate || pageNotVisible) {
    const propertyNameSource = overrides.propertyMeta?.name || property.name;
    const resolvedName = serverTranslateContent(propertyNameSource, language);
    const menuItems = overrides.menuItems || template.header.menuItems;
    const logoAlt = template.header.logo?.alt
      ? serverTranslateContent(template.header.logo.alt, language)
      : undefined;

    return (
      <>
        <meta name="robots" content="noindex, follow" />
        <LanguageProvider initialLanguage={language} initialTranslations={getServerTranslations(language)}>
          <PropertyNotFoundPage
            propertyName={resolvedName}
            propertySlug={slug}
            themeId={property.themeId}
            menuItems={menuItems}
            logoSrc={template.header.logo?.src}
            logoAlt={logoAlt}
            isCustomDomain={isCustomDomain}
            quickLinks={overrides.footer?.quickLinks || template.footer?.quickLinks}
            contactInfo={overrides.footer?.contactInfo || template.footer?.contactInfo}
            socialLinks={overrides.footer?.socialLinks}
          />
        </LanguageProvider>
      </>
    );
  }

  // Build structured data (JSON-LD)
  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const canonicalUrl = getCanonicalUrl(slug, customDomain, pageName);
  const baseUrl = getBaseUrl(customDomain);

  // Resolve property name: prefer bilingual overrides, fall back to property field
  const propertyNameSource = overrides.propertyMeta?.name || property.name;
  const propertyNameStr = serverTranslateContent(propertyNameSource, language);
  const propertyNameForLang = serverTranslateContent(propertyNameSource, language);

  // Build page-specific structured data (JSON-LD)
  let vacationRentalJsonLd: Record<string, unknown> | null = null;
  let lodgingBusinessJsonLd: Record<string, unknown> | null = null;
  let imageGalleryJsonLd: Record<string, unknown> | null = null;
  let faqPageJsonLd: Record<string, unknown> | null = null;
  let areaGuideJsonLd: Record<string, unknown> | null = null;
  let reviewPageJsonLd: Record<string, unknown> | null = null;
  let publishedReviews: Review[] = [];
  let allReviews: RichReview[] = [];
  let reviewListings: Array<{ channelId: string; displayName: string; url: string }> = [];

  // One JSON-LD entity per property, whatever the page or language
  const entityId = propertyEntityId(getCanonicalUrl(slug, customDomain));

  if (pageName === 'homepage') {
    // Homepage: VacationRental + LodgingBusiness (for Google Maps), one entity via the shared @id
    const [amenities, publishedReviewCount, fetchedReviews, listings] = await Promise.all([
      property.amenityRefs?.length ? getAmenitiesByRefs(property.amenityRefs) : [],
      getPublishedReviewCount(slug),
      getPublishedReviewsForProperty(slug, 10),
      getPublicListings(slug),
    ]);
    publishedReviews = fetchedReviews;
    const telephone = template?.footer?.contactInfo?.phone || undefined;
    // Prefer override description for JSON-LD (same priority as meta description)
    const descriptionOverride = overrides?.propertyMeta?.description || overrides?.propertyMeta?.shortDescription;
    const sameAs = buildSameAs({
      property,
      listingUrls: listings.map((l) => l.url),
      socialLinks: overrides?.footer?.socialLinks,
    });
    vacationRentalJsonLd = buildVacationRentalJsonLd({ property, amenities, canonicalUrl, telephone, publishedReviewCount, publishedReviews, language, descriptionOverride, entityId, sameAs });
    lodgingBusinessJsonLd = buildLodgingBusinessJsonLd({ property, canonicalUrl, telephone, publishedReviewCount, publishedReviews, language, descriptionOverride, entityId, sameAs });
    faqPageJsonLd = buildFAQPageJsonLd({ property, language });
  } else if (pageName === 'gallery') {
    // Gallery page: ImageGallery schema
    imageGalleryJsonLd = buildImageGalleryJsonLd({ property, canonicalUrl, language });
  } else if (pageName === 'area-guide') {
    // Area guide page: Article schema
    const descriptionOverride = overrides?.propertyMeta?.description || overrides?.propertyMeta?.shortDescription;
    areaGuideJsonLd = buildAreaGuideJsonLd({ property, canonicalUrl, language, descriptionOverride });
  } else if (pageName === 'reviews') {
    // Reviews page: fetch all reviews + build AggregateRating JSON-LD
    [allReviews, reviewListings] = await Promise.all([
      getAllPublishedReviewsForProperty(slug),
      // The same place is listed on the OTAs under other names; the reviews page names them and
      // links them, so guests and AI readers can tell it is one property.
      getPublicListings(slug),
    ]);
    if (allReviews.length > 0) {
      reviewPageJsonLd = buildReviewPageJsonLd({ property, reviews: allReviews, canonicalUrl, language, entityId });
    }
  }

  // Build breadcrumb with subpage level when not on homepage, in the page language
  const pageLabel = pageName !== 'homepage'
    ? getPageLabel(pageName, language, template, overrides)
    : undefined;
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(propertyNameStr, slug, baseUrl, pageName, pageLabel || undefined, customDomain, language);

  // Local image blur map for blur placeholders (imported as JSON module)
  const localBlurMap = blurMapData as Record<string, string>;

  // PropertyPageRenderer is a client component, so everything on `property`
  // crosses into the RSC payload and ships to the browser. `aiDescription` is
  // the vision layer's structured output for the ad/post selectors: nine
  // server-side modules read it and not one client component does, yet it was
  // costing roughly 31 KB of every guest page and growing with each photo
  // added. Strip it from the copy the client gets; the server keeps the full
  // object for JSON-LD and everything else above.
  const clientProperty = toClientProperty(property);

  // Same reasoning for the template and overrides: send what this page renders, nothing else.
  const clientTemplate = templateForClient(template, overrides, pageName);
  const clientOverrides = overridesForClient(overrides, pageName);

  // Always wrap in LanguageProvider to keep the component tree structure identical
  // across language switches (prevents React from unmounting/remounting everything)
  const renderedPageName = pageName === 'homepage' && language === DEFAULT_LANGUAGE ? 'homepage' : pageName;
  const renderedPropertyName = pageName === 'homepage' && language === DEFAULT_LANGUAGE ? propertyNameStr : propertyNameForLang;

  return (
    <>
      {vacationRentalJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(vacationRentalJsonLd) }}
        />
      )}
      {lodgingBusinessJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingBusinessJsonLd) }}
        />
      )}
      {imageGalleryJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGalleryJsonLd) }}
        />
      )}
      {faqPageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd) }}
        />
      )}
      {areaGuideJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(areaGuideJsonLd) }}
        />
      )}
      {reviewPageJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewPageJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <TrackViewItem property={clientProperty} />
      <LanguageProvider initialLanguage={language} initialTranslations={getServerTranslations(language)}>
        <Suspense fallback={<div>Loading property details...</div>}>
          <PropertyPageRenderer
            template={clientTemplate}
            overrides={clientOverrides}
            propertyName={renderedPropertyName}
            propertySlug={slug}
            pageName={renderedPageName}
            themeId={property.themeId}
            language={language}
            property={clientProperty}
            publishedReviews={publishedReviews}
            allReviews={allReviews.length > 0 ? allReviews : undefined}
            otaListings={reviewListings.length > 0 ? reviewListings : undefined}
            localBlurMap={localBlurMap}
            isCustomDomain={isCustomDomain}
          />
        </Suspense>
      </LanguageProvider>
    </>
  );
}