"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Check, X, Calendar } from 'lucide-react';
import { useBooking } from '@/contexts/BookingContext';
import { Button } from '@/components/ui/button';
import { useDateCalculation } from '../hooks/useDateCalculation';
import { useToast } from '@/hooks/use-toast';
import { getUnavailableDatesForProperty } from '@/services/availabilityService';
import { format, isWithinInterval, isBefore, startOfDay } from 'date-fns';
import { CustomDateRangePicker } from '../CustomDateRangePicker';
import { useLanguage } from '@/hooks/useLanguage';
import type { Property } from '@/types';

interface RefactoredAvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
  onAvailabilityChecked?: (isAvailable: boolean) => void;
  preloadedUnavailableDates?: Date[];
}

// Refactored component with proper callback for availability results
export function RefactoredAvailabilityCheck({
  property,
  initialCheckIn,
  initialCheckOut,
  onAvailabilityChecked,
  preloadedUnavailableDates = [] // Default to empty array if not provided
}: RefactoredAvailabilityCheckProps) {
  // Log each render for debugging
  console.log(`[RefactoredAvailabilityCheck] Rendering with property: ${property.slug}, initialCheckIn: ${initialCheckIn}, initialCheckOut: ${initialCheckOut}`);
  
  // Get translation function
  const { tc } = useLanguage();
  
  // Get values from booking context with error handling
  const bookingContext = React.useMemo(() => {
    try {
      const context = useBooking();
      // Verify return value
      if (!context || typeof context !== 'object') {
        console.error('[RefactoredAvailabilityCheck] Invalid context returned from useBooking:', context);
        throw new Error('Invalid booking context');
      }
      return context;
    } catch (error) {
      console.error('[RefactoredAvailabilityCheck] Error accessing booking context:', error);
      // Return fallback values to prevent component crash
      return {
        checkInDate: null,
        checkOutDate: null,
        numberOfNights: 0,
        numberOfGuests: 2,
        setCheckInDate: (date: Date | null) => {
          console.warn('[RefactoredAvailabilityCheck] Using fallback setCheckInDate - context unavailable');
        },
        setCheckOutDate: (date: Date | null) => {
          console.warn('[RefactoredAvailabilityCheck] Using fallback setCheckOutDate - context unavailable');
        }
      };
    }
  }, []);

  // Destructure values from context or fallback
  const {
    checkInDate,
    checkOutDate,
    numberOfNights,
    numberOfGuests,
    setCheckInDate,
    setCheckOutDate
  } = bookingContext;
  
  // Get toast for notifications - memoize to prevent unnecessary rerenders
  const { toast } = React.useMemo(() => useToast(), []);
  
  // UI state
  const [hasMounted, setHasMounted] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>(preloadedUnavailableDates);
  const [error, setError] = useState<string | null>(null);

  // Log if we have preloaded dates
  useEffect(() => {
    if (preloadedUnavailableDates && preloadedUnavailableDates.length > 0) {
      console.log(`[RefactoredAvailabilityCheck] Using ${preloadedUnavailableDates.length} pre-loaded unavailable dates`);
    }
  }, [preloadedUnavailableDates]);
  
  // Handle date changes from the date picker
  const handleDateChange = useCallback((from: Date | null, to: Date | null) => {
    console.log('[RefactoredAvailabilityCheck] Date changed:', { from, to });
    if (from) setCheckInDate(from);
    if (to) setCheckOutDate(to);
    
    // Reset availability status when dates change
    setIsAvailable(null);
    setError(null);
    
    // If both dates are selected, automatically trigger availability check
    if (from && to) {
      // Use a slight delay to ensure state is updated
      setTimeout(() => {
        console.log('[RefactoredAvailabilityCheck] Auto-checking availability after date change');
        // The actual availability check will be triggered here
        setIsLoadingAvailability(true);
        // Use preloaded dates if available, otherwise fetch from API
        (preloadedUnavailableDates.length > 0
          ? Promise.resolve(preloadedUnavailableDates)
          : getUnavailableDatesForProperty(property.slug)
        ).then(fetchedUnavailableDates => {
            console.log(`[RefactoredAvailabilityCheck] Using ${fetchedUnavailableDates.length} unavailable dates`);

            // Only set state if we had to fetch
            if (preloadedUnavailableDates.length === 0) {
              setUnavailableDates(fetchedUnavailableDates);
            }

            // Check for conflicts with selected date range
            let conflict = false;
            let current = new Date(from.getTime());

            // Check each day in the range
            while (isBefore(current, to)) {
              const dateString = format(startOfDay(current), 'yyyy-MM-dd');
              if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
                conflict = true;
                console.log(`[RefactoredAvailabilityCheck] Conflict found on ${dateString}`);
                break;
              }
              // Move to next day
              current.setDate(current.getDate() + 1);
            }

            // Update availability status
            setIsAvailable(!conflict);

            // Notify parent if callback is provided
            if (onAvailabilityChecked) {
              onAvailabilityChecked(!conflict);
            }

            // Show toast notification
            toast({
              title: !conflict ? "Available!" : "Not Available",
              description: !conflict
                ? "These dates are available for booking!"
                : "Sorry, the selected dates are not available.",
              variant: !conflict ? "default" : "destructive",
            });
          })
          .catch(error => {
            console.error('[RefactoredAvailabilityCheck] Error checking availability:', error);
            setError('Error checking availability. Please try again.');
            toast({
              title: "Error",
              description: "Failed to check availability. Please try again.",
              variant: "destructive",
            });
          })
          .finally(() => {
            setIsLoadingAvailability(false);
          });
      }, 100);
    }
  }, [setCheckInDate, setCheckOutDate, property.slug, toast, onAvailabilityChecked, preloadedUnavailableDates]);
  
  // Set mounted flag on first render - with ref to prevent loops
  const mountedRef = React.useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      console.log('[RefactoredAvailabilityCheck] Component mounting - first render only');
      mountedRef.current = true;

      // If we don't have preloaded dates, fetch them immediately on mount
      if (preloadedUnavailableDates.length === 0) {
        console.log('[RefactoredAvailabilityCheck] No preloaded dates, fetching on mount');
        getUnavailableDatesForProperty(property.slug)
          .then(dates => {
            console.log(`[RefactoredAvailabilityCheck] Loaded ${dates.length} unavailable dates on mount`);
            setUnavailableDates(dates);
            setHasMounted(true);
          })
          .catch(error => {
            console.error('[RefactoredAvailabilityCheck] Error loading unavailable dates:', error);
            setHasMounted(true); // Still mark as mounted even on error
          });
      } else {
        setHasMounted(true);
      }
    }
  }, [property.slug, preloadedUnavailableDates]);
  
  // Show loading state while initial render is happening
  if (!hasMounted) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading booking options...</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto w-full px-4 md:px-0">
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-md mb-4">
        <h3 className="font-medium text-blue-800">Availability Checker</h3>
        <p className="text-sm text-blue-700">Check if dates are available using the server-side API.</p>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <div className="bg-white p-3 rounded shadow-sm">
            <h4 className="font-medium flex items-center mb-2">
              <Calendar className="h-4 w-4 mr-1" />
              Property
            </h4>
            <p className="text-sm">{tc(property.name) || property.slug}</p>
          </div>

          <div className="bg-white p-3 rounded shadow-sm">
            {/* Debug log to check unavailable dates */}
            {console.log(`[RefactoredAvailabilityCheck] Passing ${unavailableDates.length} unavailable dates to DatePicker`)}

            <CustomDateRangePicker
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              onDateChange={handleDateChange}
              numberOfNights={numberOfNights}
              disabled={isLoadingAvailability}
              showNights={true}
              unavailableDates={unavailableDates}
            />
            {unavailableDates.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-amber-600">•</span> Some dates are not available (marked with strikethrough)
              </p>
            )}
          </div>
        </div>

        {/* Availability results section */}
        {isAvailable !== null && !isLoadingAvailability && (
          <div className={`mt-4 p-3 rounded ${isAvailable ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'}`}>
            <div className="flex items-center">
              {isAvailable ? (
                <>
                  <Check className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-green-800">Available!</h4>
                    <p className="text-sm text-green-700">These dates are available for booking.</p>
                  </div>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-red-600 mr-2" />
                  <div>
                    <h4 className="font-medium text-red-800">Not Available</h4>
                    <p className="text-sm text-red-700">The selected dates are not available.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded bg-amber-50 border border-amber-200">
            <p className="text-amber-800">{error}</p>
          </div>
        )}

        {isLoadingAvailability ? (
          <div className="mt-4 flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
            <p>Checking availability...</p>
          </div>
        ) : (
          <div className="mt-4">
            <Button
              onClick={async () => {
                if (isLoadingAvailability) return; // Prevent duplicate clicks
                if (!checkInDate || !checkOutDate) {
                  toast({
                    title: "Missing Dates",
                    description: "Please select both check-in and check-out dates.",
                    variant: "destructive",
                  });
                  return;
                }

                // Reset
                setError(null);
                setIsAvailable(null);
                console.log('[RefactoredAvailabilityCheck] Checking availability using API');
                setIsLoadingAvailability(true);

                try {
                  // Use preloaded dates if available, otherwise fetch from API
                  const fetchedUnavailableDates = preloadedUnavailableDates.length > 0
                    ? preloadedUnavailableDates
                    : await getUnavailableDatesForProperty(property.slug);

                  console.log(`[RefactoredAvailabilityCheck] Using ${fetchedUnavailableDates.length} unavailable dates`);

                  // Only set state if we had to fetch
                  if (preloadedUnavailableDates.length === 0) {
                    setUnavailableDates(fetchedUnavailableDates);
                  }

                  // Check for conflicts with selected date range
                  let conflict = false;
                  let current = new Date(checkInDate.getTime());

                  // Check each day in the range
                  while (isBefore(current, checkOutDate)) {
                    const dateString = format(startOfDay(current), 'yyyy-MM-dd');
                    if (fetchedUnavailableDates.some(d => format(startOfDay(d), 'yyyy-MM-dd') === dateString)) {
                      conflict = true;
                      console.log(`[RefactoredAvailabilityCheck] Conflict found on ${dateString}`);
                      break;
                    }
                    // Move to next day
                    current.setDate(current.getDate() + 1);
                  }

                  // Update availability status
                  setIsAvailable(!conflict);

                  // Notify parent if callback is provided
                  if (onAvailabilityChecked) {
                    onAvailabilityChecked(!conflict);
                  }

                  // Show toast notification
                  toast({
                    title: !conflict ? "Available!" : "Not Available",
                    description: !conflict
                      ? "These dates are available for booking!"
                      : "Sorry, the selected dates are not available.",
                    variant: !conflict ? "default" : "destructive",
                  });

                } catch (error) {
                  console.error('[RefactoredAvailabilityCheck] Error checking availability:', error);
                  setError('Error checking availability. Please try again.');
                  toast({
                    title: "Error",
                    description: "Failed to check availability. Please try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsLoadingAvailability(false);
                }
              }}
              className="w-full"
              disabled={isLoadingAvailability || !checkInDate || !checkOutDate} // Disable if loading or dates not selected
              data-auto-check="true"
            >
              {isLoadingAvailability ? 'Checking...' : 'Check Availability'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}