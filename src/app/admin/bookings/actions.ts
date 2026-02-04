// src/app/admin/bookings/actions.ts
"use server";

import { z } from "zod";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp, updateDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Booking, SerializableTimestamp } from "@/types";
import { updatePropertyAvailability, triggerExternalSyncForDateUpdate } from '@/services/bookingService'; // Assuming these exist and handle availability/sync
import { revalidatePath } from "next/cache";
import { addHours, parseISO, isValid } from 'date-fns';
import { loggers } from '@/lib/logger';

const logger = loggers.adminBookings;

// Helper to convert Firestore Timestamp or string date to a serializable format (ISO string)
const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') return timestamp; // Assume already ISO string
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  return null;
};

// Helper to convert serializable format back to Date or null
const toDate = (timestamp: SerializableTimestamp | undefined | null): Date | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Date) return timestamp;
    if (timestamp instanceof Timestamp) return timestamp.toDate();
    if (typeof timestamp === 'string') {
        try { return parseISO(timestamp); } catch { return null; }
    }
    if (typeof timestamp === 'number') return new Date(timestamp);
    return null;
};

/**
 * Fetches all bookings from the Firestore collection, ordered by creation date.
 * @returns A promise that resolves to an array of Booking objects with serialized dates.
 */
export async function fetchBookings(): Promise<Booking[]> {
  logger.debug('Fetching all bookings');
  const bookings: Booking[] = [];
  try {
    const bookingsCollection = collection(db, 'bookings');
    const q = query(bookingsCollection, orderBy("createdAt", "desc")); // Order by creation date
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Serialize Timestamps for client components
      bookings.push({
        id: docSnap.id,
        ...data,
        checkInDate: serializeTimestamp(data.checkInDate),
        checkOutDate: serializeTimestamp(data.checkOutDate),
        holdUntil: serializeTimestamp(data.holdUntil),
        paymentInfo: {
            ...data.paymentInfo,
            paidAt: serializeTimestamp(data.paymentInfo?.paidAt),
        },
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      } as Booking);
    });
    logger.info('Bookings fetched', { count: bookings.length });
    return bookings;
  } catch (error) {
    logger.error('Error fetching bookings', error as Error);
    return []; // Return empty array on error
  }
}


/**
 * Extends the hold period for a specific booking.
 */
const extendHoldSchema = z.object({
    bookingId: z.string().min(1),
    hoursToAdd: z.coerce.number().int().positive("Hours must be a positive number."),
});

export async function extendBookingHoldAction(
  values: z.infer<typeof extendHoldSchema>
): Promise<{ success: boolean; error?: string; newHoldUntil?: string }> {
    const validation = extendHoldSchema.safeParse(values);
    if (!validation.success) {
        return { success: false, error: "Invalid input." };
    }

    const { bookingId, hoursToAdd } = validation.data;
    logger.info('Extending hold', { bookingId, hoursToAdd });

    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
            return { success: false, error: "Booking not found." };
        }
        const bookingData = bookingSnap.data() as Booking;
        if (bookingData.status !== 'on-hold') {
             return { success: false, error: "Booking is not currently on hold." };
        }

        const currentHoldUntil = toDate(bookingData.holdUntil);
        if (!currentHoldUntil) {
            return { success: false, error: "Booking does not have a valid hold expiry date." };
        }

        const newHoldUntil = addHours(currentHoldUntil, hoursToAdd);
        const newHoldUntilTimestamp = Timestamp.fromDate(newHoldUntil);

        await updateDoc(bookingRef, {
            holdUntil: newHoldUntilTimestamp,
            updatedAt: serverTimestamp(),
            notes: `${bookingData.notes || ''}\nHold extended by admin by ${hoursToAdd} hours on ${new Date().toISOString()}.`.trim(),
        });

        revalidatePath('/admin/bookings');
        logger.info('Hold extended successfully', { bookingId, newHoldUntil: newHoldUntil.toISOString() });
        return { success: true, newHoldUntil: newHoldUntil.toISOString() };

    } catch (error) {
         logger.error('Error extending hold', error as Error, { bookingId });
         return { success: false, error: `Failed to extend hold: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}


/**
 * Cancels a booking hold, releasing availability.
 */
const cancelHoldSchema = z.object({
    bookingId: z.string().min(1),
});

export async function cancelBookingHoldAction(
    values: z.infer<typeof cancelHoldSchema>
): Promise<{ success: boolean; error?: string }> {
    const validation = cancelHoldSchema.safeParse(values);
    if (!validation.success) return { success: false, error: "Invalid input." };

    const { bookingId } = validation.data;
    logger.info('Cancelling hold', { bookingId });

    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) return { success: false, error: "Booking not found." };

        const bookingData = bookingSnap.data() as Booking;
        if (bookingData.status !== 'on-hold') return { success: false, error: "Booking is not on hold." };

        const checkInDate = toDate(bookingData.checkInDate);
        const checkOutDate = toDate(bookingData.checkOutDate);
        const propertyId = bookingData.propertyId;

        if (!checkInDate || !checkOutDate || !propertyId || !isValid(checkInDate) || !isValid(checkOutDate)) {
             logger.warn('Missing or invalid data to release availability', { bookingId });
             // Proceed with cancellation but log warning
        }

        const batch = writeBatch(db);

        // Update booking status
        batch.update(bookingRef, {
            status: 'cancelled',
            updatedAt: serverTimestamp(),
            notes: `${bookingData.notes || ''}\nHold cancelled by admin on ${new Date().toISOString()}.`.trim(),
        });

        // Commit Firestore batch first
        await batch.commit();
        logger.info('Booking status updated to cancelled', { bookingId });
        revalidatePath('/admin/bookings');

        // Release availability (best effort after status update)
        if (checkInDate && checkOutDate && propertyId && isValid(checkInDate) && isValid(checkOutDate)) {
            try {
                logger.debug('Releasing availability for cancelled hold', { bookingId });
                await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, true); // Mark as available
                await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, true); // Sync release
                logger.info('Availability released and synced', { bookingId });
            } catch (availError) {
                 logger.error('Failed to release/sync availability', availError as Error, { bookingId });
                 // Log the error, but the booking status is already cancelled.
            }
        }

        return { success: true };

    } catch (error) {
         logger.error('Error cancelling hold', error as Error, { bookingId });
         return { success: false, error: `Failed to cancel hold: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

/**
 * Manually converts an 'on-hold' booking to 'confirmed'.
 * Note: This doesn't handle payment collection. Assumes payment is handled separately.
 */
const convertHoldSchema = z.object({
    bookingId: z.string().min(1),
});

export async function convertHoldToBookingAction(
    values: z.infer<typeof convertHoldSchema>
): Promise<{ success: boolean; error?: string }> {
    const validation = convertHoldSchema.safeParse(values);
    if (!validation.success) return { success: false, error: "Invalid input." };

    const { bookingId } = validation.data;
    logger.info('Converting hold to confirmed booking', { bookingId });

    try {
         const bookingRef = doc(db, 'bookings', bookingId);
         const bookingSnap = await getDoc(bookingRef);

         if (!bookingSnap.exists()) return { success: false, error: "Booking not found." };

         const bookingData = bookingSnap.data() as Booking;
         if (bookingData.status !== 'on-hold') return { success: false, error: "Booking is not on hold." };

         // Update status to confirmed
         await updateDoc(bookingRef, {
             status: 'confirmed',
             convertedFromHold: true, // Mark as converted
             updatedAt: serverTimestamp(),
             notes: `${bookingData.notes || ''}\nHold converted to confirmed booking by admin on ${new Date().toISOString()}. Payment assumed handled.`.trim(),
         });

         logger.info('Hold converted to confirmed', { bookingId });
         revalidatePath('/admin/bookings');

         // Ensure availability remains blocked (it should already be blocked from the hold)
         // No availability update needed here, just ensure sync if necessary
         const checkInDate = toDate(bookingData.checkInDate);
         const checkOutDate = toDate(bookingData.checkOutDate);
         const propertyId = bookingData.propertyId;

          if (checkInDate && checkOutDate && propertyId && isValid(checkInDate) && isValid(checkOutDate)) {
            try {
                logger.debug('Triggering external sync for confirmed booking', { bookingId });
                await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, false); // Ensure blocked
            } catch (syncError) {
                 logger.error('Failed to sync externally', syncError as Error, { bookingId });
            }
          }

         return { success: true };

    } catch (error) {
         logger.error('Error converting hold', error as Error, { bookingId });
         return { success: false, error: `Failed to convert hold: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}