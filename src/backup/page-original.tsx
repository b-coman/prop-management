// src/app/properties/[slug]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageLayout } from '@/components/property/property-page-layout';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming db is correctly initialized
import { propertyOverridesSchema } from '@/lib/overridesSchemas'; // Import Zod schema for overrides

export const dynamic = 'force-dynamic'; // Ensures the page is always dynamically rendered

// Function to get core property data by slug (can be reused)
export async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
    if (!slug) {
        console.warn("[getPropertyBySlug] Attempted to fetch property with empty slug.");
        return undefined;
    }
    const propertyRef = doc(db, 'properties', slug); // Use slug as document ID
    try {
        const docSnap = await getDoc(propertyRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
             // Ensure slug is part of the returned object, using the doc ID
             const propertyData = { id: docSnap.id, slug: docSnap.id, ...data } as Property;
             // Ensure houseRules is always an array
             propertyData.houseRules = Array.isArray(propertyData.houseRules) ? propertyData.houseRules : [];
             // Convert Firestore Timestamps to Date objects or ISO strings if needed for client components
             // This depends on how Property type defines date fields (SerializableTimestamp allows flexibility)
            //  propertyData.createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt;
            //  propertyData.updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt;

             return propertyData;
        } else {
            console.warn(`[getPropertyBySlug] Property document not found: properties/${slug}`);
            return undefined;
        }
    } catch (error) {
        console.error(`❌ Error fetching property with slug ${slug}:`, error);
        return undefined;
    }
}

// Function to get website template data (can be reused)
export async function getWebsiteTemplate(templateId: string): Promise<WebsiteTemplate | undefined> {
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

// Function to get property overrides data (can be reused)
// Updated to add Zod validation
export async function getPropertyOverrides(slug: string): Promise<PropertyOverrides | undefined> {
     if (!slug) {
        console.warn("[getPropertyOverrides] Attempted to fetch overrides with empty slug.");
        return undefined;
     }
     const overridesRef = doc(db, 'propertyOverrides', slug); // Use slug as document ID
     try {
         const docSnap = await getDoc(overridesRef);
         if (docSnap.exists()) {
             const data = docSnap.data();
             // Validate the fetched data against the schema
             const validationResult = propertyOverridesSchema.safeParse(data);
             if (validationResult.success) {
                // console.log(`[getPropertyOverrides] Successfully fetched and validated overrides for ${slug}`);
                return { id: docSnap.id, ...validationResult.data } as PropertyOverrides;
             } else {
                // Log detailed validation errors
                console.error(`❌ Validation failed for propertyOverrides/${slug}:`, validationResult.error.format());
                // Decide how to handle: return undefined, return partial data, or throw error
                // For now, returning undefined as if not found or invalid
                return undefined;
             }
         } else {
             // console.log(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}. Returning undefined.`);
             return undefined; // Return undefined if no overrides exist
         }
     } catch (error) {
         console.error(`❌ Error fetching property overrides for ${slug}:`, error);
         return undefined;
     }
}

interface PropertyDetailsPageProps {
  params: { slug: string };
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
    // Await params before using
    const awaitedParams = await params;
    const slug = awaitedParams.slug;

    if (!slug) {
        console.error("[PropertyDetailsPage] Slug is missing from params.");
        notFound();
    }

    // console.log(`[PropertyDetailsPage] Rendering property: ${slug}`);

    // Fetch all necessary data for the property using the reusable functions
    const [property, overrides] = await Promise.all([
        getPropertyBySlug(slug),
        getPropertyOverrides(slug), // This now validates the overrides data
    ]);

    if (!property) {
        console.error(`[PropertyDetailsPage] Property "${slug}" not found.`);
        notFound();
    }

    const template = await getWebsiteTemplate(property.templateId);

    if (!template) {
        console.error(`[PropertyDetailsPage] Website template "${property.templateId}" not found for property "${slug}".`);
        notFound(); // Or render a fallback page
    }

    // console.log(`[PropertyDetailsPage] Data fetched successfully for ${slug}. Overrides fetched: ${!!overrides}`);

    return (
        <Suspense fallback={<div>Loading property details...</div>}>
            <PropertyPageLayout
                property={property}
                template={template}
                overrides={overrides || {}} // Pass validated overrides or empty object
            />
        </Suspense>
    );
}


// Optional: Generate static paths if using SSG
// Keep this function if you intend to use Static Site Generation (SSG)
// Remove or comment out if you are only using Server-Side Rendering (SSR) or Incremental Static Regeneration (ISR)
// export async function generateStaticParams() {
//   const propertiesCollection = collection(db, 'properties');
//   const snapshot = await getDocs(propertiesCollection);
//   const slugs = snapshot.docs.map(doc => doc.id); // Document ID is the slug

//   // console.log("[generateStaticParams] Generating paths for slugs:", slugs);
//   return slugs.map((slug) => ({
//     slug: slug,
//   }));
// }