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
  
  // Run this effect whenever dates or nights change
  useEffect(() => {
    // Only run if we have both dates
    if (checkInDate && checkOutDate && !fixingRef.current) {
      // Set flag to prevent re-entry
      fixingRef.current = true;

      // Calculate using multiple methods
      const method1 = differenceInDays(checkOutDate, checkInDate);
      const method2 = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

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
    }
  }, [checkInDate, checkOutDate, numberOfNights, setNumberOfNights]);
  
  // This component doesn't render anything
  return null;
}