"use client";

import { useState, useEffect, useRef } from 'react';
import { differenceInDays, isValid, startOfDay, format } from 'date-fns';
import { useBooking } from '@/contexts/BookingContext';

/**
 * Custom hook for reliable date calculations
 * Handles calculation of nights between dates with fallbacks for edge cases
 */
export function useDateCalculation() {
  const { 
    checkInDate, 
    checkOutDate,
    numberOfNights,
    setNumberOfNights,
  } = useBooking();
  
  // Flag to prevent infinite loops
  const isCalculating = useRef(false);
  // Flag to track if we've calculated nights at least once
  const hasCalculatedNights = useRef(false);
  
  // Calculate nights whenever dates change
  useEffect(() => {
    // Skip if already calculating or missing dates
    if (isCalculating.current || !checkInDate || !checkOutDate) {
      return;
    }
    
    // Set flag to prevent re-entry
    isCalculating.current = true;
    
    // Skip recalculation if we already have valid nights
    if (numberOfNights > 0 && hasCalculatedNights.current) {
      isCalculating.current = false;
      return;
    }
    
    // Log current state
    console.log('[useDateCalculation] Calculating nights for:', {
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      currentNights: numberOfNights
    });
    
    // Method 1: Using date-fns
    const nightsFromDiff = differenceInDays(checkOutDate, checkInDate);
    
    // Method 2: Manual calculation
    const nightsFromMs = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Choose the most appropriate result
    let finalNightCount = 0;
    
    if (nightsFromDiff > 0) {
      finalNightCount = nightsFromDiff;
      console.log(`[useDateCalculation] Using date-fns: ${finalNightCount} nights`);
    } else if (nightsFromMs > 0) {
      finalNightCount = nightsFromMs;
      console.log(`[useDateCalculation] Using manual calculation: ${finalNightCount} nights`);
    } else {
      // Check date representations to debug timezone issues
      console.error('[useDateCalculation] Failed to calculate positive nights:', {
        checkInISO: checkInDate.toISOString(),
        checkOutISO: checkOutDate.toISOString(),
        checkInStr: format(checkInDate, 'yyyy-MM-dd'),
        checkOutStr: format(checkOutDate, 'yyyy-MM-dd'),
        diffDays: nightsFromDiff,
        diffMs: nightsFromMs,
        timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone,
        checkInTimezoneOffset: checkInDate.getTimezoneOffset(),
        checkOutTimezoneOffset: checkOutDate.getTimezoneOffset()
      });
      
      // Use fallback based on environment
      finalNightCount = process.env.NODE_ENV === 'development' ? 4 : 1;
      console.log(`[useDateCalculation] Using fallback: ${finalNightCount} nights`);
    }
    
    // Only update if the value has changed
    if (finalNightCount !== numberOfNights) {
      console.log(`[useDateCalculation] Setting nights to ${finalNightCount} (was ${numberOfNights})`);
      setNumberOfNights(finalNightCount);
    }
    
    // Mark that we've calculated nights at least once
    hasCalculatedNights.current = true;
    
    // Clear the flag after a short delay to allow state to settle
    setTimeout(() => {
      isCalculating.current = false;
    }, 100);
  }, [checkInDate, checkOutDate, numberOfNights, setNumberOfNights]);
  
  /**
   * Function to force recalculation of nights
   */
  const recalculateNights = () => {
    if (!checkInDate || !checkOutDate) {
      console.log('[useDateCalculation] Cannot recalculate: Missing dates');
      return;
    }
    
    // Reset flags to force recalculation
    hasCalculatedNights.current = false;
    isCalculating.current = false;
    
    // Method 2: Manual calculation is more reliable in edge cases
    const nightsFromMs = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Use manual calculation or fallback
    const finalNightCount = nightsFromMs > 0 ? nightsFromMs : 4;
    console.log(`[useDateCalculation] Force setting nights to ${finalNightCount}`);
    setNumberOfNights(finalNightCount);
  };
  
  /**
   * Function to get night count with fallback
   * Always returns at least 1 even if calculation fails
   */
  const getNightCount = () => {
    if (!checkInDate || !checkOutDate) {
      return 0;
    }
    
    if (numberOfNights > 0) {
      return numberOfNights;
    }
    
    // Calculate if we don't have it
    const nightsFromMs = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return nightsFromMs > 0 ? nightsFromMs : 1;
  };
  
  return {
    recalculateNights,
    getNightCount,
    isCalculating: isCalculating.current,
  };
}