"use client";

import { useMemo } from 'react';
import { addDays } from 'date-fns';
import type { DateAlternative } from '../sections/availability/DateAlternatives';

interface UseDateSuggestionsProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  numberOfNights: number;
}

/**
 * Custom hook for generating alternative date suggestions
 * 
 * This hook takes the current check-in and check-out dates and generates
 * a list of alternative date ranges that might be suitable.
 * 
 * In a real implementation, this would consider available dates from the calendar,
 * but for now it generates static suggestions.
 */
export function useDateSuggestions({
  checkInDate,
  checkOutDate,
  numberOfNights
}: UseDateSuggestionsProps): DateAlternative[] {
  return useMemo(() => {
    if (!checkInDate || !checkOutDate) {
      return [];
    }
    
    const alternatives: DateAlternative[] = [];
    
    // Suggestion 1: One week later, same duration
    const oneWeekLater = new Date(checkInDate.getTime());
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    const oneWeekLaterCheckout = new Date(oneWeekLater);
    oneWeekLaterCheckout.setDate(oneWeekLater.getDate() + numberOfNights);
    
    alternatives.push({
      checkIn: oneWeekLater,
      checkOut: oneWeekLaterCheckout,
      nights: numberOfNights,
      label: '1 week later',
      id: 'week-later'
    });
    
    // Suggestion 2: One month later, same duration
    const oneMonthLater = new Date(checkInDate.getTime());
    oneMonthLater.setDate(oneMonthLater.getDate() + 30);
    
    const oneMonthLaterCheckout = new Date(oneMonthLater);
    oneMonthLaterCheckout.setDate(oneMonthLater.getDate() + numberOfNights);
    
    alternatives.push({
      checkIn: oneMonthLater,
      checkOut: oneMonthLaterCheckout,
      nights: numberOfNights,
      label: 'Next month',
      id: 'month-later'
    });
    
    // Suggestion 3: Same check-in date, shorter stay (if original stay was long enough)
    if (numberOfNights > 3) {
      const shorterStayCheckout = new Date(checkInDate.getTime());
      shorterStayCheckout.setDate(shorterStayCheckout.getDate() + 3);
      
      alternatives.push({
        checkIn: new Date(checkInDate),
        checkOut: shorterStayCheckout,
        nights: 3,
        label: 'Shorter stay',
        id: 'shorter-stay'
      });
    }
    
    // Suggestion 4: Next weekend
    const nextFriday = getNextDayOfWeek(checkInDate, 5); // 5 = Friday
    const nextSunday = new Date(nextFriday);
    nextSunday.setDate(nextFriday.getDate() + 2); // Sunday is 2 days after Friday
    
    alternatives.push({
      checkIn: nextFriday,
      checkOut: nextSunday,
      nights: 2,
      label: 'Weekend stay',
      id: 'weekend'
    });
    
    return alternatives;
  }, [checkInDate, checkOutDate, numberOfNights]);
}

/**
 * Helper function to find the next occurrence of a specific day of the week
 */
function getNextDayOfWeek(date: Date, dayOfWeek: number): Date {
  const resultDate = new Date(date.getTime());
  resultDate.setDate(date.getDate() + (7 + dayOfWeek - date.getDay()) % 7);
  // If the result is the same day, add a week
  if (resultDate.getDay() === date.getDay() && resultDate.getDate() === date.getDate()) {
    resultDate.setDate(resultDate.getDate() + 7);
  }
  return resultDate;
}