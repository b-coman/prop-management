// src/app/properties/[slug]/[[...path]]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { websiteTemplateSchema, propertyOverridesSchema } from '@/lib/overridesSchemas-multipage';
import { LanguageProvider } from '@/lib/language-system';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { buildVacationRentalJsonLd, buildBreadcrumbJsonLd, getCanonicalUrl, getBaseUrl } from '@/lib/structured-data';
import { getAmenitiesByRefs } from '@/lib/amenity-utils';

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Import the utility function
import { getPropertyBySlug } from '@/lib/property-utils';

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
  if (path.length > 0 && SUPPORTED_LANGUAGES.includes(path[0])) {
    language = path[0];
  }

  const property = await getProperty(slug);
  if (!property) {
    return { title: 'Property Not Found' };
  }

  const propertyName = serverTranslateContent(property.name, language);
  const description = serverTranslateContent(
    property.shortDescription || property.description,
    language,
  ) || `Book ${propertyName} - vacation rental`;

  const canonicalUrl = getCanonicalUrl(slug);
  const featuredImage = property.images?.find(img => img.isFeatured)?.url
    || property.images?.[0]?.url;

  return {
    title: propertyName,
    description,
    openGraph: {
      title: propertyName,
      description,
      url: canonicalUrl,
      type: 'website',
      images: featuredImage ? [{ url: featuredImage, alt: propertyName }] : [],
      locale: language === 'ro' ? 'ro_RO' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: propertyName,
      description,
      images: featuredImage ? [featuredImage] : [],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en': canonicalUrl,
        'ro': `${canonicalUrl}/ro`,
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

  const overrides = await getPropertyOverrides(slug);
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

  // Check if the page exists in the template
  if (pageName !== 'homepage' && template.pages && !template.pages[pageName]) {
    console.error(`[PropertyPage] Page "${pageName}" not found in template for property "${slug}".`);
    return notFound();
  }

  // Check if the page is visible in overrides (only for non-homepage)
  if (pageName !== 'homepage' && overrides.visiblePages && !overrides.visiblePages.includes(pageName)) {
    console.log(`[PropertyPage] Page "${pageName}" is not visible in overrides for property "${slug}".`);
    return notFound();
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
  const canonicalUrl = getCanonicalUrl(slug);
  const baseUrl = getBaseUrl();
  const propertyNameStr = typeof property.name === 'string'
    ? property.name
    : (property.name.en || property.name.ro || 'Property');

  // Build VacationRental JSON-LD only on homepage
  let vacationRentalJsonLd: Record<string, unknown> | null = null;
  if (pageName === 'homepage') {
    const amenities = property.amenityRefs?.length
      ? await getAmenitiesByRefs(property.amenityRefs)
      : [];
    vacationRentalJsonLd = buildVacationRentalJsonLd({ property, amenities, canonicalUrl });
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd(propertyNameStr, slug, baseUrl);

  // For homepage with default language, use the exact pattern from [slug]/page.tsx
  if (pageName === 'homepage' && language === DEFAULT_LANGUAGE) {
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
        <Suspense fallback={<div>Loading property details...</div>}>
          <PropertyPageRenderer
            template={template}
            overrides={overrides}
            propertyName={propertyNameStr}
            propertySlug={slug}
            pageName="homepage"
            themeId={property.themeId}
          />
        </Suspense>
      </>
    );
  }

  // For all other cases (non-homepage or with language), wrap in LanguageProvider
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
      <LanguageProvider initialLanguage={language}>
        <Suspense fallback={<div>Loading property details...</div>}>
          <PropertyPageRenderer
            template={template}
            overrides={overrides}
            propertyName={typeof property.name === 'string' ? property.name : (property.name[language] || property.name.en || property.name.ro || 'Property')}
            propertySlug={slug}
            pageName={pageName}
            themeId={property.themeId}
            language={language}
          />
        </Suspense>
      </LanguageProvider>
    </>
  );
}