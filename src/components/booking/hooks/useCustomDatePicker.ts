"use client";

import { useState, useCallback, useRef, useMemo } from 'react';
import { isValid, startOfDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

interface UseCustomDatePickerProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  onDateChange: (from: Date | null, to: Date | null) => void;
}

/**
 * Custom hook for managing date picker state with custom change handlers
 */
export function useCustomDatePicker({
  checkInDate,
  checkOutDate,
  onDateChange
}: UseCustomDatePickerProps) {
  // State for popover open/close
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Use a ref to track state without triggering re-renders
  const isOpenRef = useRef(isDatePickerOpen);
  
  // Memoized date range for the calendar
  const dateRange: DateRange | undefined = useMemo(() => {
    if (checkInDate && checkOutDate) {
      // Log this less frequently to reduce console noise
      if (process.env.NODE_ENV === 'development') {
        console.log("[useCustomDatePicker] Creating date range:", {
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
        console.log(`[useCustomDatePicker] Date picker ${open ? 'opened' : 'closed'}`);
      }
    }
  }, []);
  
  // Handler for date selection
  const handleDateSelect = useCallback((range: DateRange | undefined) => {
    // Use the custom handler
    const from = range?.from ? startOfDay(range.from) : null;
    const to = range?.to ? startOfDay(range.to) : null;

    // Log the date selection for debugging
    console.log("[useCustomDatePicker] Date selection changed:", {
      from: from?.toISOString(),
      to: to?.toISOString()
    });

    onDateChange(from, to);

    // Close the picker using the ref to prevent update loops
    if (isOpenRef.current) {
      isOpenRef.current = false;
      setIsDatePickerOpen(false);
    }
  }, [onDateChange]);
  
  return {
    dateRange,
    datesSelected,
    isDatePickerOpen,
    handleOpenChange,
    handleDateSelect
  };
}