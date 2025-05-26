"use client";

// ACTIVE: This is the currently active component used by AvailabilityContainer.
// DO NOT ARCHIVE THIS FILE - it is needed for the booking flow to work properly.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { Check, Loader2, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/contexts/BookingContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
// Removed API imports - this component now only reads from BookingContext
// import { checkAvailability, getUnavailableDatesForProperty } from '@/services/availabilityService';
import { GuestSelector } from '../common/GuestSelector';
import { SimpleDateSelector } from './SimpleDateSelector';

interface EnhancedAvailabilityCheckerProps {
  propertySlug: string;
  propertyName: string;
  maxGuests: number;
  onAvailabilityResult?: (isAvailable: boolean | null) => void;
}

/**
 * EnhancedAvailabilityChecker component
 * 
 * Uses BookingContext for state management but with improved date selection
 * PERFORMANCE FIX Bug #2: Added React.memo to prevent unnecessary re-renders
 */
export const EnhancedAvailabilityChecker = React.memo(function EnhancedAvailabilityChecker({
  propertySlug,
  propertyName,
  maxGuests,
  onAvailabilityResult
}: EnhancedAvailabilityCheckerProps) {
  // Get language support for translations
  const { t } = useLanguage();
  
  // Get values from booking context - now includes availability data
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests,
    // Centralized availability state
    unavailableDates,
    isAvailabilityLoading,
    availabilityError,
    isAvailable,
    // Centralized pricing state - added for debug display
    pricingDetails,
    isPricingLoading,
    // Separated fetch functions - using new architecture
    fetchAvailability,
    fetchPricing: fetchPricingWithDates
  } = useBooking();

  // Local UI state - SIMPLIFIED since availability comes from context
  const [wasChecked, setWasChecked] = useState(false);
  
  // Dependencies
  const { toast } = useToast();
  
  // Component mount effect - just log that we're ready, BookingContext handles fetching
  useEffect(() => {
    console.log("🔍 [EnhancedAvailabilityChecker] PURE UI COMPONENT - Mounted (fetching handled by BookingContext)");
  }, [propertySlug]);
  
  // Debug: Log when unavailable dates change
  useEffect(() => {
    console.log("📅 [EnhancedAvailabilityChecker] Unavailable dates state:", {
      isArray: Array.isArray(unavailableDates),
      count: unavailableDates?.length || 0,
      dates: unavailableDates,
      firstDate: unavailableDates && unavailableDates.length > 0 ? unavailableDates[0] : null,
      firstDateISO: unavailableDates && unavailableDates.length > 0 ? unavailableDates[0].toISOString() : null
    });
  }, [unavailableDates]);

  // Removed checkDatesAvailability function - availability checking now handled by BookingContext
  
  // Simplified availability monitoring - just notify parent when availability changes
  useEffect(() => {
    if (onAvailabilityResult && isAvailable !== null) {
      console.log(`[EnhancedAvailabilityChecker] 🔄 Notifying parent of availability result: ${isAvailable}`);
      onAvailabilityResult(isAvailable);
      setWasChecked(true);
    }
  }, [isAvailable, onAvailabilityResult]);

  // Handle check-in date changes
  const handleCheckInChange = useCallback((date: Date | null) => {
    console.log(`[EnhancedAvailabilityChecker] Check-in date changed to:`, date);

    // BUG #3 FIX: Remove double normalization - let BookingContext handle normalization
    // Pass raw date to context, BookingContext will normalize it properly
    setCheckInDate(date);

    // If the current checkout date is invalid with this new check-in date,
    // clear the checkout date
    if (date && checkOutDate && date >= checkOutDate) {
      setCheckOutDate(null);
    }

    // Reset availability state - auto-fetch will trigger from BookingContext
    setWasChecked(false);
  }, [checkOutDate, setCheckInDate, setCheckOutDate]);

  // Handle check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`[EnhancedAvailabilityChecker] Check-out date changed to:`, date);

    // BUG #3 FIX: Remove double normalization - let BookingContext handle normalization
    // Pass raw date to context, BookingContext will normalize it properly
    setCheckOutDate(date);

    // Reset availability state - auto-fetch will trigger from BookingContext
    setWasChecked(false);
  }, [setCheckOutDate]);

  // Guest count changes are now handled directly by GuestSelector via BookingContext
  // No need for manual handlers here since GuestSelector manages its own state

  // Check Price button handler
  const handleCheckPrice = useCallback(() => {
    if (checkInDate && checkOutDate && numberOfGuests > 0) {
      console.log(`[EnhancedAvailabilityChecker] 💰 User clicked Check Price: ${checkInDate.toISOString()} to ${checkOutDate.toISOString()}, ${numberOfGuests} guests`);
      fetchPricingWithDates(checkInDate, checkOutDate, numberOfGuests);
      setWasChecked(false); // Reset to show fresh result
    }
  }, [checkInDate, checkOutDate, numberOfGuests, fetchPricingWithDates]);

  // Create a derived value for min checkout date (always day after check-in)
  const minCheckoutDate = checkInDate ? addDays(checkInDate, 1) : new Date();

  // Show loading state while fetching data from context
  if (isAvailabilityLoading) {
    return (
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-md flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <p className="text-blue-700">Loading availability data... (v2.0 - Pure UI)</p>
      </div>
    );
  }


  return (
    <div className="p-4 border border-blue-200 bg-blue-50 rounded-md">
      {/* Status messages - only show problems */}
      {wasChecked && !isAvailable ? (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-3">
          <p className="text-xs text-red-700">
            <span className="text-red-600 font-medium">✗</span> Selected dates are not available.
          </p>
        </div>
      ) : !wasChecked && unavailableDates.length > 0 ? (
        <div className="mb-3">
          <p className="text-xs text-amber-700">
            <span className="text-amber-600">•</span> Some dates may be unavailable (marked with strikethrough).
          </p>
          {/* Debug info for development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
              <p className="font-semibold">Debug: {unavailableDates.length} unavailable dates loaded</p>
              <p className="text-gray-600">First 3 dates:</p>
              <ul className="ml-4">
                {unavailableDates.slice(0, 3).map((date, idx) => (
                  <li key={idx} className="font-mono">
                    {date.toDateString()} (UTC: {date.getUTCHours()}h)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Responsive grid container for all three form elements */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* Check-in date selector */}
        <SimpleDateSelector 
          date={checkInDate}
          onChange={handleCheckInChange}
          label="Check-in Date"
          placeholder="Select check-in date"
          disabled={isAvailabilityLoading}
          unavailableDates={unavailableDates}
          className="h-full"
        />

        {/* Check-out date selector */}
        <SimpleDateSelector 
          date={checkOutDate}
          onChange={handleCheckOutChange}
          label="Check-out Date"
          placeholder="Select check-out date"
          disabled={isAvailabilityLoading}
          minDate={minCheckoutDate}
          unavailableDates={unavailableDates}
          className="h-full"
        />
        
        {/* Guest Count Selector */}
        <div className="translate-y-[4px]">
          <GuestSelector
            maxGuests={maxGuests}
            disabled={isAvailabilityLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* Check Price Button - Always Visible for User Control */}
      <div className="mt-4 flex justify-center">
        <Button 
          onClick={handleCheckPrice}
          disabled={isPricingLoading || !checkInDate || !checkOutDate || isAvailabilityLoading}
          className="px-6 py-2"
          size="default"
          variant="default"
        >
          {isPricingLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t('booking.calculating') || 'Calculating...'}
            </>
          ) : (
            t('booking.checkPrice') || 'Check Price'
          )}
        </Button>
      </div>


      {/* Only show a warning if dates are not available */}
      {wasChecked && isAvailable === false && (
        <div className="mt-4 bg-red-100 p-3 rounded shadow-sm flex items-center">
          <X className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">These dates are not available.</p>
        </div>
      )}

      {/* Error message from centralized state */}
      {availabilityError && (
        <div className="mt-4 p-3 rounded bg-amber-50 border border-amber-200">
          <p className="text-amber-800">{availabilityError}</p>
        </div>
      )}

    </div>
  );
});