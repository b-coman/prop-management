"use client";

import { useEffect, useRef } from "react";
import { useBooking } from "@/contexts/BookingContext";
import { differenceInDays } from "date-fns";

/**
 * This component doesn't render anything - it just fixes the nights calculation
 * whenever the dates change but the nights aren't updated correctly
 */
export function FixNights() {
  // Get the booking context
  const { 
    checkInDate, 
    checkOutDate, 
    numberOfNights,
    setNumberOfNights 
  } = useBooking();
  
  // Use a ref to prevent infinite loops
  const fixingRef = useRef(false);
  // Track previous date values to prevent unnecessary recalculations
  const prevCheckInRef = useRef<Date | null>(null);
  const prevCheckOutRef = useRef<Date | null>(null);
  const prevNightsRef = useRef<number>(0);
  
  // Run this effect whenever dates or nights change
  useEffect(() => {
    // Skip if already fixing, or if we don't have both dates
    if (fixingRef.current || !checkInDate || !checkOutDate) {
      return;
    }
    
    // Check if dates or nights actually changed to prevent unnecessary work
    const checkInTime = checkInDate.getTime();
    const checkOutTime = checkOutDate.getTime();
    const datesChanged = 
      !prevCheckInRef.current || 
      !prevCheckOutRef.current || 
      prevCheckInRef.current.getTime() !== checkInTime || 
      prevCheckOutRef.current.getTime() !== checkOutTime;
    const nightsChanged = prevNightsRef.current !== numberOfNights;
    
    // Only proceed if something changed
    if (!datesChanged && !nightsChanged) {
      return;
    }
    
    // Update refs with current values
    prevCheckInRef.current = new Date(checkInTime);
    prevCheckOutRef.current = new Date(checkOutTime);
    prevNightsRef.current = numberOfNights;
    
    // Don't fix if we already have a valid night count
    if (numberOfNights > 0) {
      // Validate existing night count against dates
      const method1 = differenceInDays(checkOutDate, checkInDate);
      // Only fix if off by more than a threshold (small differences might be timezone related)
      if (Math.abs(method1 - numberOfNights) <= 1) {
        return; // Close enough, avoid unnecessary updates
      }
    }

    // Set flag to prevent re-entry
    fixingRef.current = true;

    // Calculate using multiple methods
    const method1 = differenceInDays(checkOutDate, checkInDate);
    const method2 = Math.ceil((checkOutTime - checkInTime) / (1000 * 60 * 60 * 24));

    // Use the most reliable result
    let nights = 4; // Default fallback
    if (method1 > 0) nights = method1;
    else if (method2 > 0) nights = method2;

    // Only update if nights is incorrect
    if (numberOfNights <= 0 || numberOfNights === undefined || numberOfNights !== nights) {
      console.log(`[FixNights] Setting nights to ${nights} (was ${numberOfNights})`);
      setNumberOfNights(nights);
    } else {
      console.log(`[FixNights] Nights already correct: ${numberOfNights}`);
    }

    // Release the flag after a delay
    setTimeout(() => {
      fixingRef.current = false;
    }, 1000);
  }, [checkInDate, checkOutDate, numberOfNights, setNumberOfNights]);
  
  // This component doesn't render anything
  return null;
}