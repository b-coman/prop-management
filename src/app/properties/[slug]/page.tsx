
// src/app/properties/[slug]/page.tsx

import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Property, SerializableTimestamp } from '@/types';
// Removed Prahova and Coltei specific layouts
import { PropertyPageLayout } from '@/components/property/property-page-layout'; // Import the new generic layout
import { Header } from '@/components/header'; // Keep generic header if needed by the layout
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import db for data fetching

// **** EXPORT the function ****
export async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
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
                if (!timestamp) return undefined;
                if (timestamp instanceof Timestamp) {
                    return timestamp.toDate();
                } else if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
                    // Handle Firestore Timestamp-like objects from JSON/serialization
                    return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
                } else if (typeof timestamp === 'string') {
                    // Handle ISO strings
                     try { return new Date(timestamp); } catch { return undefined; }
                } else if (typeof timestamp === 'number') {
                     // Assuming milliseconds since epoch
                     try { return new Date(timestamp); } catch { return undefined; }
                }
                return undefined;
            };

             // Convert relevant fields
             const propertyData = {
                id: doc.id,
                ...data,
                // Ensure timestamps are converted to Dates or stay as undefined/null
                createdAt: convertToDate(data.createdAt),
                updatedAt: convertToDate(data.updatedAt),
                 // Ensure arrays are always present even if missing in Firestore
                images: Array.isArray(data.images) ? data.images : [],
                amenities: Array.isArray(data.amenities) ? data.amenities : [],
                houseRules: Array.isArray(data.houseRules) ? data.houseRules : [],
                 // Explicitly cast potentially missing nested objects to ensure type safety
                location: data.location || {},
                ratings: data.ratings || { average: 0, count: 0 },
            } as Property;

             // Ensure nested location coordinates exist
             if (propertyData.location && !propertyData.location.coordinates) {
                 propertyData.location.coordinates = { latitude: 0, longitude: 0 }; // Default coordinates if missing
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

// Generate static paths using Firestore data
export async function generateStaticParams() {
  try {
      // **** Use Client SDK ****
      const propertiesCollection = collection(db, 'properties');
      const snapshot = await getDocs(propertiesCollection);

      if (snapshot.empty) {
        console.warn("[generateStaticParams] No properties found in Firestore to generate static params.");
        return [];
      }

      const params = snapshot.docs
        .map(doc => ({
            slug: doc.data().slug as string,
        }))
        .filter(param => typeof param.slug === 'string' && param.slug.length > 0); // Ensure slug is a non-empty string

      console.log(`[generateStaticParams] Generated ${params.length} params:`, params);
      return params;
  } catch (error) {
       console.error("❌ Error fetching properties for generateStaticParams:", error);
       return [];
  }
}


export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  // Await the params before accessing slug
  const awaitedParams = params;
  const slug = awaitedParams.slug;

  if (!slug) {
    console.error("[PropertyDetailsPage] Slug is missing from params.");
    notFound();
  }
  console.log(`[PropertyDetailsPage] Rendering page for slug: ${slug}`);

  // Fetch property data using the slug
  const property = await getPropertyBySlug(slug);

  if (!property) {
     console.warn(`[PropertyDetailsPage] Property not found for slug: ${slug}`);
    notFound();
  }
  console.log(`[PropertyDetailsPage] Property loaded from Firestore: ${property.name} (ID: ${property.id})`);


  // Use the generic PropertyPageLayout for all properties
  return <PropertyPageLayout property={property} />;

}

