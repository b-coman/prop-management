// src/app/admin/bookings/actions.ts
"use server";

import { z } from "zod";
import { getAdminDb, Timestamp, FieldValue } from "@/lib/firebaseAdminSafe";
import type { Booking, SerializableTimestamp } from "@/types";
import { updatePropertyAvailability } from '@/services/bookingService';
import { updateAvailabilityAdmin } from '@/lib/availability-admin';

import { revalidatePath } from "next/cache";
import { addHours, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { loggers } from '@/lib/logger';
import { normalizeCountryCode } from '@/lib/country-utils';
import { propertyDateAt, formatBucharestDate, formatBucharestDateTime, iterateBucharestStayDays } from '@/lib/dates/property-times';
import {
  requireAdmin,
  requirePropertyAccess,
  filterBookingsForUser,
  filterPropertiesForUser,
  handleAuthError,
  AuthorizationError
} from '@/lib/authorization';

const logger = loggers.adminBookings;

// Helper to convert Firestore Timestamp or string date to a serializable format (ISO string)
const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
  if (!timestamp) return null;
  if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') return timestamp; // Assume already ISO string
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  // Handle Admin SDK Timestamp-like objects
  if (typeof timestamp === 'object' && '_seconds' in timestamp) {
    return new Date((timestamp as any)._seconds * 1000).toISOString();
  }
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
    // Handle Admin SDK Timestamp-like objects
    if (typeof timestamp === 'object' && '_seconds' in timestamp) {
      return new Date((timestamp as any)._seconds * 1000);
    }
    return null;
};

/**
 * Fetches a single booking by ID with authorization check.
 */
export async function fetchBookingById(bookingId: string): Promise<Booking | null> {
  logger.debug('Fetching booking by ID', { bookingId });

  try {
    await requireAdmin();

    const db = await getAdminDb();
    const bookingSnap = await db.collection('bookings').doc(bookingId).get();

    if (!bookingSnap.exists) {
      return null;
    }

    const data = bookingSnap.data()!;

    // Check authorization for this property
    await requirePropertyAccess(data.propertyId);

    const booking: Booking = {
      id: bookingSnap.id,
      ...data,
      checkInDate: serializeTimestamp(data.checkInDate),
      checkOutDate: serializeTimestamp(data.checkOutDate),
      holdUntil: serializeTimestamp(data.holdUntil),
      bookedAt: serializeTimestamp(data.bookedAt),
      cancelledAt: serializeTimestamp(data.cancelledAt),
      paymentInfo: {
        ...data.paymentInfo,
        paidAt: serializeTimestamp(data.paymentInfo?.paidAt),
      },
      createdAt: serializeTimestamp(data.createdAt),
      updatedAt: serializeTimestamp(data.updatedAt),
    } as Booking;

    logger.info('Booking fetched', { bookingId });
    return booking;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchBookingById', { bookingId, error: error.message });
      return null;
    }
    logger.error('Error fetching booking by ID', error as Error, { bookingId });
    return null;
  }
}

export interface UnavailableDateSets {
  /**
   * Days that are blocked by data WE OWN — confirmed/completed/on-hold bookings, or active
   * holds. These are HARD-DISABLED in both check-in and check-out pickers (can't double-book).
   */
  hard: string[];
  /**
   * Days that are blocked ONLY by an external iCal feed (booking.com, Airbnb, etc.) and not
   * by any of our own bookings/holds. Admin CAN pick these as check-in to manually record
   * the OTA reservation (server will clear the external block on save). But the check-out
   * walk must still treat these as obstacles — your stay can't span over an OTA booking,
   * only end on/before it (back-to-back).
   */
  external: string[];
}

/**
 * Returns Bucharest-local date strings (YYYY-MM-DD) where the property's availability map
 * is unavailable, for use as `disabled` dates in admin date-pickers. Looks at availability
 * docs from the current month forward (12 months by default). Optionally excludes the days
 * occupied by `excludeBookingId` so an edit form doesn't disable its own dates.
 */
export async function fetchUnavailableDateStrings(
  propertyId: string,
  monthsAhead: number = 12,
  excludeBookingId?: string,
): Promise<UnavailableDateSets> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();

    // Build the list of YYYY-MM keys we care about
    const now = new Date();
    const months: string[] = [];
    for (let i = 0; i < monthsAhead; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }

    // Read availability docs AND the bookings collection in parallel.
    // Both are needed: availability.{available,externalBlocks,holds} is the data the iCal sync
    // writes to, while the `bookings` collection has the real reservations our system manages.
    // An iCal-synced reservation that also exists as a real booking (e.g., a booking.com record
    // we've imported / mirrored) must be classified as HARD even though externalBlocks is set.
    const docIds = months.map(m => `${propertyId}_${m}`);
    const [docs, bookingsSnap] = await Promise.all([
      Promise.all(docIds.map(id => db.collection('availability').doc(id).get())),
      db.collection('bookings')
        .where('propertyId', '==', propertyId)
        .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
        .get(),
    ]);

    // Build a Set of Bucharest-local YYYY-MM-DD stay nights covered by any active booking.
    const bookingNights = new Set<string>();
    for (const bDoc of bookingsSnap.docs) {
      if (excludeBookingId && bDoc.id === excludeBookingId) continue;
      const data = bDoc.data();
      const ci = toDate(data.checkInDate);
      const co = toDate(data.checkOutDate);
      if (!ci || !co) continue;
      for (const { year, month, day } of iterateBucharestStayDays(ci, co)) {
        bookingNights.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }

    // Classify each unavailable day:
    //   - hard: backed by an active booking we own, a hold, or unexplained (conservative)
    //   - external: blocked ONLY by an iCal feed AND no booking covers it
    //     (admin can override by recording the OTA reservation; server clears the external block on save)
    const hard: string[] = [];
    const external: string[] = [];
    for (const doc of docs) {
      if (!doc.exists) continue;
      const data = doc.data()!;
      const month = doc.id.substring(propertyId.length + 1); // YYYY-MM
      const available = (data.available || {}) as Record<string, boolean>;
      const externalBlocks = (data.externalBlocks || {}) as Record<string, string | null>;
      const holds = (data.holds || {}) as Record<string, string | null>;
      for (const [dayStr, isAvailable] of Object.entries(available)) {
        if (isAvailable !== false) continue;
        const ymd = `${month}-${dayStr.padStart(2, '0')}`;
        const hasHold = !!holds[dayStr];
        const hasExternal = !!externalBlocks[dayStr];
        const hasBooking = bookingNights.has(ymd);
        // External only counts as "soft" if there's no booking and no hold backing it.
        if (hasExternal && !hasHold && !hasBooking) {
          external.push(ymd);
        } else {
          hard.push(ymd);
        }
      }
    }

    // Exclude the booking's own days so an edit can shift them
    if (excludeBookingId) {
      const bookingDoc = await db.collection('bookings').doc(excludeBookingId).get();
      if (bookingDoc.exists) {
        const data = bookingDoc.data()!;
        const ci = toDate(data.checkInDate);
        const co = toDate(data.checkOutDate);
        if (ci && co) {
          const ownDays = new Set<string>();
          // Walk the booking's Bucharest-local stay days
          const startStr = formatBucharestDate(ci);
          const endStr = formatBucharestDate(co);
          let cur = new Date(`${startStr}T12:00:00Z`);
          while (formatBucharestDate(cur) < endStr) {
            ownDays.add(formatBucharestDate(cur));
            cur = new Date(cur.getTime() + 86400000);
          }
          return {
            hard: hard.filter(d => !ownDays.has(d)),
            external: external.filter(d => !ownDays.has(d)),
          };
        }
      }
    }

    return { hard, external };
  } catch (error) {
    if (error instanceof AuthorizationError) return { hard: [], external: [] };
    logger.error('Error fetching unavailable dates', error as Error, { propertyId });
    return { hard: [], external: [] };
  }
}

/**
 * Fetches all bookings from the Firestore collection, ordered by creation date.
 * Filters results based on user's property access.
 * @returns A promise that resolves to an array of Booking objects with serialized dates.
 */
export async function fetchBookings(): Promise<Booking[]> {
  logger.debug('Fetching bookings');

  try {
    // Check authorization first
    const user = await requireAdmin();

    const db = await getAdminDb();
    const bookingsSnapshot = await db.collection('bookings')
      .orderBy('createdAt', 'desc')
      .get();

    const bookings: Booking[] = [];
    bookingsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Serialize Timestamps for client components
      bookings.push({
        id: docSnap.id,
        ...data,
        checkInDate: serializeTimestamp(data.checkInDate),
        checkOutDate: serializeTimestamp(data.checkOutDate),
        holdUntil: serializeTimestamp(data.holdUntil),
        bookedAt: serializeTimestamp(data.bookedAt),
        cancelledAt: serializeTimestamp(data.cancelledAt),
        paymentInfo: {
            ...data.paymentInfo,
            paidAt: serializeTimestamp(data.paymentInfo?.paidAt),
        },
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
      } as Booking);
    });

    // Filter bookings based on user access
    const filteredBookings = filterBookingsForUser(bookings, user);
    logger.info('Bookings fetched', { count: filteredBookings.length, total: bookings.length, role: user.role });
    return filteredBookings;
  } catch (error) {
    if (error instanceof AuthorizationError) {
      logger.warn('Authorization failed for fetchBookings', { error: error.message });
      return [];
    }
    logger.error('Error fetching bookings', error as Error);
    return [];
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

    try {
        const db = await getAdminDb();
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();

        if (!bookingSnap.exists) {
            return { success: false, error: "Booking not found." };
        }

        const bookingData = bookingSnap.data() as Booking;

        // Check authorization for this property
        await requirePropertyAccess(bookingData.propertyId);

        logger.info('Extending hold', { bookingId, hoursToAdd });

        if (bookingData.status !== 'on-hold') {
             return { success: false, error: "Booking is not currently on hold." };
        }

        const currentHoldUntil = toDate(bookingData.holdUntil);
        if (!currentHoldUntil) {
            return { success: false, error: "Booking does not have a valid hold expiry date." };
        }

        const newHoldUntil = addHours(currentHoldUntil, hoursToAdd);
        const newHoldUntilTimestamp = Timestamp.fromDate(newHoldUntil);

        await bookingRef.update({
            holdUntil: newHoldUntilTimestamp,
            updatedAt: FieldValue.serverTimestamp(),
            notes: `${bookingData.notes || ''}\nHold extended by admin by ${hoursToAdd} hours on ${new Date().toISOString()}.`.trim(),
        });

        revalidatePath('/admin/bookings');
        logger.info('Hold extended successfully', { bookingId, newHoldUntil: newHoldUntil.toISOString() });
        return { success: true, newHoldUntil: newHoldUntil.toISOString() };

    } catch (error) {
        if (error instanceof AuthorizationError) {
            return handleAuthError(error);
        }
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

    try {
        const db = await getAdminDb();
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();

        if (!bookingSnap.exists) return { success: false, error: "Booking not found." };

        const bookingData = bookingSnap.data() as Booking;

        // Check authorization for this property
        await requirePropertyAccess(bookingData.propertyId);

        logger.info('Cancelling hold', { bookingId });

        if (bookingData.status !== 'on-hold') return { success: false, error: "Booking is not on hold." };

        const checkInDate = toDate(bookingData.checkInDate);
        const checkOutDate = toDate(bookingData.checkOutDate);
        const propertyId = bookingData.propertyId;

        if (!checkInDate || !checkOutDate || !propertyId || !isValid(checkInDate) || !isValid(checkOutDate)) {
             logger.warn('Missing or invalid data to release availability', { bookingId });
             // Proceed with cancellation but log warning
        }

        const batch = db.batch();

        // Update booking status
        batch.update(bookingRef, {
            status: 'cancelled',
            updatedAt: FieldValue.serverTimestamp(),
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
                logger.info('Availability released', { bookingId });
            } catch (availError) {
                 logger.error('Failed to release/sync availability', availError as Error, { bookingId });
                 // Log the error, but the booking status is already cancelled.
            }
        }

        // Housekeeping WhatsApp notification (non-blocking)
        try {
            const { sendChangeNotification } = await import('@/services/housekeepingService');
            await sendChangeNotification(propertyId, bookingId, 'cancelled');
        } catch (hkErr) {
            logger.warn('Housekeeping notification failed (non-blocking)', { bookingId, error: hkErr instanceof Error ? hkErr.message : String(hkErr) });
        }

        return { success: true };

    } catch (error) {
        if (error instanceof AuthorizationError) {
            return handleAuthError(error);
        }
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

    try {
        const db = await getAdminDb();
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingSnap = await bookingRef.get();

        if (!bookingSnap.exists) return { success: false, error: "Booking not found." };

        const bookingData = bookingSnap.data() as Booking;

        // Check authorization for this property
        await requirePropertyAccess(bookingData.propertyId);

        logger.info('Converting hold to confirmed booking', { bookingId });

        if (bookingData.status !== 'on-hold') return { success: false, error: "Booking is not on hold." };

        // Update status to confirmed
        await bookingRef.update({
            status: 'confirmed',
            convertedFromHold: true, // Mark as converted
            updatedAt: FieldValue.serverTimestamp(),
            notes: `${bookingData.notes || ''}\nHold converted to confirmed booking by admin on ${new Date().toISOString()}. Payment assumed handled.`.trim(),
        });

        logger.info('Hold converted to confirmed', { bookingId });
        revalidatePath('/admin/bookings');

        // Ensure availability remains blocked (it should already be blocked from the hold)
        // No availability update needed here, just ensure sync if necessary
        const checkInDate = toDate(bookingData.checkInDate);
        const checkOutDate = toDate(bookingData.checkOutDate);
        const propertyId = bookingData.propertyId;

        return { success: true };

    } catch (error) {
        if (error instanceof AuthorizationError) {
            return handleAuthError(error);
        }
        logger.error('Error converting hold', error as Error, { bookingId });
        return { success: false, error: `Failed to convert hold: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
}

// ===================================================================
// External Booking Management
// ===================================================================

/**
 * Fetches properties list for the booking form (id, name, currency).
 */
export async function fetchPropertiesForBookingForm(): Promise<Array<{ id: string; name: string; currency: string }>> {
  try {
    const user = await requireAdmin();
    const db = await getAdminDb();
    const snapshot = await db.collection('properties').where('status', '==', 'active').get();

    const all = snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data().name?.en || doc.data().name || doc.id) as string,
      currency: (doc.data().baseCurrency || 'RON') as string,
      propertyId: doc.id,
    }));

    const filtered = filterPropertiesForUser(all, user);
    return filtered.map(({ id, name, currency }) => ({ id, name, currency }));
  } catch (error) {
    logger.error('Error fetching properties for booking form', error as Error);
    return [];
  }
}

const externalBookingSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  source: z.string().min(1, 'Source is required'),
  externalId: z.string().optional(),
  checkInDate: z.string().min(1, 'Check-in date is required'),
  checkOutDate: z.string().min(1, 'Check-out date is required'),
  bookedAt: z.string().optional(),
  numberOfGuests: z.coerce.number().int().min(1).default(1),
  numberOfAdults: z.coerce.number().int().min(1).optional(),
  numberOfChildren: z.coerce.number().int().min(0).optional(),
  netPayout: z.coerce.number().min(0, 'Net payout must be 0 or more'),
  currency: z.string().min(1),
  language: z.string().min(1).default('en'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional()
    .transform(v => v ? v.replace(/\uFF0B/g, '+').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/[\s()\-./]/g, '') : v)
    .refine(v => !v || /^\+\d{7,15}$/.test(v), { message: 'Phone must start with + and country code' }),
  country: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Creates a new external booking (Airbnb, Booking.com, etc).
 */
export async function createExternalBookingAction(
  values: z.infer<typeof externalBookingSchema>
): Promise<{ success: boolean; error?: string; bookingId?: string }> {
  const validation = externalBookingSchema.safeParse(values);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return { success: false, error: firstError?.message || 'Invalid input.' };
  }

  const data = validation.data;

  try {
    await requireAdmin();
    await requirePropertyAccess(data.propertyId);

    const db = await getAdminDb();

    // Load property to apply its check-in / check-out times to the date inputs.
    // This produces real-time Timestamps (e.g. 14:00 / 11:00 Bucharest) instead of midnight,
    // eliminating the cross-convention overlap bug in checkAvailabilityForDates.
    const propertyDoc = await db.collection('properties').doc(data.propertyId).get();
    const property = propertyDoc.exists ? propertyDoc.data() : null;

    let checkIn: Date;
    let checkOut: Date;
    try {
      checkIn = propertyDateAt(property, data.checkInDate, 'checkin');
      checkOut = propertyDateAt(property, data.checkOutDate, 'checkout');
    } catch {
      return { success: false, error: 'Check-in / check-out dates must be YYYY-MM-DD.' };
    }
    if (!isValid(checkIn) || !isValid(checkOut) || checkOut <= checkIn) {
      return { success: false, error: 'Check-out must be after check-in.' };
    }

    const numberOfNights = differenceInCalendarDays(checkOut, checkIn);
    if (numberOfNights < 1) {
      return { success: false, error: 'Stay must be at least 1 night.' };
    }

    // Check availability (excluding external blocks which we'll override)
    const conflict = await checkAvailabilityForDates(db, data.propertyId, checkIn, checkOut);
    if (conflict) {
      return { success: false, error: conflict };
    }

    const bookedAt = data.bookedAt ? parseISO(data.bookedAt) : new Date();
    const now = new Date();

    const bookingDoc: Record<string, any> = {
      propertyId: data.propertyId,
      source: data.source,
      externalId: data.externalId || null,
      imported: false,
      status: 'confirmed',
      guestInfo: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        country: data.country ? normalizeCountryCode(data.country) || data.country : null,
      },
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests: data.numberOfGuests,
      numberOfAdults: data.numberOfAdults || data.numberOfGuests,
      numberOfChildren: data.numberOfChildren || 0,
      pricing: {
        baseRate: data.netPayout / numberOfNights,
        numberOfNights,
        cleaningFee: 0,
        accommodationTotal: data.netPayout,
        subtotal: data.netPayout,
        discountAmount: 0,
        total: data.netPayout,
        currency: data.currency,
      },
      paymentInfo: {
        amount: data.netPayout,
        status: 'succeeded' as const,
        paidAt: Timestamp.fromDate(bookedAt),
      },
      language: data.language || 'en',
      notes: data.notes || null,
      bookedAt: Timestamp.fromDate(bookedAt),
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
    };

    const docRef = await db.collection('bookings').add(bookingDoc);
    const bookingId = docRef.id;
    logger.info('Created external booking', { bookingId, source: data.source, propertyId: data.propertyId });

    // Block availability + clear external blocks
    await updateAvailabilityAdmin(data.propertyId, checkIn, checkOut, false, { clearExternalBlocks: true });

    // Upsert guest (non-blocking)
    try {
      const { upsertGuestFromBooking } = await import('@/services/guestService');
      await upsertGuestFromBooking({ id: bookingId, ...bookingDoc } as Booking);
    } catch (guestErr) {
      logger.warn('Guest upsert failed (non-blocking)', { bookingId, error: guestErr instanceof Error ? guestErr.message : String(guestErr) });
    }

    // Housekeeping notification (non-blocking, future bookings only)
    if (checkIn > now) {
      try {
        const { sendChangeNotification } = await import('@/services/housekeepingService');
        await sendChangeNotification(data.propertyId, bookingId, 'new');
      } catch (hkErr) {
        logger.warn('Housekeeping notification failed (non-blocking)', { bookingId, error: hkErr instanceof Error ? hkErr.message : String(hkErr) });
      }
    }

    revalidatePath('/admin/bookings');
    revalidatePath('/admin/calendar');
    return { success: true, bookingId };

  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    logger.error('Error creating external booking', error as Error);
    return { success: false, error: `Failed to create booking: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

const editBookingSchema = z.object({
  bookingId: z.string().min(1),
  propertyId: z.string().min(1),
  source: z.string().min(1),
  externalId: z.string().optional(),
  checkInDate: z.string().min(1),
  checkOutDate: z.string().min(1),
  bookedAt: z.string().optional(),
  numberOfGuests: z.coerce.number().int().min(1).default(1),
  numberOfAdults: z.coerce.number().int().min(1).optional(),
  numberOfChildren: z.coerce.number().int().min(0).optional(),
  netPayout: z.coerce.number().min(0),
  currency: z.string().min(1),
  language: z.string().min(1).default('en'),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional()
    .transform(v => v ? v.replace(/\uFF0B/g, '+').replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').replace(/[\s()\-./]/g, '') : v)
    .refine(v => !v || /^\+\d{7,15}$/.test(v), { message: 'Phone must start with + and country code' }),
  country: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Edits an existing booking's details.
 */
export async function editBookingAction(
  values: z.infer<typeof editBookingSchema>
): Promise<{ success: boolean; error?: string }> {
  const validation = editBookingSchema.safeParse(values);
  if (!validation.success) {
    const firstError = validation.error.errors[0];
    return { success: false, error: firstError?.message || 'Invalid input.' };
  }

  const data = validation.data;

  try {
    await requireAdmin();
    await requirePropertyAccess(data.propertyId);

    const db = await getAdminDb();
    const bookingRef = db.collection('bookings').doc(data.bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const existing = bookingSnap.data()!;

    // Apply property check-in / check-out times to the date inputs (real-time storage).
    const propertyDoc = await db.collection('properties').doc(data.propertyId).get();
    const property = propertyDoc.exists ? propertyDoc.data() : null;
    let newCheckIn: Date;
    let newCheckOut: Date;
    try {
      newCheckIn = propertyDateAt(property, data.checkInDate, 'checkin');
      newCheckOut = propertyDateAt(property, data.checkOutDate, 'checkout');
    } catch {
      return { success: false, error: 'Check-in / check-out dates must be YYYY-MM-DD.' };
    }
    if (!isValid(newCheckIn) || !isValid(newCheckOut) || newCheckOut <= newCheckIn) {
      return { success: false, error: 'Check-out must be after check-in.' };
    }

    const numberOfNights = differenceInCalendarDays(newCheckOut, newCheckIn);

    // Detect date changes
    const oldCheckIn = toDate(existing.checkInDate);
    const oldCheckOut = toDate(existing.checkOutDate);
    const datesChanged = oldCheckIn && oldCheckOut &&
      (oldCheckIn.getTime() !== newCheckIn.getTime() || oldCheckOut.getTime() !== newCheckOut.getTime());

    if (datesChanged && oldCheckIn && oldCheckOut) {
      // Check availability for new dates (excluding current booking's dates)
      const conflict = await checkAvailabilityForDates(db, data.propertyId, newCheckIn, newCheckOut, data.bookingId);
      if (conflict) {
        return { success: false, error: conflict };
      }

      // Release old dates
      await updateAvailabilityAdmin(data.propertyId, oldCheckIn, oldCheckOut, true);
      // Block new dates + clear external blocks
      await updateAvailabilityAdmin(data.propertyId, newCheckIn, newCheckOut, false, { clearExternalBlocks: true });
    }

    const bookedAt = data.bookedAt ? parseISO(data.bookedAt) : undefined;

    const updateData: Record<string, any> = {
      source: data.source,
      externalId: data.externalId || null,
      checkInDate: Timestamp.fromDate(newCheckIn),
      checkOutDate: Timestamp.fromDate(newCheckOut),
      numberOfGuests: data.numberOfGuests,
      numberOfAdults: data.numberOfAdults || data.numberOfGuests,
      numberOfChildren: data.numberOfChildren || 0,
      // Use dot notation to preserve existing guestInfo fields (userId, address, etc.)
      'guestInfo.firstName': data.firstName,
      'guestInfo.lastName': data.lastName || null,
      'guestInfo.email': data.email || null,
      'guestInfo.phone': data.phone || null,
      'guestInfo.country': data.country ? normalizeCountryCode(data.country) || data.country : null,
      // Use dot notation for pricing to preserve fields we don't manage (extraGuestFee, taxes, etc.)
      'pricing.baseRate': data.netPayout / numberOfNights,
      'pricing.numberOfNights': numberOfNights,
      'pricing.accommodationTotal': data.netPayout,
      'pricing.subtotal': data.netPayout,
      'pricing.total': data.netPayout,
      'pricing.currency': data.currency,
      'paymentInfo.amount': data.netPayout,
      language: data.language || 'en',
      notes: data.notes || null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (bookedAt && isValid(bookedAt)) {
      updateData.bookedAt = Timestamp.fromDate(bookedAt);
    }

    await bookingRef.update(updateData);
    logger.info('Updated booking', { bookingId: data.bookingId });

    // Note: we do NOT re-upsert the guest here because upsertGuestFromBooking
    // increments totalBookings/totalSpent, which would double-count on edit.
    // Guest was already created when the booking was first created.

    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${data.bookingId}`);
    revalidatePath('/admin/calendar');
    return { success: true };

  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    logger.error('Error editing booking', error as Error, { bookingId: data.bookingId });
    return { success: false, error: `Failed to edit booking: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  cancelledAt: z.string().optional(),
});

/**
 * Cancels a confirmed/completed booking, releasing availability.
 */
export async function cancelBookingAction(
  values: z.infer<typeof cancelBookingSchema>
): Promise<{ success: boolean; error?: string }> {
  const validation = cancelBookingSchema.safeParse(values);
  if (!validation.success) {
    return { success: false, error: 'Invalid input.' };
  }

  const { bookingId, cancelledAt: cancelledAtStr } = validation.data;

  try {
    await requireAdmin();

    const db = await getAdminDb();
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return { success: false, error: 'Booking not found.' };
    }

    const bookingData = bookingSnap.data()!;
    await requirePropertyAccess(bookingData.propertyId);

    if (!['confirmed', 'completed'].includes(bookingData.status)) {
      return { success: false, error: `Cannot cancel a booking with status "${bookingData.status}".` };
    }

    const cancelledAt = cancelledAtStr ? parseISO(cancelledAtStr) : new Date();
    const now = new Date();

    await bookingRef.update({
      status: 'cancelled',
      cancelledAt: Timestamp.fromDate(isValid(cancelledAt) ? cancelledAt : now),
      updatedAt: FieldValue.serverTimestamp(),
      notes: `${bookingData.notes || ''}\nCancelled by admin on ${now.toISOString()}.`.trim(),
    });

    logger.info('Booking cancelled', { bookingId });

    // Release availability
    const checkInDate = toDate(bookingData.checkInDate);
    const checkOutDate = toDate(bookingData.checkOutDate);
    const propertyId = bookingData.propertyId;

    if (checkInDate && checkOutDate && propertyId && isValid(checkInDate) && isValid(checkOutDate)) {
      try {
        await updateAvailabilityAdmin(propertyId, checkInDate, checkOutDate, true);
        logger.info('Availability released for cancelled booking', { bookingId });
      } catch (availErr) {
        logger.error('Failed to release availability', availErr as Error, { bookingId });
      }
    }

    // Reverse guest aggregates (non-blocking)
    try {
      const { findGuestByEmail, findGuestByPhone } = await import('@/services/guestService');
      const email = bookingData.guestInfo?.email?.toLowerCase().trim();
      const phone = bookingData.guestInfo?.phone;
      let guest = email ? await findGuestByEmail(email) : null;
      if (!guest && phone) guest = await findGuestByPhone(phone);

      if (guest) {
        const total = bookingData.pricing?.total || 0;
        await db.collection('guests').doc(guest.id).update({
          totalBookings: FieldValue.increment(-1),
          totalSpent: FieldValue.increment(-total),
          bookingIds: FieldValue.arrayRemove(bookingId),
          updatedAt: FieldValue.serverTimestamp(),
        });
        logger.info('Guest aggregates reversed for cancellation', { guestId: guest.id, bookingId });
      }
    } catch (guestErr) {
      logger.warn('Guest aggregate reversal failed (non-blocking)', { bookingId });
    }

    // Housekeeping notification (non-blocking)
    if (propertyId) {
      try {
        const { sendChangeNotification } = await import('@/services/housekeepingService');
        await sendChangeNotification(propertyId, bookingId, 'cancelled');
      } catch (hkErr) {
        logger.warn('Housekeeping notification failed (non-blocking)', { bookingId, error: hkErr instanceof Error ? hkErr.message : String(hkErr) });
      }
    }

    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${bookingId}`);
    revalidatePath('/admin/calendar');
    revalidatePath('/admin/guests');
    return { success: true };

  } catch (error) {
    if (error instanceof AuthorizationError) {
      return handleAuthError(error);
    }
    logger.error('Error cancelling booking', error as Error, { bookingId });
    return { success: false, error: `Failed to cancel booking: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Check if dates are available for a property.
 * Queries the bookings collection directly for overlapping confirmed/completed bookings
 * (more reliable than availability map which can have stale external blocks alongside real bookings).
 */
async function checkAvailabilityForDates(
  db: FirebaseFirestore.Firestore,
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
): Promise<string | null> {
  // Query for overlapping confirmed/completed bookings on this property
  const snapshot = await db.collection('bookings')
    .where('propertyId', '==', propertyId)
    .where('status', 'in', ['confirmed', 'completed', 'on-hold'])
    .get();

  for (const doc of snapshot.docs) {
    if (excludeBookingId && doc.id === excludeBookingId) continue;

    const data = doc.data();
    const existingCheckIn = toDate(data.checkInDate);
    const existingCheckOut = toDate(data.checkOutDate);
    if (!existingCheckIn || !existingCheckOut) continue;

    // Compare Bucharest-local calendar dates (NOT absolute timestamps). This is convention-
    // agnostic: works for both real-time-stored bookings and legacy midnight bookings, where
    // strict `<`/`>` on Date objects would misfire across storage conventions.
    const newInStr = formatBucharestDate(checkIn);
    const newOutStr = formatBucharestDate(checkOut);
    const existingInStr = formatBucharestDate(existingCheckIn);
    const existingOutStr = formatBucharestDate(existingCheckOut);
    if (newInStr < existingOutStr && newOutStr > existingInStr) {
      const guestName = [data.guestInfo?.firstName, data.guestInfo?.lastName].filter(Boolean).join(' ') || doc.id.substring(0, 8);
      const inStr = formatBucharestDateTime(existingCheckIn, 'PP');
      const outStr = formatBucharestDateTime(existingCheckOut, 'PP');
      return `Dates overlap with existing booking (${guestName}, ${inStr} - ${outStr}).`;
    }
  }

  return null; // No conflicts
}
