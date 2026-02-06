// src/app/page.tsx - Renders a specific property based on slug (defaulting to prahova)
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { getWebsiteTemplate, getPropertyOverrides } from '@/app/properties/[slug]/[[...path]]/page'; // Import shared functions
import { getPropertyBySlug } from '@/lib/property-utils';
import { buildVacationRentalJsonLd, buildBreadcrumbJsonLd, getCanonicalUrl, getBaseUrl } from '@/lib/structured-data';
import { getAmenitiesByRefs } from '@/lib/amenity-utils';

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

const defaultPropertySlug = "prahova-mountain-chalet";

export async function generateMetadata(): Promise<Metadata> {
  const property = await getPropertyBySlug(defaultPropertySlug);
  if (!property) {
    return { title: 'RentalSpot - Your Vacation Getaway' };
  }

  const propertyName = typeof property.name === 'string'
    ? property.name
    : (property.name.en || property.name.ro || 'Property');
  const description = property.description
    ? (typeof property.description === 'string'
        ? property.description
        : (property.description.en || property.description.ro || ''))
    : `Book ${propertyName} - vacation rental`;

  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const canonicalUrl = getCanonicalUrl(defaultPropertySlug, customDomain);
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
    },
    twitter: {
      card: 'summary_large_image',
      title: propertyName,
      description,
      images: featuredImage ? [featuredImage] : [],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function HomePage() {
  // Fetch all necessary data for the default property using the reusable functions
  const [property, overrides] = await Promise.all([
      getPropertyBySlug(defaultPropertySlug),
      getPropertyOverrides(defaultPropertySlug),
  ]);

  if (!property) {
    console.error(`[HomePage] Default property "${defaultPropertySlug}" not found.`);
    // Show a clear error message instead of notFound()
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <div className="max-w-md">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Property Not Found</h1>
          <p className="text-lg mb-6">
            We're sorry, but we couldn't find the property you're looking for.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Our team has been notified and is working on resolving this issue.
          </p>
          <p className="text-sm">
            Error reference: PROPERTY_NOT_FOUND_{defaultPropertySlug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  const template = await getWebsiteTemplate(property.templateId);

  if (!template) {
    console.error(`[HomePage] Website template "${property.templateId}" not found for default property "${defaultPropertySlug}".`);
    // Instead of fallback content, show a clear error page
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
            Error reference: TEMPLATE_NOT_FOUND_{defaultPropertySlug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  if (!overrides) {
    console.error(`[HomePage] Property overrides for "${defaultPropertySlug}" not found.`);
    // Instead of passing empty object, show error message
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
            Error reference: OVERRIDES_NOT_FOUND_{defaultPropertySlug.replace(/-/g, '_').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  // Build structured data (JSON-LD)
  const propertyNameStr = typeof property.name === 'string'
    ? property.name
    : (property.name.en || property.name.ro || 'Property');

  const amenities = property.amenityRefs?.length
    ? await getAmenitiesByRefs(property.amenityRefs)
    : [];

  const customDomain = property.useCustomDomain ? property.customDomain : null;
  const canonicalUrl = getCanonicalUrl(defaultPropertySlug, customDomain);
  const baseUrl = getBaseUrl(customDomain);
  const telephone = template?.footer?.contactInfo?.phone || undefined;
  const vacationRentalJsonLd = buildVacationRentalJsonLd({ property, amenities, canonicalUrl, telephone });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(propertyNameStr, defaultPropertySlug, baseUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(vacationRentalJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Suspense fallback={<div>Loading homepage...</div>}>
        <PropertyPageRenderer
          template={template}
          overrides={overrides}
          propertyName={propertyNameStr}
          propertySlug={defaultPropertySlug}
          pageName="homepage"
          themeId={property.themeId}
          property={property}
        />
      </Suspense>
    </>
  );
}
