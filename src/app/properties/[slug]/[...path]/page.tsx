// src/app/properties/[slug]/[...path]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PropertyPageRenderer } from '@/components/property/property-page-renderer';
import { websiteTemplateSchema, propertyOverridesSchema } from '@/lib/overridesSchemas-multipage';

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

interface PropertyDynamicPageProps {
  params: {
    slug: string;
    path: string[];
  };
}

export default async function PropertyDynamicPage({ params }: PropertyDynamicPageProps) {
  // Await the params object to ensure it's fully resolved
  const resolvedParams = await Promise.resolve(params);
  const { slug, path } = resolvedParams;

  // Fetch property data
  const property = await getProperty(slug);
  if (!property) {
    return notFound();
  }

  // Fetch template
  const template = await getTemplate(property.templateId);
  if (!template) {
    return notFound();
  }

  // Fetch property overrides
  const overrides = await getPropertyOverrides(slug);
  if (!overrides) {
    return notFound();
  }

  // Determine which page to render based on the path
  const pathString = path.join('/');

  // Find the page in the template that matches this path
  let pageName = 'homepage'; // Default to homepage if no match found

  // Check if the template has a pages structure
  if (!template.pages) {
    console.error(`[PropertyDynamicPage] Template ${template.id} does not have a pages structure.`);
    return notFound();
  }

  // Look through all pages in the template to find a matching path
  // First try exact match
  for (const [name, page] of Object.entries(template.pages)) {
    if (page.path === `/${pathString}`) {
      pageName = name;
      break;
    }
  }

  // If no exact match is found, use our fallback mapping
  if (pageName === 'homepage' && pathString) {
    // Fallback mapping for common paths
    if (pathString === 'details') {
      pageName = 'details';
    } else if (pathString === 'location') {
      pageName = 'location';
    } else if (pathString === 'gallery') {
      pageName = 'gallery';
    } else if (pathString === 'booking') {
      pageName = 'booking';
    }
  }

  // Check if the page is visible in overrides
  if (overrides.visiblePages && !overrides.visiblePages.includes(pageName)) {
    console.log(`[PropertyDynamicPage] Page "${pageName}" is not visible in overrides for property "${slug}".`);
    return notFound();
  }

  return (
    <Suspense fallback={<div>Loading property details...</div>}>
      <PropertyPageRenderer
        template={template}
        overrides={overrides}
        propertyName={property.name}
        propertySlug={slug}
        pageName={pageName}
      />
    </Suspense>
  );
}