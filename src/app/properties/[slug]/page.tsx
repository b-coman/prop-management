
// Removed 'use client' directive

import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Property } from '@/types';
import { PrahovaPageLayout } from '@/components/property/prahova/prahova-page-layout';
import { ColteiPageLayout } from '@/components/property/coltei/coltei-page-layout';
import { Header } from '@/components/header'; // Assuming a generic header might still be needed, adjust if not
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'; // Added Timestamp
import { db } from '@/lib/firebase'; // Import Firestore instance


// Function to get property data by slug (replace with actual data fetching)
async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
    try {
        // **** Use Client SDK ****
        const propertiesCollection = collection(db, 'properties');
        const q = query(propertiesCollection, where('slug', '==', slug));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            const data = doc.data();

            // Function to safely convert Firestore Timestamps or objects to Dates
            const convertToDate = (timestamp: any): Date | undefined => {
                if (timestamp instanceof Timestamp) {
                    return timestamp.toDate();
                } else if (timestamp && typeof timestamp._seconds === 'number' && typeof timestamp._nanoseconds === 'number') {
                    // Handle object format if needed (e.g., from JSON import)
                    return new Timestamp(timestamp._seconds, timestamp._nanoseconds).toDate();
                }
                 return undefined; // Return undefined if it's not a recognizable timestamp format
            };

            // Ensure Timestamps are converted if they exist and are in Firestore Timestamp format or object format
            const propertyData = {
                 id: doc.id,
                ...data,
                 createdAt: convertToDate(data.createdAt),
                 updatedAt: convertToDate(data.updatedAt),
                 // Handle nested timestamps if necessary, e.g., ratings.lastUpdated
            } as Property;

            // Ensure houseRules is always an array
             if (!Array.isArray(propertyData.houseRules)) {
               propertyData.houseRules = [];
             }

             // Ensure amenities is always an array
             if (!Array.isArray(propertyData.amenities)) {
                propertyData.amenities = [];
             }

              // Ensure images is always an array
             if (!Array.isArray(propertyData.images)) {
                propertyData.images = [];
             }


            return propertyData;
        } else {
            console.warn(`[getPropertyBySlug] Property with slug '${slug}' not found.`);
            return undefined;
        }
    } catch (error) {
        console.error(`❌ Error fetching property with slug ${slug}:`, error);
        return undefined;
    }
}


interface PropertyDetailsPageProps {
  params: { slug: string };
}


// Optional: Generate static paths if using SSG
// Consider if this is still needed or if ISR/SSR is better with dynamic data
export async function generateStaticParams() {
  try {
      const propertiesCollection = collection(db, 'properties');
      const snapshot = await getDocs(propertiesCollection);

      if (snapshot.empty) {
        console.warn("[generateStaticParams] No properties found in Firestore to generate static params.");
        return [];
      }

      const params = snapshot.docs.map(doc => ({
          slug: doc.data().slug as string, // Assuming slug exists and is a string
      })).filter(param => !!param.slug); // Filter out entries without a slug

      // console.log("[generateStaticParams] Generated slugs:", params.map(p => p.slug));
      return params;
  } catch (error) {
       console.error("❌ Error fetching properties for generateStaticParams:", error);
       return []; // Return empty array on error
  }
}


export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  // console.log(`[PropertyDetailsPage] Fetching property for slug: ${params.slug}`);
  const property = await getPropertyBySlug(params.slug);

  if (!property) {
    console.warn(`[PropertyDetailsPage] Property not found for slug: ${params.slug}. Rendering 404.`);
    notFound();
  }

  // console.log(`[PropertyDetailsPage] Property loaded from Firestore: ${property.name} (ID: ${property.id})`);


  // Conditionally render the layout based on the property slug
  const LayoutComponent = property.slug === 'prahova-mountain-chalet'
    ? PrahovaPageLayout
    : property.slug === 'coltei-apartment-bucharest'
      ? ColteiPageLayout
      : null; // Fallback or default layout if needed

  if (LayoutComponent) {
    return (
       <div>
         <LayoutComponent property={property} />
       </div>
    );
  }


  // Fallback for properties without a specific layout (or could redirect/show error)
   console.warn(`[PropertyDetailsPage] No specific layout found for slug: ${params.slug}. Rendering generic fallback.`);
  return (
    <div className="flex min-h-screen flex-col">
       <Header />
      <main className="flex-grow container py-12 md:py-16">
        <h1>{property.name}</h1>
        <p>Generic property page - Layout not defined.</p>
         {/* Basic rendering of property details */}
         <pre>{JSON.stringify(property, null, 2)}</pre>
      </main>
    </div>
  );
}
