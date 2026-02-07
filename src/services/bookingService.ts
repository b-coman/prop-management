
// src/services/bookingService.ts
'use server';

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp as clientServerTimestamp,
  Timestamp as ClientTimestamp,
  writeBatch as clientWriteBatch,
  setDoc as clientSetDoc,
  QueryConstraint,
  limit,
  documentId,
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import type { Booking, Availability, Property, SerializableTimestamp, CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { differenceInCalendarDays, eachDayOfInterval, format, parse, subDays, startOfMonth, endOfMonth, parseISO, startOfDay } from 'date-fns';

import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { revalidatePath } from 'next/cache'; // Import for revalidating cached data
import { loggers } from '@/lib/logger';

const logger = loggers.booking;

// --- Data Schemas (Keep CreateBookingDataSchema as is) ---
// Adjusted CreateBookingData to match the refined Booking type
export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo' |
  'pricing' | // Pricing is now part of the input data
  'holdUntil' // HoldUntil will be calculated server-side if applicable
> & {
  propertyId: string; // Slug
  checkInDate: string; // ISO string
  checkOutDate: string; // ISO string
  pricing: { // Expect the calculated pricing details
    baseRate: number;
    numberOfNights: number;
    cleaningFee: number;
    extraGuestFee?: number; // Allow optional from input, will be recalculated based on guests
    numberOfExtraGuests?: number; // Allow optional from input, will be recalculated
    accommodationTotal: number;
    subtotal: number;
    taxes?: number;
    discountAmount?: number;
    total: number;
    currency: CurrencyCode;
  };
  paymentInput?: { // Optional for test/simulation flow
    stripePaymentIntentId?: string;
    amount: number;
    status: 'succeeded' | 'paid' | 'pending' | 'failed' | 'unknown';
  };
  appliedCouponCode?: string | null;
  status?: Booking['status']; // Allows setting initial status (e.g., 'pending', 'on-hold')
};

const CreateBookingDataSchema = z.object({
  propertyId: z.string().min(1), // This is the slug
  guestInfo: z.object({
    firstName: z.string().min(1).transform(sanitizeText),
    lastName: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
    email: z.string().email().transform(sanitizeEmail),
    phone: z.string().optional().transform(val => val ? sanitizePhone(val) : ''),
    userId: z.string().optional(), // Allow userId for logged-in users
  }).passthrough(),
  checkInDate: z.string().refine(val => !isNaN(Date.parse(val))),
  checkOutDate: z.string().refine(val => !isNaN(Date.parse(val))),
  numberOfGuests: z.number().int().positive(),
  pricing: z.object({
    baseRate: z.number().nonnegative(),
    numberOfNights: z.number().int().positive(),
    cleaningFee: z.number().nonnegative(),
    extraGuestFee: z.number().nonnegative().optional(),
    numberOfExtraGuests: z.number().int().nonnegative().optional(),
    accommodationTotal: z.number().nonnegative(),
    subtotal: z.number().nonnegative(),
    taxes: z.number().nonnegative().optional(),
    discountAmount: z.number().nonnegative().optional(),
    total: z.number().nonnegative(),
    currency: z.enum(SUPPORTED_CURRENCIES), // Validate currency
  }).passthrough(),
  appliedCouponCode: z.string().nullable().optional().transform(val => val ? sanitizeText(val?.toUpperCase()) : null), // Sanitize and ensure null
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'payment_failed', 'on-hold']).optional(), // Include on-hold
  notes: z.string().optional().transform(val => val ? sanitizeText(val) : ''),
  source: z.string().optional(),
  externalId: z.string().optional(),
  // Fields related to holds/inquiries - Note: holdUntil is calculated server-side
  holdFee: z.number().optional(),
  // holdUntil: z.any().optional(), // Removed - calculated server-side
  holdPaymentId: z.string().optional(),
  convertedFromHold: z.boolean().optional(),
  convertedFromInquiry: z.string().optional(),
  paymentInput: z.object({ // Schema for the simulation paymentInput
      stripePaymentIntentId: z.string().optional(),
      amount: z.number(),
      status: z.enum(['succeeded', 'paid', 'pending', 'failed', 'unknown']),
  }).optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'],
});


// --- updateBookingPaymentInfo (Handles both full payment and hold payment) ---
export async function updateBookingPaymentInfo(
    bookingId: string,
    paymentInfo: Booking['paymentInfo'],
    propertyId: string, // Slug
    paymentCurrency: CurrencyCode,
    isHoldPayment: boolean = false // Flag to differentiate hold payments
): Promise<void> {
    logger.info('updateBookingPaymentInfo called', { bookingId, propertyId, paymentCurrency, isHoldPayment });
    if (!bookingId) throw new Error("Booking ID is required.");
    if (!propertyId) throw new Error("Property ID (slug) is required.");
    if (!paymentInfo || !paymentInfo.stripePaymentIntentId || (paymentInfo.status !== 'paid' && paymentInfo.status !== 'succeeded')) {
        logger.error('Invalid payment info received', undefined, { paymentInfo });
        throw new Error("Valid payment information (status 'paid' or 'succeeded', with intent ID) is required.");
    }

    const bookingRef = doc(db, 'bookings', bookingId);

    try {
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) throw new Error(`Booking with ID ${bookingId} not found.`);

        const bookingData = bookingSnap.data() as Booking;
        if (bookingData.propertyId !== propertyId) {
            logger.error('Property ID mismatch', undefined, { bookingId, expected: bookingData.propertyId, received: propertyId });
            throw new Error("Property ID mismatch between booking and webhook metadata.");
        }

        // Currency check
        if (!isHoldPayment && bookingData.pricing?.currency && bookingData.pricing?.currency !== paymentCurrency) {
             logger.error('Currency mismatch', undefined, { bookingId, bookingCurrency: bookingData.pricing?.currency, paymentCurrency });
              throw new Error("Currency mismatch between booking and payment.");
        }
        if (isHoldPayment && bookingData.holdFee && Math.round(bookingData.holdFee * 100) !== Math.round(paymentInfo.amount * 100)) {
             logger.warn('Hold fee amount mismatch', { bookingId, expected: bookingData.holdFee, paid: paymentInfo.amount });
        }

        // Determine the status update
        const newStatus = isHoldPayment ? 'on-hold' : 'confirmed';
        const updatePayload: Partial<Booking> = {
            status: newStatus,
            updatedAt: clientServerTimestamp(),
        };

        // Update specific payment fields
        if (isHoldPayment) {
            // Validate hold currency if provided
            if (bookingData.pricing?.currency && bookingData.pricing?.currency !== paymentCurrency) {
                logger.error('Currency mismatch for hold', undefined, { bookingId, bookingCurrency: bookingData.pricing?.currency, paymentCurrency });
                throw new Error("Currency mismatch between hold booking and payment.");
            }

            // Set hold payment ID
            updatePayload.holdPaymentId = paymentInfo.stripePaymentIntentId;

            // Update payment info
            updatePayload.paymentInfo = {
                ...bookingData.paymentInfo,
                stripePaymentIntentId: paymentInfo.stripePaymentIntentId,
                amount: paymentInfo.amount,
                status: 'succeeded',
                paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(),
            };

            // Calculate holdUntil date (24 hours from now)
            const holdDurationHours = process.env.HOLD_DURATION_HOURS ? parseInt(process.env.HOLD_DURATION_HOURS) : 24;
            const holdUntilDate = new Date();
            holdUntilDate.setHours(holdUntilDate.getHours() + holdDurationHours);
            updatePayload.holdUntil = ClientTimestamp.fromDate(holdUntilDate);

            logger.debug('Setting hold expiration', { bookingId, holdUntil: holdUntilDate.toISOString(), durationHours: holdDurationHours });
        } else {
            updatePayload.paymentInfo = {
                ...bookingData.paymentInfo,
                ...paymentInfo, // Overwrite with incoming full payment info
                paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(),
            };
        }


        logger.debug('Updating booking status and payment details', { bookingId, newStatus });
        await updateDoc(bookingRef, updatePayload);
        logger.info('Successfully updated booking', { bookingId, status: newStatus });

        const checkInDate = bookingData.checkInDate instanceof ClientTimestamp
            ? bookingData.checkInDate.toDate()
            : bookingData.checkInDate ? parseISO(bookingData.checkInDate as string) : null; // Parse ISO string if needed
        const checkOutDate = bookingData.checkOutDate instanceof ClientTimestamp
            ? bookingData.checkOutDate.toDate()
            : bookingData.checkOutDate ? parseISO(bookingData.checkOutDate as string) : null; // Parse ISO string

        if (checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
             const markAsAvailable = false;
             const holdBookingIdForUpdate = newStatus === 'on-hold' ? bookingId : undefined;

             logger.debug('Triggering availability update', { propertyId, bookingId, status: newStatus });
             try {
                await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, markAsAvailable, holdBookingIdForUpdate);
                logger.info('Availability updated', { propertyId });
             } catch (availabilityError) {
                 logger.error('Failed to update availability', availabilityError as Error, { propertyId, bookingId, status: newStatus });
             }

        } else {
             logger.warn('Missing or invalid check-in/out dates', { bookingId });
        }

    } catch (error) {
        logger.error('Error updating booking', error as Error, { bookingId });
        throw new Error(`Failed to update booking payment info: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- createBooking (Handles confirmed bookings from test/simulation or directly) ---
// IMPORTANT: Ensure this is ONLY called in secure contexts (like after webhook validation or test button)
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   const propertyId = rawBookingData.propertyId; // Slug
   const paymentIntentId = rawBookingData.paymentInput?.stripePaymentIntentId || 'N/A'; // Use optional chaining
   logger.info('createBooking called', { paymentIntentId, propertyId });

   logger.debug('Starting Zod validation', { paymentIntentId });
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     logger.error('Validation error', validationError);
     throw validationError;
   }
   const bookingData = validationResult.data; // Use validated data
   logger.debug('Data passed validation', { paymentIntentId });

  try {
     logger.debug('Transforming data for Firestore', { paymentIntentId });
     const bookingsCollection = collection(db, 'bookings');

     const checkInDate = new Date(bookingData.checkInDate);
     const checkOutDate = new Date(bookingData.checkOutDate);
     const checkInTimestamp = ClientTimestamp.fromDate(checkInDate);
     const checkOutTimestamp = ClientTimestamp.fromDate(checkOutDate);

     let paymentInfo: Booking['paymentInfo'];
      if (bookingData.paymentInput) {
          const paymentInput = bookingData.paymentInput;
          paymentInfo = {
              stripePaymentIntentId: paymentInput.stripePaymentIntentId || `simulated_${Date.now()}`,
              amount: paymentInput.amount, // Amount from paymentInput
              status: paymentInput.status, // Status from paymentInput
              paidAt: (paymentInput.status === 'succeeded' || paymentInput.status === 'paid')
                  ? clientServerTimestamp() // Use server timestamp for paid status
                  : null,
          };
      } else {
           // Default payment info if not provided (e.g., for pending bookings)
           paymentInfo = {
               stripePaymentIntentId: '', // Empty if no payment attempt yet
               amount: bookingData.pricing.total, // Total calculated price
               status: 'pending', // Assume pending if no paymentInput
               paidAt: null,
           };
      }


     const docData: Omit<Booking, 'id'> = {
         propertyId: bookingData.propertyId, // Use slug
         guestInfo: bookingData.guestInfo,
         checkInDate: checkInTimestamp,
         checkOutDate: checkOutTimestamp,
         numberOfGuests: bookingData.numberOfGuests,
         pricing: bookingData.pricing, // Includes currency
         appliedCouponCode: bookingData.appliedCouponCode ?? null,
         status: bookingData.status || 'confirmed', // Default status if not provided
         paymentInfo: paymentInfo, // Use constructed paymentInfo
         notes: bookingData.notes,
         source: bookingData.source || 'unknown', // Set a default source if needed
         externalId: bookingData.externalId,
         holdFee: bookingData.holdFee,
         // holdUntil calculation should ideally happen in createHoldBookingAction
         holdUntil: (bookingData as any).holdUntil ? ClientTimestamp.fromDate(new Date((bookingData as any).holdUntil as any)) : undefined,
         holdPaymentId: bookingData.holdPaymentId,
         convertedFromHold: bookingData.convertedFromHold ?? false,
         convertedFromInquiry: bookingData.convertedFromInquiry ?? null,
         createdAt: clientServerTimestamp(),
         updatedAt: clientServerTimestamp(),
     };

     logger.debug('Adding booking document to Firestore', { paymentIntentId });
     const docRef = await addDoc(bookingsCollection, docData);
     const bookingId = docRef.id;
     logger.info('Booking document created', { bookingId, paymentIntentId });

      // Update availability ONLY if the booking status is 'confirmed' or 'on-hold'
      if (docData.status === 'confirmed' || docData.status === 'on-hold') {
         logger.debug('Triggering availability update', { propertyId, bookingId, status: docData.status });
          const isHold = docData.status === 'on-hold';
          const holdId = isHold ? bookingId : undefined;
         try {
           await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, false, holdId); // Mark as unavailable (potentially with hold ID)
           logger.info('Availability updated', { propertyId, bookingId });
         } catch (availabilityError) {
           logger.error('Failed to update availability', availabilityError as Error, { propertyId, bookingId, source: docData.source });
         }

         // Only sync externally if it's confirmed (not just a hold) and not a simulation
         if (docData.status === 'confirmed' && docData.source !== 'simulation' && docData.source !== 'test-button') {
         }
      }

     logger.info('createBooking completed', { bookingId });
     return bookingId;

   } catch (error) {
      // Avoid masking the specific Zod error message
      if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
          logger.error('Error during booking creation', error as Error, { paymentIntentId });
      }
     // Keep specific Zod errors, otherwise use generic message
     const errorMessage = error instanceof Error ? error.message : `An unexpected error occurred while creating the booking (Ref: ${paymentIntentId}). Please contact support.`;
     throw new Error(errorMessage);
   }
 }

// --- getBookingById ---
export async function getBookingById(bookingId: string): Promise<Booking | null> {
    // console.log(`[getBookingById] Fetching booking with ID: ${bookingId}`);
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Convert Timestamps back
            const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? parseISO(data.checkInDate as string) : null);
            const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? parseISO(data.checkOutDate as string) : null);
            const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? parseISO(data.paymentInfo.paidAt as string) : null);
            const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? parseISO(data.holdUntil as string) : null);
            const createdAt = data.createdAt instanceof ClientTimestamp ? data.createdAt.toDate() : (data.createdAt ? parseISO(data.createdAt as string) : null);
            const updatedAt = data.updatedAt instanceof ClientTimestamp ? data.updatedAt.toDate() : (data.updatedAt ? parseISO(data.updatedAt as string) : null);

            const booking = {
                id: docSnap.id,
                ...data,
                checkInDate,
                checkOutDate,
                paymentInfo: { ...data.paymentInfo, paidAt },
                holdUntil,
                createdAt,
                updatedAt,
                pricing: {
                    ...data.pricing,
                    currency: data.pricing?.currency || 'USD', // Default currency if missing
                },
            } as Booking;
            // console.log(`[getBookingById] Found booking:`, bookingId);
            return booking;
        } else {
            logger.warn('No booking found', { bookingId });
            return null;
        }
    } catch (error) {
        logger.error('Error fetching booking', error as Error, { bookingId });
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- updateBookingStatus ---
export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    logger.info('Updating booking status', { bookingId, status });
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(),
        });
        logger.info('Successfully updated booking status', { bookingId, status });

        // Sync guest record for relevant status changes
        if (status === 'confirmed' || status === 'completed' || status === 'cancelled') {
          try {
            const { upsertGuestFromBooking } = await import('@/services/guestService');
            const bookingForGuest = await getBookingById(bookingId);
            if (bookingForGuest) {
              await upsertGuestFromBooking({ ...bookingForGuest, status });
            }
          } catch (guestError) {
            logger.warn('Non-blocking: failed to sync guest record', { bookingId, error: (guestError as Error).message });
          }
        }

        // Revalidate paths related to bookings
        revalidatePath('/admin/bookings'); // Assuming an admin bookings page
        revalidatePath(`/my-bookings`); // Assuming a user bookings page
        // Revalidate property availability check page if necessary
        const booking = await getBookingById(bookingId);
        if (booking?.propertyId) {
             revalidatePath(`/booking/check/${booking.propertyId}`);
        }


        if (status === 'cancelled') {
          // const booking = await getBookingById(bookingId); // Fetch the full booking details - Already fetched above
          if (booking && booking.checkInDate && booking.checkOutDate) {
             const propertyId = booking.propertyId;
             // Ensure dates are Date objects before passing
             const checkInDate = booking.checkInDate instanceof Date ? booking.checkInDate : null;
             const checkOutDate = booking.checkOutDate instanceof Date ? booking.checkOutDate : null;

             if (checkInDate && checkOutDate && propertyId && isValid(checkInDate) && isValid(checkOutDate)) {
                 logger.debug('Releasing availability for cancelled booking', { bookingId });
                 try {
                     await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, true); // Mark as available
                     logger.info('Availability released for cancelled booking', { bookingId });
                 } catch (availError) {
                      logger.error('Failed to update availability for cancelled booking', availError as Error, { bookingId });
                 }
             } else {
                  logger.warn('Could not update availability after cancellation - missing data', { bookingId });
             }
          } else {
             logger.warn('Could not find booking to update availability after cancellation', { bookingId });
          }
        }

    } catch (error) {
        logger.error('Error updating booking status', error as Error, { bookingId });
        throw new Error(`Failed to update booking status: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- getBookingsForProperty ---
export async function getBookingsForProperty(propertySlug: string): Promise<Booking[]> {
    logger.debug('Fetching bookings for property', { propertySlug });
    const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        const q = query(bookingsCollection, where('propertyId', '==', propertySlug));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
             // Convert Timestamps
             const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? parseISO(data.checkInDate as string) : null);
             const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? parseISO(data.checkOutDate as string) : null);
             const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? parseISO(data.paymentInfo.paidAt as string) : null);
             const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? parseISO(data.holdUntil as string) : null);
             const createdAt = data.createdAt instanceof ClientTimestamp ? data.createdAt.toDate() : (data.createdAt ? parseISO(data.createdAt as string) : null);
             const updatedAt = data.updatedAt instanceof ClientTimestamp ? data.updatedAt.toDate() : (data.updatedAt ? parseISO(data.updatedAt as string) : null);


            bookings.push({
                id: doc.id,
                ...data,
                checkInDate,
                checkOutDate,
                paymentInfo: { ...data.paymentInfo, paidAt },
                holdUntil,
                createdAt,
                updatedAt,
                 pricing: {
                     ...data.pricing,
                     currency: data.pricing?.currency || 'USD',
                 },
            } as Booking);
        });
        logger.debug('Bookings found for property', { propertySlug, count: bookings.length });
        return bookings;
    } catch (error) {
        logger.error('Error fetching bookings for property', error as Error, { propertySlug });
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- getBookingsForUser ---
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
    logger.debug('Fetching bookings for user', { userId });
     const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        // Query using the correct path
        const q = query(bookingsCollection, where('guestInfo.userId', '==', userId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
             const data = doc.data();
             // Convert Timestamps
             const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? parseISO(data.checkInDate as string) : null);
             const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? parseISO(data.checkOutDate as string) : null);
             const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? parseISO(data.paymentInfo.paidAt as string) : null);
             const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? parseISO(data.holdUntil as string) : null);
             const createdAt = data.createdAt instanceof ClientTimestamp ? data.createdAt.toDate() : (data.createdAt ? parseISO(data.createdAt as string) : null);
             const updatedAt = data.updatedAt instanceof ClientTimestamp ? data.updatedAt.toDate() : (data.updatedAt ? parseISO(data.updatedAt as string) : null);

             bookings.push({
                 id: doc.id,
                 ...data,
                 checkInDate,
                 checkOutDate,
                 paymentInfo: { ...data.paymentInfo, paidAt },
                 holdUntil,
                 createdAt,
                 updatedAt,
                 pricing: {
                     ...data.pricing,
                     currency: data.pricing?.currency || 'USD',
                 },
             } as Booking);
        });
        logger.debug('Bookings found for user', { userId, count: bookings.length });
        return bookings;
    } catch (error) {
        logger.error('Error fetching bookings for user', error as Error, { userId });
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Helper function to check if a date is valid
function isValid(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

// --- updatePropertyAvailability (Using CLIENT SDK) ---
/**
 * Updates the availability status for a range of dates for a specific property.
 * Uses the Client SDK.
 *
 * @param propertyId The slug of the property.
 * @param checkInDate The start date of the booking (inclusive).
 * @param checkOutDate The end date of the booking (exclusive).
 * @param available True to mark dates as available (release), false to mark as unavailable (book/hold).
 * @param holdBookingId Optional: If marking as unavailable due to a hold, provide the booking ID.
 */
export async function updatePropertyAvailability(
    propertyId: string, // Slug
    checkInDate: Date,
    checkOutDate: Date,
    available: boolean,
    holdBookingId?: string // ID of the booking if this is for a hold
): Promise<void> {
  const action = available ? 'release' : (holdBookingId ? 'hold' : 'book');
  logger.info('updatePropertyAvailability called', {
    action,
    propertyId,
    checkIn: format(checkInDate, 'yyyy-MM-dd'),
    checkOut: format(subDays(checkOutDate, 1), 'yyyy-MM-dd'),
    holdBookingId
  });

  if (!db) {
    logger.error('Firestore Client SDK not initialized');
    throw new Error("Firestore Client SDK is not initialized.");
  }
  if (!isValid(checkInDate) || !isValid(checkOutDate) || checkOutDate <= checkInDate) {
     logger.warn('Invalid dates provided', { checkInDate, checkOutDate });
     return;
  }

  const start = startOfDay(checkInDate);
  const end = startOfDay(subDays(checkOutDate, 1)); // Availability is stored per booked night
  const datesToUpdate = eachDayOfInterval({ start, end });

  if (datesToUpdate.length === 0) {
       logger.debug('No dates in interval');
       return;
  }

  // Group updates by month (YYYY-MM)
  const updatesByMonth: { [month: string]: { daysToUpdate: { [day: number]: boolean }, holdsToUpdate: { [day: number]: string | null } } } = {};

  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM');
    const dayOfMonth = date.getUTCDate(); // Use UTC day
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = { daysToUpdate: {}, holdsToUpdate: {} };
    }
    updatesByMonth[monthStr].daysToUpdate[dayOfMonth] = available; // Set availability status
    // If marking as unavailable due to a hold, record the hold ID; otherwise, clear any existing hold ID
    updatesByMonth[monthStr].holdsToUpdate[dayOfMonth] = !available && holdBookingId ? holdBookingId : null;
  });

  const batch = clientWriteBatch(db);
  const availabilityCollection = collection(db, 'availability');

  try {
    const monthStrings = Object.keys(updatesByMonth);
    if (monthStrings.length === 0) return;

    const docIdsToFetch = monthStrings.map(monthStr => `${propertyId}_${monthStr}`); // Use slug
    const fetchedDocsMap = new Map<string, Availability>();

    // Fetch existing documents in batches of 30 (Firestore 'in' query limit)
    const idBatches: string[][] = [];
    for (let i = 0; i < docIdsToFetch.length; i += 30) {
        idBatches.push(docIdsToFetch.slice(i, i + 30));
    }
    logger.debug('Fetching existing availability docs', { monthCount: monthStrings.length });
    await Promise.all(idBatches.map(async (batchIds) => {
        if (batchIds.length === 0) return;
        const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(docSnap => {
            if (docSnap.exists()) {
                fetchedDocsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Availability);
            }
        });
    }));
     logger.debug('Fetched existing availability docs', { count: fetchedDocsMap.size });


    // Prepare batch operations
    monthStrings.forEach(monthStr => {
      const availabilityDocId = `${propertyId}_${monthStr}`; // Use slug
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId);
      const { daysToUpdate, holdsToUpdate } = updatesByMonth[monthStr];

      const existingDoc = fetchedDocsMap.get(availabilityDocId);
      const currentAvailableMap = existingDoc?.available || {};
      const currentHoldsMap = existingDoc?.holds || {};

      const updatePayload: { [key: string]: any } = {};
      let needsUpdate = false;

      // Prepare availability updates
      for (const dayStr in daysToUpdate) {
           const day = parseInt(dayStr, 10);
           if (currentAvailableMap[day] !== daysToUpdate[day]) {
               updatePayload[`available.${day}`] = daysToUpdate[day];
               needsUpdate = true;
           }
      }
      // Prepare holds updates
      for (const dayStr in holdsToUpdate) {
           const day = parseInt(dayStr, 10);
           const currentHoldValue = currentHoldsMap[day] || null;
           const newHoldValue = holdsToUpdate[day]; // string or null
           if (currentHoldValue !== newHoldValue) {
                // Update holds map - Firestore handles null deletion
                updatePayload[`holds.${day}`] = newHoldValue;
                needsUpdate = true;
           }
      }


      if (needsUpdate || !existingDoc) {
           updatePayload.updatedAt = clientServerTimestamp(); // Update timestamp only if changes are made or doc is new
           if (existingDoc) {
               batch.update(availabilityDocRef, updatePayload);
           } else {
               const [year, month] = monthStr.split('-').map(Number);
               const daysInMonth = new Date(year, month, 0).getDate(); // Correct way to get days in month
               const initialAvailableMap: { [day: number]: boolean } = {};
               const initialHoldsMap: { [day: number]: string | null } = {}; // Initialize holds map

               for (let day = 1; day <= daysInMonth; day++) {
                   initialAvailableMap[day] = daysToUpdate[day] !== undefined ? daysToUpdate[day] : true; // Default to available
                   if (holdsToUpdate[day] !== undefined) {
                        initialHoldsMap[day] = holdsToUpdate[day];
                   } else {
                       initialHoldsMap[day] = null; // Ensure null for days without a hold
                   }
               }

               const newDocData: Partial<Availability> = {
                   propertyId: propertyId, // Use slug
                   month: monthStr,
                   available: initialAvailableMap,
                   holds: initialHoldsMap, // Include holds map
                   updatedAt: clientServerTimestamp(),
               };
                // Use set with merge: true to create or update
                batch.set(availabilityDocRef, newDocData, { merge: true });
           }
      }
    });

    logger.debug('Committing availability batch', { propertyId, months: monthStrings });
    await batch.commit();
    logger.info('Availability batch committed', { propertyId });

  } catch (error) {
    logger.error('Error during availability batch update', error as Error, { propertyId });
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
        logger.error('Permission denied - check Firestore rules', undefined, { propertyId });
        throw new Error(`Permission denied updating availability for property ${propertyId}. Check Firestore rules.`);
    }
    throw new Error(`Failed to update local property availability using Client SDK: ${errorMessage}`);
  }
}

// --- getUnavailableDatesForProperty ---
export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  logger.info('getUnavailableDatesForProperty called', { propertySlug, monthsToFetch });

  const availabilityCollection = collection(db, 'availability');

  const today = new Date();
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  try {
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      const docId = `${propertySlug}_${monthStr}`;
      monthDocIds.push(docId);
    }

    if (monthDocIds.length === 0) {
      logger.warn('No document IDs to query');
      return [];
    }

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }

    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds, index) => {
          if (batchIds.length === 0) return null; // Return null for empty batches
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
          return getDocs(q);
      })
    );
    logger.debug('Completed Firestore batch queries', { batchCount: allQuerySnapshots.length });

    let docCount = 0;
    const unavailableDates: Date[] = [];

    allQuerySnapshots.forEach((querySnapshot, batchIndex) => {
         if (!querySnapshot) {
           return;
         }

         docCount += querySnapshot.docs.length;

         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;

             // Simple check if docId starts with the correct slug
             if (!docId.startsWith(`${propertySlug}_`)) {
                 return;
             }

            const monthStr = data.month || docId.split('_').slice(1).join('_'); // Get month part

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 return;
             }

             const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
             const month = monthIndex - 1; // JS month is 0-indexed

             // Process 'available' map
             if (data.available && typeof data.available === 'object') {
                 for (const dayStr in data.available) {
                     const day = parseInt(dayStr, 10);
                     if (!isNaN(day) && data.available[day] === false) { // Only add if explicitly marked as unavailable
                         try {
                             const date = new Date(Date.UTC(year, month, day));
                              if (isValid(date) && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                 const todayUtcStart = startOfDay(new Date());
                                 if (date >= todayUtcStart) {
                                     // Check if date already added from 'holds' map
                                     if (!unavailableDates.some(d => d.getTime() === date.getTime())) {
                                          unavailableDates.push(date);
                                     }
                                 }
                              }
                         } catch (dateError) {
                              // Skip invalid dates
                         }
                     }
                 }
             }

            // Process 'holds' map - consider held dates as unavailable
            if (data.holds && typeof data.holds === 'object') {
                 for (const dayStr in data.holds) {
                     if (data.holds[dayStr]) { // If there's a hold ID for this day
                          const day = parseInt(dayStr, 10);
                          if (!isNaN(day)) {
                               try {
                                   const date = new Date(Date.UTC(year, month, day));
                                   if (isValid(date) && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                       const todayUtcStart = startOfDay(new Date());
                                       if (date >= todayUtcStart && !unavailableDates.some(d => d.getTime() === date.getTime())) {
                                           // Add if not already added from 'available' map
                                           unavailableDates.push(date);
                                       }
                                   }
                               } catch (dateError) {
                                   // Skip invalid dates
                               }
                          }
                     }
                 }
            }
        });
    });

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    logger.info('Unavailable dates fetched', { propertySlug, count: unavailableDates.length });

    return unavailableDates;

  } catch (error) {
    logger.error('Error fetching unavailable dates', error as Error, { propertySlug });
    return [];
  }
}

// --- New service for Inquiries (Placeholder) ---
// Removed invalid export * statement
// export * from './inquiryService'; // Assuming inquiry logic is in a separate file
