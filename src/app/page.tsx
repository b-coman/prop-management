// src/app/page.tsx - Renders a specific property based on slug (defaulting to prahova)
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { PropertyPageLayout } from '@/components/property/property-page-layout';
import { collection, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming db is correctly initialized

// Function to get core property data by slug (can be reused)
async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
    const propertyRef = doc(db, 'properties', slug); // Use slug as document ID
    try {
        const docSnap = await getDoc(propertyRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
             // Ensure slug is part of the returned object, using the doc ID
             const propertyData = { id: docSnap.id, slug: docSnap.id, ...data } as Property;
             // Ensure houseRules is always an array
             propertyData.houseRules = propertyData.houseRules || [];
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

// Function to get property overrides data (can be reused)
async function getPropertyOverrides(slug: string): Promise<PropertyOverrides | undefined> {
     const overridesRef = doc(db, 'propertyOverrides', slug); // Use slug as document ID
     try {
         const docSnap = await getDoc(overridesRef);
         if (docSnap.exists()) {
             return { id: docSnap.id, ...docSnap.data() } as PropertyOverrides;
         } else {
             console.log(`[getPropertyOverrides] No overrides document found for: propertyOverrides/${slug}.`);
             return undefined;
         }
     } catch (error) {
         console.error(`❌ Error fetching property overrides for ${slug}:`, error);
         return undefined;
     }
}

export default async function HomePage() {
  // Define the default property slug for the homepage
  const defaultPropertySlug = "prahova-mountain-chalet"; // Or dynamically determine this later

  console.log(`[HomePage] Rendering default property: ${defaultPropertySlug}`);

  // Fetch all necessary data for the default property
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

  console.log(`[HomePage] Data fetched successfully for ${defaultPropertySlug}.`);

  // Render the property page layout with the fetched data
  return (
    <Suspense fallback={<div>Loading homepage...</div>}>
      <PropertyPageLayout
        property={property}
        template={template}
        overrides={overrides || {}} // Pass overrides or empty object
      />
    </Suspense>
  );
}
