"use client";

import React, { useEffect, useRef, useState, useContext } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseISO, isValid, differenceInDays } from 'date-fns';
import { BookingProvider, useBooking } from '@/contexts/BookingContext';
import { AvailabilityContainer } from './AvailabilityContainer';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLanguage } from '@/hooks/useLanguage';
import type { Property } from '@/types';

// Props for the complete BookingContainer
export interface BookingContainerProps {
  property: Property;
  position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: 'compressed' | 'large';
  showRating?: boolean;
  variant?: 'embedded' | 'standalone';
  className?: string;
}

// Props for the BookingInitializer component
interface BookingInitializerProps {
  property: Property;
  initialCheckIn?: Date;
  initialCheckOut?: Date;
  initialGuests?: number;
  position?: string;
  size?: string;
  showRating?: boolean;
  variant?: 'embedded' | 'standalone';
  className?: string;
}

/**
 * Inner component that accesses the BookingContext
 */
function BookingInitializer({
  property,
  initialCheckIn,
  initialCheckOut,
  initialGuests,
  position = 'bottom',
  size = 'compressed',
  showRating = false,
  variant = 'standalone',
  className
}: BookingInitializerProps) {
  const {
    checkInDate,
    checkOutDate,
    numberOfGuests,
    setPropertySlug,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
    // BUG #3 FIX: Use URL-specific setters for initialization
    setCheckInDateFromURL,
    setCheckOutDateFromURL,
    setNumberOfGuestsFromURL,
    // Add availability fetch function
    fetchAvailability,
    calendarUnavailableDates
  } = useBooking();
  
  // Define ref outside the effect hook
  const hasInitialized = useRef(false);

  // Initialize booking context with URL parameters - once only
  useEffect(() => {
    // Skip if already initialized
    if (hasInitialized.current) {
      return;
    }

    // Mark as initialized
    hasInitialized.current = true;

    // Set property slug
    setPropertySlug(property.slug);

    // BUG #3 FIX: Use URL-specific setters that won't override user interactions
    // Set check-in date
    if (initialCheckIn) {
      setCheckInDateFromURL(initialCheckIn);
    }

    // Set check-out date
    if (initialCheckOut) {
      setCheckOutDateFromURL(initialCheckOut);
    }

    // Set number of guests
    if (initialGuests) {
      setNumberOfGuestsFromURL(initialGuests);
    }

  }, []); // Empty dependency array = only run once

  // Load availability data if not already loaded
  useEffect(() => {
    if (property.slug && calendarUnavailableDates.length === 0) {
      console.log(`[BookingContainer] Loading availability for property: ${property.slug}`);
      fetchAvailability().catch(error => {
        console.error('[BookingContainer] Error loading availability:', error);
      });
    }
  }, [property.slug]); // Only depend on property slug


  // Import useLanguage hook for multilingual support (needs to be called unconditionally)
  const { tc, t } = useLanguage();
  
  // For embedded variant, show the initial booking form
  if (variant === 'embedded') {
    const { formatPrice, selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, ratesLoading } = useCurrency();
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
      setHasMounted(true);
    }, []);

    const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency || 'EUR');
    
    // Convert the property's advertised price to the selected display currency
    const displayPriceAmount = property.advertisedRate !== null && 
                             property.advertisedRate !== undefined && 
                             !ratesLoading && 
                             hasMounted
      ? convertToSelectedCurrency(property.advertisedRate, propertyBaseCcy)
      : property.advertisedRate; // Fallback to base price if not mounted or rates loading

    const currencyToDisplay = !hasMounted || ratesLoading ? propertyBaseCcy : selectedCurrency;

    // Force integer rounding and debug
    const roundedPrice = displayPriceAmount !== null && displayPriceAmount !== undefined 
      ? Math.round(displayPriceAmount) 
      : null;
    
    console.log('[Price Debug] Original:', displayPriceAmount, 'Rounded:', roundedPrice, 'Currency:', currencyToDisplay);
    
    const formattedDisplayPrice = roundedPrice !== null
      ? formatPrice(roundedPrice, currencyToDisplay)
      : null;

    // Use property ratings if available
    const rating = property.ratings?.average;
    const reviewsCount = property.ratings?.count;

    // Base classes for the container
    const containerClasses = cn(
      // Base styling with backdrop effects
      'bg-background/80 backdrop-blur-sm rounded-xl w-full',
      // Enhanced shadow for better visual separation
      'shadow-xl ring-1 ring-black/5',
      // Animation/transition classes
      'transition-all duration-300 ease-in-out',
      // Padding - more for large size
      size === 'large' ? 'p-6 md:p-8' : 'p-4 md:p-6',
      // Default position 
      'mx-auto',
      // Add any additional classes passed as props
      className
    );

    return (
      <div 
        className={containerClasses}
        data-position={position}
        data-size={size}
      >
        {/* Inject CSS for consistent layout regardless of theme */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Theme-agnostic responsive styling */
          [data-position="${position}"][data-size="${size}"] {
            box-sizing: border-box !important;
          }
          
          /* Custom padding for booking form cards */
          .booking-form-card {
            /* No padding on card itself */
          }
          
          .booking-form-card > div:first-child,  /* CardHeader */
          .booking-form-card > div:last-child {   /* CardContent */
            padding: 1rem !important;
          }
          
          .booking-form-card > div:last-child {   /* CardContent after header */
            padding-top: 0 !important;
          }
          
          /* Embedded variant in hero section - reduce vertical padding */
          ${variant === 'embedded' ? `
            [data-position="${position}"][data-size="${size}"] {
              padding-top: 1rem !important;
              padding-bottom: 1rem !important;
            }
            
            @media (min-width: 768px) {
              [data-position="${position}"][data-size="${size}"] {
                padding-top: 1rem !important;
                padding-bottom: 1rem !important;
              }
            }
          ` : ''}
          
          /* Force horizontal layout for large size on all screens */
          ${size === 'large' ? `
            /* Mobile First - Stack vertically even for large with consistent alignment */
            .booking-form-flex-container {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 16px !important;
              width: 100% !important;
            }
            
            @media (min-width: 768px) {
              /* Tablet+ - Horizontal layout for large */
              .booking-form-flex-container {
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                align-items: flex-end !important;
                justify-content: flex-start !important;
                gap: 24px !important;
              }
            }`
          : `
            /* Mobile First - Stack vertically with consistent alignment */
            .booking-form-flex-container {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 12px !important;
              width: 100% !important;
            }
            
            @media (min-width: 768px) {
              /* Tablet+ - Horizontal layout */
              .booking-form-flex-container {
                flex-direction: row !important;
                flex-wrap: wrap !important;
                align-items: flex-end !important;
                justify-content: flex-start !important;
                gap: ${size === 'large' ? '8px' : '6px'} !important;
              }
            }
          `}
            
            /* Common styles for all layouts - Mobile First Unified Width */
            .booking-price-container {
              flex-shrink: 0 !important;
              width: 100% !important;
              max-width: 280px !important;
              margin: 0 auto !important;
              text-align: center !important;
            }
            
            @media (min-width: 768px) {
              .booking-price-container {
                width: auto !important;
                max-width: none !important;
                margin: 0 !important;
                margin-right: ${size === 'large' ? '20px' : '12px'} !important;
                text-align: left !important;
              }
            }
            
            /* Booking form container - Mobile First Unified Width */
            .booking-form-wrapper {
              width: 100% !important;
              max-width: 280px !important;
              margin: 0 auto !important;
              overflow: hidden !important;
            }
            
            @media (min-width: 768px) {
              .booking-form-wrapper {
                flex: 1 !important;
                min-width: 280px !important;
                max-width: none !important;
                margin: 0 !important;
              }
            }
            
            /* InitialBookingForm container - Mobile First with Center Alignment */
            .InitialBookingForm {
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              gap: 16px !important;
              width: 100% !important;
              max-width: 100% !important;
              overflow: hidden !important;
              box-sizing: border-box !important;
            }
            
            /* Tablet and up - Horizontal layout */
            @media (min-width: 768px) {
              .InitialBookingForm {
                flex-direction: row !important;
                align-items: flex-end !important;
                gap: ${size === 'large' ? '8px' : '6px'} !important;
              }
            }
            
            /* Form elements - Mobile First Unified Width */
            .InitialBookingForm > div:first-child,
            .InitialBookingForm > div:last-child {
              width: 100% !important;
              max-width: 280px !important;
              margin: 0 auto !important;
            }
            
            /* Mobile-specific content alignment overrides */
            @media (max-width: 767px) {
              .booking-price-container * {
                text-align: center !important;
              }
              
              /* Force both date picker and button containers to exact same width */
              .InitialBookingForm > div:first-child,
              .InitialBookingForm > div:last-child {
                width: 280px !important;
                max-width: 280px !important;
              }
              
              /* TouchTarget and Button width enforcement for date picker */
              .InitialBookingForm > div:first-child > div,
              .InitialBookingForm > div:first-child > div > button,
              #date {
                width: 280px !important;
                max-width: 280px !important;
                justify-content: center !important;
                text-align: center !important;
              }
              
              /* TouchTarget and Button width enforcement for green button */
              .InitialBookingForm > div:last-child > div,
              .InitialBookingForm > div:last-child > div > button,
              #check-availability-btn {
                width: 280px !important;
                max-width: 280px !important;
              }
              
              #date span {
                text-align: center !important;
              }
            }
            
            /* Tablet and up - Horizontal layout adjustments */
            @media (min-width: 768px) {
              .InitialBookingForm > div:first-child,
              .InitialBookingForm > div:last-child {
                flex: 1 !important;
                width: 50% !important;
                max-width: 50% !important;
                min-width: 0 !important;
                margin: 0 !important;
              }
            }
            
            /* Ensure button stays within container */
            #check-availability-btn {
              width: 100% !important;
              padding-left: ${size === 'large' ? '24px' : '12px'} !important;
              padding-right: ${size === 'large' ? '24px' : '12px'} !important;
              font-size: ${size === 'large' ? '13px' : '11px'} !important;
              height: ${size === 'large' ? '44px' : '38px'} !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
            }
            
            /* Force date picker wrapper elements to full width */
            .InitialBookingForm > div:first-child > div,
            .InitialBookingForm > div:first-child > div > *,
            .InitialBookingForm > div:last-child > div,
            .InitialBookingForm > div:last-child > div > * {
              width: 100% !important;
            }
            
            /* Force both buttons to identical styling */
            #date,
            #check-availability-btn {
              width: 100% !important;
              height: ${size === 'large' ? '44px' : '38px'} !important;
              padding-left: 16px !important;
              padding-right: 16px !important;
              border-width: 1px !important;
              box-sizing: border-box !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              font-size: ${size === 'large' ? '14px' : '13px'} !important;
            }
            
            #date {
              border-color: hsl(var(--border)) !important;
              background-color: hsl(var(--background)) !important;
            }
            
            #check-availability-btn {
              border-color: transparent !important;
              background-color: hsl(var(--primary)) !important;
              color: hsl(var(--primary-foreground)) !important;
            }
          }
          
          /* Larger screens get slightly more size */
          @media (min-width: 1024px) {
            .booking-form-flex-container {
              gap: 20px !important;
            }
            
            .booking-price-container {
              margin-right: 16px !important;
            }
            
            .InitialBookingForm {
              gap: 20px !important;
            }
            
            .InitialBookingForm > div:first-child,
            .InitialBookingForm > div:last-child {
              flex: 1 !important;
              width: 50% !important;
              max-width: 50% !important;
              min-width: 0 !important;
            }
            
            #date {
              padding-left: 20px !important;
              padding-right: 20px !important;
            }
            
            #check-availability-btn {
              font-size: 12px !important;
              padding-left: 20px !important;
              padding-right: 20px !important;
            }
          }
          
          /* Very large screens */
          @media (min-width: 1280px) {
            .InitialBookingForm > div:first-child,
            .InitialBookingForm > div:last-child {
              flex: 1 !important;
              width: 50% !important;
              max-width: 50% !important;
              min-width: 0 !important;
            }
            
            #check-availability-btn {
              font-size: 13px !important;
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
          }
        `}} />

        {/* Flex container for price and form */}
        <div className="booking-form-flex-container w-full">
          {/* Price Section */}
          <div className="booking-price-container">
            <div className="flex flex-col items-center justify-end">
              {/* Desktop: FROM on separate line */}
              <p className={cn(
                "text-muted-foreground uppercase tracking-wider mb-1 hidden md:block",
                size === 'large' ? "text-sm" : "text-xs"
              )}>
                {typeof property.advertisedRateType === 'object' 
                  ? tc(property.advertisedRateType) 
                  : t('common.from')}
              </p>
              
              {/* Mobile: FROM → price with visual balance */}
              <div className={cn(
                "flex items-center justify-between w-full md:hidden px-2",
                size === 'large' ? "text-xl" : "text-lg"
              )}>
                <span className="text-muted-foreground uppercase tracking-wider font-normal text-sm opacity-70">
                  {typeof property.advertisedRateType === 'object' 
                    ? tc(property.advertisedRateType) 
                    : t('common.from')}
                </span>
                <span className="text-muted-foreground mx-2">→</span>
                <div className="font-bold text-foreground leading-none">
                  {hasMounted && formattedDisplayPrice !== null 
                    ? formattedDisplayPrice 
                    : (property.advertisedRate ? formatPrice(Math.round(property.advertisedRate), propertyBaseCcy) : "Loading price...")}
                  <span className={cn(
                    "font-normal text-muted-foreground ml-1",
                    size === 'large' ? "text-base" : "text-sm"
                  )}>/{t('common.night')}</span>
                </div>
              </div>
              
              {/* Desktop: price on separate line */}
              <p className={cn(
                "font-bold text-foreground leading-none hidden md:block",
                size === 'large' ? "text-3xl md:text-4xl" : "text-2xl md:text-2xl lg:text-3xl"
              )}>
                {hasMounted && formattedDisplayPrice !== null 
                  ? formattedDisplayPrice 
                  : (property.advertisedRate ? formatPrice(Math.round(property.advertisedRate), propertyBaseCcy) : "Loading price...")}
                <span className={cn(
                  "font-normal text-muted-foreground ml-1",
                  size === 'large' ? "text-base" : "text-sm"
                )}>/{t('common.night')}</span>
              </p>
            </div>
          </div>
          
          {/* Booking Form */}
          <div className="booking-form-wrapper max-w-full overflow-hidden">
            <InitialBookingForm 
              property={property} 
              size={size as 'compressed' | 'large'} 
            />
          </div>
          
          {/* Ratings shown only if needed */}
          {showRating && rating && reviewsCount && (
            <div className="booking-rating-container flex items-center gap-1 text-foreground self-end ml-4">
              <Star className="h-5 w-5 text-primary fill-primary" />
              <span className="font-semibold">{rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({reviewsCount} reviews)</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // For standalone variant, use the AvailabilityContainer
  return (
    <AvailabilityContainer
      property={property}
      initialCheckIn={initialCheckIn?.toISOString()}
      initialCheckOut={initialCheckOut?.toISOString()}
      className={className}
    />
  );
}

/**
 * Main booking container component
 * Handles URL parameters and provides the booking context
 */
export const BookingContainer = React.memo(function BookingContainer({ 
  property, 
  position = 'bottom',
  size = 'compressed',
  showRating = false,
  variant = 'standalone',
  className
}: BookingContainerProps) {
  const searchParams = useSearchParams();

  // BUG #3 FIX: Parse URL parameters only once on mount, not on every render
  // This prevents URL dates from overriding user's manual date selections
  const [urlParsedData] = useState(() => {
    console.log(`[BookingContainer] 🔧 PARSING URL PARAMETERS (one-time only)`);
    
    // Parse date parameters from URL
    const checkInParam = searchParams?.get('checkIn');
    const checkOutParam = searchParams?.get('checkOut');
    const guestsParam = searchParams?.get('guests');

    // Validate and parse check-in date
    let initialCheckIn: Date | undefined;
    if (checkInParam) {
      // CRITICAL FIX: Use same normalization as URL parsing to prevent timezone day-shift
      if (checkInParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = checkInParam.split('-').map(Number);
        const normalized = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        console.log(`[BookingContainer] 🔧 Normalized checkIn: ${checkInParam} → ${normalized.toISOString()}`);
        initialCheckIn = normalized;
      } else {
        const parsedDate = parseISO(checkInParam);
        if (isValid(parsedDate)) {
          const normalized = new Date(parsedDate);
          normalized.setUTCHours(12, 0, 0, 0);
          initialCheckIn = normalized;
        }
      }
    }

    // Validate and parse check-out date
    let initialCheckOut: Date | undefined;
    if (checkOutParam) {
      // CRITICAL FIX: Use same normalization as URL parsing to prevent timezone day-shift
      if (checkOutParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = checkOutParam.split('-').map(Number);
        const normalized = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        console.log(`[BookingContainer] 🔧 Normalized checkOut: ${checkOutParam} → ${normalized.toISOString()}`);
        initialCheckOut = normalized;
      } else {
        const parsedDate = parseISO(checkOutParam);
        if (isValid(parsedDate)) {
          const normalized = new Date(parsedDate);
          normalized.setUTCHours(12, 0, 0, 0);
          initialCheckOut = normalized;
        }
      }
    }

    // Parse guests param
    const initialGuests = guestsParam ? parseInt(guestsParam, 10) : undefined;
    
    return { initialCheckIn, initialCheckOut, initialGuests };
  });

  // Extract the parsed values
  const { initialCheckIn, initialCheckOut, initialGuests } = urlParsedData;

  // Calculate nights if both dates are valid


  // Conditional wrapper to prevent nested BookingProviders
  const ConditionalBookingProvider = ({ children }: { children: React.ReactNode }) => {
    try {
      // Try to access existing BookingContext
      useBooking();
      console.log(`[BookingContainer] ✅ Using existing BookingProvider for property: ${property.slug}`);
      return <>{children}</>;
    } catch {
      // No provider exists, create one
      console.log(`[BookingContainer] 🆕 Creating new BookingProvider for property: ${property.slug}`);
      return (
        <BookingProvider propertySlug={property.slug}>
          {children}
        </BookingProvider>
      );
    }
  };

  return (
    <ConditionalBookingProvider>
      <div className={cn("w-full", className)}>
        <BookingInitializer
          property={property}
          initialCheckIn={initialCheckIn}
          initialCheckOut={initialCheckOut}
          initialGuests={initialGuests}
          position={position}
          size={size}
          showRating={showRating}
          variant={variant}
          className={className}
        />
      </div>
    </ConditionalBookingProvider>
  );
});