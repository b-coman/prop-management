
// src/app/properties/[slug]/page.tsx

import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Property } from '@/types';
import { PrahovaPageLayout } from '@/components/property/prahova/prahova-page-layout';
import { ColteiPageLayout } from '@/components/property/coltei/coltei-page-layout';
import { Header } from '@/components/header';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Remove InitialBookingForm import from here, it will be used within the layout components
// import { InitialBookingForm } from '@/components/booking/initial-booking-form'; // Assuming this new component exists

// Function to get property data by slug (from Firestore)
// **** EXPORT the function ****
export async function getPropertyBySlug(slug: string): Promise<Property | undefined> {
    try {
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
                    return new Timestamp(timestamp.seconds, timestamp.nanoseconds).toDate();
                }
                return undefined;
            };

            const propertyData = {
                 id: doc.id,
                ...data,
                 createdAt: convertToDate(data.createdAt),
                 updatedAt: convertToDate(data.updatedAt),
                 // Handle nested timestamps if necessary
                 // Ensure houseRules is always an array
                 houseRules: Array.isArray(data.houseRules) ? data.houseRules : [],
            } as Property;

            // Ensure arrays are always present
             propertyData.amenities = Array.isArray(propertyData.amenities) ? propertyData.amenities : [];
             propertyData.images = Array.isArray(propertyData.images) ? propertyData.images : [];

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
      const propertiesCollection = collection(db, 'properties');
      const snapshot = await getDocs(propertiesCollection);

      if (snapshot.empty) {
        console.warn("[generateStaticParams] No properties found in Firestore to generate static params.");
        return [];
      }

      const params = snapshot.docs.map(doc => ({
          slug: doc.data().slug as string,
      })).filter(param => !!param.slug);

      return params;
  } catch (error) {
       console.error("❌ Error fetching properties for generateStaticParams:", error);
       return [];
  }
}


export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  // Fetch property data
  const property = await getPropertyBySlug(params.slug);

  if (!property) {
    notFound();
  }

  // Conditionally render the layout based on the property slug
  const LayoutComponent = property.slug === 'prahova-mountain-chalet'
    ? PrahovaPageLayout
    : property.slug === 'coltei-apartment-bucharest'
      ? ColteiPageLayout
      : null; // Fallback or default layout if needed

  if (LayoutComponent) {
    // Pass the property data to the specific layout component
    // The layout component will be responsible for rendering the InitialBookingForm
    return (
       <div>
         <LayoutComponent property={property} />
       </div>
    );
  }

  // Fallback for properties without a specific layout
  console.warn(`[PropertyDetailsPage] No specific layout found for slug: ${params.slug}. Rendering generic fallback.`);
  return (
    <div className="flex min-h-screen flex-col">
       <Header />
      <main className="flex-grow container py-12 md:py-16">
        <h1>{property.name}</h1>
        <p>Generic property page - Layout not defined.</p>
         {/* Basic rendering of property details */}
         <pre>{JSON.stringify(property, null, 2)}</pre>
          {/* You might render a generic InitialBookingForm here if needed */}
          {/* <Card id="booking-form" className="sticky top-24 shadow-lg">
            <CardHeader><CardTitle>Check Availability</CardTitle></CardHeader>
            <CardContent><InitialBookingForm property={property} /></CardContent>
          </Card> */}
      </main>
      {/* Add a generic footer if needed */}
    </div>
  );
}
