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
  serverTimestamp,
  Timestamp,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { z } from 'zod'; // Import Zod
import { db } from '@/lib/firebase'; // Import your initialized Firestore instance
import type { Booking, Availability, Property } from '@/types'; // Added Property type import
import { differenceInCalendarDays, eachDayOfInterval, format, parse } from 'date-fns'; // Import date-fns helpers
import { updateAirbnbListingAvailability, updateBookingComListingAvailability } from './booking-sync'; // Import sync functions

// Define the structure for creating a booking, based on bookingExample and required inputs.
// Omit fields that are auto-generated or should not be provided at creation.
// Use Pick and Omit to be more precise about required fields at creation time.
export type CreateBookingData = Omit<Booking,
  'id' |            // Firestore generates ID
  'checkInDate' |   // Will be converted from string
  'checkOutDate' |  // Will be converted from string
  'createdAt' |     // Firestore server timestamp
  'updatedAt' |     // Firestore server timestamp
  'paymentInfo'     // Will be constructed from paymentInput
> & {
  // Expect ISO strings from Stripe metadata or form
  checkInDate: string;
  checkOutDate: string;
  // Expect payment details from Stripe session/webhook
  paymentInput: {
    stripePaymentIntentId: string;
    amount: number; // Total amount from Stripe (in dollars)
    status: string; // Payment status from Stripe (e.g., 'succeeded', 'paid')
  };
};

// Define Zod schema for validation
const CreateBookingDataSchema = z.object({
  propertyId: z.string().min(1, { message: 'Property ID is required.' }),
  guestInfo: z.object({
    firstName: z.string().min(1, { message: 'Guest first name is required.' }),
    lastName: z.string(), // Optional
    email: z.string().email({ message: 'Invalid guest email address.' }),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    zipCode: z.string().optional(),
    userId: z.string().optional(),
  }),
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
  }),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(), // Allow optional status, default below
  paymentInput: z.object({
    stripePaymentIntentId: z.string().min(1, { message: 'Stripe Payment Intent ID is required.' }),
    amount: z.number().positive({ message: 'Payment amount must be positive.' }),
    status: z.string().min(1, { message: 'Payment status is required.' }),
  }),
  notes: z.string().optional(),
  source: z.string().optional(),
  externalId: z.string().optional(),
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: 'Check-out date must be after check-in date.',
  path: ['checkOutDate'], // Specify the path of the error
});


/**
 * Fetches property details including external listing IDs.
 *
 * @param propertyId The ID of the property to fetch.
 * @returns The Property object or null if not found.
 */
async function getPropertyForSync(propertyId: string): Promise<Property | null> {
    const propertyRef = doc(db, 'properties', propertyId);
    const docSnap = await getDoc(propertyRef);
    if (docSnap.exists()) {
        // Assuming the data structure matches the Property type, including optional external IDs
        return { id: docSnap.id, ...docSnap.data() } as Property;
    } else {
        console.warn(`[getPropertyForSync] Property not found: ${propertyId}`);
        return null;
    }
}

/**
 * Creates a new booking document in Firestore based on the bookingExample structure.
 * Includes enhanced error handling, logging, and Zod validation.
 * Calls updatePropertyAvailability upon successful booking creation.
 * Calls synchronization functions for external platforms.
 *
 * @param rawBookingData - The raw data for the new booking, conforming to CreateBookingData.
 * @returns The ID of the newly created booking document.
 * @throws Throws an error if validation fails or the booking cannot be created, including context like Payment Intent ID.
 */
export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   const paymentIntentId = rawBookingData?.paymentInput?.stripePaymentIntentId || 'N/A';
   console.log(`[createBooking] Received raw data for Payment Intent [${paymentIntentId}]:`, JSON.stringify(rawBookingData, null, 2));

   // --- Zod Validation ---
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);

   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ Validation Error creating booking for Payment Intent [${paymentIntentId}]:`, validationError.message);
     console.error(`[Validation Error Data - Payment Intent: ${paymentIntentId}] Data:`, JSON.stringify(rawBookingData, null, 2));
     throw validationError; // Re-throw the specific validation error
   }

   // Use the validated data from now on
   const bookingData = validationResult.data;
   console.log(`[createBooking] Data passed validation for Payment Intent [${paymentIntentId}]`);


  try {
    const bookingsCollection = collection(db, 'bookings');

    // --- Data Transformation ---
    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);
    const checkInTimestamp = Timestamp.fromDate(checkInDate);
    const checkOutTimestamp = Timestamp.fromDate(checkOutDate);


    // Construct the paymentInfo object using validated data
    const paymentInfo: Booking['paymentInfo'] = {
      stripePaymentIntentId: bookingData.paymentInput.stripePaymentIntentId,
      amount: bookingData.paymentInput.amount,
      status: bookingData.paymentInput.status,
      // Set paidAt timestamp only if payment status indicates success
      paidAt: bookingData.paymentInput.status === 'succeeded' || bookingData.paymentInput.status === 'paid'
        ? Timestamp.now() // Use client-side now(), serverTimestamp is better for create/update time
        : null,
    };

    // Prepare the document data for Firestore, aligning with Booking type
    // Omit 'paymentInput' from the top level as it's now part of 'paymentInfo'
    const { paymentInput, ...restOfBookingData } = bookingData;

    const docData: Omit<Booking, 'id'> = {
        ...restOfBookingData, // Spread the rest of the validated data
        checkInDate: checkInTimestamp,
        checkOutDate: checkOutTimestamp,
        paymentInfo: paymentInfo,
        createdAt: serverTimestamp(), // Firestore generates timestamp on the server
        updatedAt: serverTimestamp(), // Firestore generates timestamp on the server
        status: restOfBookingData.status || 'confirmed', // Default to confirmed if not provided
    };

    console.log(`[Firestore Doc Data - Payment Intent: ${paymentIntentId}] Preparing to save:`, JSON.stringify(docData, (key, value) =>
        // Custom replacer to handle Timestamp objects for logging
        value instanceof Timestamp ? value.toDate().toISOString() : value,
    2));

    // --- Firestore Operation ---
    const docRef = await addDoc(bookingsCollection, docData);
    const bookingId = docRef.id;
    console.log(`✅ Booking created successfully with ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

    // --- Update Local Availability ---
    try {
        await updatePropertyAvailability(bookingData.propertyId, checkInDate, checkOutDate, false); // Mark as unavailable
        console.log(`[Availability Update] Marked local dates as unavailable for property ${bookingData.propertyId} for booking ${bookingId}.`);
    } catch (availabilityError) {
        console.error(`⚠️ Failed to update local availability for property ${bookingData.propertyId} after creating booking ${bookingId}:`, availabilityError);
        // Decide if this should be a fatal error or just logged
    }

     // --- Synchronize Availability with External Platforms ---
     try {
        const propertyDetails = await getPropertyForSync(bookingData.propertyId);
        if (propertyDetails) {
            // Sync with Airbnb if ID exists
            if (propertyDetails.airbnbListingId) {
                console.log(`[Sync] Attempting to update Airbnb listing ${propertyDetails.airbnbListingId} for booking ${bookingId}...`);
                // Assuming updateAirbnbListingAvailability marks the dates as unavailable
                await updateAirbnbListingAvailability(propertyDetails.airbnbListingId, false); // Simplified - Needs date range handling
                console.log(`[Sync] Successfully initiated Airbnb availability update for listing ${propertyDetails.airbnbListingId}.`);
            } else {
                 console.log(`[Sync] No Airbnb Listing ID found for property ${bookingData.propertyId}. Skipping Airbnb sync.`);
            }

            // Sync with Booking.com if ID exists
            if (propertyDetails.bookingComListingId) {
                console.log(`[Sync] Attempting to update Booking.com listing ${propertyDetails.bookingComListingId} for booking ${bookingId}...`);
                // Assuming updateBookingComListingAvailability marks the dates as unavailable
                await updateBookingComListingAvailability(propertyDetails.bookingComListingId, false); // Simplified - Needs date range handling
                 console.log(`[Sync] Successfully initiated Booking.com availability update for listing ${propertyDetails.bookingComListingId}.`);
            } else {
                 console.log(`[Sync] No Booking.com Listing ID found for property ${bookingData.propertyId}. Skipping Booking.com sync.`);
            }
        } else {
             console.warn(`[Sync] Could not retrieve property details for ${bookingData.propertyId} to perform external sync.`);
        }
    } catch (syncError) {
        console.error(`❌ Error synchronizing availability with external platforms for property ${bookingData.propertyId} after creating booking ${bookingId}:`, syncError);
        // Log the error but don't fail the booking process. This might require manual intervention or retry.
    }


    return bookingId;

  } catch (error) {
     // --- Firestore/Other Error Handling & Logging ---
     // Avoid logging validation errors again if they were already caught
     if (!(error instanceof Error && error.message.startsWith('Invalid booking data:'))) {
         console.error(`❌ Error creating booking in Firestore for Payment Intent [${paymentIntentId}]:`, error);
         // Log the data that caused the error for easier debugging
         console.error(`[createBooking Error Data - Payment Intent: ${paymentIntentId}] Data causing error:`, JSON.stringify(bookingData, null, 2)); // Log validated data here
     }

    // Construct a more informative error message (unless it's already a validation error)
    const errorMessage = error instanceof Error
        ? (error.message.startsWith('Invalid booking data:') ? error.message : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${error.message}`)
        : `Failed to create booking (Payment Intent: ${paymentIntentId}): ${String(error)}`;

    // Re-throw the error to be handled by the caller (e.g., the webhook handler)
    throw new Error(errorMessage);
  }
}

/**
 * Retrieves a booking document by its ID.
 *
 * @param bookingId The ID of the booking document.
 * @returns A Promise resolving to the Booking object or null if not found.
 */
export async function getBookingById(bookingId: string): Promise<Booking | null> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            // Combine document ID with data
            // Convert Timestamps to Dates or ISO strings if needed client-side
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                checkInDate: (data.checkInDate as Timestamp)?.toDate(), // Example conversion
                checkOutDate: (data.checkOutDate as Timestamp)?.toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate(),
                paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: (data.paymentInfo?.paidAt as Timestamp | null)?.toDate() ?? null,
                },
            } as unknown as Booking; // Cast carefully or define a client-side type
        } else {
            console.log(`[getBookingById] No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error fetching booking with ID ${bookingId}:`, error);
        throw new Error(`Failed to fetch booking: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates the status of a specific booking document.
 *
 * @param bookingId The ID of the booking document to update.
 * @param status The new status to set.
 * @returns A Promise resolving when the update is complete.
 */
export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: serverTimestamp(),
        });
        console.log(`[updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);

        // TODO: If status is 'cancelled', potentially trigger availability update to make dates available again
        // if (status === 'cancelled') {
        //   const booking = await getBookingById(bookingId);
        //   if (booking) {
        //     await updatePropertyAvailability(booking.propertyId, booking.checkInDate.toDate(), booking.checkOutDate.toDate(), true);
        //     // Also trigger sync with external platforms
        //   }
        // }

    } catch (error) {
        console.error(`❌ Error updating status for booking ${bookingId}:`, error);
        throw new Error(`Failed to update booking status: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Retrieves all bookings associated with a specific property ID.
 *
 * @param propertyId The ID of the property.
 * @returns A Promise resolving to an array of Booking objects.
 */
export async function getBookingsForProperty(propertyId: string): Promise<Booking[]> {
    const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        const q = query(bookingsCollection, where('propertyId', '==', propertyId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Timestamps for consistency if needed
            bookings.push({
                id: doc.id,
                ...data,
                checkInDate: (data.checkInDate as Timestamp)?.toDate(),
                checkOutDate: (data.checkOutDate as Timestamp)?.toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate(),
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: (data.paymentInfo?.paidAt as Timestamp | null)?.toDate() ?? null,
                },
            } as unknown as Booking);
        });
        console.log(`[getBookingsForProperty] Found ${bookings.length} bookings for property ${propertyId}`);
        return bookings;
    } catch (error) {
        console.error(`❌ Error fetching bookings for property ${propertyId}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Retrieves all bookings associated with a specific user ID (from guestInfo.userId).
 *
 * @param userId The ID of the user.
 * @returns A Promise resolving to an array of Booking objects.
 */
export async function getBookingsForUser(userId: string): Promise<Booking[]> {
     const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings');
        // Use dot notation to query nested field
        const q = query(bookingsCollection, where('guestInfo.userId', '==', userId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
             const data = doc.data();
             bookings.push({
                 id: doc.id,
                ...data,
                checkInDate: (data.checkInDate as Timestamp)?.toDate(),
                checkOutDate: (data.checkOutDate as Timestamp)?.toDate(),
                createdAt: (data.createdAt as Timestamp)?.toDate(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate(),
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: (data.paymentInfo?.paidAt as Timestamp | null)?.toDate() ?? null,
                },
             } as unknown as Booking);
        });
         console.log(`[getBookingsForUser] Found ${bookings.length} bookings for user ${userId}`);
        return bookings;
    } catch (error) {
        console.error(`❌ Error fetching bookings for user ${userId}:`, error);
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Updates the availability status for a given property and date range in Firestore.
 * This uses the monthly document structure (`propertyId_YYYY-MM`).
 *
 * @param propertyId The ID of the property.
 * @param checkInDate The start date of the range (inclusive).
 * @param checkOutDate The end date of the range (exclusive - the day the guest leaves).
 * @param available The availability status to set (true = available, false = booked/unavailable).
 * @returns A Promise resolving when the update is complete.
 */
export async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, available: boolean): Promise<void> {
  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability] Check-out date (${checkOutDate}) must be after check-in date (${checkInDate}). No update performed.`);
    return;
  }

  // Get all dates in the range, EXCLUDING the check-out date itself.
  const datesToUpdate = eachDayOfInterval({
    start: checkInDate,
    // Use date-fns `subDays` or manually adjust for exclusion
    end: new Date(new Date(checkOutDate).setDate(checkOutDate.getDate() - 1))
  });

  if (datesToUpdate.length === 0) {
      console.log("[updatePropertyAvailability] No dates to update (check-in and check-out might be consecutive).");
      return;
  }


  // Group dates by month (YYYY-MM)
  const updatesByMonth: { [month: string]: { [day: number]: boolean } } = {};
  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM');
    const dayOfMonth = date.getDate(); // Day as number (1-31)
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = {};
    }
    updatesByMonth[monthStr][dayOfMonth] = available;
  });

  const batch = writeBatch(db);
  const availabilityCollection = collection(db, 'availability');

  try {
    // Process updates for each month involved in the date range
    for (const monthStr in updatesByMonth) {
      const availabilityDocId = `${propertyId}_${monthStr}`;
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId);
      const updatesForDay = updatesByMonth[monthStr]; // e.g., { 15: false, 16: false }

      // Prepare the update payload using dot notation for nested 'available' map
      const updatePayload: { [key: string]: boolean | Timestamp } = {};
      for (const day in updatesForDay) {
        // Ensure day is treated as a string key for Firestore map field path
        updatePayload[`available.${day}`] = updatesForDay[day];
      }
      updatePayload.updatedAt = serverTimestamp(); // Always update the timestamp

       // Check if the document exists before updating/setting
       // This read operation adds cost but ensures correct handling of new months.
      const docSnap = await getDoc(availabilityDocRef);

      if (docSnap.exists()) {
        // Document exists, merge the update using updateDoc
        console.log(`[Availability Batch] Updating existing doc ${availabilityDocId} with days:`, Object.keys(updatesForDay).join(', '));
        batch.update(availabilityDocRef, updatePayload);
      } else {
        // Document doesn't exist, create it with the *entire* month's data
        console.log(`[Availability Batch] Creating new doc ${availabilityDocId} for month ${monthStr}.`);
        const [year, month] = monthStr.split('-').map(Number);
        // Calculate days in the month correctly
        const daysInMonth = new Date(year, month, 0).getDate();
        const initialAvailableMap: { [day: number]: boolean } = {};
        for (let day = 1; day <= daysInMonth; day++) {
          // Default to available unless it's one of the days being explicitly updated
          initialAvailableMap[day] = updatesForDay[day] !== undefined ? updatesForDay[day] : true;
        }

        const newDocData: Partial<Availability> = {
          propertyId: propertyId,
          month: monthStr,
          available: initialAvailableMap,
          updatedAt: serverTimestamp(),
        };
         console.log(`[Availability Batch] New doc ${availabilityDocId} initial data:`, newDocData);
         // Use set to create the new document with the full month's availability map
         batch.set(availabilityDocRef, newDocData);
      }
    }

    // Commit the batch write
    await batch.commit();
    console.log(`[updatePropertyAvailability] Successfully updated local availability for property ${propertyId} from ${format(checkInDate, 'yyyy-MM-dd')} to ${format(checkOutDate, 'yyyy-MM-dd')} (exclusive) to ${available ? 'available' : 'unavailable'}`);

  } catch (error) {
    console.error(`❌ Error updating local property availability for ${propertyId}:`, error);
    throw new Error(`Failed to update local property availability: ${error instanceof Error ? error.message : String(error)}`);
  }
}