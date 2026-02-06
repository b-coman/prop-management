"use server";

import { z } from "zod";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdminSafe";
import { updatePropertyAvailability } from '@/services/bookingService';
import { revalidatePath } from "next/cache";
import { parseISO, isValid, isPast } from 'date-fns';
import { loggers } from '@/lib/logger';
import type { Booking, SerializableTimestamp } from "@/types";
import {
  requireAdmin,
  requirePropertyAccess,
  handleAuthError,
  AuthorizationError,
} from '@/lib/authorization';

const logger = loggers.adminBookings;

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(50);

interface BulkActionResult {
  success: boolean;
  successCount: number;
  failCount: number;
}

const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') {
    try { return parseISO(timestamp); } catch { return null; }
  }
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as { _seconds: number })._seconds * 1000);
  }
  return null;
};

export async function bulkCancelBookings(bookingIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(bookingIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: bookingIds.length };
  }

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkCancelBookings', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  const db = await getAdminDb();
  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    parsed.data.map(async (bookingId) => {
      const bookingRef = db.collection('bookings').doc(bookingId);
      const bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists) {
        throw new Error('Booking not found');
      }

      const data = bookingSnap.data() as Booking;

      // Auth check per booking
      await requirePropertyAccess(data.propertyId);

      // Only cancel pending or on-hold bookings
      if (data.status !== 'pending' && data.status !== 'on-hold') {
        throw new Error(`Cannot cancel booking with status: ${data.status}`);
      }

      await bookingRef.update({
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
        notes: `${data.notes || ''}\nBulk cancelled by admin on ${new Date().toISOString()}.`.trim(),
      });

      // Release availability (best effort)
      const checkInDate = toDate(data.checkInDate);
      const checkOutDate = toDate(data.checkOutDate);
      if (checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
        try {
          await updatePropertyAvailability(data.propertyId, checkInDate, checkOutDate, true);
        } catch (availError) {
          logger.error('Failed to release availability during bulk cancel', availError as Error, { bookingId });
        }
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failCount++;
      logger.warn('Bulk cancel failed for one booking', { reason: result.reason?.message });
    }
  }

  revalidatePath('/admin/bookings');
  logger.info('Bulk cancel completed', { successCount, failCount });

  return { success: failCount === 0, successCount, failCount };
}

export async function bulkCompleteBookings(bookingIds: string[]): Promise<BulkActionResult> {
  const parsed = bulkIdsSchema.safeParse(bookingIds);
  if (!parsed.success) {
    return { success: false, successCount: 0, failCount: bookingIds.length };
  }

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Auth failed for bulkCompleteBookings', { error: error.message });
    }
    return { success: false, successCount: 0, failCount: parsed.data.length };
  }

  const db = await getAdminDb();
  let successCount = 0;
  let failCount = 0;

  const results = await Promise.allSettled(
    parsed.data.map(async (bookingId) => {
      const bookingRef = db.collection('bookings').doc(bookingId);
      const bookingSnap = await bookingRef.get();

      if (!bookingSnap.exists) {
        throw new Error('Booking not found');
      }

      const data = bookingSnap.data() as Booking;

      await requirePropertyAccess(data.propertyId);

      if (data.status !== 'confirmed') {
        throw new Error(`Cannot complete booking with status: ${data.status}`);
      }

      const checkOutDate = toDate(data.checkOutDate);
      if (!checkOutDate || !isPast(checkOutDate)) {
        throw new Error('Cannot complete booking before checkout date');
      }

      await bookingRef.update({
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      });
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      failCount++;
      logger.warn('Bulk complete failed for one booking', { reason: result.reason?.message });
    }
  }

  revalidatePath('/admin/bookings');
  logger.info('Bulk complete completed', { successCount, failCount });

  return { success: failCount === 0, successCount, failCount };
}
