// src/lib/availability-admin.ts
// Shared Admin SDK utility for updating property availability.
// Used by release-holds cron, external booking actions, and cancellation flows.

import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { format } from 'date-fns';
import { loggers } from '@/lib/logger';

const logger = loggers.availability;

/**
 * Update property availability using Admin SDK.
 *
 * @param propertyId - Property slug
 * @param checkInDate - Check-in date (inclusive)
 * @param checkOutDate - Check-out date (exclusive)
 * @param available - true to release dates, false to block them
 * @param options.holdBookingId - If blocking for a hold, sets holds.{day} = bookingId
 * @param options.clearExternalBlocks - If true, removes externalBlocks entries for the booked dates
 */
export async function updateAvailabilityAdmin(
  propertyId: string,
  checkInDate: Date,
  checkOutDate: Date,
  available: boolean,
  options?: { holdBookingId?: string; clearExternalBlocks?: boolean }
): Promise<void> {
  logger.debug('Updating availability', { propertyId, action: available ? 'releasing' : 'blocking' });

  const db = await getAdminDb();

  // Get date range (excluding check-out date)
  const dates: Date[] = [];
  const currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (dates.length === 0) {
    logger.debug('No dates to update', { propertyId });
    return;
  }

  // Group updates by month
  const updatesByMonth: { [monthKey: string]: { [day: number]: boolean } } = {};

  dates.forEach(date => {
    const monthKey = format(date, 'yyyy-MM');
    const day = date.getDate();

    if (!updatesByMonth[monthKey]) {
      updatesByMonth[monthKey] = {};
    }
    updatesByMonth[monthKey][day] = available;
  });

  // Ensure all availability docs exist before updating
  // (update() fails on missing docs, and set(merge) doesn't support dot notation)
  for (const monthKey of Object.keys(updatesByMonth)) {
    const docId = `${propertyId}_${monthKey}`;
    const docRef = db.collection('availability').doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      await docRef.set({
        propertyId,
        month: monthKey,
        available: {},
        updatedAt: new Date(),
      });
      logger.debug('Created missing availability document', { docId });
    }
  }

  // Apply updates using batch.update() — dot notation works correctly here
  const batch = db.batch();

  for (const [monthKey, dayUpdates] of Object.entries(updatesByMonth)) {
    const docId = `${propertyId}_${monthKey}`;
    const docRef = db.collection('availability').doc(docId);

    const updateData: { [key: string]: any } = {
      updatedAt: new Date()
    };

    for (const [day, isAvailable] of Object.entries(dayUpdates)) {
      updateData[`available.${day}`] = isAvailable;
      // Clear hold when making available
      if (isAvailable) {
        updateData[`holds.${day}`] = FieldValue.delete();
      }
      // Set hold reference when blocking for a hold
      if (!isAvailable && options?.holdBookingId) {
        updateData[`holds.${day}`] = options.holdBookingId;
      }
      // Clear external blocks when creating a booking for these dates
      if (options?.clearExternalBlocks) {
        updateData[`externalBlocks.${day}`] = FieldValue.delete();
      }
    }

    logger.debug('Updating availability document', { docId, daysCount: Object.keys(dayUpdates).length });
    batch.update(docRef, updateData);
  }

  await batch.commit();
  logger.info('Completed availability updates', { propertyId });
}
