"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { addDays, format, isBefore, startOfDay } from 'date-fns';
import { Check, Loader2, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleDateSelector } from './SimpleDateSelector';
import { useToast } from '@/hooks/use-toast';
import { checkAvailability } from '@/services/availabilityService';
import { GuestSelector } from '../common/GuestSelector';

interface IndependentAvailabilityCheckerProps {
  propertySlug: string;
  propertyName: string;
  maxGuests: number;
  initialCheckIn?: Date | null;
  initialCheckOut?: Date | null;
  initialGuests?: number;
  onAvailabilityResult?: (isAvailable: boolean | null) => void;
  onGuestCountChange?: (count: number) => void;
  onDateChange?: (checkInDate: Date | null, checkOutDate: Date | null) => void;
}

/**
 * IndependentAvailabilityChecker component
 * 
 * Completely self-contained checker that doesn't depend on BookingContext
 * for its state management - to avoid any potential issues with the context
 */
export function IndependentAvailabilityChecker({
  propertySlug,
  propertyName,
  maxGuests,
  initialCheckIn = null,
  initialCheckOut = null,
  initialGuests = 2,
  onAvailabilityResult,
  onGuestCountChange,
  onDateChange
}: IndependentAvailabilityCheckerProps) {
  // Manage state internally
  const [checkInDate, setCheckInDate] = useState<Date | null>(initialCheckIn);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(initialCheckOut);
  const [guestCount, setGuestCount] = useState<number>(initialGuests);
  const [numberOfNights, setNumberOfNights] = useState<number>(0);
  
  // State for availability checking
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [wasChecked, setWasChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Dependencies  
  const { toast } = useToast();
  
  // Calculate nights whenever dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const diffTime = checkOutDate.getTime() - checkInDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      setNumberOfNights(diffDays);
    } else {
      setNumberOfNights(0);
    }
    
    // Notify parent about date changes if needed
    if (onDateChange) {
      onDateChange(checkInDate, checkOutDate);
    }
  }, [checkInDate, checkOutDate, onDateChange]);

  // Handle check-in date changes
  const handleCheckInChange = useCallback((date: Date | null) => {
    console.log(`[IndependentAvailabilityChecker] Check-in date changed to: ${date?.toDateString() || 'null'}`);
    
    // Always clear checkout date when check-in date changes
    if (date && checkOutDate && date >= checkOutDate) {
      setCheckOutDate(null);
    }
    
    setCheckInDate(date);
    
    // Reset availability state
    setWasChecked(false);
    setIsAvailable(null);
    setError(null);
  }, [checkOutDate]);

  // Handle check-out date changes
  const handleCheckOutChange = useCallback((date: Date | null) => {
    console.log(`[IndependentAvailabilityChecker] Check-out date changed to: ${date?.toDateString() || 'null'}`);
    setCheckOutDate(date);
    
    // Reset availability state
    setWasChecked(false);
    setIsAvailable(null);
    setError(null);
  }, []);

  // Handle guest count changes
  const handleGuestCountChange = useCallback((count: number) => {
    console.log(`[IndependentAvailabilityChecker] Guest count changed to: ${count}`);
    setGuestCount(count);
    
    if (onGuestCountChange) {
      onGuestCountChange(count);
    }
  }, [onGuestCountChange]);

  // Check availability
  const handleCheckAvailability = useCallback(async () => {
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
    console.log('[IndependentAvailabilityChecker] Checking availability using API');
    setIsCheckingAvailability(true);

    try {
      // Use the checkAvailability service directly
      const result = await checkAvailability(propertySlug, checkInDate, checkOutDate);

      // Store the unavailable dates
      setUnavailableDates(result.unavailableDates);

      // Update availability status
      setIsAvailable(result.isAvailable);
      setWasChecked(true);

      // Notify parent component if needed
      if (onAvailabilityResult) {
        onAvailabilityResult(result.isAvailable);
      }

      // No toast notification needed

    } catch (error) {
      console.error('[IndependentAvailabilityChecker] Error checking availability:', error);
      setError('Error checking availability. Please try again.');
      toast({
        title: "Error",
        description: "Failed to check availability. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [checkInDate, checkOutDate, propertySlug, toast, onAvailabilityResult]);

  // Create a derived value for min checkout date (always day after check-in)
  const minCheckoutDate = checkInDate ? addDays(checkInDate, 1) : new Date();

  // Auto-check availability when both dates are selected
  useEffect(() => {
    // Only auto-check when both dates are selected, not already checking, and not already checked
    if (checkInDate && checkOutDate && !isCheckingAvailability && !wasChecked) {
      // Small timeout to avoid rapid rechecks during date selection
      const timer = setTimeout(() => {
        console.log('[IndependentAvailabilityChecker] Auto-checking availability');
        handleCheckAvailability();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [checkInDate, checkOutDate, isCheckingAvailability, wasChecked, handleCheckAvailability]);

  return (
    <div className="p-4 border border-blue-200 bg-blue-50 rounded-md">
      <h3 className="font-medium text-blue-800">Availability Checker</h3>
      <p className="text-sm text-blue-700 mb-4">
        Select your dates and check availability.
      </p>

      <div className="flex items-center space-x-2 bg-white p-3 rounded shadow-sm">
        <Calendar className="h-4 w-4 text-blue-600" />
        <p>Property: {propertyName}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date selector fields */}
        <SimpleDateSelector 
          date={checkInDate}
          onChange={handleCheckInChange}
          label="Check-in Date"
          placeholder="Select check-in date"
          disabled={isCheckingAvailability}
        />

        <SimpleDateSelector 
          date={checkOutDate}
          onChange={handleCheckOutChange}
          label="Check-out Date"
          placeholder="Select check-out date"
          disabled={isCheckingAvailability}
          minDate={minCheckoutDate}
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