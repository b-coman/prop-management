
// src/app/booking/check/[slug]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/generic-header'; // Assuming a generic header
import { AvailabilityCheck } from '@/components/booking/availability-check'; // Import the new component
// Correct import path: Import directly from the file where it's defined
import { getPropertyBySlug } from '@/app/properties/[slug]/page';
import { db } from '@/lib/firebase'; // Import db for data fetching
import { collection, query, where, getDocs } from 'firebase/firestore';

interface AvailabilityCheckPageProps {
  params: { slug: string };
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    // guests?: string; // guests is no longer passed via search params
  };
}

// Optional: Function to generate metadata dynamically
export async function generateMetadata({ params }: AvailabilityCheckPageProps): Promise<Metadata> {
  // In Next.js 15, we need to await params before accessing its properties
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) {
    return { title: 'Availability Check - Not Found' };
  }
  return {
    title: `Check Availability - ${property.name}`,
    description: `Check booking availability for ${property.name} for your selected dates.`,
  };
}

// Main Page Component
export default async function AvailabilityCheckPage({ params, searchParams }: AvailabilityCheckPageProps) {
  // In Next.js 15, we need to await params and searchParams before accessing properties
  const { slug } = await params;
  const { checkIn, checkOut } = await searchParams;

  if (!slug) {
    console.error("[AvailabilityCheckPage] Slug is missing from params.");
    notFound();
  }

  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound(); // Property slug is invalid
  }

  // Basic validation for search params (only dates now)

  if (!checkIn || !checkOut) {
    // Handle invalid search params, maybe redirect back or show an error
    // For now, we can let the AvailabilityCheck component handle it,
    // or redirect: redirect(`/properties/${params.slug}`);
    console.warn("[AvailabilityCheckPage] Invalid search parameters received:", searchParams);
    // Consider rendering an error state within AvailabilityCheck instead of redirecting immediately
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Use Generic Header for this page */}
      <Header propertyName={property.name} propertySlug={property.slug}/>
      <main className="flex-grow container py-12 md:py-16">
        {/* Wrap AvailabilityCheck in Suspense if it uses useSearchParams directly,
            but passing props is generally preferred for Server Components */}
        <Suspense fallback={<div>Loading availability...</div>}>
          <AvailabilityCheck
            property={property}
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
          />
        </Suspense>
      </main>
      {/* Add a generic footer if desired */}
      {/* <Footer /> */}
       <footer className="border-t bg-muted/50">
         <div className="container py-4 text-center text-xs text-muted-foreground">
           RentalSpot &copy; {new Date().getFullYear()}
         </div>
       </footer>
    </div>
  );
}


