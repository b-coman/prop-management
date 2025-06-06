// src/app/page.tsx - Renders a specific property based on slug (defaulting to prahova)
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { getWebsiteTemplate, getPropertyOverrides } from '@/app/properties/[slug]/[[...path]]/page'; // Import shared functions
import { getPropertyBySlug } from '@/lib/property-utils';
// AuthProvider removed, context will be consumed from root layout

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

export default async function HomePage() {
  // Define the default property slug for the homepage
  const defaultPropertySlug = "prahova-mountain-chalet"; // Or dynamically determine this later

  // console.log(`[HomePage] Rendering default property: ${defaultPropertySlug}`);

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

  // console.log(`[HomePage] Data fetched successfully for ${defaultPropertySlug}.`);

  return (
    // AuthProvider removed
    <Suspense fallback={<div>Loading homepage...</div>}>
      <PropertyPageRenderer
        template={template}
        overrides={overrides}
        propertyName={typeof property.name === 'string' ? property.name : (property.name.en || property.name.ro || 'Property')}
        propertySlug={defaultPropertySlug}
        pageName="homepage"
        themeId={property.themeId}
        property={property}
      />
    </Suspense>
  );
}
