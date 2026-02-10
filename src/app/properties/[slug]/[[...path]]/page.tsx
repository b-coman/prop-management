// src/app/properties/[slug]/[[...path]]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { PropertyNotFoundPage } from '@/components/property/property-not-found-page';
import { websiteTemplateSchema, propertyOverridesSchema } from '@/lib/overridesSchemas-multipage';
import { LanguageProvider } from '@/lib/language-system';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { buildVacationRentalJsonLd, buildBreadcrumbJsonLd, getCanonicalUrl, getBaseUrl } from '@/lib/structured-data';
import { getAmenitiesByRefs } from '@/lib/amenity-utils';
import { TrackViewItem } from '@/components/tracking/track-page-view';
import blurMapData from '@/data/blur-map.json';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Import the utility function
import type { Review } from '@/types';
import { getPropertyBySlug, getPublishedReviewCount } from '@/lib/property-utils';
import { getPublishedReviewsForProperty } from '@/services/reviewService';

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
    } catch (error) {
      console.error("Error converting timestamp:", error);
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
      console.warn(`[getTemplate] Template document not found: websiteTemplates/${templateId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching website template ${templateId}:`, error);
    return null;
  }
}

// Function to get property overrides data
async function getPropertyOverrides(slug: string) {
  if (!slug) {
    console.warn("[getPropertyOverrides] Attempted to fetch overrides with empty slug.");
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
      console.warn(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching property overrides for ${slug}:`, error);
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
  const description = serverTranslateContent(
    overrides?.propertyMeta?.shortDescription || overrides?.propertyMeta?.description ||
    property.shortDescription || property.description,
    language,
  ) || `Book ${propertyName} - vacation rental`;

  // Build page-specific title: "Page Title - Property Name" for sub-pages
  let pageTitle = propertyName;
  if (pageName !== 'homepage' && template?.pages?.[pageName]?.title) {
    const pageLabel = serverTranslateContent(template.pages[pageName].title, language);
    if (pageLabel) {
      pageTitle = `${pageLabel} - ${propertyName}`;
    }
  }

  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const canonicalUrl = getCanonicalUrl(slug, customDomain);
  const featuredImage = property.images?.find(img => img.isFeatured)?.url
    || property.images?.[0]?.url;

  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      type: 'website',
      images: featuredImage ? [{ url: featuredImage, alt: propertyName }] : [],
      locale: language === 'ro' ? 'ro_RO' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description,
      images: featuredImage ? [featuredImage] : [],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: customDomain
        ? { 'en': canonicalUrl, 'ro': `${canonicalUrl}/ro` }
        : { 'en': canonicalUrl, 'ro': `${canonicalUrl}/ro` },
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
    console.error("[PropertyPage] Slug is missing from params.");
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

  // Fetch all necessary data for the property
  const property = await getProperty(slug);
  if (!property) {
    console.error(`[PropertyPage] Property "${slug}" not found.`);
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
    console.error(`[PropertyPage] Website template "${property.templateId}" not found for property "${slug}".`);
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

  let overrides = await getPropertyOverrides(slug);
  if (!overrides) {
    console.error(`[PropertyPage] Property overrides for "${slug}" not found.`);
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
  overrides = await resolveOverrideAmenityRefs(overrides);

  // Detect if request came through a custom domain (needed for 404 and normal rendering)
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
  const isCustomDomain = !!(property.useCustomDomain && property.customDomain &&
    (host === property.customDomain || host === `www.${property.customDomain}`));

  // Check if the page exists in the template or is hidden — show branded 404
  const pageNotInTemplate = pageName !== 'homepage' && template.pages && !template.pages[pageName];
  const pageNotVisible = pageName !== 'homepage' && overrides.visiblePages && !overrides.visiblePages.includes(pageName);

  if (pageNotInTemplate || pageNotVisible) {
    const reason = pageNotInTemplate ? 'not in template' : 'not visible';
    console.log(`[PropertyPage] Page "${pageName}" ${reason} for property "${slug}", showing branded 404.`);

    const propertyNameSource = overrides.propertyMeta?.name || property.name;
    const resolvedName = serverTranslateContent(propertyNameSource, language);
    const menuItems = overrides.menuItems || template.header.menuItems;
    const logoAlt = template.header.logo?.alt
      ? serverTranslateContent(template.header.logo.alt, language)
      : undefined;

    return (
      <>
        <meta name="robots" content="noindex, follow" />
        <LanguageProvider initialLanguage={language}>
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

  // Debug: Log any _translationStatus in overrides
  if (overrides?._translationStatus) {
    console.log('[PropertyPage] ⚠️ _translationStatus found in overrides:', JSON.stringify(overrides._translationStatus, null, 2));
  }
  
  // DEBUGGING: Log the retrieved property overrides for hero section (from [slug]/page.tsx)
  console.log(`[PropertyPage] 🔍 LOADED OVERRIDES for "${slug}":`);
  
  // Log the hero block data specifically
  if (overrides.homepage && overrides.homepage.hero) {
    console.log('[PropertyPage] 🏠 HERO BLOCK DATA:', {
      showBookingForm: overrides.homepage.hero.showBookingForm,
      showRating: overrides.homepage.hero.showRating,
      bookingForm: overrides.homepage.hero.bookingForm,
      hasTitle: !!overrides.homepage.hero.title,
      hasSubtitle: !!overrides.homepage.hero.subtitle
    });
  } else if (overrides.hero) {
    // For single-page structure
    console.log('[PropertyPage] 🏠 HERO BLOCK DATA (single-page):', {
      showBookingForm: overrides.hero.showBookingForm,
      showRating: overrides.hero.showRating,
      bookingForm: overrides.hero.bookingForm,
      hasTitle: !!overrides.hero.title,
      hasSubtitle: !!overrides.hero.subtitle
    });
  } else {
    console.warn('[PropertyPage] ⚠️ No hero data found in overrides');
  }

  // Build structured data (JSON-LD)
  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const canonicalUrl = getCanonicalUrl(slug, customDomain);
  const baseUrl = getBaseUrl(customDomain);

  // Resolve property name: prefer bilingual overrides, fall back to property field
  const propertyNameSource = overrides.propertyMeta?.name || property.name;
  const propertyNameStr = serverTranslateContent(propertyNameSource, language);
  const propertyNameForLang = serverTranslateContent(propertyNameSource, language);

  // Build VacationRental JSON-LD only on homepage
  let vacationRentalJsonLd: Record<string, unknown> | null = null;
  let publishedReviews: Review[] = [];
  if (pageName === 'homepage') {
    const [amenities, publishedReviewCount, fetchedReviews] = await Promise.all([
      property.amenityRefs?.length ? getAmenitiesByRefs(property.amenityRefs) : [],
      getPublishedReviewCount(slug),
      getPublishedReviewsForProperty(slug, 10),
    ]);
    publishedReviews = fetchedReviews;
    const telephone = template?.footer?.contactInfo?.phone || undefined;
    vacationRentalJsonLd = buildVacationRentalJsonLd({ property, amenities, canonicalUrl, telephone, publishedReviewCount, publishedReviews });
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(propertyNameStr, slug, baseUrl);

  // Local image blur map for blur placeholders (imported as JSON module)
  const localBlurMap = blurMapData as Record<string, string>;

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <TrackViewItem property={property} />
      <LanguageProvider initialLanguage={language}>
        <Suspense fallback={<div>Loading property details...</div>}>
          <PropertyPageRenderer
            template={template}
            overrides={overrides}
            propertyName={renderedPropertyName}
            propertySlug={slug}
            pageName={renderedPageName}
            themeId={property.themeId}
            language={language}
            property={property}
            publishedReviews={publishedReviews}
            localBlurMap={localBlurMap}
            isCustomDomain={isCustomDomain}
          />
        </Suspense>
      </LanguageProvider>
    </>
  );
}