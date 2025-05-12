
// src/app/booking/check/[slug]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/generic-header'; // Assuming a generic header
import { BookingContainer } from '@/components/booking'; // Import the new container component
// Import from the utility file
import { getPropertyBySlug } from '@/lib/property-utils';
import { db } from '@/lib/firebase'; // Import db for data fetching
import { collection, query, where, getDocs } from 'firebase/firestore';
import BookingClientLayout from './booking-client-layout';
import { AvailabilityErrorHandler } from '../error-handler';

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

  console.log("\n================================");
  console.log("🔍 [SERVER] Booking Check Page Requested");
  console.log("================================");
  console.log(`📆 Date/Time: ${new Date().toISOString()}`);
  console.log(`🏠 Property Slug: ${slug}`);
  console.log(`🗓️ Check-in: ${checkIn || 'Not provided'}`);
  console.log(`🗓️ Check-out: ${checkOut || 'Not provided'}`);
  console.log("================================\n");

  if (!slug) {
    console.error("❌ [SERVER] Slug is missing from params - returning 404");
    notFound();
  }

  console.log("🔍 [SERVER] Fetching property data from database...");
  const property = await getPropertyBySlug(slug);

  if (!property) {
    console.error(`❌ [SERVER] Property not found with slug: ${slug} - returning 404`);
    notFound(); // Property slug is invalid
  }

  console.log(`✅ [SERVER] Property found: "${property.name}"`);

  // Basic validation for search params (only dates now)
  if (!checkIn || !checkOut) {
    console.warn("⚠️ [SERVER] Missing date parameters in URL:");
    console.warn(`   Check-in: ${checkIn || 'MISSING'}`);
    console.warn(`   Check-out: ${checkOut || 'MISSING'}`);
    console.warn("   The client component will handle this case.");
  } else {
    // Additional validation to catch invalid date formats
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.error("❌ [SERVER] Invalid date format detected in URL params:");
        console.error(`   Check-in: ${checkIn} - Valid: ${!isNaN(checkInDate.getTime())}`);
        console.error(`   Check-out: ${checkOut} - Valid: ${!isNaN(checkOutDate.getTime())}`);
      } else {
        const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log("✅ [SERVER] Valid dates parsed from URL params:");
        console.log(`   Check-in: ${checkInDate.toISOString().split('T')[0]}`);
        console.log(`   Check-out: ${checkOutDate.toISOString().split('T')[0]}`);
        console.log(`   Nights: ${nights}`);

        if (nights <= 0) {
          console.warn("⚠️ [SERVER] Potential issue: Check-out date is before or same as check-in date");
        }

        if (checkInDate < new Date()) {
          console.warn("⚠️ [SERVER] Potential issue: Check-in date is in the past");
        }
      }
    } catch (error) {
      console.error("❌ [SERVER] Error parsing dates from URL params:", error);
    }
  }

  console.log("🚀 [SERVER] Rendering booking check page...\n");

  return (
    <div className="flex min-h-screen flex-col">
      {/* Use Generic Header for this page */}
      <Header propertyName={property.name} propertySlug={property.slug}/>
      <main className="flex-grow container py-12 md:py-16">
        {/* Wrap AvailabilityCheck in Suspense if it uses useSearchParams directly,
            but passing props is generally preferred for Server Components */}
        <Suspense fallback={<div>Loading availability...</div>}>
          <BookingClientLayout propertySlug={property.slug}>
            <BookingContainer
              property={property}
            />
          </BookingClientLayout>
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


