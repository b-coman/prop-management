"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { getUnavailableDatesForProperty } from '@/services/availabilityService';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useDateCalculation } from './useDateCalculation';

/**
 * Hook to handle property availability checking
 * Only checks availability when explicitly called, never auto-checks
 */
export function useAvailabilityCheck(propertySlug: string) {
  const { toast } = useToast();
  const {
    checkInDate,
    checkOutDate,
  } = useBooking();

  // Local state for availability checking
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [suggestedDates, setSuggestedDates] = useState<Array<{ from: Date; to: Date; recommendation?: string }>>([]);

  // Get the night calculation utilities
  const { getNightCount } = useDateCalculation();

  // Tracking if component is mounted and preventing duplicate requests
  const isMounted = useRef(true);
  const isCheckingRef = useRef(false);

  // Check property availability - only when explicitly called
  const checkAvailability = useCallback(async () => {
    // Guard against multiple simultaneous checks and unmounted component
    if (isCheckingRef.current || !isMounted.current) {
      console.log("[useAvailabilityCheck] Check aborted - " +
        (isCheckingRef.current ? "check already in progress" : "component not mounted"));
      return;
    }

    // Set checking flag to prevent duplicate calls
    isCheckingRef.current = true;

    console.log("[useAvailabilityCheck] Starting availability check...", {
      propertySlug,
      from: checkInDate ? checkInDate.toISOString() : 'null',
      to: checkOutDate ? checkOutDate.toISOString() : 'null',
      numNights: getNightCount()
    });

    // Reset state
    try {
      setIsLoadingAvailability(true);
      setSuggestedDates([]);
      setIsAvailable(null);
    } catch (error) {
      console.error("[useAvailabilityCheck] Error resetting state:", error);
    }

    // Set a timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
      console.log("[useAvailabilityCheck] Check timed out after 10 seconds");
      if (isMounted.current) {
        setIsLoadingAvailability(false);
        setIsAvailable(null);
        isCheckingRef.current = false;
        toast({
          title: "Check Timed Out",
          description: "The availability check took too long. Please try again.",
          variant: "destructive",
        });
      }
    }, 10000); // 10-second timeout

    // Validate dates
    if (!checkInDate || !checkOutDate) {
      clearTimeout(timeoutId);
      setIsLoadingAvailability(false);
      isCheckingRef.current = false;
      console.log("[useAvailabilityCheck] Check aborted - no dates selected");
      return;
    }

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      clearTimeout(timeoutId);
      setIsLoadingAvailability(false);
      isCheckingRef.current = false;
      console.error("[useAvailabilityCheck] Check aborted - invalid date objects");
      toast({
        title: "Invalid Dates",
        description: "The selected dates are invalid. Please try selecting dates again.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log(`[useAvailabilityCheck] Fetching unavailable dates for ${propertySlug}...`);

      // Fetch actual unavailable dates from API
      console.log(`[useAvailabilityCheck] 🔍 Performing availability check against API for ${propertySlug}...`);

      // TEMPORARY HACK: For development testing, set available without checking
      if (process.env.NODE_ENV === 'development' && false) { // Set to true to force availability
        console.log("[useAvailabilityCheck] DEVELOPMENT MODE: Force setting available");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        setIsAvailable(true);
        setUnavailableDates([]);
      } else {
        // Real availability check
        const fetchedUnavailableDates = await getUnavailableDatesForProperty(propertySlug);
        console.log(`[useAvailabilityCheck] Received ${fetchedUnavailableDates.length} unavailable dates`);
        setUnavailableDates(fetchedUnavailableDates);

        let conflict = false;
        let current = new Date(checkInDate.getTime());
        console.log(`[useAvailabilityCheck] Checking from ${format(current, 'yyyy-MM-dd')} to ${format(checkOutDate, 'yyyy-MM-dd')}`);

        // Check for conflicts day by day
        while (isBefore(current, checkOutDate)) {
          const dateString = format(startOfDay(current), 'yyyy-MM-dd');
          if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
            conflict = true;
            console.log(`[useAvailabilityCheck] Conflict found on ${dateString}`);
            break;
          }
          current = addDays(current, 1);
        }

        console.log(`[useAvailabilityCheck] Check result: ${!conflict ? 'Available' : 'Not Available'}`);
        setIsAvailable(!conflict);

        // If not available, find alternative dates
        if (conflict) {
          const nightCount = getNightCount();
          if (nightCount > 0) {
            console.log("[useAvailabilityCheck] Finding alternative dates...");
            let suggestionFound = false;
            let suggestionStart = addDays(checkOutDate, 1);
            const maxSearchDate = addDays(checkOutDate, 60);

            while (isBefore(suggestionStart, maxSearchDate) && !suggestionFound) {
              const suggestionEnd = addDays(suggestionStart, nightCount);
              let suggestionConflict = false;
              let checkCurrent = new Date(suggestionStart.getTime());

              while (isBefore(checkCurrent, suggestionEnd)) {
                const checkDateString = format(startOfDay(checkCurrent), 'yyyy-MM-dd');
                if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === checkDateString)
                    || isBefore(checkCurrent, startOfDay(new Date()))) {
                  suggestionConflict = true;
                  break;
                }
                checkCurrent = addDays(checkCurrent, 1);
              }

              if (!suggestionConflict) {
                console.log(`[useAvailabilityCheck] Found alternative dates: ${format(suggestionStart, 'yyyy-MM-dd')} to ${format(suggestionEnd, 'yyyy-MM-dd')}`);
                setSuggestedDates([{ from: suggestionStart, to: suggestionEnd, recommendation: "Next Available" }]);
                suggestionFound = true;
              } else {
                suggestionStart = addDays(suggestionStart, 1);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[useAvailabilityCheck] Error:", error);
      toast({
        title: "Error Checking Availability",
        description: "Could not check property availability. Please try again.",
        variant: "destructive",
      });
      setIsAvailable(false);
    } finally {
      clearTimeout(timeoutId); // Clear the timeout on success or error
      setIsLoadingAvailability(false);
      isCheckingRef.current = false;
      console.log("[useAvailabilityCheck] Check finished");
    }
  }, [checkInDate, checkOutDate, getNightCount, propertySlug, toast]);

  // Reset availability state when dates change
  useEffect(() => {
    if (isMounted.current && (checkInDate || checkOutDate)) {
      console.log("[useAvailabilityCheck] Dates changed - resetting availability state");
      setIsAvailable(null);
      setSuggestedDates([]);
    }
  }, [checkInDate, checkOutDate]);

  // Initialize and clean up on mount/unmount
  useEffect(() => {
    console.log("[useAvailabilityCheck] Component mounted");
    isMounted.current = true;

    return () => {
      console.log("[useAvailabilityCheck] Component unmounted");
      isMounted.current = false;
    };
  }, []);

  return {
    isAvailable,
    isLoadingAvailability,
    unavailableDates,
    suggestedDates,
    checkAvailability,
    setIsAvailable, // Expose for development/testing
  };
}