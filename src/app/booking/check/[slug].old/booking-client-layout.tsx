"use client";

import React, { useEffect, useRef, useState } from 'react';
import { BookingProvider } from '@/contexts/BookingContext';
import { useBooking } from '@/contexts/BookingContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSearchParams } from 'next/navigation';
import { clearSyncedStorageByPrefix } from '@/hooks/use-synced-storage';
import { parseISO, isValid, startOfDay } from 'date-fns';
import { ErrorBoundary } from '@/components/error-boundary';
import BookingErrorFallback from '../../ErrorFallback';
import { AvailabilityErrorHandler } from '../error-handler';
import type { CurrencyCode } from '@/types';
import { FEATURES } from '@/config/features';

interface BookingClientLayoutProps {
  children: React.ReactNode;
  propertySlug: string;
  themeId?: string;
  heroImage?: string | null;
  initialLanguage?: string;
}

// Helper function for parsing date strings from URL params
// Fixed to handle YYYY-MM-DD format strings correctly and preserve the specified day
const parseDateSafe = (dateStr: string | undefined | null): Date | null => {
  if (!dateStr) return null;

  try {
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // For YYYY-MM-DD format, create date with explicit UTC time to avoid timezone issues
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date using proper UTC values to ensure correct day is preserved
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      
      console.log(`[BookingClient] Parsed "${dateStr}" with UTC approach:`, {
        inputDate: dateStr,
        resultDate: date.toISOString(),
        resultLocalDate: date.toLocaleDateString()
      });
      
      return date;
    }
    
    // First, try using parseISO which handles ISO format strings
    const parsedISO = parseISO(dateStr);
    if (isValid(parsedISO)) {
      // Set to noon on the same day to avoid timezone issues
      const adjustedDate = new Date(parsedISO);
      adjustedDate.setHours(12, 0, 0, 0);
      return adjustedDate;
    }

    // If parseISO fails, try using standard Date constructor
    const parsed = new Date(dateStr);
    if (isValid(parsed)) {
      const adjustedDate = new Date(parsed);
      adjustedDate.setHours(12, 0, 0, 0);
      return adjustedDate;
    }

    return null;
  } catch (error) {
    console.error(`[BookingClient] Error parsing date string "${dateStr}":`, error);
    return null;
  }
};

// This component initializes storage before the BookingProvider mounts
function BookingStorageInitializer({ propertySlug }: { propertySlug: string }) {
  const searchParams = useSearchParams();
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const initRef = useRef(false);

  // When URL parameters change, prepare storage for the BookingProvider
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Only run this once per mount to avoid clearing data after it's been fetched
    if (initRef.current) return;
    
    if (checkIn || checkOut) {
      // Check if we already processed these exact URL params
      const processedMarker = sessionStorage.getItem('booking_url_params_processed');
      const currentParams = `${propertySlug}_${checkIn}_${checkOut}`;
      
      if (processedMarker === currentParams) {
        console.log(`[BookingStorageInitializer] ✅ Already processed URL params for: ${currentParams}`);
        return;
      }
      
      // Mark as initialized
      initRef.current = true;
      
      // DEBUG: Log what's in storage before clearing
      console.log(`[BookingStorageInitializer] 🚨 BEFORE CLEAR - Session storage keys:`, Object.keys(sessionStorage).filter(k => k.includes('booking')));
      
      // Clear only non-essential booking data, preserve pricing and critical data
      const keysToPreserve = new Set<string>();
      const allBookingKeys = Object.keys(sessionStorage).filter(k => k.includes('booking'));
      
      allBookingKeys.forEach(key => {
        // Preserve pricing data, session IDs, and critical booking data
        if (key.includes('pricingDetails') || 
            key.includes('session_id') ||
            key.includes('totalPrice') ||
            key.includes('numberOfNights')) {
          keysToPreserve.add(key);
          const value = sessionStorage.getItem(key);
          console.log(`[BookingStorageInitializer] 💰 PRESERVING key "${key}":`, value ? 'HAS DATA' : 'NULL');
        }
      });
      
      // Store preserved data
      const preservedData: { [key: string]: string | null } = {};
      keysToPreserve.forEach(key => {
        preservedData[key] = sessionStorage.getItem(key);
      });
      
      // Clear only non-preserved keys
      console.log(`[BookingStorageInitializer] ⚠️ CLEARING non-essential booking storage`);
      allBookingKeys.forEach(key => {
        if (!keysToPreserve.has(key)) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Mark these URL params as processed
      sessionStorage.setItem('booking_url_params_processed', currentParams);
      
      // DEBUG: Log what's left after selective clearing
      console.log(`[BookingStorageInitializer] 🚨 AFTER CLEAR - Session storage keys:`, Object.keys(sessionStorage).filter(k => k.includes('booking')));
    }
  }, [propertySlug, checkIn, checkOut]);

  return null;
}

// Theme applicator component to handle property theme application
function BookingThemeApplicator({ themeId, onThemeReady }: { themeId?: string; onThemeReady: () => void }) {
  const { setTheme } = useTheme();
  
  useEffect(() => {
    if (themeId) {
      console.log(`🎨 [Booking] Applying property theme: ${themeId}`);
      setTheme(themeId);
      // Small delay to ensure theme is applied before rendering
      setTimeout(onThemeReady, 50);
    } else {
      // No theme to apply, ready immediately
      onThemeReady();
    }
  }, [themeId, setTheme, onThemeReady]);
  
  return null; // No render needed
}

// This component gets access to the context after it's been initialized
function BookingClientInner({ 
  children, 
  propertySlug,
  heroImage,
  themeId
}: { 
  children: React.ReactNode, 
  propertySlug: string,
  heroImage: string | null | undefined,
  themeId?: string
}) {
  const searchParams = useSearchParams();
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const currency = searchParams.get('currency');
  const {
    setCheckInDate,
    setCheckOutDate,
    setPropertySlug,
    // BUG #3 FIX: Use URL-specific setters for initial load to allow pricing fetch
    setCheckInDateFromURL,
    setCheckOutDateFromURL,
    fetchPricing,
    pricingDetails
  } = useBooking();
  const { setSelectedCurrencyTemporary } = useCurrency();

  // Track whether we've already processed URL params
  const processedUrlParams = useRef(false);
  
  // Track theme readiness to prevent flash
  const [themeReady, setThemeReady] = useState(false);

  // Set values in the context
  useEffect(() => {    
    // Set property slug in the context
    setPropertySlug(propertySlug);
    
    // Set currency from URL params once
    if (currency && !processedUrlParams.current) {
      const upperCurrency = currency.toUpperCase() as CurrencyCode;
      // Validate it's a supported currency
      const supportedCurrencies = ['USD', 'EUR', 'RON'];
      if (supportedCurrencies.includes(upperCurrency)) {
        console.log(`[BookingClientInner] Setting currency from URL (temporary): ${upperCurrency}`);
        setSelectedCurrencyTemporary(upperCurrency);
      } else {
        console.warn(`[BookingClientInner] Invalid currency in URL: ${currency}, using default`);
      }
    }
    
    // Set dates from URL params only once
    if ((checkIn || checkOut) && !processedUrlParams.current) {
      // Mark as processed to prevent multiple applications of the same URL params
      processedUrlParams.current = true;
      
      // Parse and set dates directly from URL params
      const parsedCheckIn = parseDateSafe(checkIn);
      const parsedCheckOut = parseDateSafe(checkOut);
      
      // Log the parsed dates for debugging
      console.log(`[BookingClientInner] Parsed dates from URL:`, {
        checkIn: checkIn,
        checkOut: checkOut,
        parsedCheckIn: parsedCheckIn?.toISOString() || 'null',
        parsedCheckOut: parsedCheckOut?.toISOString() || 'null',
        currency: currency
      });
      
      // DEBUG: Log parsed date objects for timezone verification
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BookingClientInner] 📅 Parsed date objects:`, {
          checkIn: parsedCheckIn?.toISOString(),
          checkOut: parsedCheckOut?.toISOString(),
          currency: currency
        });
      }
      
      // Set dates sequentially with timeouts to ensure proper state propagation
      if (parsedCheckIn) {
        // Set a flag to prevent multiple applications during development double-mounting
        sessionStorage.setItem('booking_url_params_applied', 'true');
        
        console.log(`[BookingClientInner] Setting checkInDate from URL:`, parsedCheckIn.toISOString());
        setCheckInDateFromURL(parsedCheckIn);
        
        // Set check-out date immediately after check-in
        if (parsedCheckOut) {
          // No delay needed - set immediately
          console.log(`[BookingClientInner] Setting checkOutDate from URL:`, parsedCheckOut.toISOString());
          setCheckOutDateFromURL(parsedCheckOut);
        }
      } else if (parsedCheckOut) {
        console.log(`[BookingClientInner] Setting checkOutDate only from URL:`, parsedCheckOut.toISOString());
        setCheckOutDateFromURL(parsedCheckOut);
      }
    }
  }, [propertySlug, setPropertySlug, currency, setSelectedCurrencyTemporary]); // Added currency dependencies

  // Fetch pricing when we have dates from URL
  useEffect(() => {
    // Only fetch if we have both dates and haven't fetched pricing yet
    if (checkIn && checkOut && !pricingDetails) {
      // Small delay to ensure context state has been updated
      const timer = setTimeout(() => {
        console.log(`[BookingClientInner] Fetching pricing for dates from URL`);
        fetchPricing().catch(error => {
          console.error('[BookingClientInner] Error fetching pricing:', error);
        });
      }, 300); // 300ms delay to ensure dates are set in context

      return () => clearTimeout(timer);
    }
  }, [checkIn, checkOut, pricingDetails, fetchPricing]);

  // Show loading until theme is ready
  if (!themeReady) {
    return (
      <>
        {/* Apply property theme */}
        <BookingThemeApplicator themeId={themeId} onThemeReady={() => setThemeReady(true)} />
        
        {/* Loading state to prevent theme flash */}
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading booking page...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Pass heroImage to children */}
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {          
          // Set heroImage with highest priority
          const childProps = { 
            ...child.props,
            heroImage: heroImage 
          };
          
          
          return React.cloneElement(child, childProps);
        }
        return child;
      })}
    </>
  );
}


// Main layout component - same behavior in dev and prod
export default function BookingClientLayout({ children, propertySlug, heroImage, themeId, initialLanguage }: BookingClientLayoutProps) {
  
  return (
    <>
      {/* V1 only: Storage initializer that clears data */}
      {!FEATURES.BOOKING_V2 && <BookingStorageInitializer propertySlug={propertySlug} />}

      {/* Add global error handler for fetch abort errors */}
      <AvailabilityErrorHandler />

      {/* Add an error boundary to catch any booking-related errors */}
      <ErrorBoundary
        fallback={<BookingErrorFallback
          error={new Error('Booking error occurred')}
          reset={() => {
            // Clear storage and reload on reset
            if (typeof window !== 'undefined') {
              Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('booking_')) {
                  sessionStorage.removeItem(key);
                }
              });
              window.location.reload();
            }
          }}
        />}
      >
        {FEATURES.BOOKING_V2 ? (
          // V2: Don't wrap with V1 BookingProvider, let BookingPageV2 handle its own provider
          children
        ) : (
          // V1: Use the original BookingProvider
          <BookingProvider propertySlug={propertySlug}>
            <BookingClientInner propertySlug={propertySlug} heroImage={heroImage} themeId={themeId}>
              {children}
            </BookingClientInner>
          </BookingProvider>
        )}
      </ErrorBoundary>
    </>
  );
}