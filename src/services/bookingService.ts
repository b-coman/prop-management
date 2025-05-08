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

// --- Data Schemas (Keep CreateBookingDataSchema as is) ---
export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo' |
  'pricing'
> & {
  propertyId: string; // This is the slug
  checkInDate: string; // ISO string
  checkOutDate: string; // ISO string
  pricing: {
    baseRate: number;
    numberOfNights: number;
    cleaningFee: number;
    extraGuestFee?: number;
    numberOfExtraGuests?: number;
    accommodationTotal: number;
    subtotal: number;
    taxes?: number;
    discountAmount?: number;
    total: number;
    currency: CurrencyCode; // Add currency to pricing object
  };
  appliedCouponCode?: string;
  status?: Booking['status']; // Allow specifying initial status if needed, defaults to 'confirmed' or 'pending'
};

const CreateBookingDataSchema = z.object({
  propertyId: z.string().min(1), // This is the slug
  guestInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
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
  appliedCouponCode: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'payment_failed', 'on-hold']).optional(), // Include on-hold
  notes: z.string().optional(),
  source: z.string().optional(),
  externalId: z.string().optional(),
  // Fields related to holds/inquiries
  holdFee: z.number().optional(),
  holdUntil: z.any().optional(), // Allow any type for flexibility initially
  holdPaymentId: z.string().optional(),
  convertedFromHold: z.boolean().optional(),
  convertedFromInquiry: z.string().optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'],
});
// Removed pricing total validation as it might be complex with holds/conversions
// .refine(data => { ... })

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
        throw new Error("Valid payment information (status 'paid' or 'succeeded') is required.");
    }

    const bookingRef = doc(db, 'bookings', bookingId);

    try {
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) throw new Error(`Booking with ID ${bookingId} not found.`);

        const bookingData = bookingSnap.data() as Booking;
        if (bookingData.propertyId !== propertyId) throw new Error("Property ID mismatch between booking and webhook metadata.");

        // Currency check (important for full bookings, maybe less strict for holds if fee is fixed USD?)
        // For now, assume hold fee is also in property base currency
        if (!isHoldPayment && bookingData.pricing?.currency !== paymentCurrency) {
             console.error(`[updateBookingPaymentInfo] Currency Mismatch: Booking ${bookingId} pricing currency (${bookingData.pricing?.currency}) does not match payment currency (${paymentCurrency}).`);
             // Decide if this should throw an error for full bookings
              // throw new Error("Currency mismatch between booking and payment.");
        }
        if (isHoldPayment && bookingData.holdFee && Math.round(bookingData.holdFee * 100) !== Math.round(paymentInfo.amount * 100)) {
             console.warn(`[updateBookingPaymentInfo] Hold fee amount mismatch for booking ${bookingId}. Expected: ${bookingData.holdFee}, Paid: ${paymentInfo.amount}. Continuing update.`);
             // Don't throw, but log warning
        }


        // Determine the status update based on whether it's a hold or full payment
        const newStatus = isHoldPayment ? 'on-hold' : 'confirmed'; // Keep 'on-hold' after hold payment
        const updatePayload: Partial<Booking> = {
            status: newStatus,
            updatedAt: clientServerTimestamp(),
        };

        // Update specific payment fields based on type
        if (isHoldPayment) {
            updatePayload.holdPaymentId = paymentInfo.stripePaymentIntentId;
             // Update paymentInfo minimally for the hold fee payment
             updatePayload.paymentInfo = {
                 ...bookingData.paymentInfo, // Keep potential existing info if needed
                 stripePaymentIntentId: paymentInfo.stripePaymentIntentId, // Track hold payment ID separately? Or overwrite? Decide based on needs.
                 amount: paymentInfo.amount, // Record the hold fee amount paid
                 status: 'succeeded', // Mark hold payment as succeeded
                 paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(),
             };
        } else {
            // Update full payment info for confirmed bookings
            updatePayload.paymentInfo = {
                ...bookingData.paymentInfo, // Keep existing info if relevant (e.g., hold details?)
                ...paymentInfo,
                paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(),
            };
        }


        console.log(`[updateBookingPaymentInfo] Updating booking ${bookingId} status to '${newStatus}' and payment details.`);
        await updateDoc(bookingRef, updatePayload);
        console.log(`✅ [updateBookingPaymentInfo] Successfully updated booking ${bookingId} to ${newStatus}.`);

        const checkInDate = bookingData.checkInDate instanceof ClientTimestamp
            ? bookingData.checkInDate.toDate()
            : bookingData.checkInDate ? new Date(bookingData.checkInDate as any) : null;
        const checkOutDate = bookingData.checkOutDate instanceof ClientTimestamp
            ? bookingData.checkOutDate.toDate()
            : bookingData.checkOutDate ? new Date(bookingData.checkOutDate as any) : null;

        if (checkInDate && checkOutDate) {
             const markAsAvailable = false; // Both confirmed and on-hold make dates unavailable
             const holdBookingId = newStatus === 'on-hold' ? bookingId : undefined; // Pass bookingId if it's a hold

             console.log(`[updateBookingPaymentInfo] Triggering availability update for property ${propertyId}, booking ${bookingId}, status ${newStatus}`);
             try {
                await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, markAsAvailable, holdBookingId);
                console.log(`✅ [updateBookingPaymentInfo] Availability updated for property ${propertyId}.`);
             } catch (availabilityError) {
                 console.error(`❌ [updateBookingPaymentInfo] Failed to update availability for property ${propertyId} after ${newStatus} booking ${bookingId}:`, availabilityError);
             }

            // Trigger external sync only for CONFIRMED bookings, not just holds yet
            // (Syncing holds might require specific API capabilities)
            if (newStatus === 'confirmed') {
                 console.log(`[updateBookingPaymentInfo] Triggering external sync for property ${propertyId}, booking ${bookingId}...`);
                 await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
             }

        } else {
             console.warn(`[updateBookingPaymentInfo] Missing check-in/out dates for booking ${bookingId}. Cannot update availability.`);
        }

    } catch (error) {
        console.error(`❌ [updateBookingPaymentInfo] Error updating booking ${bookingId}:`, error);
        throw new Error(`Failed to update booking payment info: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- createBooking (Handles confirmed bookings from test/simulation) ---
// This remains largely the same, but uses CLIENT SDK for availability update
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   const propertyId = rawBookingData.propertyId; // Expecting slug
   const paymentIntentId = (rawBookingData as any)?.paymentInput?.stripePaymentIntentId || 'N/A';
   console.log(`--- [createBooking] Function called for Payment Intent [${paymentIntentId}], Property [${propertyId}] ---`);

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

     let paymentInfo: Booking['paymentInfo'] | undefined = undefined;
      if ((rawBookingData as any).paymentInput) {
          const paymentInput = (rawBookingData as any).paymentInput;
          paymentInfo = {
              stripePaymentIntentId: paymentInput.stripePaymentIntentId || `simulated_${Date.now()}`,
              amount: paymentInput.amount ?? bookingData.pricing.total,
              status: paymentInput.status || 'succeeded',
              paidAt: (paymentInput.status === 'succeeded' || paymentInput.status === 'paid')
                  ? ClientTimestamp.now()
                  : null,
          };
      } else {
           paymentInfo = {
               stripePaymentIntentId: 'N/A',
               amount: bookingData.pricing.total, // Amount is in the currency specified in bookingData.pricing.currency
               status: 'unknown', // Or perhaps 'pending' if no payment info provided
               paidAt: null,
           };
      }


     const docData: Omit<Booking, 'id'> = {
         propertyId: bookingData.propertyId, // Ensure slug is used
         guestInfo: bookingData.guestInfo,
         checkInDate: checkInTimestamp,
         checkOutDate: checkOutTimestamp,
         numberOfGuests: bookingData.numberOfGuests,
         pricing: bookingData.pricing, // Includes currency
         appliedCouponCode: bookingData.appliedCouponCode,
         status: bookingData.status || 'confirmed', // Default to confirmed if not specified
         paymentInfo: paymentInfo,
         notes: bookingData.notes,
         source: bookingData.source || 'simulation', // Default source
         externalId: bookingData.externalId,
         holdFee: bookingData.holdFee,
         holdUntil: bookingData.holdUntil ? ClientTimestamp.fromDate(new Date(bookingData.holdUntil as any)) : undefined,
         holdPaymentId: bookingData.holdPaymentId,
         convertedFromHold: bookingData.convertedFromHold,
         convertedFromInquiry: bookingData.convertedFromInquiry,
         createdAt: clientServerTimestamp(),
         updatedAt: clientServerTimestamp(),
     };

     console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify({
         ...docData,
         checkInDate: `Timestamp(${checkInDate.toISOString()})`,
         checkOutDate: `Timestamp(${checkOutDate.toISOString()})`,
         paidAt: docData.paymentInfo?.paidAt ? `Timestamp(${(docData.paymentInfo.paidAt as ClientTimestamp).toDate().toISOString()})` : null,
         createdAt: 'ServerTimestamp',
         updatedAt: 'ServerTimestamp'
     }, null, 2));


     console.log(`[createBooking] Attempting to add booking document to Firestore (Client SDK) for Payment Intent [${paymentIntentId}]...`);
     const docRef = await addDoc(bookingsCollection, docData);
     const bookingId = docRef.id;
     console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

     console.log(`[createBooking] Triggering local availability update (Client SDK) for property ${propertyId}, booking ${bookingId}`);
     try {
       await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
       console.log(`✅ [createBooking] Successfully finished update call for local availability for property ${propertyId}, booking ${bookingId}.`);
     } catch (availabilityError) {
       console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${propertyId} after creating booking ${bookingId}:`, availabilityError);
       console.warn(`⚠️ [createBooking] Availability update failed, but booking ${bookingId} was created (source: ${docData.source}). Manual check needed.`);
     }

      // Only sync if it's not a simulation/test
      if (docData.source !== 'simulation' && docData.source !== 'test-button') {
          console.log(`[createBooking] Starting external platform sync for property ${propertyId}, booking ${bookingId}...`);
          await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
      } else {
          console.log(`[createBooking] Skipping external sync for booking source: ${docData.source}`);
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

// --- getBookingById (Keep as is) ---
export async function getBookingById(bookingId: string): Promise<Booking | null> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Convert Timestamps back if needed for client consumption
            const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? new Date(data.checkInDate as any) : null);
            const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? new Date(data.checkOutDate as any) : null);
            const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? new Date(data.paymentInfo.paidAt as any) : null);
            const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? new Date(data.holdUntil as any) : null);

            return {
                id: docSnap.id,
                ...data,
                checkInDate,
                checkOutDate,
                paymentInfo: { ...data.paymentInfo, paidAt },
                holdUntil,
                // Ensure pricing includes currency (handle potential missing field)
                pricing: {
                    ...data.pricing,
                    currency: data.pricing?.currency || 'USD', // Default if missing
                },
            } as Booking; // Casting needed due to Timestamp conversion
        } else {
            console.warn(`[getBookingById] No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ [getBookingById] Error fetching booking with ID ${bookingId}:`, error);
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}


// --- updateBookingStatus (Keep as is, handles cancellation availability update) ---
export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(),
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);

        // If cancelled, release dates
        if (status === 'cancelled') {
          const booking = await getBookingById(bookingId);
          if (booking && booking.checkInDate && booking.checkOutDate) {
             const propertyId = booking.propertyId;
             // Ensure dates are Date objects before passing
             const checkInDate = booking.checkInDate instanceof Date ? booking.checkInDate : null;
             const checkOutDate = booking.checkOutDate instanceof Date ? booking.checkOutDate : null;

             if (checkInDate && checkOutDate && propertyId) {
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


// --- getBookingsForProperty (Keep as is) ---
export async function getBookingsForProperty(propertySlug: string): Promise<Booking[]> {
    const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        const q = query(bookingsCollection, where('propertyId', '==', propertySlug));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
             // Convert Timestamps
            const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? new Date(data.checkInDate as any) : null);
            const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? new Date(data.checkOutDate as any) : null);
            const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? new Date(data.paymentInfo.paidAt as any) : null);
            const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? new Date(data.holdUntil as any) : null);

            bookings.push({
                id: doc.id,
                ...data,
                checkInDate,
                checkOutDate,
                paymentInfo: { ...data.paymentInfo, paidAt },
                holdUntil,
                 // Ensure pricing includes currency
                pricing: {
                    ...data.pricing,
                    currency: data.pricing?.currency || 'USD',
                },
            } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForProperty] Error fetching bookings for property ${propertySlug}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- getBookingsForUser (Keep as is) ---
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
     const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        const q = query(bookingsCollection, where('guestInfo.userId', '==', userId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
             const data = doc.data();
             // Convert Timestamps
             const checkInDate = data.checkInDate instanceof ClientTimestamp ? data.checkInDate.toDate() : (data.checkInDate ? new Date(data.checkInDate as any) : null);
             const checkOutDate = data.checkOutDate instanceof ClientTimestamp ? data.checkOutDate.toDate() : (data.checkOutDate ? new Date(data.checkOutDate as any) : null);
             const paidAt = data.paymentInfo?.paidAt instanceof ClientTimestamp ? data.paymentInfo.paidAt.toDate() : (data.paymentInfo?.paidAt ? new Date(data.paymentInfo.paidAt as any) : null);
             const holdUntil = data.holdUntil instanceof ClientTimestamp ? data.holdUntil.toDate() : (data.holdUntil ? new Date(data.holdUntil as any) : null);

             bookings.push({
                 id: doc.id,
                 ...data,
                 checkInDate,
                 checkOutDate,
                 paymentInfo: { ...data.paymentInfo, paidAt },
                 holdUntil,
                  // Ensure pricing includes currency
                 pricing: {
                     ...data.pricing,
                     currency: data.pricing?.currency || 'USD',
                 },
             } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForUser] Error fetching bookings for user ${userId}:`, error);
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// --- updatePropertyAvailability (Updated to handle holds) ---
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
  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability] Check-out date must be after check-in date. No update performed.`);
    return;
  }

  const start = startOfDay(checkInDate);
  const end = startOfDay(subDays(checkOutDate, 1)); // Availability is stored per booked night
  const datesToUpdate = eachDayOfInterval({ start, end });

  if (datesToUpdate.length === 0) return;

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

      // Construct the payload using dot notation for nested fields
      const updatePayload: { [key: string]: any } = {};
      for (const day in daysToUpdate) {
          updatePayload[`available.${String(day)}`] = daysToUpdate[day];
      }
      for (const day in holdsToUpdate) {
          // Use null to remove the hold, or the bookingId to set it
          updatePayload[`holds.${String(day)}`] = holdsToUpdate[day];
      }
      updatePayload.updatedAt = clientServerTimestamp(); // Update timestamp

      const existingDoc = fetchedDocsMap.get(availabilityDocId);

      if (existingDoc) {
         console.log(`[updatePropertyAvailability Batch Prep] Updating doc ${availabilityDocId}`);
         batch.update(availabilityDocRef, updatePayload);
      } else {
         console.log(`[updatePropertyAvailability Batch Prep] Creating doc ${availabilityDocId}`);
         const [year, month] = monthStr.split('-').map(Number);
         const daysInMonth = new Date(year, month, 0).getDate();
         const initialAvailableMap: { [day: number]: boolean } = {};
         const initialHoldsMap: { [day: number]: string } = {}; // Initialize holds map

         for (let day = 1; day <= daysInMonth; day++) {
             initialAvailableMap[day] = daysToUpdate[day] !== undefined ? daysToUpdate[day] : true; // Default to available
             // Apply initial hold status if creating the document during a hold operation
             if (holdsToUpdate[day] !== undefined && holdsToUpdate[day] !== null) {
                  initialHoldsMap[day] = holdsToUpdate[day]!;
             }
         }

         const newDocData: Partial<Availability> = {
             propertyId: propertyId, // Use slug
             month: monthStr,
             available: initialAvailableMap,
             holds: initialHoldsMap, // Add holds map
             updatedAt: clientServerTimestamp(),
         };
         batch.set(availabilityDocRef, newDocData, { merge: true }); // Use set with merge to create or overwrite
      }
    });

    console.log(`[updatePropertyAvailability - CLIENT SDK] Committing client batch for property ${propertyId}...`);
    await batch.commit();
    console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Batch committed for property ${propertyId}.`);

  } catch (error) {
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
        throw new Error(`Permission denied updating availability for property ${propertyId}. Check Firestore rules.`);
    }
    throw new Error(`Failed to update local property availability using Client SDK: ${errorMessage}`);
  }
}

// --- triggerExternalSyncForDateUpdate (Keep as is) ---
async function triggerExternalSyncForDateUpdate(propertyId: string, checkInDate: Date, checkOutDate: Date, isAvailable: boolean): Promise<void> {
    console.log(`[Sync Trigger] Syncing availability change for property ${propertyId} (slug) (${isAvailable ? 'Release' : 'Block'})`);
     try {
       const propertyDetails = await getPropertyForSync(propertyId); // Uses slug
       if (propertyDetails) {
           if (propertyDetails.channelIds?.airbnb) {
               await updateAirbnbListingAvailability(propertyDetails.channelIds.airbnb, isAvailable, checkInDate, checkOutDate);
           }
           if (propertyDetails.channelIds?.booking_com) { // Corrected property name
               await updateBookingComListingAvailability(propertyDetails.channelIds.booking_com, isAvailable, checkInDate, checkOutDate); // Corrected property name
           }
       } else {
           console.warn(`[Sync Trigger] Could not find property ${propertyId} for external sync.`);
       }
   } catch (syncError) {
        console.error(`❌ [Sync Trigger] Error syncing externally for property ${propertyId}:`, syncError);
   }
}


// --- getUnavailableDatesForProperty (Keep as is, uses slug correctly) ---
export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  const unavailableDates: Date[] = [];
  console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
  console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertySlug} for the next ${monthsToFetch} months.`);

  if (!db) {
      console.error("❌ [getUnavailableDatesForProperty] Firestore Client SDK (db) is not initialized.");
      return [];
  }

  const availabilityCollection = collection(db, 'availability');
  const today = new Date();
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  try {
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      monthDocIds.push(`${propertySlug}_${monthStr}`); // Use slug
    }

     if (monthDocIds.length === 0) return [];
    console.log(`[getUnavailableDatesForProperty] Querying for document IDs: ${monthDocIds.join(', ')}`);

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }
    console.log(`[getUnavailableDatesForProperty] Split into ${queryBatches.length} query batches.`);

    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds) => {
          if (batchIds.length === 0) return null; // Return null for empty batches
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
          return getDocs(q);
      })
    );
    console.log(`[getUnavailableDatesForProperty] Fetched results from ${allQuerySnapshots.length} batches.`);

    let docCount = 0;
    allQuerySnapshots.forEach((querySnapshot) => {
         if (!querySnapshot) return; // Skip null results from empty batches
         docCount += querySnapshot.docs.length;
         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
             // Simple check if docId starts with the correct slug
             if (!docId.startsWith(`${propertySlug}_`)) {
                 console.warn(`[getUnavailableDates] Mismatch: Doc ID ${docId} doesn't match expected pattern for slug ${propertySlug}. Skipping.`);
                 return;
             }

            const monthStr = data.month || docId.split('_').slice(1).join('_'); // Get month part

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 console.warn(`[getUnavailableDates] Invalid month string '${monthStr}' for doc ${docId}. Skipping.`);
                 return;
             }

            if (data.available && typeof data.available === 'object') {
                const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                const month = monthIndex - 1;

                for (const dayStr in data.available) {
                    const day = parseInt(dayStr, 10);
                    if (!isNaN(day) && data.available[day] === false) { // Only add if explicitly marked as unavailable
                        try {
                            const date = new Date(Date.UTC(year, month, day));
                             if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                const todayUtcStart = startOfDay(new Date());
                                if (date >= todayUtcStart) {
                                    unavailableDates.push(date);
                                }
                             } else {
                                 console.warn(`[getUnavailableDates] Invalid date created for ${monthStr}-${dayStr}. Skipping.`);
                             }
                        } catch (dateError) {
                             console.warn(`[getUnavailableDates] Error creating date ${monthStr}-${dayStr}:`, dateError);
                        }
                    }
                }
            }
            // Consider holds as unavailable too (optional, depending on business logic)
            if (data.holds && typeof data.holds === 'object') {
                 const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                 const month = monthIndex - 1;
                 for (const dayStr in data.holds) {
                     if (data.holds[dayStr]) { // If there's a hold ID for this day
                          const day = parseInt(dayStr, 10);
                          if (!isNaN(day)) {
                               try {
                                   const date = new Date(Date.UTC(year, month, day));
                                   if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                       const todayUtcStart = startOfDay(new Date());
                                       if (date >= todayUtcStart && !unavailableDates.some(d => d.getTime() === date.getTime())) {
                                           // Add if not already marked unavailable
                                           unavailableDates.push(date);
                                       }
                                   }
                               } catch (dateError) {
                                   console.warn(`[getUnavailableDates - Holds] Error creating date ${monthStr}-${dayStr}:`, dateError);
                               }
                          }
                     }
                 }
            }
        });
    });
    console.log(`[getUnavailableDates] Processed ${docCount} total documents.`);

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    console.log(`[getUnavailableDates] Found ${unavailableDates.length} unavailable/held dates for ${propertySlug}.`);
    console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
    return unavailableDates;

  } catch (error) {
    console.error(`❌ Error fetching unavailable dates for property ${propertySlug}:`, error);
    console.log(`--- [getUnavailableDatesForProperty] Function finished with error ---`);
    return [];
  }
}

// --- New service for Inquiries (Placeholder) ---
export * from './inquiryService'; // Assuming inquiry logic is in a separate file
