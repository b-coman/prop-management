// src/app/page.tsx - Renders a specific property based on slug (defaulting to prahova)
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageLayout } from '@/components/property/property-page-layout';
import { getPropertyBySlug, getWebsiteTemplate, getPropertyOverrides } from '@/app/properties/[slug]/page'; // Import shared functions
// AuthProvider removed, context will be consumed from root layout

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
    notFound(); // Or render a fallback homepage
  }

  const template = await getWebsiteTemplate(property.templateId);

  if (!template) {
    console.error(`[HomePage] Website template "${property.templateId}" not found for default property "${defaultPropertySlug}".`);
    notFound(); // Or render a fallback homepage
  }

  // console.log(`[HomePage] Data fetched successfully for ${defaultPropertySlug}.`);

  return (
    // AuthProvider removed
    <Suspense fallback={<div>Loading homepage...</div>}>
      <PropertyPageLayout
        property={property}
        template={template}
        overrides={overrides || {}} // Pass overrides or empty object
      />
    </Suspense>
  );
}
