"use client";

// DEPRECATED: This component is now deprecated and should be archived.
// Please use the RefactoredAvailabilityCheck component in /components/booking/container/
// instead, which includes better error handling and support for pricing calendar.
// This file will be moved to /src/archive in a future cleanup.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, format, startOfDay } from 'date-fns';
import { Check, Loader2, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/contexts/BookingContext';
import { useToast } from '@/hooks/use-toast';
import { checkAvailability, getUnavailableDatesForProperty } from '@/services/availabilityService';
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
 */
export function EnhancedAvailabilityChecker({
  propertySlug,
  propertyName,
  maxGuests,
  onAvailabilityResult
}: EnhancedAvailabilityCheckerProps) {
  // Get values from booking context
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    setCheckInDate,
    setCheckOutDate,
    setNumberOfGuests
  } = useBooking();

  // Local UI state
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [wasChecked, setWasChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  
  // Dependencies
  const { toast } = useToast();
  
  // Track local state of dates and guest count to prevent context sync issues
  const [localCheckInDate, setLocalCheckInDate] = useState<Date | null>(checkInDate);
  const [localCheckOutDate, setLocalCheckOutDate] = useState<Date | null>(checkOutDate);
  const [localGuestCount, setLocalGuestCount] = useState<number>(numberOfGuests);
  
  // Immediately load unavailable dates when the component mounts
  useEffect(() => {
    const loadUnavailableDates = async () => {
      setIsLoadingInitialData(true);
      console.log("==========================================");
      console.log("🔍 [EnhancedAvailabilityChecker] Loading unavailable dates on mount");
      console.log("==========================================");
      
      try {
        const dates = await getUnavailableDatesForProperty(propertySlug);
        console.log(`[EnhancedAvailabilityChecker] Loaded ${dates.length} unavailable dates for property ${propertySlug}`);
        
        if (dates.length > 0) {
          // Log a few example dates
          const sampleDates = dates.slice(0, 3);
          console.log(`[EnhancedAvailabilityChecker] Sample unavailable dates:`, 
            sampleDates.map(d => d.toISOString())
          );
        }
        
        // Store the unavailable dates
        setUnavailableDates(dates);
      } catch (error) {
        console.error('[EnhancedAvailabilityChecker] Error loading unavailable dates:', error);
        toast({
          title: "Warning",
          description: "Could not load all unavailable dates. Availability information may be incomplete.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingInitialData(false);
      }
    };
    
    loadUnavailableDates();
  }, [propertySlug, toast]);
  
  // Sync from context to local state when component mounts or context changes
  useEffect(() => {
    setLocalCheckInDate(checkInDate);
    setLocalCheckOutDate(checkOutDate);
    setLocalGuestCount(numberOfGuests);
  }, [checkInDate, checkOutDate, numberOfGuests]);

  // This function checks if the selected dates are available
  // using the already loaded unavailable dates (no API call needed)
  const checkDatesAvailability = useCallback(() => {
    if (!localCheckInDate || !localCheckOutDate || unavailableDates.length === 0) {
      // Mark as checked even when we skip to prevent infinite loop attempts
      setWasChecked(true);
      return;
    }
    
    console.log(`[EnhancedAvailabilityChecker] Checking dates: ${localCheckInDate.toISOString()} to ${localCheckOutDate.toISOString()}`);
    setIsCheckingAvailability(true);
    setError(null);
    
    try {
      // Check if any selected date is in the unavailable dates list
      let current = new Date(localCheckInDate.getTime());
      let conflict = false;
      
      while (current < localCheckOutDate) {
        const currentDateStr = format(startOfDay(current), 'yyyy-MM-dd');
        const isUnavailable = unavailableDates.some(d => 
          format(startOfDay(d), 'yyyy-MM-dd') === currentDateStr
        );
        
        if (isUnavailable) {
          console.log(`[EnhancedAvailabilityChecker] Conflict on date: ${currentDateStr}`);
          conflict = true;
          break;
        }
        
        // Move to the next day
        current.setDate(current.getDate() + 1);
      }
      
      const available = !conflict;
      console.log(`[EnhancedAvailabilityChecker] Availability result: ${available ? 'Available' : 'Not Available'}`);
      
      // Update state and notify parent
      setIsAvailable(available);
      setWasChecked(true);
      
      if (onAvailabilityResult) {
        onAvailabilityResult(available);
      }
      
      // No toast notification needed
    } catch (error) {
      console.error('[EnhancedAvailabilityChecker] Error checking dates:', error);
      setError('Error checking availability. Please try again.');
      // Mark as checked even on error to prevent infinite loops
      setWasChecked(true);
      setIsAvailable(false);
      
      toast({
        title: "Error",
        description: "There was an error checking availability.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [localCheckInDate, localCheckOutDate, unavailableDates, toast, onAvailabilityResult]);
  
  // Keep track of auto-check attempts to prevent infinite loops
  const autoCheckAttemptsRef = useRef(0);
  const MAX_AUTO_CHECK_ATTEMPTS = 3;

  // Auto-check availability when data is loaded - with safety limits
  useEffect(() => {
    // Skip if we're already checking or if we're still loading data
    if (isCheckingAvailability || isLoadingInitialData) {
      return;
    }
    
    // Check if we have everything we need and haven't checked yet
    if (
      unavailableDates.length > 0 && 
      localCheckInDate && 
      localCheckOutDate && 
      !wasChecked &&
      autoCheckAttemptsRef.current < MAX_AUTO_CHECK_ATTEMPTS // Prevent infinite loops
    ) {
      console.log('==========================================');
      console.log(`🔄 [EnhancedAvailabilityChecker] Auto-checking availability (attempt ${autoCheckAttemptsRef.current + 1}/${MAX_AUTO_CHECK_ATTEMPTS})`);
      console.log('==========================================');
      
      // Increment attempt counter
      autoCheckAttemptsRef.current++;
      
      // Small delay to ensure state updates are complete
      const timerId = setTimeout(checkDatesAvailability, 100);
      return () => clearTimeout(timerId);
    }
  }, [
    unavailableDates.length, 
    localCheckInDate, 
    localCheckOutDate, 
    wasChecked, 
    isCheckingAvailability, 
    isLoadingInitialData,
    checkDatesAvailability
  ]);

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

    // Reset availability state
    setWasChecked(false);
    setIsAvailable(null);
    setError(null);
  }, [localCheckOutDate, setCheckInDate, setCheckOutDate]);

  // Handle check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`[EnhancedAvailabilityChecker] Check-out date changed to:`, date);

    // Update both local state and context
    setLocalCheckOutDate(date);
    setCheckOutDate(date);

    // Reset availability state
    setWasChecked(false);
    setIsAvailable(null);
    setError(null);
  }, [setCheckOutDate]);

  // Handle guest count changes
  const handleGuestCountChange = useCallback((count: number) => {
    console.log(`[EnhancedAvailabilityChecker] 🧑‍🤝‍🧑 Guest count changed to: ${count}`);

    // Update local state immediately for UI responsiveness
    setLocalGuestCount(count);

    // Update context state with the new value
    setNumberOfGuests(count);

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
  }, [setNumberOfGuests, localCheckInDate, localCheckOutDate, numberOfNights]);

  // Create a derived value for min checkout date (always day after check-in)
  const minCheckoutDate = localCheckInDate ? addDays(localCheckInDate, 1) : new Date();

  // Show loading state while fetching initial data
  if (isLoadingInitialData) {
    return (
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-md flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <p className="text-blue-700">Loading availability data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-blue-200 bg-blue-50 rounded-md">
      <h3 className="font-medium text-blue-800">Availability Checker</h3>
      <p className="text-sm text-blue-700 mb-2">
        Select your dates and check availability.
      </p>
      
      {unavailableDates.length > 0 && (
        <p className="text-xs text-amber-700 mb-3">
          <span className="text-amber-600">•</span> {unavailableDates.length} unavailable dates loaded. Dates that are not available are marked with strikethrough.
        </p>
      )}

      <div className="flex items-center space-x-2 bg-white p-3 rounded shadow-sm">
        <Calendar className="h-4 w-4 text-blue-600" />
        <p>Property: {propertyName}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date selector fields with unavailable dates */}
        <SimpleDateSelector 
          date={localCheckInDate}
          onChange={handleCheckInChange}
          label="Check-in Date"
          placeholder="Select check-in date"
          disabled={isCheckingAvailability}
          unavailableDates={unavailableDates}
        />

        <SimpleDateSelector 
          date={localCheckOutDate}
          onChange={handleCheckOutChange}
          label="Check-out Date"
          placeholder="Select check-out date"
          disabled={isCheckingAvailability}
          minDate={minCheckoutDate}
          unavailableDates={unavailableDates}
        />
      </div>

      {/* Show nights count when both dates are selected */}
      {checkInDate && checkOutDate && numberOfNights > 0 && (
        <p className="text-sm text-blue-800 mt-2">
          Total stay: {numberOfNights} {numberOfNights === 1 ? 'night' : 'nights'}
        </p>
      )}

      {/* Guest Count Selector */}
      <div className="mt-4">
        <GuestSelector
          value={localGuestCount}
          onChange={handleGuestCountChange}
          maxGuests={maxGuests}
          disabled={isCheckingAvailability}
        />
      </div>

      {/* Only show a warning if dates are not available */}
      {wasChecked && isAvailable === false && (
        <div className="mt-4 bg-red-100 p-3 rounded shadow-sm flex items-center">
          <X className="h-4 w-4 text-red-600 mr-2" />
          <p className="text-sm text-red-800">These dates are not available.</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 rounded bg-amber-50 border border-amber-200">
          <p className="text-amber-800">{error}</p>
        </div>
      )}

    </div>
  );
}