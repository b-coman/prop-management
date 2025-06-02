/**
 * Date Utilities for Booking V2
 * 
 * @file-status: ACTIVE
 * @v2-role: CORE - Date manipulation utilities for V2 booking system
 * @created: 2025-05-31
 * @description: Utility functions for date calculations, minimum stay validation,
 *               and back-to-back booking logic as specified in V2 requirements
 * @dependencies: date-fns
 */

import { addDays, differenceInDays, isBefore, isAfter, isSameDay } from 'date-fns';

/**
 * Calculate the number of days between two dates (exclusive of end date)
 * Used for calculating nights in booking
 */
export function getDaysBetween(startDate: Date, endDate: Date): number {
  return differenceInDays(endDate, startDate);
}

/**
 * Get all dates before a given check-in date (for check-out calendar disabled dates)
 * Used to prevent checkout before checkin
 */
export function getDatesBeforeCheckIn(checkInDate: Date): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  const startDate = isBefore(today, checkInDate) ? today : checkInDate;
  
  for (let d = new Date(startDate); isBefore(d, checkInDate); d = addDays(d, 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

/**
 * Get all dates between two dates (exclusive of end date)
 * Used for minimum stay enforcement in calendar
 */
export function getDatesBetween(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  for (let d = new Date(startDate); isBefore(d, endDate); d = addDays(d, 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

/**
 * Validate if a date range meets minimum stay requirements
 */
export function validateMinimumStay(
  checkIn: Date, 
  checkOut: Date, 
  minimumStay: number
): boolean {
  const nights = getDaysBetween(checkIn, checkOut);
  return nights >= minimumStay;
}

/**
 * Get the earliest valid checkout date based on checkin and minimum stay
 */
export function getMinimumCheckoutDate(checkInDate: Date, minimumStay: number): Date {
  return addDays(checkInDate, minimumStay);
}

/**
 * Apply back-to-back booking logic (shift unavailable dates +1 day for checkout calendar)
 * This allows same-day checkout/checkin transitions
 */
export function applyBackToBackLogic(unavailableDates: Date[]): Date[] {
  return unavailableDates.map(date => addDays(date, 1));
}

/**
 * Check if a date is in the past (before today)
 */
export function isPastDate(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return isBefore(date, today);
}

/**
 * Generate disabled dates for check-in calendar
 */
export function getCheckInDisabledDates(unavailableDates: Date[]): Date[] {
  const today = new Date();
  const pastDates: Date[] = [];
  
  // Add past dates (last 90 days for reasonable range)
  for (let i = 90; i > 0; i--) {
    pastDates.push(addDays(today, -i));
  }
  
  return [...unavailableDates, ...pastDates];
}

/**
 * Generate disabled dates for check-out calendar with minimum stay enforcement
 */
export function getCheckOutDisabledDates(
  checkInDate: Date,
  unavailableDates: Date[],
  minimumStay: number
): Date[] {
  const minCheckoutDate = getMinimumCheckoutDate(checkInDate, minimumStay);
  
  return [
    // Back-to-back booking logic (shift unavailable dates +1 day)
    ...applyBackToBackLogic(unavailableDates),
    // All dates before check-in
    ...getDatesBeforeCheckIn(checkInDate),
    // Minimum stay enforcement
    ...getDatesBetween(checkInDate, minCheckoutDate),
    // Same day checkout prevention
    checkInDate
  ];
}

/**
 * Format date range for display
 */
export function formatDateRange(checkIn: Date, checkOut: Date): string {
  const nights = getDaysBetween(checkIn, checkOut);
  const nightText = nights === 1 ? 'night' : 'nights';
  
  return `${checkIn.toLocaleDateString()} - ${checkOut.toLocaleDateString()} (${nights} ${nightText})`;
}

/**
 * Parse date string safely (handles YYYY-MM-DD format from URL parameters)
 */
export function parseDateString(dateString: string): Date | null {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format date for API calls (YYYY-MM-DD format)
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}