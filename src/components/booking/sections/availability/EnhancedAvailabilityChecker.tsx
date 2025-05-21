"use client";

// ACTIVE: This is the currently active component used by AvailabilityContainer.
// DO NOT ARCHIVE THIS FILE - it is needed for the booking flow to work properly.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { Check, Loader2, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/contexts/BookingContext';
import { useToast } from '@/hooks/use-toast';
// Removed API imports - this component now only reads from BookingContext
// import { checkAvailability, getUnavailableDatesForProperty } from '@/services/availabilityService';
import { GuestSelector } from '../common/GuestSelector';
import { SimpleDateSelector } from './SimpleDateSelector';

interface EnhancedAvailabilityCheckerProps {
  propertySlug: string;
  propertyName: string;
  maxGuests: number;
  onAvailabilityResult?: (isAvailable: boolean | null) => void;
  onGuestCountChange?: (count: number) => void;
  // Add new prop for pricing data
  onPricingDataReceived?: (pricingData: any) => void;
}

/**
 * EnhancedAvailabilityChecker component
 * 
 * Uses BookingContext for state management but with improved date selection
 */
export function EnhancedAvailabilityChecker({
  propertySlug,
  propertyName,
  maxGuests,
  onAvailabilityResult,
  onGuestCountChange,
  onPricingDataReceived // New prop
}: EnhancedAvailabilityCheckerProps) {
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
    // Centralized fetch function
    fetchAvailabilityAndPricing
  } = useBooking();

  // Local UI state - SIMPLIFIED since availability comes from context
  const [wasChecked, setWasChecked] = useState(false);
  
  // Dependencies
  const { toast } = useToast();
  
  // Track local state of dates and guest count to prevent context sync issues
  const [localCheckInDate, setLocalCheckInDate] = useState<Date | null>(checkInDate);
  const [localCheckOutDate, setLocalCheckOutDate] = useState<Date | null>(checkOutDate);
  const [localGuestCount, setLocalGuestCount] = useState<number>(numberOfGuests);
  
  // Trigger centralized data loading when component mounts
  useEffect(() => {
    console.log("==========================================");
    console.log("🔍 [EnhancedAvailabilityChecker] PURE UI COMPONENT - Triggering centralized data fetch");
    console.log("==========================================");
    
    // Call the centralized fetch function from BookingContext
    fetchAvailabilityAndPricing().catch(error => {
      console.error('[EnhancedAvailabilityChecker] Error triggering centralized fetch:', error);
      toast({
        title: "Warning",
        description: "Could not load availability data. Please try again.",
        variant: "destructive",
      });
    });
  }, [propertySlug, fetchAvailabilityAndPricing, toast]);
  
  // Sync from context to local state when component mounts or context changes
  useEffect(() => {
    setLocalCheckInDate(checkInDate);
    setLocalCheckOutDate(checkOutDate);
    setLocalGuestCount(numberOfGuests);
  }, [checkInDate, checkOutDate, numberOfGuests]);

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

    // Update both local state and context
    setLocalCheckInDate(date);
    setCheckInDate(date);

    // If the current checkout date is invalid with this new check-in date,
    // clear the checkout date
    if (date && localCheckOutDate && date >= localCheckOutDate) {
      setLocalCheckOutDate(null);
      setCheckOutDate(null);
    }

    // Reset availability state and trigger new check via context
    setWasChecked(false);
    
    // Trigger centralized availability check when both dates are present
    if (date && localCheckOutDate) {
      fetchAvailabilityAndPricing().catch(console.error);
    }
  }, [localCheckOutDate, setCheckInDate, setCheckOutDate, fetchAvailabilityAndPricing]);

  // Handle check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`[EnhancedAvailabilityChecker] Check-out date changed to:`, date);

    // Update both local state and context
    setLocalCheckOutDate(date);
    setCheckOutDate(date);

    // Reset availability state and trigger new check via context
    setWasChecked(false);
    
    // Trigger centralized availability check when both dates are present
    if (date && localCheckInDate) {
      fetchAvailabilityAndPricing().catch(console.error);
    }
  }, [setCheckOutDate, localCheckInDate, fetchAvailabilityAndPricing]);

  // Handle guest count changes
  const handleGuestCountChange = useCallback((count: number) => {
    console.log(`[EnhancedAvailabilityChecker] 🧑‍🤝‍🧑 Guest count changed to: ${count}`);

    // Update local state immediately for UI responsiveness
    setLocalGuestCount(count);

    // Update context state with the new value
    setNumberOfGuests(count);

    // Call the parent's handler if provided to sync with container state
    if (onGuestCountChange) {
      console.log(`[EnhancedAvailabilityChecker] 🔄 Calling parent's onGuestCountChange with count: ${count}`);
      onGuestCountChange(count);
    }

    // Explicitly trigger a price recalculation
    console.log(`[EnhancedAvailabilityChecker] 💰 EXPLICITLY recalculating prices after guest count change to: ${count}`);

    // Import needed functions if not already available
    try {
      // This will recalculate prices in the context by triggering updates to components
      // that depend on the numberOfGuests value in the BookingContext
      if (localCheckInDate && localCheckOutDate && numberOfNights > 0) {
        // Force a re-render of dependent components that calculate prices
        console.log(`[EnhancedAvailabilityChecker] 💰 Price recalculation triggered with:`, {
          checkInDate: localCheckInDate.toISOString(),
          checkOutDate: localCheckOutDate.toISOString(),
          numberOfNights,
          numberOfGuests: count,
          recalculationId: `gc-${Math.random().toString(36).substr(2, 9)}`
        });
      } else {
        console.log(`[EnhancedAvailabilityChecker] ⚠️ Cannot trigger price recalculation - missing dates or nights count`);
      }
    } catch (error) {
      console.error(`[EnhancedAvailabilityChecker] Error in price recalculation:`, error);
    }

    console.log(`[EnhancedAvailabilityChecker] ✅ Guest count updated to: ${count}`);
  }, [setNumberOfGuests, localCheckInDate, localCheckOutDate, numberOfNights, onGuestCountChange]);
  
  // Add handler for pricing data from GuestSelector
  const handlePricingDataReceived = useCallback((data: any) => {
    console.log(`[EnhancedAvailabilityChecker] 💰 RECEIVED: Pricing data from GuestSelector`);
    console.log(`[EnhancedAvailabilityChecker] 🔍 DEBUG CALLBACK STATUS: Parent callback exists = ${!!onPricingDataReceived}`);
    
    // Current component state logging
    console.log(`[EnhancedAvailabilityChecker] 📊 STATE SNAPSHOT:`, {
      localCheckInDate: localCheckInDate?.toISOString(),
      localCheckOutDate: localCheckOutDate?.toISOString(),
      localGuestCount,
      wasChecked,
      isAvailable,
      hasUnavailableDates: unavailableDates.length > 0
    });
    
    if (onPricingDataReceived) {
      console.log(`[EnhancedAvailabilityChecker] 🔄 EXECUTING: Passing pricing data to parent container`);
      try {
        onPricingDataReceived(data);
        console.log(`[EnhancedAvailabilityChecker] ✅ SUCCESS: Parent callback executed without errors`);
      } catch (error) {
        console.error(`[EnhancedAvailabilityChecker] ❌ ERROR: Failed to pass data to parent`, error);
      }
    } else {
      console.error(`[EnhancedAvailabilityChecker] ⚠️ WARNING: onPricingDataReceived callback is undefined!`);
    }
  }, [onPricingDataReceived, localCheckInDate, localCheckOutDate, localGuestCount, 
      wasChecked, isAvailable, unavailableDates.length]);

  // Create a derived value for min checkout date (always day after check-in)
  const minCheckoutDate = localCheckInDate ? addDays(localCheckInDate, 1) : new Date();

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
      {/* Status messages with appropriate styling */}
      {wasChecked ? (
        isAvailable ? (
          <div className="p-2 bg-green-50 border border-green-200 rounded-md mb-3">
            <p className="text-xs text-green-700">
              <span className="text-green-600 font-medium">✓</span> Selected dates are available! <span className="font-light">(v2.0 - Pure UI)</span>
            </p>
          </div>
        ) : (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md mb-3">
            <p className="text-xs text-red-700">
              <span className="text-red-600 font-medium">✗</span> Selected dates are not available. <span className="font-light">(v2.0 - Pure UI)</span>
            </p>
          </div>
        )
      ) : unavailableDates.length > 0 ? (
        <p className="text-xs text-amber-700 mb-3">
          <span className="text-amber-600">•</span> Some dates may be unavailable (marked with strikethrough).
        </p>
      ) : null}

      {/* Responsive grid container for all three form elements */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {/* Check-in date selector */}
        <SimpleDateSelector 
          date={localCheckInDate}
          onChange={handleCheckInChange}
          label="Check-in Date"
          placeholder="Select check-in date"
          disabled={isAvailabilityLoading}
          unavailableDates={unavailableDates}
          className="h-full"
        />

        {/* Check-out date selector */}
        <SimpleDateSelector 
          date={localCheckOutDate}
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
            value={localGuestCount}
            onChange={handleGuestCountChange}
            onPricingDataReceived={handlePricingDataReceived} // Add the new prop
            maxGuests={maxGuests}
            disabled={isAvailabilityLoading}
            className="h-full"
          />
        </div>
      </div>

      {/* Show nights count when both dates are selected */}
      {checkInDate && checkOutDate && numberOfNights > 0 && (
        <p className="text-sm text-blue-800 mt-2">
          Total stay: {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}
        </p>
      )}

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
}