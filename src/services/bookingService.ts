
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
import type { Booking, Availability, Property } from '@/types';
import { differenceInCalendarDays, eachDayOfInterval, format, parse, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { updateAirbnbListingAvailability, updateBookingComListingAvailability, getPropertyForSync } from './booking-sync';


// Define the structure for creating a booking
// Aligning pricing with the updated Booking type
export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo' |
  'pricing' // Pricing structure will be derived but needs explicit fields
> & {
  checkInDate: string;
  checkOutDate: string;
  pricing: { // Explicitly define expected input for pricing calc
    baseRate: number;
    numberOfNights: number;
    cleaningFee: number;
    extraGuestFee?: number; // From property at time of booking
    numberOfExtraGuests?: number; // Calculated based on form input
    total: number; // Final total calculated by the form/client
    accommodationTotal: number; // New field for base + extra guests cost
    subtotal: number; // New field for accommodation + cleaning
    taxes?: number; // Still optional
  };
  paymentInput: {
    stripePaymentIntentId: string;
    amount: number;
    status: string;
  };
};

// Define Zod schema for validation - Updated pricing schema
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
  pricing: z.object({ // Updated pricing validation
    baseRate: z.number().positive({ message: 'Base rate must be positive.' }),
    numberOfNights: z.number().int().positive({ message: 'Number of nights must be positive.' }),
    cleaningFee: z.number().nonnegative({ message: 'Cleaning fee cannot be negative.' }),
    extraGuestFee: z.number().nonnegative({ message: 'Extra guest fee cannot be negative.' }).optional(),
    numberOfExtraGuests: z.number().int().nonnegative({ message: 'Number of extra guests cannot be negative.' }).optional(),
    accommodationTotal: z.number().positive({ message: 'Accommodation total must be positive.' }),
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
   const paymentIntentId = rawBookingData?.paymentInput?.stripePaymentIntentId || 'N/A';

   let bookingData: z.infer<typeof CreateBookingDataSchema>;

   // Zod Validation
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ [createBooking] Validation Error for Payment Intent [${paymentIntentId}]:`, validationError.message);
     throw validationError;
   }
   bookingData = validationResult.data;

  try {
    const bookingsCollection = collection(db, 'bookings'); // Use Client SDK 'db' for booking creation

    // Data Transformation
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

    // Remove paymentInput before creating the main docData
    const { paymentInput, ...restOfBookingData } = bookingData;

    // Construct the final booking document data, including the updated pricing structure
    const docData: Omit<Booking, 'id'> = {
        ...restOfBookingData,
        checkInDate: checkInTimestamp,
        checkOutDate: checkOutTimestamp,
        // The pricing object from validated data already matches the Booking type
        pricing: {
            baseRate: restOfBookingData.pricing.baseRate,
            numberOfNights: restOfBookingData.pricing.numberOfNights,
            cleaningFee: restOfBookingData.pricing.cleaningFee,
            extraGuestFee: restOfBookingData.pricing.extraGuestFee, // Store the fee applied
            numberOfExtraGuests: restOfBookingData.pricing.numberOfExtraGuests, // Store number of extra guests
            accommodationTotal: restOfBookingData.pricing.accommodationTotal, // Store calculated accommodation total
            subtotal: restOfBookingData.pricing.subtotal, // Store calculated subtotal
            taxes: restOfBookingData.pricing.taxes ?? 0, // Default taxes to 0 if not provided
            total: restOfBookingData.pricing.total, // Store final total
        },
        paymentInfo: paymentInfo,
        createdAt: clientServerTimestamp(), // Use Client serverTimestamp
        updatedAt: clientServerTimestamp(), // Use Client serverTimestamp
        status: restOfBookingData.status || 'confirmed', // Default status to 'confirmed'
    };

    // Log the prepared data for debugging (optional)
    // console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify(docData, null, 2));


    // Firestore Operation (Client SDK)
    const docRef = await addDoc(bookingsCollection, docData);
    const bookingId = docRef.id;
    console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

    // --- Update Property Availability (Client SDK) ---
    try {
      await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false);
      console.log(`✅ [createBooking] Successfully finished update call for local availability (Client SDK) for property ${bookingData.propertyId}, booking ${bookingId}.`);
    } catch (availabilityError) {
      console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
    }

     // --- Synchronize Availability with External Platforms ---
     try {
        const propertyDetails = await getPropertyForSync(bookingData.propertyId);
        if (propertyDetails) {
            if (propertyDetails.airbnbListingId) {
                await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, false, checkInDate, checkOutDate);
                 console.log(`[Sync] Initiated Airbnb availability update for listing ${propertyDetails.airbnbListingId}.`);
            } else {
                 // console.log(`[Sync] No Airbnb Listing ID found for property ${bookingData.propertyId}. Skipping Airbnb sync.`);
            }
            if (propertyDetails.bookingComListingId) {
                await updateBookingComListingAvailability(propertyDetails.bookingComListingId, false, checkInDate, checkOutDate);
                 console.log(`[Sync] Initiated Booking.com availability update for listing ${propertyDetails.bookingComListingId}.`);
            } else {
                 // console.log(`[Sync] No Booking.com Listing ID found for property ${bookingData.propertyId}. Skipping Booking.com sync.`);
            }
        } else {
             console.warn(`[Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync.`);
        }
    } catch (syncError) {
        console.error(`❌ [Sync] Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
    }

    return bookingId;

  } catch (error) {
     if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
         console.error(`❌ [createBooking] Error during booking creation process for Payment Intent [${paymentIntentId}]:`, error);
     }
    const errorMessage = error instanceof Error
        ? (error.message.startsWith('Invalid booking data:') ? error.message : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${error.message}`)
        : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${String(error)}`;

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
            const checkIn = (booking.checkInDate as ClientTimestamp).toDate();
            const checkOut = (booking.checkOutDate as ClientTimestamp).toDate();
            try {
                // **** Call function using Client SDK ****
                await updatePropertyAvailability(booking.propertyId, checkIn, checkOut, true);
                console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
            } catch (availError) {
                 console.error(`❌ [updateBookingStatus] Failed to update local availability (Client SDK) for cancelled booking ${bookingId}:`, availError);
            }

             // Trigger external sync
             try {
                const propertyDetails = await getPropertyForSync(booking.propertyId);
                if (propertyDetails) {
                    if (propertyDetails.airbnbListingId) {
                        await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, true, checkIn, checkOut);
                         console.log(`[Sync] Initiated Airbnb date release for ${propertyDetails.airbnbListingId}`);
                    }
                     if (propertyDetails.bookingComListingId) {
                        await updateBookingComListingAvailability(propertyDetails.bookingComListingId, true, checkIn, checkOut);
                         console.log(`[Sync] Initiated Booking.com date release for ${propertyDetails.bookingComListingId}`);
                    }
                } else {
                    console.warn(`[Sync] Could not find property details for ${booking.propertyId} to sync cancellation.`);
                }
             } catch (syncError) {
                 console.error(`❌ [Sync] Error syncing availability after cancellation for booking ${bookingId}:`, syncError);
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
 * using the **Firebase Client SDK**.
 *
 * This function relies on Firestore security rules to allow the necessary writes.
 * It should be called from a trusted server environment (e.g., a Next.js server action)
 * that runs under an appropriate authentication context if required by the rules.
 * It temporarily allows all writes for testing server-side functions.
 */
export async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, available: boolean): Promise<void> {
  // Reduced logging
  // console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
  // console.log(`[updatePropertyAvailability - CLIENT SDK] Args: propertyId=${propertyId}, checkIn=${format(checkInDate, 'yyyy-MM-dd')}, checkOut=${format(checkOutDate, 'yyyy-MM-dd')} (exclusive), available=${available}`);

  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability] Check-out date (${format(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${format(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
    return;
  }

  const datesToUpdate = eachDayOfInterval({
    start: checkInDate,
    end: subDays(checkOutDate, 1)
  });

  if (datesToUpdate.length === 0) {
      return;
  }

  const updatesByMonth: { [month: string]: { [day: number]: boolean } } = {};
  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM');
    const dayOfMonth = date.getDate();
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = {};
    }
    updatesByMonth[monthStr][dayOfMonth] = available;
  });

  const batch = clientWriteBatch(db); // Use clientWriteBatch with client db
  const availabilityCollection = collection(db, 'availability'); // Use client db

  try {
    const monthStrings = Object.keys(updatesByMonth);

    if (monthStrings.length === 0) {
      return;
    }

    // Fetch existing docs using Client SDK 'in' query
    const docIdsToFetch = monthStrings.map(monthStr => `${propertyId}_${monthStr}`);

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


    monthStrings.forEach(monthStr => {
      const availabilityDocId = `${propertyId}_${monthStr}`;
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId); // Use client db
      const updatesForDay = updatesByMonth[monthStr];

      const updatePayload: { [key: string]: boolean | any } = {}; // Use 'any' for clientServerTimestamp
      for (const day in updatesForDay) {
        updatePayload[`available.${String(day)}`] = updatesForDay[day];
      }
      updatePayload.updatedAt = clientServerTimestamp(); // Use Client serverTimestamp

      const existingDoc = fetchedDocsMap.get(availabilityDocId);

      if (existingDoc) {
        batch.update(availabilityDocRef, updatePayload);
      } else {
        const [year, month] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(year, month, 0).getDate();
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
        batch.set(availabilityDocRef, newDocData, { merge: true }); // Use merge: true to avoid overwriting existing fields if any
      }
    });

    // Commit the Client SDK batch write
    await batch.commit();
    console.log(`✅ [updatePropertyAvailability] Successfully committed batch updates for local availability for property ${propertyId}.`);

  } catch (error) {
    // This error might be due to Firestore security rules denying the write.
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
  }
}


/**
 * Fetches all unavailable dates for a given property within a reasonable future range
 * using the **Client SDK**.
 */
export async function getUnavailableDatesForProperty(propertyId: string, monthsToFetch: number = 12): Promise<Date[]> {
  const unavailableDates: Date[] = [];
  const availabilityCollection = collection(db, 'availability'); // Use Client SDK 'db'
  const today = new Date();
  // Use UTC for consistency when dealing with dates across potential timezones
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));


  try {
    const monthDocIds: string[] = [];
    for (let i = 0; i < monthsToFetch; i++) {
      // Calculate target month correctly in UTC
      const targetMonth = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + i, 1));
      const monthStr = format(targetMonth, 'yyyy-MM');
      monthDocIds.push(`${propertyId}_${monthStr}`);
    }

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) { // Firestore 'in' query supports up to 30 elements
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }

     if (monthDocIds.length === 0) {
        return [];
    }

    // Execute queries using Client SDK
    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds) => {
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds)); // Use documentId() for client query
          return getDocs(q);
      })
    );

    allQuerySnapshots.forEach((querySnapshot) => {
         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
            const monthStrFromId = docId.split('_')[1];
            const monthStrFromData = data.month;
            // Prefer month from data if available, fallback to parsing from ID
            const monthStr = monthStrFromData || monthStrFromId;

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 console.warn(`[getUnavailableDatesForProperty] Could not determine valid month string for doc ${docId}. Skipping.`);
                 return;
             }

            if (data.available && typeof data.available === 'object') {
                const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                const month = monthIndex - 1; // JS months are 0-indexed

                for (const dayStr in data.available) {
                    const day = parseInt(dayStr, 10);
                    if (!isNaN(day) && data.available[day] === false) {
                        try {
                            if (year > 0 && month >= 0 && month < 12 && day > 0 && day <= 31) {
                                const date = new Date(Date.UTC(year, month, day)); // Work in UTC
                                 if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                    const todayUtcStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
                                    if (date >= todayUtcStart) {
                                        unavailableDates.push(date);
                                    }
                                 } else {
                                    // console.warn(`[getUnavailableDatesForProperty] Invalid date created for ${year}-${monthStr}-${dayStr} in doc ${docId}. Skipping.`);
                                 }
                            } else {
                                // console.warn(`[getUnavailableDatesForProperty] Invalid year/month/day components found in doc ${docId}: year=${year}, month=${monthIndex}, day=${dayStr}. Skipping.`);
                            }
                        } catch (dateError) {
                            // console.warn(`[getUnavailableDatesForProperty] Error creating date for ${year}-${monthStr}-${dayStr} in doc ${docId}:`, dateError, `. Skipping.`);
                        }
                    }
                }
            } else {
                // console.warn(`[getUnavailableDatesForProperty] Document ${docId} has missing or invalid 'available' data. Skipping.`);
            }
        });
    });

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    return unavailableDates;

  } catch (error) {
    console.error(`❌ Error fetching unavailable dates for property ${propertyId}:`, error);
    return []; // Return empty array on error
  }
}

