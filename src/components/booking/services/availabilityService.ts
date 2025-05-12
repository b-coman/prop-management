"use client";

import { getUnavailableDatesForProperty } from '@/services/availabilityService';
import { format, isValid, startOfDay } from 'date-fns';

/**
 * Interface for the response from the availability check
 */
export interface AvailabilityCheckResult {
  isAvailable: boolean;
  unavailableDates: Date[];
  message?: string;
}

/**
 * Check if a date range is available
 * 
 * This function checks if a date range is available by comparing it with
 * a list of unavailable dates. If any day in the range is unavailable,
 * the entire range is considered unavailable.
 */
export function checkDateRangeAvailability(
  startDate: Date,
  endDate: Date,
  unavailableDates: Date[]
): boolean {
  const start = startOfDay(startDate).getTime();
  const end = startOfDay(endDate).getTime();
  
  // For each day in the range, check if it's in the unavailable dates
  const currentDate = new Date(start);
  while (currentDate.getTime() <= end) {
    // Check if this day is in the unavailable dates
    if (unavailableDates.some(unavailableDate => 
      startOfDay(unavailableDate).getTime() === startOfDay(currentDate).getTime()
    )) {
      return false;
    }
    
    // Move to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return true;
}

/**
 * Check availability for a date range
 * 
 * This function checks if a date range is available for a property.
 * It fetches the unavailable dates and then checks if the range is available.
 */
export async function checkAvailability(
  propertySlug: string,
  startDate: Date,
  endDate: Date
): Promise<AvailabilityCheckResult> {
  console.log(`Checking availability for ${propertySlug} from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
  
  try {
    // Fetch unavailable dates from the API
    const unavailableDates = await getUnavailableDatesForProperty(propertySlug);
    
    // Check if the date range is available
    const isAvailable = checkDateRangeAvailability(startDate, endDate, unavailableDates);
    
    return {
      isAvailable,
      unavailableDates,
      message: isAvailable 
        ? 'These dates are available!' 
        : 'Some of these dates are not available.'
    };
  } catch (error) {
    console.error('Error checking availability:', error);
    return {
      isAvailable: false,
      unavailableDates: [],
      message: 'Error checking availability. Please try again.'
    };
  }
}

/**
 * Generate suggested alternatives for unavailable dates
 * 
 * This function generates alternative date ranges when the requested dates
 * are unavailable, taking into account the property's busy periods.
 */
export async function getSuggestedAlternatives(
  propertySlug: string,
  originalCheckIn: Date,
  originalCheckOut: Date,
  unavailableDates: Date[]
): Promise<Array<{ checkIn: Date, checkOut: Date, nights: number, label: string }>> {
  // This would use more advanced logic in a real implementation
  // For now, we'll return some static suggestions
  
  const nights = Math.round((originalCheckOut.getTime() - originalCheckIn.getTime()) / (1000 * 60 * 60 * 24));
  
  // Simple alternatives one week later, two weeks later, etc.
  const alternatives = [
    {
      checkIn: new Date(originalCheckIn.getTime() + 7 * 24 * 60 * 60 * 1000),
      checkOut: new Date(originalCheckOut.getTime() + 7 * 24 * 60 * 60 * 1000),
      nights,
      label: 'One week later'
    },
    {
      checkIn: new Date(originalCheckIn.getTime() + 14 * 24 * 60 * 60 * 1000),
      checkOut: new Date(originalCheckOut.getTime() + 14 * 24 * 60 * 60 * 1000),
      nights,
      label: 'Two weeks later'
    }
  ];
  
  // In a real implementation, we would check if these alternatives are actually available
  
  return alternatives;
}