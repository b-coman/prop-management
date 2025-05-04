
// src/app/booking/check/[slug]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header'; // Assuming a generic header
import { AvailabilityCheck } from '@/components/booking/availability-check'; // Import the new component
import { getPropertyBySlug } from '@/app/properties/[slug]/page'; // Re-use the fetch function

interface AvailabilityCheckPageProps {
  params: { slug: string };
  searchParams: {
    checkIn?: string;
    checkOut?: string;
    guests?: string;
  };
}

// Optional: Function to generate metadata dynamically
export async function generateMetadata({ params }: AvailabilityCheckPageProps): Promise<Metadata> {
  const property = await getPropertyBySlug(params.slug);
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
  const property = await getPropertyBySlug(params.slug);

  if (!property) {
    notFound(); // Property slug is invalid
  }

  // Basic validation for search params
  const checkIn = searchParams.checkIn;
  const checkOut = searchParams.checkOut;
  const guests = searchParams.guests ? parseInt(searchParams.guests, 10) : 1;

  if (!checkIn || !checkOut || isNaN(guests) || guests < 1) {
    // Handle invalid search params, maybe redirect back or show an error
    // For now, we can let the AvailabilityCheck component handle it,
    // or redirect: redirect(`/properties/${params.slug}`);
    console.warn("[AvailabilityCheckPage] Invalid search parameters received:", searchParams);
    // Consider rendering an error state within AvailabilityCheck instead of redirecting immediately
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-grow container py-12 md:py-16">
        {/* Wrap AvailabilityCheck in Suspense if it uses useSearchParams directly,
            but passing props is generally preferred for Server Components */}
        <Suspense fallback={<div>Loading availability...</div>}>
          <AvailabilityCheck
            property={property}
            initialCheckIn={checkIn}
            initialCheckOut={checkOut}
            initialGuests={guests}
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
