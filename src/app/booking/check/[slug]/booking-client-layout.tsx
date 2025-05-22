"use client";

import React, { useEffect, useRef } from 'react';
import { BookingProvider } from '@/contexts/BookingContext';
import { useBooking } from '@/contexts/BookingContext';
import { useSearchParams } from 'next/navigation';
import { clearSyncedStorageByPrefix } from '@/hooks/use-synced-storage';
import { parseISO, isValid, startOfDay } from 'date-fns';
import { ErrorBoundary } from '@/components/error-boundary';
import BookingErrorFallback from '../../ErrorFallback';
import { AvailabilityErrorHandler } from '../error-handler';

interface BookingClientLayoutProps {
  children: React.ReactNode;
  propertySlug: string;
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

  // When URL parameters change, prepare storage for the BookingProvider
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (checkIn || checkOut) {
      // Clear any existing storage
      clearSyncedStorageByPrefix(`booking_${propertySlug}_`, { prefix: '' });
      clearSyncedStorageByPrefix('booking_', { prefix: '' });
      
      // Store session ID in sessionStorage so it can be accessed by other components
      const storageInitMarker = `booking_url_params_processed_${Date.now()}`;
      sessionStorage.setItem('booking_url_params_processed', storageInitMarker);
    }
  }, [propertySlug, checkIn, checkOut]);

  return null;
}

// This component gets access to the context after it's been initialized
function BookingClientInner({ 
  children, 
  propertySlug,
  heroImage
}: { 
  children: React.ReactNode, 
  propertySlug: string,
  heroImage: string | null
}) {
  const searchParams = useSearchParams();
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const {
    setCheckInDate,
    setCheckOutDate,
    setPropertySlug
  } = useBooking();

  // Track whether we've already processed URL params
  const processedUrlParams = useRef(false);

  // Set values in the context
  useEffect(() => {    
    // Set property slug in the context
    setPropertySlug(propertySlug);
    
    // Set dates from URL params only once
    if ((checkIn || checkOut) && !processedUrlParams.current) {
      // Mark as processed to prevent multiple applications of the same URL params
      processedUrlParams.current = true;
      
      // Parse and set dates directly from URL params
      const parsedCheckIn = parseDateSafe(checkIn);
      const parsedCheckOut = parseDateSafe(checkOut);
      
      // Log the parsed dates for debugging
      console.log(`[BookingClientInner] Parsed dates from URL - ONE TIME PROCESSING:`, {
        checkIn: checkIn,
        checkOut: checkOut,
        parsedCheckIn: parsedCheckIn?.toISOString() || 'null',
        parsedCheckOut: parsedCheckOut?.toISOString() || 'null'
      });
      
      // DEBUG: Log parsed date objects for timezone verification
      if (process.env.NODE_ENV === 'development') {
        console.log(`[BookingClientInner] 📅 Parsed date objects:`, {
          checkIn: parsedCheckIn?.toISOString(),
          checkOut: parsedCheckOut?.toISOString()
        });
      }
      
      // Set dates sequentially with timeouts to ensure proper state propagation
      if (parsedCheckIn) {
        // Set a flag to prevent multiple applications during development double-mounting
        sessionStorage.setItem('booking_url_params_applied', 'true');
        
        console.log(`[BookingClientInner] Setting checkInDate (ONE TIME):`, parsedCheckIn.toISOString());
        setCheckInDate(parsedCheckIn);
        
        // Set check-out date with a delay to ensure proper sequencing
        if (parsedCheckOut) {
          setTimeout(() => {
            console.log(`[BookingClientInner] Setting checkOutDate (ONE TIME):`, parsedCheckOut.toISOString());
            setCheckOutDate(parsedCheckOut);
          }, 100);
        }
      } else if (parsedCheckOut) {
        console.log(`[BookingClientInner] Setting checkOutDate only (ONE TIME):`, parsedCheckOut.toISOString());
        setCheckOutDate(parsedCheckOut);
      }
    }
  }, [propertySlug, setPropertySlug]); // Removed dependency on checkIn, checkOut, setCheckInDate, setCheckOutDate to prevent loops

  return (
    <>
      {/* Pass heroImage to children */}
      {React.Children.map(children, child => {
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

interface BookingClientLayoutProps {
  children: React.ReactNode;
  propertySlug: string;
  heroImage?: string | null;
}

// Main layout component with React Strict Mode protection
export default function BookingClientLayout({ children, propertySlug, heroImage }: BookingClientLayoutProps) {
  // Track if this instance has already mounted a provider
  const [shouldMount, setShouldMount] = React.useState(false);

  // Check if a provider is already mounted - this helps with React Strict Mode
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only check in development mode
    if (process.env.NODE_ENV === 'development') {
      const mountKey = `booking_provider_mounted_${propertySlug || 'global'}`;
      const isAlreadyMounted = window[mountKey as any];

      if (isAlreadyMounted) {
        setShouldMount(false);
      } else {
        setShouldMount(true);
      }
    } else {
      // In production, always mount
      setShouldMount(true);
    }
  }, [propertySlug]);

  return (
    <>
      <BookingStorageInitializer propertySlug={propertySlug} />

      {/* Add global error handler for fetch abort errors */}
      <AvailabilityErrorHandler />

      {/* Add an error boundary to catch any booking-related errors */}
      <ErrorBoundary
        fallback={(error: Error) => (
          <BookingErrorFallback
            error={error}
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
          />
        )}
      >
        {shouldMount || process.env.NODE_ENV !== 'development' ? (
          <BookingProvider propertySlug={propertySlug}>
            <BookingClientInner propertySlug={propertySlug} heroImage={heroImage}>
              {children}
            </BookingClientInner>
          </BookingProvider>
        ) : (
          // Pass children through without a provider if we've determined a provider is already mounted
          <>{children}</>
        )}
      </ErrorBoundary>
    </>
  );
}