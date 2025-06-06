/**
 * @fileoverview Booking Check Page with Path-Based Language Detection
 * @module app/booking/check/[slug]/[[...path]]/page
 * 
 * @description
 * Server component for booking availability checking with path-based language detection.
 * Migrated from search parameter approach to eliminate race conditions and achieve
 * consistency with property pages architecture.
 * 
 * @architecture
 * Location: Booking flow entry point
 * Layer: Server-side page component (App Router)
 * Pattern: Path-based language detection (/booking/check/slug/ro)
 * 
 * @dependencies
 * - Internal: Property utilities, language system, booking components
 * - External: Next.js App Router, Firebase Firestore
 * 
 * @relationships
 * - Renders: BookingPageV2 or V1 booking system based on feature flags
 * - Provides: Language detection, property data, theme configuration
 * - Children: BookingClientLayout, BookingPageV2
 * 
 * @url-structure
 * /booking/check/property-slug/[language]?checkIn=date&checkOut=date&currency=code
 * 
 * @examples
 * /booking/check/prahova-mountain-chalet/ro?checkIn=2025-06-24&checkOut=2025-06-27
 * /booking/check/prahova-mountain-chalet?checkIn=2025-06-24&checkOut=2025-06-27 (defaults to English)
 * 
 * @migration-notes
 * Migrated from search parameter approach (?lang=ro) to path-based approach (/ro)
 * to eliminate client-side race conditions and achieve consistency with property pages.
 * Migration completed 2025-06-05 as part of language system unification.
 * 
 * @v2-dependency: CORE
 * @v2-usage: Primary booking entry point
 * @v2-first-used: 2025-06-05
 * 
 * @since v2.0.0
 * @author RentalSpot Team
 */

// src/app/booking/check/[slug]/[[...path]]/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientBookingWrapper } from '@/components/booking/client-booking-wrapper';
import { ThemeProvider } from '@/contexts/ThemeContext';
// Import all needed utilities
import { getPropertyBySlug, getPropertyHeroImage } from '@/lib/property-utils';
import { db } from '@/lib/firebase'; // Import db for data fetching
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import BookingClientLayout from './booking-client-layout';
import { AvailabilityErrorHandler } from '../../error-handler';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { FEATURES } from '@/config/features';
import { BookingPageV2 } from '@/components/booking-v2';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { LanguageHtmlUpdater } from '@/components/language-html-updater';

interface BookingCheckPageProps {
  params: Promise<{ 
    slug: string;
    path?: string[];
  }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    currency?: string;
    // Note: lang/language removed - now handled via path
  }>;
}

// Optional: Function to generate metadata dynamically
export async function generateMetadata({ params, searchParams }: BookingCheckPageProps): Promise<Metadata> {
  // In Next.js 15, we need to await params and searchParams before accessing properties
  const { slug, path } = await params;
  const resolvedSearchParams = await searchParams;
  
  // Extract language from path (same logic as property pages)
  let detectedLanguage = DEFAULT_LANGUAGE;
  if (path && path.length > 0 && SUPPORTED_LANGUAGES.includes(path[0])) {
    detectedLanguage = path[0];
  }
    
  const property = await getPropertyBySlug(slug);
  if (!property) {
    return { 
      title: 'Availability Check - Not Found',
      other: {
        'html-lang': detectedLanguage
      }
    };
  }
  
  const propertyName = serverTranslateContent(property.name, detectedLanguage);
  
  // Create localized metadata
  const titles = {
    en: `Check Availability - ${propertyName}`,
    ro: `Verifică Disponibilitatea - ${propertyName}`
  };
  
  const descriptions = {
    en: `Check booking availability for ${propertyName} for your selected dates.`,
    ro: `Verifică disponibilitatea pentru rezervare la ${propertyName} pentru datele selectate.`
  };
  
  return {
    title: titles[detectedLanguage as keyof typeof titles] || titles.en,
    description: descriptions[detectedLanguage as keyof typeof descriptions] || descriptions.en,
    other: {
      'html-lang': detectedLanguage
    }
  };
}

// Main Page Component
export default async function BookingCheckPage({ params, searchParams }: BookingCheckPageProps) {
  // In Next.js 15, we need to await params and searchParams before accessing properties
  const { slug, path } = await params;
  const { checkIn, checkOut, currency } = await searchParams;
  
  // Path-based language detection (consistent with property pages)
  let detectedLanguage = DEFAULT_LANGUAGE;
  let actualPath = path || [];
  
  // Check if the first path segment is a supported language
  if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
    detectedLanguage = actualPath[0];
    actualPath = actualPath.slice(1); // Remove language from path for future use
  }

  console.log("\n================================");
  console.log("🔍 [SERVER] Booking Check Page Requested");
  console.log("================================");
  console.log(`📆 Date/Time: ${new Date().toISOString()}`);
  console.log(`🏠 Property Slug: ${slug}`);
  console.log(`🗓️ Check-in: ${checkIn || 'Not provided'}`);
  console.log(`🗓️ Check-out: ${checkOut || 'Not provided'}`);
  console.log(`🌐 Language Path: ${path ? path.join('/') : 'Not provided'}`);
  console.log(`🌐 Detected Language: ${detectedLanguage}`);
  console.log(`🌐 Supported Languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
  console.log(`🔧 Migration: Using path-based detection (v2.0)`);
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
      <>
        <LanguageHtmlUpdater initialLanguage={detectedLanguage} />
        <Suspense fallback={<div>Loading V2 booking system...</div>}>
          <BookingClientLayout 
            propertySlug={property.slug} 
            themeId={propertyThemeId} 
            heroImage={heroImage}
            initialLanguage={detectedLanguage}
          >
            <BookingPageV2
              property={property}
              initialCurrency={currency as any}
              initialLanguage={detectedLanguage}
              themeId={propertyThemeId}
            />
          </BookingClientLayout>
        </Suspense>
      </>
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