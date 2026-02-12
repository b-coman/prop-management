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
import { ThemeProvider } from '@/contexts/ThemeContext';
// Import all needed utilities
import { getPropertyBySlug, getPropertyHeroImage } from '@/lib/property-utils';
import { db } from '@/lib/firebase'; // Import db for data fetching
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import BookingClientLayout from './booking-client-layout';
import { AvailabilityErrorHandler } from '../../error-handler';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { BookingPageV2 } from '@/components/booking-v2';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { LanguageHtmlUpdater } from '@/components/language-html-updater';
import { loggers } from '@/lib/logger';

const logger = loggers.booking;

interface BookingCheckPageProps {
  params: Promise<{ 
    slug: string;
    path?: string[];
  }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    checkin?: string;
    checkout?: string;
    guests?: string;
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
  const resolvedParams = await searchParams;
  // Support both camelCase and lowercase params (Google Vacation Rentals uses lowercase)
  const checkIn = resolvedParams.checkIn || resolvedParams.checkin;
  const checkOut = resolvedParams.checkOut || resolvedParams.checkout;
  const currency = resolvedParams.currency;
  
  // Path-based language detection (consistent with property pages)
  let detectedLanguage = DEFAULT_LANGUAGE;
  let actualPath = path || [];
  
  // Check if the first path segment is a supported language
  if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
    detectedLanguage = actualPath[0];
    actualPath = actualPath.slice(1); // Remove language from path for future use
  }

  logger.info('Booking check page requested', {
    slug,
    checkIn: checkIn || 'Not provided',
    checkOut: checkOut || 'Not provided',
    languagePath: path ? path.join('/') : 'Not provided',
    detectedLanguage
  });

  if (!slug) {
    logger.error('Slug is missing from params - returning 404');
    notFound();
  }

  logger.debug('Fetching property data from database', { slug });
  const property = await getPropertyBySlug(slug);

  if (!property) {
    logger.error('Property not found - returning 404', undefined, { slug });
    notFound(); // Property slug is invalid
  }

  logger.debug('Property found', { propertyName: property.name, slug });

  // Basic validation for search params (only dates now)
  if (!checkIn || !checkOut) {
    logger.warn('Missing date parameters in URL', {
      checkIn: checkIn || 'MISSING',
      checkOut: checkOut || 'MISSING'
    });
  } else {
    // Additional validation to catch invalid date formats
    try {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        logger.error('Invalid date format detected in URL params', undefined, {
          checkIn,
          checkOut,
          checkInValid: !isNaN(checkInDate.getTime()),
          checkOutValid: !isNaN(checkOutDate.getTime())
        });
      } else {
        const nights = Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        logger.debug('Valid dates parsed from URL params', {
          checkIn: checkInDate.toISOString().split('T')[0],
          checkOut: checkOutDate.toISOString().split('T')[0],
          nights
        });

        if (nights <= 0) {
          logger.warn('Check-out date is before or same as check-in date', { nights });
        }

        if (checkInDate < new Date()) {
          logger.warn('Check-in date is in the past', { checkIn: checkInDate.toISOString() });
        }
      }
    } catch (error) {
      logger.error('Error parsing dates from URL params', error as Error, { checkIn, checkOut });
    }
  }

  logger.debug('Rendering booking check page', { slug, detectedLanguage });

  // Extract property name for display using server-side multilingual handling
  const propertyName = serverTranslateContent(property.name) || property.slug;
  
  // Pre-fetch hero image directly on the server side - this is more reliable
  let heroImage = null;
  try {
    logger.debug('Pre-fetching hero image', { slug: property.slug });
    heroImage = await getPropertyHeroImage(property.slug, true);
    logger.debug('Hero image fetched', { slug: property.slug, hasImage: !!heroImage });
  } catch (error) {
    logger.error('Error pre-fetching hero image', error as Error, { slug: property.slug });
    // Continue without the hero image if it fails
  }

  // Get property theme ID for consistent theming
  const propertyThemeId = property.themeId;
  
  // V2 booking system is now the standard
  return (
    <>
      <LanguageHtmlUpdater initialLanguage={detectedLanguage} />
      <Suspense fallback={<div>Loading booking system...</div>}>
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