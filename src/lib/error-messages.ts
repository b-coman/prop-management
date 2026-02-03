/**
 * Enhanced error message generation for booking errors
 * Transforms API error responses into helpful, actionable user messages
 */

import { format, addDays } from 'date-fns';

interface ApiErrorResponse {
  available?: boolean;
  reason?: 'unavailable_dates' | 'minimum_stay';
  minimumStay?: number;
  requiredNights?: number;
  unavailableDates?: string[];
  error?: string;
}

interface BookingContext {
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  propertyId: string;
}

/**
 * Generate enhanced error messages with helpful suggestions
 */
export function generateEnhancedErrorMessage(
  error: ApiErrorResponse | string,
  context?: BookingContext
): string {
  // Handle simple string errors (backward compatibility)
  if (typeof error === 'string') {
    return error;
  }

  // Handle API error responses
  if (error.available === false && error.reason) {
    switch (error.reason) {
      case 'minimum_stay':
        return generateMinimumStayMessage(error, context);
      
      case 'unavailable_dates':
        return generateUnavailableDatesMessage(error, context);
      
      default:
        return "Selected dates are not available. Please try different dates.";
    }
  }

  // Handle generic API errors
  if (error.error) {
    return error.error;
  }

  // Fallback
  return "Unable to check availability. Please try again.";
}

/**
 * Generate helpful message for minimum stay violations
 */
function generateMinimumStayMessage(
  error: ApiErrorResponse, 
  context?: BookingContext
): string {
  const requiredNights = error.minimumStay || error.requiredNights || 2;
  
  if (context) {
    // Calculate suggested checkout date
    const suggestedCheckout = addDays(context.checkInDate, requiredNights);
    const suggestedDate = format(suggestedCheckout, 'MMM d');
    
    return `This property requires a minimum stay of ${requiredNights} nights. Try extending your checkout to ${suggestedDate} or choosing different dates.`;
  }
  
  return `This property requires a minimum stay of ${requiredNights} nights. Please extend your stay or choose different dates.`;
}

/**
 * Generate helpful message for unavailable dates
 */
function generateUnavailableDatesMessage(
  error: ApiErrorResponse, 
  context?: BookingContext
): string {
  const unavailableDates = error.unavailableDates || [];
  
  if (unavailableDates.length > 0) {
    if (unavailableDates.length === 1) {
      return "One of your selected dates is not available. Please choose different dates or adjust your stay length.";
    } else {
      return `${unavailableDates.length} of your selected dates are not available. Please choose different dates or a shorter stay.`;
    }
  }
  
  return "Selected dates are not available. Please choose different dates.";
}

/**
 * Generate simple date suggestions (no API calls needed)
 */
export function generateSimpleDateSuggestions(context: BookingContext): string[] {
  const suggestions: string[] = [];
  
  // Suggest next weekend (if it's not weekend already)
  const dayOfWeek = context.checkInDate.getDay();
  if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Not Friday or Saturday
    const nextFriday = new Date(context.checkInDate);
    const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextFriday.setDate(nextFriday.getDate() + daysToFriday);
    const nextSunday = addDays(nextFriday, 2);
    
    suggestions.push(`Try next weekend: ${format(nextFriday, 'MMM d')} - ${format(nextSunday, 'MMM d')}`);
  }
  
  // Suggest next month (same dates)
  const nextMonth = new Date(context.checkInDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthCheckout = new Date(context.checkOutDate);
  nextMonthCheckout.setMonth(nextMonthCheckout.getMonth() + 1);
  
  suggestions.push(`Try next month: ${format(nextMonth, 'MMM d')} - ${format(nextMonthCheckout, 'MMM d')}`);
  
  // Suggest shorter stay (if current stay is longer than 2 nights)
  if (context.nights > 2) {
    const shorterCheckout = addDays(context.checkInDate, 2);
    suggestions.push(`Try a shorter stay: ${format(context.checkInDate, 'MMM d')} - ${format(shorterCheckout, 'MMM d')}`);
  }
  
  return suggestions.slice(0, 2); // Limit to 2 suggestions to avoid overwhelming
}

/**
 * Check if a date range is available (no conflicts with unavailable dates)
 */
function isDateRangeAvailable(startDate: Date, endDate: Date, unavailableDates: Date[]): boolean {
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    // Check if this date is in the unavailable dates array
    const isUnavailable = unavailableDates.some(unavailableDate => 
      unavailableDate.getFullYear() === currentDate.getFullYear() &&
      unavailableDate.getMonth() === currentDate.getMonth() &&
      unavailableDate.getDate() === currentDate.getDate()
    );
    
    if (isUnavailable) {
      return false;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return true;
}

/**
 * Find the next available date range starting from a given date
 */
function findNextAvailablePeriod(
  fromDate: Date, 
  nights: number, 
  unavailableDates: Date[], 
  minStay: number
): Date | null {
  const actualNights = Math.max(nights, minStay);
  const maxSearchDays = 90; // Don't search more than 3 months ahead
  let searchDate = new Date(fromDate);
  
  for (let i = 0; i < maxSearchDays; i++) {
    const endDate = addDays(searchDate, actualNights);
    
    if (isDateRangeAvailable(searchDate, endDate, unavailableDates)) {
      return searchDate;
    }
    
    searchDate.setDate(searchDate.getDate() + 1);
  }
  
  return null; // No availability found within search range
}

/**
 * Generate smart date suggestions using real availability data
 */
export function generateSmartDateSuggestions(context: BookingContext & {
  unavailableDates: Date[];
  minimumStay: number;
}): string[] {
  const { checkInDate, checkOutDate, nights, unavailableDates, minimumStay } = context;
  const suggestions: string[] = [];
  
  // For minimum stay violations, first suggest extending current dates
  if (nights < minimumStay) {
    const extendedCheckout = addDays(checkInDate, minimumStay);
    if (isDateRangeAvailable(checkInDate, extendedCheckout, unavailableDates)) {
      const suggestedDate = format(extendedCheckout, 'MMM d');
      suggestions.push(`Extend your stay to ${suggestedDate} (${minimumStay} nights minimum)`);
    }
  }
  
  // Find next available period with minimum stay
  const nextAvailable = findNextAvailablePeriod(
    addDays(checkInDate, 1), // Start searching from next day
    nights,
    unavailableDates,
    minimumStay
  );
  
  if (nextAvailable) {
    const actualNights = Math.max(nights, minimumStay);
    const endDate = addDays(nextAvailable, actualNights);
    suggestions.push(`Next available: ${format(nextAvailable, 'MMM d')} - ${format(endDate, 'MMM d')}`);
  }
  
  // Try to find next weekend availability (if not already weekend)
  const dayOfWeek = checkInDate.getDay();
  if (dayOfWeek !== 5 && dayOfWeek !== 6) { // Not Friday or Saturday
    const nextFriday = new Date(checkInDate);
    const daysToFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextFriday.setDate(nextFriday.getDate() + daysToFriday);
    
    const weekendAvailable = findNextAvailablePeriod(
      nextFriday,
      Math.max(2, minimumStay), // Weekend is at least 2 nights
      unavailableDates,
      minimumStay
    );
    
    if (weekendAvailable && weekendAvailable.getTime() !== nextAvailable?.getTime()) {
      const weekendEnd = addDays(weekendAvailable, Math.max(2, minimumStay));
      suggestions.push(`Next available weekend: ${format(weekendAvailable, 'MMM d')} - ${format(weekendEnd, 'MMM d')}`);
    }
  }
  
  return suggestions.slice(0, 2); // Limit to 2 suggestions
}