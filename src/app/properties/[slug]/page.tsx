// src/app/properties/[slug]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageLayout } from '@/components/property/property-page-layout';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Function to get core property data by slug
export async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
    const propertyRef = doc(db, 'properties', slug); // Use slug as document ID
    try {
        const docSnap = await getDoc(propertyRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Basic type assertion, ideally use Zod validation
            return { id: docSnap.id, ...data } as Property;
        } else {
            console.warn(`[getPropertyBySlug] Property document not found: properties/${slug}`);
            return undefined;
        }
    } catch (error) {
        console.error(`❌ Error fetching property with slug ${slug}:`, error);
        return undefined;
    }
}

// Function to get website template data
async function getWebsiteTemplate(templateId: string): Promise<WebsiteTemplate | undefined> {
    if (!templateId) return undefined;
    const templateRef = doc(db, 'websiteTemplates', templateId);
    try {
        const docSnap = await getDoc(templateRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as WebsiteTemplate;
        } else {
            console.warn(`[getWebsiteTemplate] Template document not found: websiteTemplates/${templateId}`);
            return undefined;
        }
    } catch (error) {
        console.error(`❌ Error fetching website template ${templateId}:`, error);
        return undefined;
    }
}

// Function to get property overrides data
async function getPropertyOverrides(slug: string): Promise<PropertyOverrides | undefined> {
    const overridesRef = doc(db, 'propertyOverrides', slug); // Use slug as document ID
    try {
        const docSnap = await getDoc(overridesRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as PropertyOverrides;
        } else {
            console.log(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}. Using defaults.`);
            // Return an empty object or specific default structure if needed
            return undefined; // Indicate no overrides found
        }
    } catch (error) {
        console.error(`❌ Error fetching property overrides for ${slug}:`, error);
        return undefined; // Return undefined on error
    }
}


interface PropertyDetailsPageProps {
  params: { slug: string };
}

// Generate static paths using slugs from the 'properties' collection
export async function generateStaticParams() {
  try {
      const propertiesCollection = collection(db, 'properties');
      const snapshot = await getDocs(propertiesCollection);

      if (snapshot.empty) {
        console.warn("[generateStaticParams] No properties found in Firestore to generate static params.");
        return [];
      }

      const params = snapshot.docs.map(doc => ({
            slug: doc.id, // Document ID is the slug
        }));

      console.log(`[generateStaticParams] Generated ${params.length} params:`, params);
      return params;
  } catch (error) {
       console.error("❌ Error fetching properties for generateStaticParams:", error);
       return []; // Return empty array on error
  }
}


export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  // Await the params before using its properties
  const awaitedParams = await params;
  const slug = awaitedParams.slug;

  if (!slug) {
    console.error("[PropertyDetailsPage] Slug is missing from params.");
    notFound();
  }
  console.log(`[PropertyDetailsPage] Rendering page for slug: ${slug}`);

  // Fetch all necessary data in parallel
  const [property, overrides] = await Promise.all([
      getPropertyBySlug(slug),
      getPropertyOverrides(slug),
  ]);


  if (!property) {
     console.warn(`[PropertyDetailsPage] Property not found for slug: ${slug}`);
    notFound();
  }

  // Fetch template based on property.templateId
  const template = await getWebsiteTemplate(property.templateId);

   if (!template) {
      console.error(`[PropertyDetailsPage] Website template "${property.templateId}" not found for property "${slug}". Cannot render page.`);
      // Decide how to handle missing template: show error, use default, or 404
      notFound(); // Or render a specific error component
   }

  console.log(`[PropertyDetailsPage] Data fetched successfully for ${slug}.`);

  // Use the generic PropertyPageLayout for all properties
  // Pass all fetched data to the layout component
  return (
      <Suspense fallback={<div>Loading property details...</div>}>
         <PropertyPageLayout
            property={property}
            template={template}
            overrides={overrides || {}} // Pass overrides or empty object if none found
         />
      </Suspense>
  );
}
