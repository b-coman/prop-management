
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
import type { Booking, Availability, Property, SerializableTimestamp } from '@/types';
import { differenceInCalendarDays, eachDayOfInterval, format, parse, subDays, startOfMonth, endOfMonth, parseISO, startOfDay } from 'date-fns';
import { updateAirbnbListingAvailability, updateBookingComListingAvailability, getPropertyForSync } from './booking-sync';

// --- Schemas (Keep Zod schemas for data validation if createBooking is still used elsewhere) ---

export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo' | // paymentInfo structure is defined separately now
  'pricing'
> & {
  checkInDate: string; // ISO String
  checkOutDate: string; // ISO String
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
  };
  appliedCouponCode?: string;
  // paymentInput is now handled by the webhook and updateBookingPaymentInfo
  // status will likely be 'confirmed' when this is called by simulation/webhook
  status?: Booking['status']; // Optional for flexibility, webhook should set 'confirmed'
};

const CreateBookingDataSchema = z.object({
  propertyId: z.string().min(1),
  guestInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email(),
    phone: z.string().optional(),
    userId: z.string().optional(),
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
  }).passthrough(),
  appliedCouponCode: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  // Removed paymentInput validation here, handled separately
  notes: z.string().optional(),
  source: z.string().optional(),
  externalId: z.string().optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'],
}).refine(data => {
    const calculatedTotal = (data.pricing.subtotal ?? 0) + (data.pricing.taxes ?? 0) - (data.pricing.discountAmount ?? 0);
    return Math.abs(calculatedTotal - data.pricing.total) < 0.01;
}, {
    message: 'Calculated total does not match provided total price.',
    path: ['pricing.total'],
});


/**
 * Updates an existing booking (typically 'pending') with payment information
 * and sets its status to 'confirmed'. Called by the Stripe webhook.
 */
export async function updateBookingPaymentInfo(
    bookingId: string,
    paymentInfo: Booking['paymentInfo']
): Promise<void> {
    console.log(`--- [updateBookingPaymentInfo] Called for booking: ${bookingId} ---`);
    if (!bookingId) {
        throw new Error("Booking ID is required to update payment info.");
    }
     if (!paymentInfo || !paymentInfo.stripePaymentIntentId || paymentInfo.status !== 'paid' && paymentInfo.status !== 'succeeded') {
         console.warn(`[updateBookingPaymentInfo] Invalid or incomplete payment info for booking ${bookingId}. Status: ${paymentInfo?.status}`);
        throw new Error("Valid payment information (status 'paid' or 'succeeded') is required.");
    }

    const bookingRef = doc(db, 'bookings', bookingId);

    try {
        // Fetch the booking to get check-in/out dates for availability update
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) {
            console.error(`[updateBookingPaymentInfo] Booking ${bookingId} not found.`);
            throw new Error(`Booking with ID ${bookingId} not found.`);
        }
        const bookingData = bookingSnap.data() as Booking; // Cast to Booking

        console.log(`[updateBookingPaymentInfo] Updating booking ${bookingId} status to 'confirmed' and adding payment details.`);
        await updateDoc(bookingRef, {
            status: 'confirmed',
            paymentInfo: { // Merge with existing potentially, or overwrite
                ...bookingData.paymentInfo, // Keep existing fields if any
                ...paymentInfo, // Add/overwrite with new payment data
                paidAt: paymentInfo.paidAt instanceof Date ? Timestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(), // Ensure Firestore Timestamp
            },
            updatedAt: clientServerTimestamp(),
        });
        console.log(`✅ [updateBookingPaymentInfo] Successfully updated booking ${bookingId} to confirmed.`);

        // --- Update Property Availability ---
        const checkInDate = bookingData.checkInDate instanceof Timestamp
            ? bookingData.checkInDate.toDate()
            : bookingData.checkInDate ? new Date(bookingData.checkInDate as any) : null; // Handle different types
        const checkOutDate = bookingData.checkOutDate instanceof Timestamp
            ? bookingData.checkOutDate.toDate()
            : bookingData.checkOutDate ? new Date(bookingData.checkOutDate as any) : null;

        if (checkInDate && checkOutDate) {
             console.log(`[updateBookingPaymentInfo] Triggering availability update for property ${bookingData.propertyId}, booking ${bookingId}`);
            try {
                await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
                console.log(`✅ [updateBookingPaymentInfo] Availability updated for property ${bookingData.propertyId}.`);
            } catch (availabilityError) {
                 console.error(`❌ [updateBookingPaymentInfo] Failed to update availability for property ${bookingData.propertyId} after confirming booking ${bookingId}:`, availabilityError);
                 // Log but don't fail the whole process, booking is confirmed
            }
             // --- Trigger External Sync ---
             // Move sync here, only sync AFTER booking is confirmed
             console.log(`[updateBookingPaymentInfo] Triggering external sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
             try {
                 const propertyDetails = await getPropertyForSync(bookingData.propertyId);
                 if (propertyDetails) {
                     if (propertyDetails.airbnbListingId) {
                         await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                     }
                     if (propertyDetails.bookingComListingId) {
                         await updateBookingComListingAvailability(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                     }
                 } else {
                     console.warn(`[updateBookingPaymentInfo Sync] Could not find property ${bookingData.propertyId} for external sync.`);
                 }
             } catch (syncError) {
                  console.error(`❌ [updateBookingPaymentInfo Sync] Error syncing externally for booking ${bookingId}:`, syncError);
             }

        } else {
             console.warn(`[updateBookingPaymentInfo] Missing check-in/out dates for booking ${bookingId}. Cannot update availability.`);
        }

    } catch (error) {
        console.error(`❌ [updateBookingPaymentInfo] Error updating booking ${bookingId}:`, error);
        throw new Error(`Failed to update booking payment info: ${error instanceof Error ? error.message : String(error)}`);
    }
}


/**
 * Creates a new confirmed booking document in Firestore (e.g., for simulations or direct creation).
 * NOTE: The primary flow now uses createPendingBookingAction followed by webhook confirmation.
 * This function might still be useful for the simulation button.
 */
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   const paymentIntentId = (rawBookingData as any)?.paymentInput?.stripePaymentIntentId || 'N/A'; // Handle potential missing paymentInput
   console.log(`--- [createBooking] Function called (likely simulation) for Payment Intent [${paymentIntentId}] ---`);
   console.log(`[createBooking] Received raw data:`, JSON.stringify(rawBookingData, null, 2));

   let bookingData: z.infer<typeof CreateBookingDataSchema>;

   // Zod Validation
   console.log(`[createBooking] Starting Zod validation...`);
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ [createBooking] Validation Error:`, validationError.message);
     throw validationError;
   }
   bookingData = validationResult.data;
   console.log(`[createBooking] Data passed validation.`);


  try {
     console.log(`[createBooking] Entered main try block.`);
     const bookingsCollection = collection(db, 'bookings');

     // Data Transformation
     console.log(`[createBooking] Transforming data for Firestore...`);
     const checkInDate = new Date(bookingData.checkInDate);
     const checkOutDate = new Date(bookingData.checkOutDate);
     const checkInTimestamp = ClientTimestamp.fromDate(checkInDate);
     const checkOutTimestamp = ClientTimestamp.fromDate(checkOutDate);

     // Construct PaymentInfo if paymentInput exists (for simulation)
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
          // Create a default placeholder if no paymentInput provided (shouldn't happen in normal flow)
           paymentInfo = {
               stripePaymentIntentId: 'N/A',
               amount: bookingData.pricing.total,
               status: 'unknown', // Or 'confirmed' if assuming success?
               paidAt: null,
           };
      }

     // Construct the final booking document data
     const docData: Omit<Booking, 'id'> = {
         propertyId: bookingData.propertyId,
         guestInfo: bookingData.guestInfo,
         checkInDate: checkInTimestamp,
         checkOutDate: checkOutTimestamp,
         numberOfGuests: bookingData.numberOfGuests,
         pricing: bookingData.pricing,
         appliedCouponCode: bookingData.appliedCouponCode,
         status: bookingData.status || 'confirmed', // Default to confirmed for direct creation/simulation
         paymentInfo: paymentInfo,
         notes: bookingData.notes,
         source: bookingData.source || 'simulation', // Default source
         externalId: bookingData.externalId,
         createdAt: clientServerTimestamp(),
         updatedAt: clientServerTimestamp(),
     };

     console.log(`[createBooking] Firestore Doc Data Prepared:`, JSON.stringify({ ...docData, checkInDate: `Timestamp(${checkInDate.toISOString()})`, checkOutDate: `Timestamp(${checkOutDate.toISOString()})`, paidAt: docData.paymentInfo.paidAt ? `Timestamp(${(docData.paymentInfo.paidAt as ClientTimestamp).toDate().toISOString()})` : null, createdAt: 'ServerTimestamp', updatedAt: 'ServerTimestamp' }, null, 2));


     // Firestore Operation (Client SDK)
     console.log(`[createBooking] Attempting to add booking document...`);
     const docRef = await addDoc(bookingsCollection, docData);
     const bookingId = docRef.id;
     console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId}`);

     // --- Update Property Availability (Client SDK) ---
     console.log(`[createBooking] Triggering local availability update for property ${bookingData.propertyId}, booking ${bookingId}`);
     try {
       await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false);
       console.log(`✅ [createBooking] Successfully finished update call for local availability for property ${bookingData.propertyId}, booking ${bookingId}.`);
     } catch (availabilityError) {
       console.error(`❌ [createBooking] Failed to update local availability for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
       // Decide if this should block the entire process or just log a warning
       // In simulation, maybe log and continue? For real bookings, re-throw.
        // throw availabilityError; // Uncomment if availability update failure should halt creation
        console.warn(`⚠️ [createBooking] Availability update failed, but booking ${bookingId} was created (source: ${docData.source}). Manual check needed.`);
     }

     // --- Synchronize Availability with External Platforms ---
     // Skip sync for simulation/test bookings or handle differently if needed
      if (docData.source !== 'simulation' && docData.source !== 'test-button') {
          console.log(`[createBooking] Starting external platform sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
          try {
             const propertyDetails = await getPropertyForSync(bookingData.propertyId);
             if (propertyDetails) {
                 if (propertyDetails.airbnbListingId) {
                     await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                 }
                 if (propertyDetails.bookingComListingId) {
                     await updateBookingComListingAvailability(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                 }
             } else {
                  console.warn(`[createBooking Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync.`);
             }
         } catch (syncError) {
             console.error(`❌ [createBooking Sync] Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
         }
     } else {
          console.log(`[createBooking] Skipping external sync for booking source: ${docData.source}`);
     }

     console.log(`--- [createBooking] Function returning successfully with booking ID: ${bookingId} ---`);
     return bookingId;

   } catch (error) {
      if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
          console.error(`❌ [createBooking] Error during booking creation process:`, error);
      }
     const errorMessage = error instanceof Error
         ? (error.message.startsWith('Invalid booking data:') ? error.message : `Failed to create booking (Ref: ${paymentIntentId}). Please contact support.`)
         : `An unexpected error occurred while creating the booking (Ref: ${paymentIntentId}). Please contact support.`;

     throw new Error(errorMessage);
   }
 }

/**
 * Retrieves a booking document by its ID using the Client SDK.
 */
export async function getBookingById(bookingId: string): Promise<Booking | null> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId); // Use Client SDK 'db'
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Convert Timestamps if needed for client consumption, or keep as Timestamps
            const bookingResult = {
                id: docSnap.id,
                ...data,
                checkInDate: data.checkInDate, // Client Timestamp
                checkOutDate: data.checkOutDate, // Client Timestamp
                createdAt: data.createdAt, // Client Timestamp
                updatedAt: data.updatedAt, // Client Timestamp
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, // Client Timestamp or null
                },
            } as Booking;
            return bookingResult;
        } else {
            console.warn(`[getBookingById] No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ [getBookingById] Error fetching booking with ID ${bookingId}:`, error);
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates the status of a specific booking document using the Client SDK.
 * Calls updatePropertyAvailability (Client SDK) if status is 'cancelled'.
 */
export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId); // Use Client SDK 'db'
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(), // Use Client serverTimestamp
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);

        if (status === 'cancelled') {
          const booking = await getBookingById(bookingId); // Re-fetch using Client SDK
          if (booking && booking.checkInDate && booking.checkOutDate) {
            // Convert Client Timestamps back to Dates
             const checkInDate = booking.checkInDate instanceof Timestamp
                ? booking.checkInDate.toDate()
                : booking.checkInDate ? new Date(booking.checkInDate as any) : null;
             const checkOutDate = booking.checkOutDate instanceof Timestamp
                ? booking.checkOutDate.toDate()
                : booking.checkOutDate ? new Date(booking.checkOutDate as any) : null;

             if (checkInDate && checkOutDate) {
                 try {
                     // Make dates available again
                     await updatePropertyAvailability(booking.propertyId, checkInDate, checkOutDate, true);
                     console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);

                      // Trigger external sync to release dates
                     await triggerExternalSyncForDateUpdate(booking.propertyId, checkInDate, checkOutDate, true);

                 } catch (availError) {
                      console.error(`❌ [updateBookingStatus] Failed to update local availability or sync for cancelled booking ${bookingId}:`, availError);
                 }
             } else {
                  console.warn(`[updateBookingStatus] Could not parse dates for booking ${bookingId} to update availability after cancellation.`);
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

/**
 * Retrieves all bookings associated with a specific property ID using the Client SDK.
 */
export async function getBookingsForProperty(propertyId: string): Promise<Booking[]> {
    const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings'); // Use Client SDK 'db'
        const q = query(bookingsCollection, where('propertyId', '==', propertyId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                checkInDate: data.checkInDate, // Client Timestamp
                checkOutDate: data.checkOutDate, // Client Timestamp
                createdAt: data.createdAt, // Client Timestamp
                updatedAt: data.updatedAt, // Client Timestamp
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, // Client Timestamp or null
                },
            } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForProperty] Error fetching bookings for property ${propertyId}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Retrieves all bookings associated with a specific user ID using the Client SDK.
 */
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
     const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings'); // Use Client SDK 'db'
        const q = query(bookingsCollection, where('guestInfo.userId', '==', userId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
             const data = doc.data();
             bookings.push({
                 id: doc.id,
                ...data,
                checkInDate: data.checkInDate, // Client Timestamp
                checkOutDate: data.checkOutDate, // Client Timestamp
                createdAt: data.createdAt, // Client Timestamp
                updatedAt: data.updatedAt, // Client Timestamp
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, // Client Timestamp or null
                },
             } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForUser] Error fetching bookings for user ${userId}:`, error);
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates the availability status for a given property and date range in Firestore
 * using the **Firebase Client SDK**. Requires appropriate security rules.
 */
export async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, available: boolean): Promise<void> {
  console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
  console.log(`[updatePropertyAvailability - CLIENT SDK] Args: propertyId=${propertyId}, checkIn=${format(checkInDate, 'yyyy-MM-dd')}, checkOut=${format(checkOutDate, 'yyyy-MM-dd')} (exclusive), available=${available}`);

  if (!db) {
    console.error("❌ [updatePropertyAvailability - CLIENT SDK] Firestore Client SDK (db) is not initialized.");
    throw new Error("Firestore Client SDK is not initialized.");
  }

  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability] Check-out date (${format(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${format(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
    return;
  }

  // Ensure dates are at the start of the day UTC for consistency
  const start = startOfDay(checkInDate);
  const end = startOfDay(subDays(checkOutDate, 1)); // Make checkout date exclusive

  const datesToUpdate = eachDayOfInterval({ start, end });

  if (datesToUpdate.length === 0) {
    console.log("[updatePropertyAvailability - CLIENT SDK] No dates need updating.");
    return;
  }
  console.log(`[updatePropertyAvailability - CLIENT SDK] Dates to update (${datesToUpdate.length}): ${datesToUpdate.map(d => format(d, 'yyyy-MM-dd')).join(', ')}`);

  const updatesByMonth: { [month: string]: { [day: number]: boolean } } = {};
  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM'); // Use UTC month
    const dayOfMonth = date.getUTCDate(); // Use UTC day
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = {};
    }
    updatesByMonth[monthStr][dayOfMonth] = available;
  });
  console.log(`[updatePropertyAvailability - CLIENT SDK] Updates grouped by month:`, JSON.stringify(updatesByMonth));

  const batch = clientWriteBatch(db);
  const availabilityCollection = collection(db, 'availability');
  console.log(`[updatePropertyAvailability - CLIENT SDK] Initialized Firestore Client batch.`);

  try {
    const monthStrings = Object.keys(updatesByMonth);
    console.log(`[updatePropertyAvailability - CLIENT SDK] Processing months: ${monthStrings.join(', ')}`);

    if (monthStrings.length === 0) return;

    const docIdsToFetch = monthStrings.map(monthStr => `${propertyId}_${monthStr}`);
    console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${monthStrings.length} months...`);

    const idBatches: string[][] = [];
    for (let i = 0; i < docIdsToFetch.length; i += 30) {
      idBatches.push(docIdsToFetch.slice(i, i + 30));
    }

    const fetchedDocsMap = new Map<string, Availability>();
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
    console.log(`[updatePropertyAvailability - CLIENT SDK] Fetched ${fetchedDocsMap.size} existing doc snapshots.`);

    monthStrings.forEach(monthStr => {
      const availabilityDocId = `${propertyId}_${monthStr}`;
      console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Days: ${Object.keys(updatesByMonth[monthStr]).join(', ')}`);
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId);
      const updatesForDay = updatesByMonth[monthStr];

      const updatePayload: { [key: string]: any } = {};
      for (const day in updatesForDay) {
        updatePayload[`available.${String(day)}`] = updatesForDay[day];
      }
      updatePayload.updatedAt = clientServerTimestamp();
      console.log(`[updatePropertyAvailability Batch Prep] Payload for ${availabilityDocId}:`, JSON.stringify({ ...updatePayload, updatedAt: 'ServerTimestamp' }));


      const existingDoc = fetchedDocsMap.get(availabilityDocId);

      if (existingDoc) {
        console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} exists. Adding UPDATE.`);
        batch.update(availabilityDocRef, updatePayload);
      } else {
        console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial.`);
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        const initialAvailableMap: { [day: number]: boolean } = {};
        for (let day = 1; day <= daysInMonth; day++) {
          initialAvailableMap[day] = updatesForDay[day] !== undefined ? updatesForDay[day] : true;
        }

        const newDocData: Partial<Availability> = {
          propertyId: propertyId,
          month: monthStr,
          available: initialAvailableMap,
          updatedAt: clientServerTimestamp(),
        };
        console.log(`[updatePropertyAvailability Batch Prep] Adding SET (merge: true) for ${availabilityDocId}.`);
        batch.set(availabilityDocRef, newDocData, { merge: true });
      }
    });

    console.log(`[updatePropertyAvailability - CLIENT SDK] Committing client batch for property ${propertyId}...`);
    await batch.commit();
    console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Batch committed for property ${propertyId}.`);
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function finished successfully ---`);

  } catch (error) {
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
    // Rethrow with a more specific message if it's a permission error
     if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
        throw new Error(`Permission denied updating availability. Check Firestore rules.`);
     }
    throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to trigger external sync after availability update.
 */
async function triggerExternalSyncForDateUpdate(propertyId: string, checkInDate: Date, checkOutDate: Date, isAvailable: boolean): Promise<void> {
    console.log(`[Sync Trigger] Syncing availability change for property ${propertyId} (${isAvailable ? 'Release' : 'Block'})`);
     try {
       const propertyDetails = await getPropertyForSync(propertyId);
       if (propertyDetails) {
           if (propertyDetails.airbnbListingId) {
               await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, isAvailable, checkInDate, checkOutDate);
           }
           if (propertyDetails.bookingComListingId) {
               await updateBookingComListingAvailability(propertyDetails.bookingComListingId, isAvailable, checkInDate, checkOutDate);
           }
       } else {
           console.warn(`[Sync Trigger] Could not find property ${propertyId} for external sync.`);
       }
   } catch (syncError) {
        console.error(`❌ [Sync Trigger] Error syncing externally for property ${propertyId}:`, syncError);
   }
}


/**
 * Fetches all unavailable dates for a given property using the Client SDK.
 */
export async function getUnavailableDatesForProperty(propertyId: string, monthsToFetch: number = 12): Promise<Date[]> {
  const unavailableDates: Date[] = [];
  console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
  console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertyId} for the next ${monthsToFetch} months.`);

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
      monthDocIds.push(`${propertyId}_${monthStr}`);
    }

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }

     if (monthDocIds.length === 0) {
        console.log("[getUnavailableDatesForProperty] No month document IDs to query.");
        return [];
    }

    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds) => {
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
          return getDocs(q);
      })
    );

    allQuerySnapshots.forEach((querySnapshot) => {
         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
            const monthStr = data.month || docId.split('_')[1]; // Prefer data.month

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 console.warn(`[getUnavailableDates] Invalid month string for doc ${docId}. Skipping.`);
                 return;
             }

            if (data.available && typeof data.available === 'object') {
                const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                const month = monthIndex - 1; // JS months 0-indexed

                for (const dayStr in data.available) {
                    const day = parseInt(dayStr, 10);
                    if (!isNaN(day) && data.available[day] === false) {
                        try {
                            // Construct date as UTC date
                            const date = new Date(Date.UTC(year, month, day));
                             // Double check date validity after creation
                             if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                const todayUtcStart = startOfDay(new Date()); // Compare against local start of today
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
        });
    });

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    console.log(`[getUnavailableDates] Found ${unavailableDates.length} unavailable dates for ${propertyId}.`);
    console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
    return unavailableDates;

  } catch (error) {
    console.error(`❌ Error fetching unavailable dates for property ${propertyId}:`, error);
    console.log(`--- [getUnavailableDatesForProperty] Function finished with error ---`);
    return [];
  }
}
