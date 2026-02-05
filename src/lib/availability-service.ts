/**
 * @fileoverview Availability service for checking property availability
 * 
 * This service provides availability checking using the availability collection
 * as the single source of truth. This is the cleaned up version after the
 * successful migration from the dual-storage system.
 */

import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
import { format, startOfDay, eachDayOfInterval, subDays } from 'date-fns';
import { loggers } from '@/lib/logger';

export interface AvailabilityResult {
  isAvailable: boolean;
  unavailableDates: string[];
  source: 'availability';
}

/**
 * Check availability for a date range using the availability collection
 * 
 * @param propertyId Property slug
 * @param checkInDate Start date (inclusive)
 * @param checkOutDate End date (exclusive)
 * @returns Availability result
 */
export async function checkAvailabilityWithFlags(
  propertyId: string,
  checkInDate: Date,
  checkOutDate: Date
): Promise<AvailabilityResult> {
  loggers.availability.debug('Checking availability', { propertyId, checkIn: format(checkInDate, 'yyyy-MM-dd'), checkOut: format(checkOutDate, 'yyyy-MM-dd') });
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Firebase Admin SDK not available');
  }

  const unavailableDates: string[] = [];
  const dateRange = eachDayOfInterval({ 
    start: startOfDay(checkInDate), 
    end: startOfDay(subDays(checkOutDate, 1)) 
  });

  // Group dates by month for efficient queries
  const monthGroups: { [monthKey: string]: Date[] } = {};
  dateRange.forEach(date => {
    const monthKey = format(date, 'yyyy-MM');
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = [];
    }
    monthGroups[monthKey].push(date);
  });

  // Build document references for batch fetch
  const monthKeys = Object.keys(monthGroups);
  const docIds = monthKeys.map(monthKey => `${propertyId}_${monthKey}`);
  const docRefs = docIds.map(docId => db.collection('availability').doc(docId));

  // Single batch fetch instead of N sequential fetches
  // Performance improvement: O(n) queries → O(1) query
  const docs = await db.getAll(...docRefs);

  // Process results
  docs.forEach((doc, index) => {
    const monthKey = monthKeys[index];
    const dates = monthGroups[monthKey];
    const docId = docIds[index];

    if (!doc.exists) {
      // No document = dates are considered available (consistent with /api/check-availability)
      // This is the expected state for future months that haven't been configured yet
      loggers.availability.debug('No availability document, considering dates available', { docId });
      return;
    }

    const data = doc.data();
    const availableMap = data?.available || {};
    const holdsMap = data?.holds || {};

    dates.forEach(date => {
      const day = date.getDate();
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check if date is explicitly marked as unavailable or has a hold
      const isUnavailable = availableMap[day] === false || !!holdsMap[day];

      if (isUnavailable) {
        unavailableDates.push(dateStr);
        loggers.availability.debug('Date unavailable', { dateStr, available: availableMap[day], hold: holdsMap[day] });
      }
    });
  });

  const isAvailable = unavailableDates.length === 0;
  loggers.availability.debug('Availability result', { isAvailable, unavailableDatesCount: unavailableDates.length });

  return {
    isAvailable,
    unavailableDates,
    source: 'availability'
  };
}

/**
 * Alias for backward compatibility
 * @deprecated Use checkAvailabilityWithFlags instead
 */
export const checkAvailability = checkAvailabilityWithFlags;