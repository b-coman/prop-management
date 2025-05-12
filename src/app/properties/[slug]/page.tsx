// src/app/properties/[slug]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { websiteTemplateSchema, propertyOverridesSchema } from '@/lib/overridesSchemas-multipage';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Import the utility function
import { getPropertyBySlug } from '@/lib/property-utils';

// Alias for backward compatibility
const getProperty = getPropertyBySlug;

// Function to get website template data
async function getTemplate(templateId: string) {
  if (!templateId) return null;
  const templateRef = doc(db, 'websiteTemplates', templateId);
  try {
    const docSnap = await getDoc(templateRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.warn(`[getTemplate] Template document not found: websiteTemplates/${templateId}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching website template ${templateId}:`, error);
    return null;
  }
}

// This function is exported above for reuse

interface PropertyPageProps {
  params: { slug: string };
}

// Functions for importing elsewhere
export async function getWebsiteTemplate(templateId: string) {
  return getTemplate(templateId);
}

export async function getPropertyOverrides(slug: string) {
  if (!slug) {
    console.warn("[getPropertyOverrides] Attempted to fetch overrides with empty slug.");
    return null;
  }
  const overridesRef = doc(db, 'propertyOverrides', slug);
  try {
    const docSnap = await getDoc(overridesRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      console.warn(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching property overrides for ${slug}:`, error);
    return null;
  }
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  // Await the params object to ensure it's fully resolved
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams.slug;

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

  return (
    <Suspense fallback={<div>Loading property details...</div>}>
      <PropertyPageRenderer
        template={template}
        overrides={overrides}
        propertyName={property.name}
        propertySlug={slug}
        pageName="homepage"
      />
    </Suspense>
  );
}