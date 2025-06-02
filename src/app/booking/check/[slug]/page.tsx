
// src/app/booking/check/[slug]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientHeader } from '@/components/client-header'; 
import { ClientBookingWrapper } from '@/components/booking/client-booking-wrapper';
import { ThemeProvider } from '@/contexts/ThemeContext';
// Import all needed utilities
import { getPropertyBySlug, getPropertyHeroImage } from '@/lib/property-utils';
import { db } from '@/lib/firebase'; // Import db for data fetching
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import BookingClientLayout from './booking-client-layout';
import { AvailabilityErrorHandler } from '../error-handler';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { FEATURES } from '@/config/features';
import { BookingPageV2 } from '@/components/booking-v2';

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
  const propertyName = serverTranslateContent(property.name);
  return {
    title: `Check Availability - ${propertyName}`,
    description: `Check booking availability for ${propertyName} for your selected dates.`,
  };
}

// Main Page Component
export default async function AvailabilityCheckPage({ params, searchParams }: AvailabilityCheckPageProps) {
  // In Next.js 15, we need to await params and searchParams before accessing properties
  const { slug } = await params;
  const { checkIn, checkOut, currency, language } = await searchParams;

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

  // Extract property name for display using server-side multilingual handling
  const propertyName = serverTranslateContent(property.name) || property.slug;
  
  // Pre-fetch hero image directly on the server side - this is more reliable
  let heroImage = null;
  try {
    console.log("🖼️ [SERVER] Pre-fetching hero image for property:", property.slug);
    heroImage = await getPropertyHeroImage(property.slug, true);
    console.log("🖼️ [SERVER] Hero image result:", heroImage);
  } catch (error) {
    console.error("🖼️ [SERVER] Error pre-fetching hero image:", error);
    // Continue without the hero image if it fails
  }

  // Get property theme ID for consistent theming
  const propertyThemeId = property.themeId;
  
  // Feature flag: V2 vs V1 booking system
  if (FEATURES.BOOKING_V2) {
    return (
      <Suspense fallback={<div>Loading V2 booking system...</div>}>
        <BookingClientLayout propertySlug={property.slug} themeId={propertyThemeId} heroImage={heroImage}>
          <BookingPageV2
            property={property}
            initialCurrency={currency as any}
            initialLanguage={language}
          />
        </BookingClientLayout>
      </Suspense>
    );
  }

  // V1 booking system (default)
  return (
    <Suspense fallback={<div>Loading availability...</div>}>
      <BookingClientLayout propertySlug={property.slug} themeId={propertyThemeId} heroImage={heroImage}>
        <ClientBookingWrapper
          property={property}
          urlParams={{ checkIn, checkOut }}
          heroImage={heroImage} // Directly pass the pre-fetched hero image
        />
      </BookingClientLayout>
    </Suspense>
  );
}


