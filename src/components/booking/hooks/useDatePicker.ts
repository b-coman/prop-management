"use client";

import { useState, useCallback, useRef, useMemo } from 'react';
import { useBooking } from '@/contexts/BookingContext';
import { isValid, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

/**
 * Custom hook for managing date picker state with protections against update loops
 */
export function useDatePicker() {
  const { 
    checkInDate, 
    checkOutDate, 
    setCheckInDate,
    setCheckOutDate,
    setNumberOfNights
  } = useBooking();
  
  // State for popover open/close
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Use a ref to track state without triggering re-renders
  const isOpenRef = useRef(isDatePickerOpen);
  
  // Memoized date range for the calendar
  const dateRange: DateRange | undefined = useMemo(() => {
    if (checkInDate && checkOutDate) {
      // Log this less frequently to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.log("[useDatePicker] Creating date range:", {
          from: checkInDate.toISOString(),
          to: checkOutDate.toISOString()
        });
      }
      return { from: checkInDate, to: checkOutDate };
    }
    return undefined;
  }, [
    // Use time values instead of object references
    checkInDate?.getTime(),
    checkOutDate?.getTime()
  ]);
  
  // Memoized dates selected state
  const datesSelected = useMemo(() => {
    const hasCheckIn = !!checkInDate;
    const hasCheckOut = !!checkOutDate;
    const checkInValid = hasCheckIn && isValid(checkInDate);
    const checkOutValid = hasCheckOut && isValid(checkOutDate);
    
    // Simple validation of dates order
    const datesInOrder = checkInValid && checkOutValid && 
      checkOutDate.getTime() > checkInDate.getTime();
      
    return hasCheckIn && hasCheckOut && checkInValid && checkOutValid && datesInOrder;
  }, [
    checkInDate?.getTime(),
    checkOutDate?.getTime()
  ]);
  
  // Handler for opening/closing the date picker
  const handleOpenChange = useCallback((open: boolean) => {
    // Only update if value actually changes
    if (isOpenRef.current !== open) {
      isOpenRef.current = open;
      setIsDatePickerOpen(open);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[useDatePicker] Date picker ${open ? 'opened' : 'closed'}`);
      }
    }
  }, []);
  
  // Handler for date selection
  const handleDateSelect = useCallback((range: DateRange | undefined) => {
    if (range?.from) {
      // Normalize dates to start of day
      const checkIn = startOfDay(range.from);
      setCheckInDate(checkIn);
    } else {
      setCheckInDate(null);
    }
    
    if (range?.to) {
      const checkOut = startOfDay(range.to);
      setCheckOutDate(checkOut);
    } else {
      setCheckOutDate(null);
    }
    
    // Close the picker using the ref to prevent update loops
    if (isOpenRef.current) {
      isOpenRef.current = false;
      setIsDatePickerOpen(false);
    }
  }, [setCheckInDate, setCheckOutDate]);
  
  return {
    dateRange,
    datesSelected,
    isDatePickerOpen,
    handleOpenChange,
    handleDateSelect
  };
}