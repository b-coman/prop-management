
// src/services/bookingService.ts
'use server'; // Mark this module for server-side execution

import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp as clientServerTimestamp, // Rename client timestamp
  Timestamp as ClientTimestamp, // Rename client timestamp
  writeBatch as clientWriteBatch, // Rename client batch
  setDoc as clientSetDoc, // Rename client setDoc
  QueryConstraint,
  limit,
  documentId, // Import documentId for querying by ID
} from 'firebase/firestore';
import { z } from 'zod';
import { db } from '@/lib/firebase'; // **** Use Client SDK Firestore instance ****
// import { dbAdmin } from '@/lib/firebaseAdmin'; // **** No longer using Admin SDK here ****
// import * as admin from 'firebase-admin'; // No longer using admin types here
import type { Booking, Availability, Property } from '@/types';
import { differenceInCalendarDays, eachDayOfInterval, format, parse, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { updateAirbnbListingAvailability, updateBookingComListingAvailability, getPropertyForSync } from './booking-sync';

// Define the structure for creating a booking
export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo'
> & {
  checkInDate: string;
  checkOutDate: string;
  paymentInput: {
    stripePaymentIntentId: string;
    amount: number;
    status: string;
  };
};

// Define Zod schema for validation
const CreateBookingDataSchema = z.object({
  propertyId: z.string().min(1, { message: 'Property ID is required.' }),
  guestInfo: z.object({
    firstName: z.string().min(1, { message: 'Guest first name is required.' }),
    lastName: z.string().optional(),
    email: z.string().email({ message: 'Invalid guest email address.' }),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    userId: z.string().optional(),
  }).passthrough(),
  checkInDate: z.string().datetime({ message: 'Invalid check-in date format (ISO string expected).' }),
  checkOutDate: z.string().datetime({ message: 'Invalid check-out date format (ISO string expected).' }),
  numberOfGuests: z.number().int().positive({ message: 'Number of guests must be positive.' }),
  pricing: z.object({
    baseRate: z.number().positive({ message: 'Base rate must be positive.' }),
    numberOfNights: z.number().int().positive({ message: 'Number of nights must be positive.' }),
    cleaningFee: z.number().nonnegative({ message: 'Cleaning fee cannot be negative.' }),
    subtotal: z.number().positive({ message: 'Subtotal must be positive.' }),
    taxes: z.number().nonnegative({ message: 'Taxes cannot be negative.' }).optional(),
    total: z.number().positive({ message: 'Total price must be positive.' }),
  }).passthrough(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  paymentInput: z.object({
    stripePaymentIntentId: z.string().min(1, { message: 'Stripe Payment Intent ID is required.' }),
    amount: z.number().positive({ message: 'Payment amount must be positive.' }),
    status: z.string().min(1, { message: 'Payment status is required.' }),
  }).passthrough(),
  notes: z.string().optional(),
  source: z.string().optional(),
  externalId: z.string().optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'],
});


/**
 * Creates a new booking document in Firestore using the Client SDK.
 * Calls updatePropertyAvailability (which now also uses the Client SDK) upon success.
 */
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   console.log("--- [createBooking] Function called ---");
   const paymentIntentId = rawBookingData?.paymentInput?.stripePaymentIntentId || 'N/A';
   console.log(`[createBooking] Received raw data for Payment Intent [${paymentIntentId}]`);

   let bookingData: z.infer<typeof CreateBookingDataSchema>;

   // Zod Validation
   console.log(`[createBooking] Starting Zod validation for Payment Intent [${paymentIntentId}]...`);
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ [createBooking] Validation Error for Payment Intent [${paymentIntentId}]:`, validationError.message);
     console.log("--- [createBooking] Function throwing validation error ---");
     throw validationError;
   }
   bookingData = validationResult.data;
   console.log(`[createBooking] Data passed validation for Payment Intent [${paymentIntentId}]`);

  try {
    console.log(`[createBooking] Entered main try block for Payment Intent [${paymentIntentId}]`);
    const bookingsCollection = collection(db, 'bookings'); // Use Client SDK 'db' for booking creation

    // Data Transformation
    console.log(`[createBooking] Transforming data for Firestore for Payment Intent [${paymentIntentId}]...`);
    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);
    const checkInTimestamp = ClientTimestamp.fromDate(checkInDate); // Use Client Timestamp
    const checkOutTimestamp = ClientTimestamp.fromDate(checkOutDate); // Use Client Timestamp

    const paymentInfo: Booking['paymentInfo'] = {
      stripePaymentIntentId: bookingData.paymentInput.stripePaymentIntentId,
      amount: bookingData.paymentInput.amount,
      status: bookingData.paymentInput.status,
      paidAt: bookingData.paymentInput.status === 'succeeded' || bookingData.paymentInput.status === 'paid'
        ? ClientTimestamp.now() // Use Client Timestamp
        : null,
    };

    const { paymentInput, ...restOfBookingData } = bookingData;

    const docData: Omit<Booking, 'id'> = {
        ...restOfBookingData,
        checkInDate: checkInTimestamp,
        checkOutDate: checkOutTimestamp,
        paymentInfo: paymentInfo,
        createdAt: clientServerTimestamp(), // Use Client serverTimestamp
        updatedAt: clientServerTimestamp(), // Use Client serverTimestamp
        status: restOfBookingData.status || 'confirmed',
    };
    console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify(docData, (key, value) => {
        if (value && typeof value === 'object' && value.hasOwnProperty('_methodName') && value._methodName === 'serverTimestamp') {
            return 'ServerTimestamp'; // Replace serverTimestamp placeholder for cleaner logging
        }
         if (value && typeof value === 'object' && value.hasOwnProperty('seconds') && value.hasOwnProperty('nanoseconds')) {
            // Basic check for Firestore Timestamp-like structure
            return `Timestamp(${new Date(value.seconds * 1000).toISOString()})`;
        }
        return value;
    }, 2));


    // Firestore Operation (Client SDK)
    console.log(`[createBooking] Attempting to add booking document to Firestore (Client SDK) for Payment Intent [${paymentIntentId}]...`);
    const docRef = await addDoc(bookingsCollection, docData);
    const bookingId = docRef.id;
    console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

    // --- Update Property Availability (Client SDK) ---
    console.log(`[createBooking] Triggering local availability update (Client SDK) for property ${bookingData.propertyId}, booking ${bookingId}`);
    try {
      // **** Call the function that now uses the Client SDK ****
      await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false);
      console.log(`✅ [createBooking] Successfully finished update call for local availability (Client SDK) for property ${bookingData.propertyId}, booking ${bookingId}.`);
    } catch (availabilityError) {
      // Log error, but don't fail the booking if availability update fails
      // IMPORTANT: This failure might indicate security rule issues or problems writing availability data.
      console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
    }

     // --- Synchronize Availability with External Platforms ---
     console.log(`[createBooking] Starting external platform sync for property ${bookingData.propertyId}, booking ${bookingId}...`);
     try {
        const propertyDetails = await getPropertyForSync(bookingData.propertyId);
        if (propertyDetails) {
            if (propertyDetails.airbnbListingId) {
                await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                 console.log(`✅ [createBooking Sync] Successfully initiated Airbnb availability update for listing ${propertyDetails.airbnbListingId}.`);
            } else {
                 console.log(`[createBooking Sync] No Airbnb Listing ID found for property ${bookingData.propertyId}. Skipping Airbnb sync.`);
            }
            if (propertyDetails.bookingComListingId) {
                await updateBookingComListingAvailability(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                 console.log(`✅ [createBooking Sync] Successfully initiated Booking.com availability update for listing ${propertyDetails.bookingComListingId}.`);
            } else {
                 console.log(`[createBooking Sync] No Booking.com Listing ID found for property ${bookingData.propertyId}. Skipping Booking.com sync.`);
            }
        } else {
             console.warn(`[createBooking Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync. Check if property exists in Firestore.`);
        }
    } catch (syncError) {
        console.error(`❌ [createBooking Sync] Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
    }

    console.log(`--- [createBooking] Function returning successfully with booking ID: ${bookingId} ---`);
    return bookingId;

  } catch (error) {
     if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
         console.error(`❌ [createBooking] Error during booking creation process for Payment Intent [${paymentIntentId}]:`, error);
     }
    const errorMessage = error instanceof Error
        ? (error.message.startsWith('Invalid booking data:') ? error.message : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${error.message}`)
        : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${String(error)}`;

    console.log(`--- [createBooking] Function throwing error: ${errorMessage} ---`);
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
            const bookingResult = {
                id: docSnap.id,
                ...data,
                checkInDate: data.checkInDate, // Keep as Client Timestamp
                checkOutDate: data.checkOutDate, // Keep as Client Timestamp
                createdAt: data.createdAt, // Keep as Client Timestamp
                updatedAt: data.updatedAt, // Keep as Client Timestamp
                paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, // Keep as Client Timestamp or null
                },
            } as Booking;
            return bookingResult;
        } else {
            console.log(`[getBookingById] No booking found with ID: ${bookingId}`);
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
    console.log(`--- [updateBookingStatus] Function called for ID: ${bookingId}, Status: ${status} ---`);
    try {
        const bookingRef = doc(db, 'bookings', bookingId); // Use Client SDK 'db'
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(), // Use Client serverTimestamp
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status} (Client SDK)`);

        if (status === 'cancelled') {
          console.log(`[updateBookingStatus] Booking ${bookingId} cancelled. Attempting to release dates (Client SDK)...`);
          const booking = await getBookingById(bookingId); // Re-fetch using Client SDK
          if (booking && booking.checkInDate && booking.checkOutDate) {
            // Convert Client Timestamps back to Dates
            const checkIn = (booking.checkInDate as ClientTimestamp).toDate();
            const checkOut = (booking.checkOutDate as ClientTimestamp).toDate();
            console.log(`[updateBookingStatus] Releasing local dates for cancelled booking ${bookingId} from ${checkIn.toISOString()} to ${checkOut.toISOString()}`);
            try {
                // **** Call function using Client SDK ****
                await updatePropertyAvailability(booking.propertyId, checkIn, checkOut, true);
                console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
            } catch (availError) {
                 // IMPORTANT: This failure might indicate security rule issues.
                 console.error(`❌ [updateBookingStatus] Failed to update local availability (Client SDK) for cancelled booking ${bookingId}:`, availError);
            }

             // Trigger external sync
             console.log(`[updateBookingStatus] Triggering external sync for cancelled booking ${bookingId}`);
             try {
                const propertyDetails = await getPropertyForSync(booking.propertyId);
                if (propertyDetails) {
                    if (propertyDetails.airbnbListingId) {
                        await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, true, checkIn, checkOut);
                         console.log(`✅ [updateBookingStatus Sync] Initiated Airbnb date release for ${propertyDetails.airbnbListingId}`);
                    }
                     if (propertyDetails.bookingComListingId) {
                        await updateBookingComListingAvailability(propertyDetails.bookingComListingId, true, checkIn, checkOut);
                         console.log(`✅ [updateBookingStatus Sync] Initiated Booking.com date release for ${propertyDetails.bookingComListingId}`);
                    }
                } else {
                    console.warn(`[updateBookingStatus Sync] Could not find property details for ${booking.propertyId} to sync cancellation.`);
                }
             } catch (syncError) {
                 console.error(`❌ [updateBookingStatus Sync] Error syncing availability after cancellation for booking ${bookingId}:`, syncError);
             }
          } else {
             console.warn(`[updateBookingStatus] Could not find booking ${bookingId} or its dates to update availability after cancellation.`);
          }
        }
        console.log(`--- [updateBookingStatus] Function finished successfully for ID: ${bookingId} ---`);

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
 * using the **Firebase Client SDK**.
 *
 * This function relies on Firestore security rules to allow the necessary writes.
 * It should be called from a trusted server environment (e.g., a Next.js server action)
 * that runs under an appropriate authentication context if required by the rules.
 */
export async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, available: boolean): Promise<void> {
  console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
  console.log(`[updatePropertyAvailability - CLIENT SDK] Args: propertyId=${propertyId}, checkIn=${format(checkInDate, 'yyyy-MM-dd')}, checkOut=${format(checkOutDate, 'yyyy-MM-dd')} (exclusive), available=${available}`);

  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability - CLIENT SDK] Check-out date (${format(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${format(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
    return;
  }

  const datesToUpdate = eachDayOfInterval({
    start: checkInDate,
    end: subDays(checkOutDate, 1)
  });

  if (datesToUpdate.length === 0) {
      console.log("[updatePropertyAvailability - CLIENT SDK] No dates need updating.");
      return;
  }
  console.log(`[updatePropertyAvailability - CLIENT SDK] Dates to update (${datesToUpdate.length}): ${datesToUpdate.map(d => format(d, 'yyyy-MM-dd')).join(', ')}`);

  console.log("[updatePropertyAvailability - CLIENT SDK] Grouping updates by month...");
  const updatesByMonth: { [month: string]: { [day: number]: boolean } } = {};
  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM');
    const dayOfMonth = date.getDate();
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = {};
    }
    updatesByMonth[monthStr][dayOfMonth] = available;
  });
  console.log(`[updatePropertyAvailability - CLIENT SDK] Updates grouped by month:`, JSON.stringify(updatesByMonth));

  // **** Use Client SDK's batch and Firestore instance ****
  console.log("[updatePropertyAvailability - CLIENT SDK] Initialized Firestore Client batch.");
  const batch = clientWriteBatch(db); // Use clientWriteBatch with client db
  const availabilityCollection = collection(db, 'availability'); // Use client db

  try {
    const monthStrings = Object.keys(updatesByMonth);
    console.log(`[updatePropertyAvailability - CLIENT SDK] Processing months: ${monthStrings.join(', ')}`);

    if (monthStrings.length === 0) {
      console.log("[updatePropertyAvailability - CLIENT SDK] No months to process after grouping.");
      return;
    }

    // Fetch existing docs using Client SDK 'in' query
    const docIdsToFetch = monthStrings.map(monthStr => `${propertyId}_${monthStr}`);
    console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${docIdsToFetch.length} months...`);

    // Split into batches if necessary (max 30 IDs per 'in' query)
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
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId); // Use client db
      const updatesForDay = updatesByMonth[monthStr];
      console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Updates needed for days: ${Object.keys(updatesForDay).join(', ')}`);

      const updatePayload: { [key: string]: boolean | any } = {}; // Use 'any' for clientServerTimestamp
      for (const day in updatesForDay) {
        updatePayload[`available.${String(day)}`] = updatesForDay[day];
      }
      updatePayload.updatedAt = clientServerTimestamp(); // Use Client serverTimestamp
      console.log(`[updatePropertyAvailability Batch Prep] Prepared update payload for ${availabilityDocId}:`, JSON.stringify(updatePayload, (key, value) => typeof value === 'object' && value !== null && value.constructor?.name?.includes('Timestamp') ? "ServerTimestamp" : value, 2));


      const existingDoc = fetchedDocsMap.get(availabilityDocId);

      if (existingDoc) {
        console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} exists. Adding UPDATE operation to client batch.`);
        batch.update(availabilityDocRef, updatePayload);
      } else {
        console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial data for month ${monthStr}.`);
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
        console.log(`[updatePropertyAvailability Batch Prep] Calculated initial availability map for ${daysInMonth} days in ${monthStr}.`);
        const initialAvailableMap: { [day: number]: boolean } = {};
        for (let day = 1; day <= daysInMonth; day++) {
          initialAvailableMap[day] = updatesForDay[day] !== undefined ? updatesForDay[day] : true; // Apply update if exists, else default to true
        }

        const newDocData: Partial<Availability> = {
          propertyId: propertyId,
          month: monthStr,
          available: initialAvailableMap,
          updatedAt: clientServerTimestamp(), // Use Client serverTimestamp
        };
        console.log(`[updatePropertyAvailability Batch Prep] New doc data for ${availabilityDocId}:`, JSON.stringify(newDocData, (key, value) => typeof value === 'object' && value !== null && value.constructor?.name?.includes('Timestamp') ? "ServerTimestamp" : value, 2));
        console.log(`[updatePropertyAvailability Batch Prep] Adding SET operation (merge: true) to client batch for ${availabilityDocId}.`);
        batch.set(availabilityDocRef, newDocData, { merge: true }); // Use merge: true to avoid overwriting existing fields if any
      }
    });

    // Commit the Client SDK batch write
    console.log(`[updatePropertyAvailability - CLIENT SDK] Preparing to commit client batch for property ${propertyId}, months: ${monthStrings.join(', ')}...`);
    await batch.commit();
    console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Successfully committed client batch updates for local availability.`);
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function finished successfully ---`);

  } catch (error) {
    // This error might be due to Firestore security rules denying the write.
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
    throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
  }
}


/**
 * Fetches all unavailable dates for a given property within a reasonable future range
 * using the **Client SDK**.
 */
export async function getUnavailableDatesForProperty(propertyId: string, monthsToFetch: number = 12): Promise<Date[]> {
  console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
  console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertyId} for the next ${monthsToFetch} months.`);
  const unavailableDates: Date[] = [];
  const availabilityCollection = collection(db, 'availability'); // Use Client SDK 'db'
  const today = new Date();
  const currentMonthStart = startOfMonth(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
   console.log(`[getUnavailableDatesForProperty] Today (UTC): ${today.toISOString()}, Current Month Start (UTC): ${currentMonthStart.toISOString()}`);


  try {
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      const targetMonth = new Date(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1);
      const monthStr = format(targetMonth, 'yyyy-MM');
      monthDocIds.push(`${propertyId}_${monthStr}`);
    }
    console.log(`[getUnavailableDatesForProperty] Querying for document IDs: ${monthDocIds.join(', ')}`);

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) { // Firestore 'in' query supports up to 30 elements
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }
    console.log(`[getUnavailableDatesForProperty] Split into ${queryBatches.length} query batches due to 'in' operator limit.`);


     if (monthDocIds.length === 0) {
        console.log("[getUnavailableDatesForProperty] No month document IDs to query. Returning empty array.");
        return [];
    }

    // Execute queries using Client SDK
    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds, index) => {
           console.log(`[getUnavailableDatesForProperty] Executing query for batch ${index + 1}: ${batchIds.join(', ')}`);
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds)); // Use documentId() for client query
          return getDocs(q);
      })
    );
    console.log(`[getUnavailableDatesForProperty] Fetched results from ${allQuerySnapshots.length} batches.`);

    allQuerySnapshots.forEach((querySnapshot, batchIndex) => {
         console.log(`[getUnavailableDatesForProperty] Processing batch ${batchIndex + 1}: Found ${querySnapshot.size} documents.`);
         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
            const monthStrFromId = docId.split('_')[1];
            const monthStrFromData = data.month;
            // Prefer month from data if available, fallback to parsing from ID
            const monthStr = monthStrFromData || monthStrFromId;
             console.log(`[getUnavailableDatesForProperty] Processing doc ${docId}, using month string: ${monthStr}`);


             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 console.warn(`[getUnavailableDatesForProperty] Could not determine valid month string for doc ${docId}. Skipping.`);
                 return;
             }

            if (data.available && typeof data.available === 'object') {
                 console.log(`[getUnavailableDatesForProperty] Found 'available' map for doc ${docId}. Parsing days...`);
                const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                const month = monthIndex - 1; // JS months are 0-indexed

                for (const dayStr in data.available) {
                    const day = parseInt(dayStr, 10);
                    if (!isNaN(day) && data.available[day] === false) {
                        // Date components seem valid, try creating the Date object
                        try {
                            if (year > 0 && month >= 0 && month < 12 && day > 0 && day <= 31) {
                                // Create date in UTC to avoid timezone issues
                                const date = new Date(Date.UTC(year, month, day));
                                 // Double-check if the created date is valid (accounts for invalid days like Feb 30)
                                 if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                    // Ensure the date is not in the past
                                    const todayUtcStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                                    if (date >= todayUtcStart) {
                                        // console.log(`[getUnavailableDatesForProperty] Adding unavailable date: ${date.toISOString().split('T')[0]}`);
                                        unavailableDates.push(date);
                                    }
                                    // else {
                                    //     console.log(`[getUnavailableDatesForProperty] Skipping past unavailable date: ${date.toISOString().split('T')[0]}`);
                                    // }
                                 } else {
                                    console.warn(`[getUnavailableDatesForProperty] Invalid date created for ${year}-${monthStr}-${dayStr} in doc ${docId}. Skipping.`);
                                 }
                            } else {
                                 console.warn(`[getUnavailableDatesForProperty] Invalid year/month/day components found in doc ${docId}: year=${year}, month=${monthIndex}, day=${dayStr}. Skipping.`);
                            }
                        } catch (dateError) {
                             console.warn(`[getUnavailableDatesForProperty] Error creating date for ${year}-${monthStr}-${dayStr} in doc ${docId}:`, dateError, `. Skipping.`);
                        }
                    }
                }
            } else {
                 console.warn(`[getUnavailableDatesForProperty] Document ${docId} has missing or invalid 'available' data. Skipping.`);
            }
        });
    });

    console.log(`[getUnavailableDatesForProperty] Total unavailable dates found for property ${propertyId}: ${unavailableDates.length}`);
    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    // console.log(`[getUnavailableDatesForProperty] Returning sorted unavailable dates: `, unavailableDates.map(d => d.toISOString().split('T')[0]));
    console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
    return unavailableDates;

  } catch (error) {
    console.error(`❌ Error fetching unavailable dates for property ${propertyId}:`, error);
    return []; // Return empty array on error
  }
}
