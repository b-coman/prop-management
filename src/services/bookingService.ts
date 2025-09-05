
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
import { updateAirbnbListingAvailability, updateBookingComListingAvailability, getPropertyForSync } from './booking-sync';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';
import { revalidatePath } from 'next/cache'; // Import for revalidating cached data

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
    console.log(`--- [updateBookingPaymentInfo] Called for ${isHoldPayment ? 'HOLD ' : ''}booking: ${bookingId}, property: ${propertyId}, paymentCurrency: ${paymentCurrency} ---`);
    if (!bookingId) throw new Error("Booking ID is required.");
    if (!propertyId) throw new Error("Property ID (slug) is required.");
    if (!paymentInfo || !paymentInfo.stripePaymentIntentId || (paymentInfo.status !== 'paid' && paymentInfo.status !== 'succeeded')) {
        console.error("[updateBookingPaymentInfo] Invalid payment info received:", paymentInfo);
        throw new Error("Valid payment information (status 'paid' or 'succeeded', with intent ID) is required.");
    }

    const bookingRef = doc(db, 'bookings', bookingId);

    try {
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) throw new Error(`Booking with ID ${bookingId} not found.`);

        const bookingData = bookingSnap.data() as Booking;
        if (bookingData.propertyId !== propertyId) {
            console.error(`[updateBookingPaymentInfo] Property ID mismatch for booking ${bookingId}. Expected: ${bookingData.propertyId}, Got: ${propertyId}`);
            throw new Error("Property ID mismatch between booking and webhook metadata.");
        }

        // Currency check
        if (!isHoldPayment && bookingData.pricing?.currency && bookingData.pricing?.currency !== paymentCurrency) {
             console.error(`[updateBookingPaymentInfo] Currency Mismatch: Booking ${bookingId} pricing currency (${bookingData.pricing?.currency}) does not match payment currency (${paymentCurrency}).`);
              throw new Error("Currency mismatch between booking and payment.");
        }
        if (isHoldPayment && bookingData.holdFee && Math.round(bookingData.holdFee * 100) !== Math.round(paymentInfo.amount * 100)) {
             console.warn(`[updateBookingPaymentInfo] Hold fee amount mismatch for booking ${bookingId}. Expected: ${bookingData.holdFee}, Paid: ${paymentInfo.amount}. Continuing update.`);
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
                console.error(`[updateBookingPaymentInfo] Currency Mismatch for Hold: Booking ${bookingId} pricing currency (${bookingData.pricing?.currency}) does not match payment currency (${paymentCurrency}).`);
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

            console.log(`[updateBookingPaymentInfo] Setting hold expiration for booking ${bookingId} to ${holdUntilDate.toISOString()} (${holdDurationHours} hours)`);
        } else {
            updatePayload.paymentInfo = {
                ...bookingData.paymentInfo,
                ...paymentInfo, // Overwrite with incoming full payment info
                paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(),
            };
        }


        console.log(`[updateBookingPaymentInfo] Updating booking ${bookingId} status to '${newStatus}' and payment details.`);
        await updateDoc(bookingRef, updatePayload);
        console.log(`✅ [updateBookingPaymentInfo] Successfully updated booking ${bookingId} to ${newStatus}.`);

        const checkInDate = bookingData.checkInDate instanceof ClientTimestamp
            ? bookingData.checkInDate.toDate()
            : bookingData.checkInDate ? parseISO(bookingData.checkInDate as string) : null; // Parse ISO string if needed
        const checkOutDate = bookingData.checkOutDate instanceof ClientTimestamp
            ? bookingData.checkOutDate.toDate()
            : bookingData.checkOutDate ? parseISO(bookingData.checkOutDate as string) : null; // Parse ISO string

        if (checkInDate && checkOutDate && isValid(checkInDate) && isValid(checkOutDate)) {
             const markAsAvailable = false;
             const holdBookingIdForUpdate = newStatus === 'on-hold' ? bookingId : undefined;

             console.log(`[updateBookingPaymentInfo] Triggering availability update for property ${propertyId}, booking ${bookingId}, status ${newStatus}`);
             try {
                await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, markAsAvailable, holdBookingIdForUpdate);
                console.log(`✅ [updateBookingPaymentInfo] Availability updated for property ${propertyId}.`);
             } catch (availabilityError) {
                 console.error(`❌ [updateBookingPaymentInfo] Failed to update availability for property ${propertyId} after ${newStatus} booking ${bookingId}:`, availabilityError);
             }

             if (newStatus === 'confirmed') {
                 console.log(`[updateBookingPaymentInfo] Triggering external sync for property ${propertyId}, booking ${bookingId}...`);
                 await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, false);
             }

        } else {
             console.warn(`[updateBookingPaymentInfo] Missing or invalid check-in/out dates for booking ${bookingId}. Cannot update availability.`);
             console.log("Check-in:", bookingData.checkInDate, "Parsed Check-in:", checkInDate);
             console.log("Check-out:", bookingData.checkOutDate, "Parsed Check-out:", checkOutDate);
        }

    } catch (error) {
        console.error(`❌ [updateBookingPaymentInfo] Error updating booking ${bookingId}:`, error);
        throw new Error(`Failed to update booking payment info: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- createBooking (Handles confirmed bookings from test/simulation or directly) ---
// IMPORTANT: Ensure this is ONLY called in secure contexts (like after webhook validation or test button)
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   const propertyId = rawBookingData.propertyId; // Slug
   const paymentIntentId = rawBookingData.paymentInput?.stripePaymentIntentId || 'N/A'; // Use optional chaining
   console.log(`--- [createBooking] Function called ---`);
   console.log(`[createBooking] Received raw data for Payment Intent [${paymentIntentId}]`, JSON.stringify(rawBookingData, null, 2));

   console.log(`[createBooking] Starting Zod validation for Payment Intent [${paymentIntentId}]...`);
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ [createBooking] Validation Error:`, validationError.message);
     throw validationError;
   }
   const bookingData = validationResult.data; // Use validated data
   console.log(`[createBooking] Data passed validation for Payment Intent [${paymentIntentId}]`);

  try {
     console.log(`[createBooking] Entered main try block for Payment Intent [${paymentIntentId}]`);
     const bookingsCollection = collection(db, 'bookings');

     console.log(`[createBooking] Transforming data for Firestore for Payment Intent [${paymentIntentId}]...`);
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

     // Log prepared data without complex objects for cleaner logs
      console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify({
          ...docData,
          checkInDate: `Timestamp(${checkInDate.toISOString()})`,
          checkOutDate: `Timestamp(${checkOutDate.toISOString()})`,
          paidAt: docData.paymentInfo?.paidAt ? `ServerTimestamp` : null,
          createdAt: 'ServerTimestamp',
          updatedAt: 'ServerTimestamp'
      }, null, 2));


     console.log(`[createBooking] Attempting to add booking document to Firestore (Client SDK) for Payment Intent [${paymentIntentId}]...`);
     const docRef = await addDoc(bookingsCollection, docData);
     const bookingId = docRef.id;
     console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

      // Update availability ONLY if the booking status is 'confirmed' or 'on-hold'
      if (docData.status === 'confirmed' || docData.status === 'on-hold') {
         console.log(`[createBooking] Triggering local availability update (Client SDK) for property ${propertyId}, booking ${bookingId} (Status: ${docData.status})`);
          const isHold = docData.status === 'on-hold';
          const holdId = isHold ? bookingId : undefined;
         try {
           await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, false, holdId); // Mark as unavailable (potentially with hold ID)
           console.log(`✅ [createBooking] Successfully finished update call for local availability for property ${propertyId}, booking ${bookingId}.`);
         } catch (availabilityError) {
           console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${propertyId} after creating booking ${bookingId}:`, availabilityError);
           console.warn(`⚠️ [createBooking] Availability update failed, but booking ${bookingId} was created (source: ${docData.source}). Manual check needed.`);
         }

         // Only sync externally if it's confirmed (not just a hold) and not a simulation
         if (docData.status === 'confirmed' && docData.source !== 'simulation' && docData.source !== 'test-button') {
             console.log(`[createBooking] Starting external platform sync for property ${propertyId}, booking ${bookingId}...`);
             await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
         } else if (docData.status === 'confirmed') {
             console.log(`[createBooking] Skipping external sync for booking source: ${docData.source}`);
         }
      } else {
           console.log(`[createBooking] Skipping availability update and external sync for booking ${bookingId} with status: ${docData.status}`);
      }


     console.log(`--- [createBooking] Function returning successfully with booking ID: ${bookingId} ---`);
     return bookingId;

   } catch (error) {
      // Avoid masking the specific Zod error message
      if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
          console.error(`❌ [createBooking] Error during booking creation process:`, error);
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
            console.warn(`[getBookingById] No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ [getBookingById] Error fetching booking with ID ${bookingId}:`, error);
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- updateBookingStatus ---
export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    console.log(`[updateBookingStatus] Updating booking ${bookingId} to status: ${status}`);
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(),
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);

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
                 console.log(`[updateBookingStatus] Releasing availability for cancelled booking ${bookingId}...`);
                 try {
                     await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, true); // Mark as available
                     console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
                     await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, true); // Mark as available externally
                 } catch (availError) {
                      console.error(`❌ [updateBookingStatus] Failed to update local availability or sync for cancelled booking ${bookingId}:`, availError);
                 }
             } else {
                  console.warn(`[updateBookingStatus] Could not use dates or missing propertyId for booking ${bookingId} to update availability after cancellation.`);
             }
          } else {
             console.warn(`[updateBookingStatus] Could not find booking ${bookingId} or its dates to update availability after cancellation.`);
          }
        }

    } catch (error) {
        console.error(`❌ [updateBookingStatus] Error updating status for booking ${bookingId} (Client SDK):`, error);
        throw new Error(`Failed to update booking status: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- getBookingsForProperty ---
export async function getBookingsForProperty(propertySlug: string): Promise<Booking[]> {
    console.log(`[getBookingsForProperty] Fetching bookings for property: ${propertySlug}`);
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
        console.log(`[getBookingsForProperty] Found ${bookings.length} bookings for ${propertySlug}.`);
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForProperty] Error fetching bookings for property ${propertySlug}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- getBookingsForUser ---
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
    console.log(`[getBookingsForUser] Fetching bookings for user: ${userId}`);
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
        console.log(`[getBookingsForUser] Found ${bookings.length} bookings for user ${userId}.`);
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForUser] Error fetching bookings for user ${userId}:`, error);
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
  const action = available ? 'Releasing' : (holdBookingId ? `Holding (ID: ${holdBookingId})` : 'Booking');
  console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
  console.log(`[updatePropertyAvailability - CLIENT SDK] Action: ${action}, Property: ${propertyId}, Dates: ${format(checkInDate, 'yyyy-MM-dd')} to ${format(subDays(checkOutDate, 1), 'yyyy-MM-dd')}`);

  if (!db) {
    console.error("❌ [updatePropertyAvailability - CLIENT SDK] Firestore Client SDK (db) is not initialized.");
    throw new Error("Firestore Client SDK is not initialized.");
  }
  if (!isValid(checkInDate) || !isValid(checkOutDate) || checkOutDate <= checkInDate) {
     console.warn(`[updatePropertyAvailability] Invalid dates provided: CheckIn=${checkInDate}, CheckOut=${checkOutDate}. No update performed.`);
     return;
  }

  const start = startOfDay(checkInDate);
  const end = startOfDay(subDays(checkOutDate, 1)); // Availability is stored per booked night
  const datesToUpdate = eachDayOfInterval({ start, end });

  if (datesToUpdate.length === 0) {
       console.log("[updatePropertyAvailability - CLIENT SDK] No dates in interval. No update performed.");
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
    console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${monthStrings.length} months...`);
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
     console.log(`[updatePropertyAvailability - CLIENT SDK] Fetched ${fetchedDocsMap.size} existing availability docs.`);


    // Prepare batch operations
    monthStrings.forEach(monthStr => {
      const availabilityDocId = `${propertyId}_${monthStr}`; // Use slug
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId);
      const { daysToUpdate, holdsToUpdate } = updatesByMonth[monthStr];
      console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Updates needed for days: ${Object.keys(daysToUpdate).join(', ')}`);

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
               console.log(`[updatePropertyAvailability Batch Prep] Prepared UPDATE payload for ${availabilityDocId}:`, updatePayload);
               batch.update(availabilityDocRef, updatePayload);
           } else {
               console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial data for month ${monthStr}.`);
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
                console.log(`[updatePropertyAvailability Batch Prep] New doc data for ${availabilityDocId}:`, JSON.stringify(newDocData, (key, value) => key === 'updatedAt' ? 'ServerTimestamp' : value, 2));
                // Use set with merge: true to create or update
                batch.set(availabilityDocRef, newDocData, { merge: true });
                 console.log(`[updatePropertyAvailability Batch Prep] Adding SET operation (merge: true) to client batch for ${availabilityDocId}.`);
           }
      } else {
          console.log(`[updatePropertyAvailability Batch Prep] No changes needed for month ${monthStr}. Skipping batch operation.`);
      }
    });

    console.log(`[updatePropertyAvailability - CLIENT SDK] Preparing to commit client batch for property ${propertyId}, months: ${monthStrings.join(', ')}...`);
    await batch.commit();
    console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Batch committed for property ${propertyId}.`);

  } catch (error) {
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
        console.error(`[updatePropertyAvailability - CLIENT SDK] Permission Denied! Check Firestore rules for path: /availability/${propertyId}_${Object.keys(updatesByMonth)[0]} ...`);
        throw new Error(`Permission denied updating availability for property ${propertyId}. Check Firestore rules.`);
    }
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
    throw new Error(`Failed to update local property availability using Client SDK: ${errorMessage}`);
  }
}

// --- triggerExternalSyncForDateUpdate ---
export async function triggerExternalSyncForDateUpdate(propertyId: string, checkInDate: Date, checkOutDate: Date, isAvailable: boolean): Promise<void> {
    console.log(`[Sync Trigger] Syncing availability change for property ${propertyId} (slug) (${isAvailable ? 'Release' : 'Block'})`);
     try {
       const propertyDetails = await getPropertyForSync(propertyId); // Uses slug
       if (propertyDetails) {
           const airbnbId = propertyDetails.channelIds?.airbnb;
           const bookingComId = propertyDetails.channelIds?.booking_com;

           if (airbnbId) {
                console.log(`[Sync Trigger] Updating Airbnb listing ${airbnbId}...`);
               await updateAirbnbListingAvailability(airbnbId, isAvailable, checkInDate, checkOutDate);
           } else {
                // console.log(`[Sync Trigger] No Airbnb Listing ID found for property ${propertyId}. Skipping Airbnb sync.`);
           }

           if (bookingComId) { // Corrected property name
                console.log(`[Sync Trigger] Updating Booking.com listing ${bookingComId}...`);
               await updateBookingComListingAvailability(bookingComId, isAvailable, checkInDate, checkOutDate); // Corrected property name
           } else {
                // console.log(`[Sync Trigger] No Booking.com Listing ID found for property ${propertyId}. Skipping Booking.com sync.`);
           }
       } else {
           console.warn(`[Sync Trigger] Could not find property ${propertyId} for external sync.`);
       }
   } catch (syncError) {
        console.error(`❌ [Sync Trigger] Error syncing externally for property ${propertyId}:`, syncError);
   }
}


// --- getUnavailableDatesForProperty ---
export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  // Add a very obvious console log that's hard to miss
  console.log(`==========================================`);
  console.log(`🚨 SERVER-SIDE AVAILABILITY CHECK RUNNING 🚨`);
  console.log(`📡 USING API INSTEAD OF DIRECT FIRESTORE QUERY 📡`);
  console.log(`==========================================`);

  console.log(`--- [getUnavailableDatesForProperty] 🔍 Function called ---`);
  console.log(`[getUnavailableDatesForProperty] Fetching for property slug: "${propertySlug}" for the next ${monthsToFetch} months.`);
  console.log(`[getUnavailableDatesForProperty] 📡 Using server API endpoint instead of direct Firestore query`);

  const availabilityCollection = collection(db, 'availability');
  console.log(`[getUnavailableDatesForProperty] 📂 Targeting Firestore collection: 'availability'`);

  const today = new Date();
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  console.log(`[getUnavailableDatesForProperty] Current month start: ${format(currentMonthStart, 'yyyy-MM-dd')}`);

  try {
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      const docId = `${propertySlug}_${monthStr}`;
      monthDocIds.push(docId);
      console.log(`[getUnavailableDatesForProperty] Adding doc ID to query: ${docId}`);
    }

    if (monthDocIds.length === 0) {
      console.warn(`[getUnavailableDatesForProperty] No document IDs to query. Returning empty array.`);
      return [];
    }

    console.log(`[getUnavailableDatesForProperty] 🔍 Querying for ${monthDocIds.length} document IDs`);

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }
    console.log(`[getUnavailableDatesForProperty] Split into ${queryBatches.length} query batches due to Firestore limits.`);

    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds, index) => {
          if (batchIds.length === 0) return null; // Return null for empty batches
          console.log(`[getUnavailableDatesForProperty] 🔄 Executing query for batch ${index + 1}: ${batchIds.join(', ')}`);
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
          return getDocs(q);
      })
    );
    console.log(`[getUnavailableDatesForProperty] ✅ Completed ${allQuerySnapshots.length} Firestore batch queries.`);

    let docCount = 0;
    let docsWithDataCount = 0;
    const unavailableDates: Date[] = [];

    allQuerySnapshots.forEach((querySnapshot, batchIndex) => {
         if (!querySnapshot) {
           console.log(`[getUnavailableDatesForProperty] Batch ${batchIndex + 1} had no results (null).`);
           return;
         }

         console.log(`[getUnavailableDatesForProperty] 📄 Processing batch ${batchIndex + 1}: Found ${querySnapshot.docs.length} documents.`);
         docCount += querySnapshot.docs.length;

         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
            console.log(`[getUnavailableDatesForProperty] 📝 Processing document: ${docId}`);

             // Simple check if docId starts with the correct slug
             if (!docId.startsWith(`${propertySlug}_`)) {
                 console.warn(`[getUnavailableDatesForProperty] ❌ Mismatch: Doc ID ${docId} doesn't match expected pattern for slug ${propertySlug}. Skipping.`);
                 return;
             }

            const monthStr = data.month || docId.split('_').slice(1).join('_'); // Get month part
            console.log(`[getUnavailableDatesForProperty] Document is for month: ${monthStr}`);

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 console.warn(`[getUnavailableDatesForProperty] ❌ Invalid month string '${monthStr}' for doc ${docId}. Skipping.`);
                 return;
             }

             const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
             const month = monthIndex - 1; // JS month is 0-indexed
             console.log(`[getUnavailableDatesForProperty] Parsed year: ${year}, month: ${month + 1} (0-indexed: ${month})`);

             docsWithDataCount++;

             // Debug log the raw document data
             console.log(`[getUnavailableDatesForProperty] Document data:`, JSON.stringify({
               docId,
               month: data.month,
               hasAvailableMap: !!data.available,
               hasHoldsMap: !!data.holds,
               availableDaysCount: data.available ? Object.keys(data.available).length : 0,
               holdsDaysCount: data.holds ? Object.keys(data.holds).length : 0
             }));

             // Process 'available' map
             let unavailableFromAvailableMap = 0;
             if (data.available && typeof data.available === 'object') {
                 console.log(`[getUnavailableDatesForProperty] Processing 'available' map with ${Object.keys(data.available).length} days`);
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
                                          unavailableFromAvailableMap++;
                                          console.log(`[getUnavailableDatesForProperty] ➕ Added UNAVAILABLE date from 'available' map: ${format(date, 'yyyy-MM-dd')}`);
                                     }
                                 } else {
                                     console.log(`[getUnavailableDatesForProperty] Skipping past date: ${format(date, 'yyyy-MM-dd')}`);
                                 }
                              } else {
                                  console.warn(`[getUnavailableDatesForProperty] ❌ Invalid date created for ${monthStr}-${dayStr}. Skipping.`);
                              }
                         } catch (dateError) {
                              console.warn(`[getUnavailableDatesForProperty] ❌ Error creating date ${monthStr}-${dayStr}:`, dateError);
                         }
                     }
                 }
                 console.log(`[getUnavailableDatesForProperty] Added ${unavailableFromAvailableMap} dates from 'available' map`);
             } else {
                 console.log(`[getUnavailableDatesForProperty] No 'available' map found in document ${docId}`);
             }

            // Process 'holds' map - consider held dates as unavailable
            let unavailableFromHoldsMap = 0;
            if (data.holds && typeof data.holds === 'object') {
                 console.log(`[getUnavailableDatesForProperty] Processing 'holds' map with ${Object.keys(data.holds).length} days`);
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
                                           unavailableFromHoldsMap++;
                                           console.log(`[getUnavailableDatesForProperty] ➕ Added HELD date from 'holds' map: ${format(date, 'yyyy-MM-dd')} (Hold ID: ${data.holds[dayStr]})`);
                                       }
                                   }
                               } catch (dateError) {
                                   console.warn(`[getUnavailableDatesForProperty] ❌ Error creating date ${monthStr}-${dayStr}:`, dateError);
                               }
                          }
                     }
                 }
                 console.log(`[getUnavailableDatesForProperty] Added ${unavailableFromHoldsMap} dates from 'holds' map`);
            } else {
                console.log(`[getUnavailableDatesForProperty] No 'holds' map found in document ${docId}`);
            }
        });
    });
    console.log(`[getUnavailableDatesForProperty] 📊 Summary: Processed ${docCount} total documents, ${docsWithDataCount} with valid data.`);

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    console.log(`[getUnavailableDatesForProperty] 🗓️ Total unavailable dates found for property ${propertySlug}: ${unavailableDates.length}`);

    if (unavailableDates.length > 0) {
        // Only show up to 20 dates to avoid console spam
        const datesToShow = unavailableDates.length > 20 ? unavailableDates.slice(0, 20) : unavailableDates;
        console.log(`[getUnavailableDatesForProperty] First ${datesToShow.length} unavailable dates: ${datesToShow.map(d => format(d, 'yyyy-MM-dd')).join(', ')}${unavailableDates.length > 20 ? ' ...(more)' : ''}`);
    } else {
        console.log(`[getUnavailableDatesForProperty] No unavailable dates found for property ${propertySlug}`);
    }

    console.log(`--- [getUnavailableDatesForProperty] ✅ Function finished successfully ---`);
    return unavailableDates;

  } catch (error) {
    console.error(`❌ [getUnavailableDatesForProperty] Error fetching unavailable dates for property ${propertySlug}:`, error);
    console.log(`--- [getUnavailableDatesForProperty] ❌ Function finished with error ---`);
    return [];
  }
}

// --- New service for Inquiries (Placeholder) ---
// Removed invalid export * statement
// export * from './inquiryService'; // Assuming inquiry logic is in a separate file
