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
    setNumberOfNights
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

    // Set check-in date
    if (initialCheckIn) {
      setCheckInDate(initialCheckIn);
    }

    // Set check-out date
    if (initialCheckOut) {
      setCheckOutDate(initialCheckOut);
    }

    // Set number of guests
    if (initialGuests) {
      setNumberOfGuests(initialGuests);
    }

    // Calculate nights if both dates are provided
    if (initialCheckIn && initialCheckOut) {
      const nights = differenceInDays(initialCheckOut, initialCheckIn);
      if (nights > 0) {
        setNumberOfNights(nights);
      } else {
      }
    } else {
    }

  }, []); // Empty dependency array = only run once

  // Import useLanguage hook for multilingual support (needs to be called unconditionally)
  const { tc } = useLanguage();
  
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

    const formattedDisplayPrice = displayPriceAmount !== null && displayPriceAmount !== undefined
      ? formatPrice(displayPriceAmount, currencyToDisplay)
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
            /* Main content container */
            .booking-form-flex-container {
              display: flex !important;
              flex-direction: row !important;
              flex-wrap: nowrap !important;
              align-items: flex-end !important;
              gap: 20px !important;
              width: 100% !important;
            }`
          : `
            @media (min-width: 768px) {
              /* Main content container */
              .booking-form-flex-container {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                align-items: flex-end !important;
                gap: 12px !important;
                width: 100% !important;
              }
            }
          `}
            
            /* Common styles for all layouts */
            .booking-price-container {
              flex-shrink: 0 !important;
              margin-right: ${size === 'large' ? '16px' : '8px'} !important;
            }
            
            /* Booking form container */
            .booking-form-wrapper {
              flex: 1 !important;
              min-width: ${size === 'large' ? '400px' : '200px'} !important;
              overflow: visible !important;
            }
            
            /* InitialBookingForm container */
            .InitialBookingForm {
              display: flex !important;
              flex-direction: row !important;
              align-items: flex-end !important;
              gap: ${size === 'large' ? '16px' : '10px'} !important;
              width: 100% !important;
            }
            
            /* Date picker container */
            .InitialBookingForm > div:first-child {
              flex: 1 !important;
              min-width: 210px !important;
              max-width: calc(100% - 130px) !important;
              width: auto !important;
            }
            
            /* Button container */
            .InitialBookingForm > div:last-child {
              flex-shrink: 0 !important;
              width: auto !important;
              min-width: ${size === 'large' ? '140px' : '110px'} !important;
            }
            
            /* Ensure button stays within container */
            #check-availability-btn {
              width: 100% !important;
              padding-left: ${size === 'large' ? '16px' : '8px'} !important;
              padding-right: ${size === 'large' ? '16px' : '8px'} !important;
              font-size: ${size === 'large' ? '14px' : '11px'} !important;
              height: ${size === 'large' ? '44px' : '38px'} !important; /* Match date picker height */
              white-space: nowrap !important;
            }
            
            /* Date button - make it keep consistent width */
            #date {
              width: 100% !important;
              transition: none !important;
              height: ${size === 'large' ? '44px' : '38px'} !important;
              font-size: ${size === 'large' ? '14px' : '13px'} !important;
            }
          }
          
          /* Larger screens get slightly more size */
          @media (min-width: 1024px) {
            .booking-form-flex-container {
              gap: 16px !important;
            }
            
            .booking-price-container {
              margin-right: 12px !important;
            }
            
            .InitialBookingForm {
              gap: 16px !important;
            }
            
            .InitialBookingForm > div:last-child {
              min-width: 120px !important;
            }
            
            #check-availability-btn {
              font-size: 12px !important;
              padding-left: 10px !important;
              padding-right: 10px !important;
            }
          }
          
          /* Very large screens */
          @media (min-width: 1280px) {
            .InitialBookingForm > div:last-child {
              min-width: 130px !important;
            }
            
            #check-availability-btn {
              font-size: 13px !important;
              padding-left: 12px !important;
              padding-right: 12px !important;
            }
          }
        `}} />

        {/* Flex container for price and form */}
        <div className="booking-form-flex-container flex flex-col items-start md:w-full">
          {/* Price Section */}
          <div className="booking-price-container mb-4 md:mb-0 md:mr-3 lg:mr-6 md:flex-shrink-0 self-end">
            <div className="flex flex-col items-start justify-end">
              <p className={cn(
                "text-muted-foreground uppercase tracking-wider mb-1",
                size === 'large' ? "text-sm" : "text-xs"
              )}>
                {typeof property.advertisedRateType === 'string' 
                  ? property.advertisedRateType 
                  : (tc(property.advertisedRateType) || "from")}
              </p>
              <p className={cn(
                "font-bold text-foreground leading-none",
                size === 'large' ? "text-3xl md:text-4xl" : "text-2xl md:text-2xl lg:text-3xl"
              )}>
                {hasMounted && formattedDisplayPrice !== null 
                  ? formattedDisplayPrice 
                  : (property.baseRate ? formatPrice(property.baseRate, propertyBaseCcy) : "Loading price...")}
                <span className={cn(
                  "font-normal text-muted-foreground ml-1",
                  size === 'large' ? "text-base" : "text-sm"
                )}>/night</span>
              </p>
            </div>
          </div>
          
          {/* Booking Form */}
          <div className="booking-form-wrapper flex-1 self-end max-w-full md:max-w-[calc(100%-3rem)]">
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