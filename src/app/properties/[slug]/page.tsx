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
             const validationResult = propertyOverridesSchema.safeParse(data);
             if (validationResult.success) {
                return { id: docSnap.id, ...validationResult.data } as PropertyOverrides;
             } else {
                console.error(`❌ Validation failed for propertyOverrides/${slug}:`, validationResult.error.flatten());
                // Decide how to handle: return undefined, return partial data, or throw error
                // For now, returning undefined as if not found or invalid
                return undefined;
             }
         } else {
             console.log(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}.`);
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
        getPropertyOverrides(slug),
    ]);

    if (!property) {
        console.error(`[PropertyDetailsPage] Property "${slug}" not found.`);
        notFound();
    }

    const template = await getWebsiteTemplate(property.templateId);

    if (!template) {
        console.error(`[PropertyDetailsPage] Website template "${property.templateId}" not found for property "${slug}".`);
        notFound();
    }

    // console.log(`[PropertyDetailsPage] Data fetched successfully for ${slug}.`);

    return (
        <Suspense fallback={<div>Loading property details...</div>}>
            <PropertyPageLayout
                property={property}
                template={template}
                overrides={overrides || {}} // Pass overrides or empty object
            />
        </Suspense>
    );
}

