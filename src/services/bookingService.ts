
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


export type CreateBookingData = Omit<Booking,
  'id' |
  'checkInDate' |
  'checkOutDate' |
  'createdAt' |
  'updatedAt' |
  'paymentInfo' | 
  'pricing'
> & {
  propertyId: string; 
  checkInDate: string; 
  checkOutDate: string; 
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
  status?: Booking['status']; 
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
    currency: z.enum(SUPPORTED_CURRENCIES), // Validate currency
  }).passthrough(),
  appliedCouponCode: z.string().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
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


export async function updateBookingPaymentInfo(
    bookingId: string,
    paymentInfo: Booking['paymentInfo'],
    propertyId: string, 
    paymentCurrency: CurrencyCode // Currency of the payment received by Stripe
): Promise<void> {
    console.log(`--- [updateBookingPaymentInfo] Called for booking: ${bookingId}, property: ${propertyId}, paymentCurrency: ${paymentCurrency} ---`);
    if (!bookingId) {
        throw new Error("Booking ID is required to update payment info.");
    }
    if (!propertyId) {
         throw new Error("Property ID (slug) is required to update payment info and availability.");
    }
     if (!paymentInfo || !paymentInfo.stripePaymentIntentId || (paymentInfo.status !== 'paid' && paymentInfo.status !== 'succeeded')) {
         console.warn(`[updateBookingPaymentInfo] Invalid or incomplete payment info for booking ${bookingId}. Status: ${paymentInfo?.status}`);
        throw new Error("Valid payment information (status 'paid' or 'succeeded') is required.");
    }

    const bookingRef = doc(db, 'bookings', bookingId);

    try {
        const bookingSnap = await getDoc(bookingRef);
        if (!bookingSnap.exists()) {
            console.error(`[updateBookingPaymentInfo] Booking ${bookingId} not found.`);
            throw new Error(`Booking with ID ${bookingId} not found.`);
        }
        const bookingData = bookingSnap.data() as Booking; 

        if (bookingData.propertyId !== propertyId) {
             console.error(`[updateBookingPaymentInfo] Mismatch: Booking ${bookingId} propertyId (${bookingData.propertyId}) does not match webhook metadata propertyId (${propertyId}).`);
             throw new Error("Property ID mismatch between booking and webhook metadata.");
        }
        
        // Ensure the booking's pricing currency matches the payment currency from Stripe metadata
        if (bookingData.pricing.currency !== paymentCurrency) {
            console.error(`[updateBookingPaymentInfo] Currency Mismatch: Booking ${bookingId} pricing currency (${bookingData.pricing.currency}) does not match payment currency from Stripe metadata (${paymentCurrency}). This could indicate an issue with how prices were sent to Stripe.`);
            // Potentially throw an error or handle this case (e.g., by converting the paymentInfo.amount if rates are known)
            // For now, we'll proceed but log a severe warning. Ideally, this shouldn't happen if createCheckoutSession is correct.
            // throw new Error("Currency mismatch between booking and payment.");
        }


        console.log(`[updateBookingPaymentInfo] Updating booking ${bookingId} status to 'confirmed' and adding payment details.`);
        await updateDoc(bookingRef, {
            status: 'confirmed',
            paymentInfo: { 
                ...bookingData.paymentInfo, 
                ...paymentInfo, 
                paidAt: paymentInfo.paidAt instanceof Date ? ClientTimestamp.fromDate(paymentInfo.paidAt) : clientServerTimestamp(), 
            },
            updatedAt: clientServerTimestamp(),
        });
        console.log(`✅ [updateBookingPaymentInfo] Successfully updated booking ${bookingId} to confirmed.`);

        const checkInDate = bookingData.checkInDate instanceof ClientTimestamp
            ? bookingData.checkInDate.toDate()
            : bookingData.checkInDate ? new Date(bookingData.checkInDate as any) : null; 
        const checkOutDate = bookingData.checkOutDate instanceof ClientTimestamp
            ? bookingData.checkOutDate.toDate()
            : bookingData.checkOutDate ? new Date(bookingData.checkOutDate as any) : null;

        if (checkInDate && checkOutDate) {
             console.log(`[updateBookingPaymentInfo] Triggering availability update for property ${propertyId}, booking ${bookingId}`);
            try {
                await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, false);
                console.log(`✅ [updateBookingPaymentInfo] Availability updated for property ${propertyId}.`);
            } catch (availabilityError) {
                 console.error(`❌ [updateBookingPaymentInfo] Failed to update availability for property ${propertyId} after confirming booking ${bookingId}:`, availabilityError);
            }
             console.log(`[updateBookingPaymentInfo] Triggering external sync for property ${propertyId}, booking ${bookingId}...`);
             try {
                 const propertyDetails = await getPropertyForSync(propertyId);
                 if (propertyDetails) {
                     if (propertyDetails.channelIds?.airbnb) {
                         await updateAirbnbListingAvailability(propertyDetails.channelIds.airbnb, false, checkInDate, checkOutDate);
                     }
                     if (propertyDetails.channelIds?.booking_com) {
                         await updateBookingComListingAvailability(propertyDetails.channelIds.booking_com, false, checkInDate, checkOutDate);
                     }
                 } else {
                     console.warn(`[updateBookingPaymentInfo Sync] Could not find property ${propertyId} for external sync.`);
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


export async function createBooking(rawBookingData: CreateBookingData): Promise<string> {
   if (!rawBookingData.propertyId) {
     throw new Error("Missing propertyId (slug) in booking data.");
   }
   const propertyId = rawBookingData.propertyId; 

   const paymentIntentId = (rawBookingData as any)?.paymentInput?.stripePaymentIntentId || 'N/A'; 
   console.log(`--- [createBooking] Function called for Payment Intent [${paymentIntentId}], Property [${propertyId}] ---`);
   // console.log(`[createBooking] Received raw data:`, JSON.stringify(rawBookingData, null, 2));

   let bookingData: z.infer<typeof CreateBookingDataSchema>;

   console.log(`[createBooking] Starting Zod validation for Payment Intent [${paymentIntentId}]...`);
   const validationResult = CreateBookingDataSchema.safeParse(rawBookingData);
   if (!validationResult.success) {
     const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
     const validationError = new Error(`Invalid booking data: ${errorMessages}`);
     console.error(`❌ [createBooking] Validation Error:`, validationError.message);
     throw validationError;
   }
   bookingData = validationResult.data; 
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
               status: 'unknown', 
               paidAt: null,
           };
      }

     const docData: Omit<Booking, 'id'> = {
         propertyId: bookingData.propertyId, 
         guestInfo: bookingData.guestInfo,
         checkInDate: checkInTimestamp,
         checkOutDate: checkOutTimestamp,
         pricing: bookingData.pricing, // Includes currency
         appliedCouponCode: bookingData.appliedCouponCode,
         status: bookingData.status || 'confirmed', 
         paymentInfo: paymentInfo,
         notes: bookingData.notes,
         source: bookingData.source || 'simulation', 
         externalId: bookingData.externalId,
         createdAt: clientServerTimestamp(),
         updatedAt: clientServerTimestamp(),
     };

     console.log(`[createBooking] Firestore Doc Data Prepared for Payment Intent [${paymentIntentId}]:`, JSON.stringify({
         ...docData,
         checkInDate: `Timestamp(${checkInDate.toISOString()})`,
         checkOutDate: `Timestamp(${checkOutDate.toISOString()})`,
         paidAt: docData.paymentInfo.paidAt ? `Timestamp(${(docData.paymentInfo.paidAt as ClientTimestamp).toDate().toISOString()})` : null,
         createdAt: 'ServerTimestamp',
         updatedAt: 'ServerTimestamp'
     }, null, 2));


     console.log(`[createBooking] Attempting to add booking document to Firestore (Client SDK) for Payment Intent [${paymentIntentId}]...`);
     const docRef = await addDoc(bookingsCollection, docData);
     const bookingId = docRef.id;
     console.log(`✅ [createBooking] Booking document created successfully! ID: ${bookingId} for Payment Intent [${paymentIntentId}]`);

     console.log(`[createBooking] Triggering local availability update (Client SDK) for property ${propertyId}, booking ${bookingId}`);
     try {
       await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, false);
       console.log(`✅ [createBooking] Successfully finished update call for local availability for property ${propertyId}, booking ${bookingId}.`);
     } catch (availabilityError) {
       console.error(`❌ [createBooking] Failed to update local availability (Client SDK) for property ${propertyId} after creating booking ${bookingId}:`, availabilityError);
        console.warn(`⚠️ [createBooking] Availability update failed, but booking ${bookingId} was created (source: ${docData.source}). Manual check needed.`);
     }

      if (docData.source !== 'simulation' && docData.source !== 'test-button') {
          console.log(`[createBooking] Starting external platform sync for property ${propertyId}, booking ${bookingId}...`);
          try {
             const propertyDetails = await getPropertyForSync(propertyId);
             if (propertyDetails) {
                 if (propertyDetails.channelIds?.airbnb) {
                     await updateAirbnbListingAvailability(propertyDetails.channelIds.airbnb, false, checkInDate, checkOutDate);
                 }
                 if (propertyDetails.channelIds?.booking_com) {
                     await updateBookingComListingAvailability(propertyDetails.channelIds.booking_com, false, checkInDate, checkOutDate);
                 }
             } else {
                  console.warn(`[createBooking Sync] Could not retrieve property details for ${propertyId} to perform external sync.`);
             }
         } catch (syncError) {
             console.error(`❌ [createBooking Sync] Error synchronizing availability with external platforms for property ${propertyId} after creating booking ${bookingId}:`, syncError);
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

export async function getBookingById(bookingId: string): Promise<Booking | null> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId); 
        const docSnap = await getDoc(bookingRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const bookingResult = {
                id: docSnap.id,
                ...data,
                propertyId: data.propertyId, 
                checkInDate: data.checkInDate, 
                checkOutDate: data.checkOutDate, 
                createdAt: data.createdAt, 
                updatedAt: data.updatedAt, 
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, 
                },
                 pricing: { // Ensure pricing includes currency
                     ...data.pricing,
                     currency: data.pricing.currency || 'USD', // Default to USD if missing, though schema should enforce
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

export async function updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
    try {
        const bookingRef = doc(db, 'bookings', bookingId); 
        await updateDoc(bookingRef, {
            status: status,
            updatedAt: clientServerTimestamp(), 
        });
        console.log(`✅ [updateBookingStatus] Successfully updated booking ${bookingId} to status: ${status}`);

        if (status === 'cancelled') {
          const booking = await getBookingById(bookingId); 
          if (booking && booking.checkInDate && booking.checkOutDate) {
             const propertyId = booking.propertyId;
             const checkInDate = booking.checkInDate instanceof ClientTimestamp
                ? booking.checkInDate.toDate()
                : booking.checkInDate ? new Date(booking.checkInDate as any) : null;
             const checkOutDate = booking.checkOutDate instanceof ClientTimestamp
                ? booking.checkOutDate.toDate()
                : booking.checkOutDate ? new Date(booking.checkOutDate as any) : null;

             if (checkInDate && checkOutDate && propertyId) {
                 try {
                     await updatePropertyAvailability(propertyId, checkInDate, checkOutDate, true);
                     console.log(`✅ [updateBookingStatus] Successfully updated local availability (Client SDK) for cancelled booking ${bookingId}.`);
                     await triggerExternalSyncForDateUpdate(propertyId, checkInDate, checkOutDate, true);
                 } catch (availError) {
                      console.error(`❌ [updateBookingStatus] Failed to update local availability or sync for cancelled booking ${bookingId}:`, availError);
                 }
             } else {
                  console.warn(`[updateBookingStatus] Could not parse dates or missing propertyId for booking ${bookingId} to update availability after cancellation.`);
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

export async function getBookingsForProperty(propertySlug: string): Promise<Booking[]> {
    const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings'); 
        const q = query(bookingsCollection, where('propertyId', '==', propertySlug));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            bookings.push({
                id: doc.id,
                ...data,
                propertyId: data.propertyId, 
                checkInDate: data.checkInDate, 
                checkOutDate: data.checkOutDate, 
                createdAt: data.createdAt, 
                updatedAt: data.updatedAt, 
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, 
                },
                pricing: { // Ensure pricing includes currency
                     ...data.pricing,
                     currency: data.pricing.currency || 'USD', 
                 },
            } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForProperty] Error fetching bookings for property ${propertySlug}:`, error);
        throw new Error(`Failed to fetch bookings for property: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getBookingsForUser(userId: string): Promise<Booking[]> {
     const bookings: Booking[] = [];
    try {
        const bookingsCollection = collection(db, 'bookings'); 
        const q = query(bookingsCollection, where('guestInfo.userId', '==', userId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
             const data = doc.data();
             bookings.push({
                 id: doc.id,
                ...data,
                propertyId: data.propertyId, 
                checkInDate: data.checkInDate, 
                checkOutDate: data.checkOutDate, 
                createdAt: data.createdAt, 
                updatedAt: data.updatedAt, 
                 paymentInfo: {
                    ...data.paymentInfo,
                    paidAt: data.paymentInfo?.paidAt, 
                },
                pricing: { // Ensure pricing includes currency
                     ...data.pricing,
                     currency: data.pricing.currency || 'USD', 
                 },
             } as Booking);
        });
        return bookings;
    } catch (error) {
        console.error(`❌ [getBookingsForUser] Error fetching bookings for user ${userId}:`, error);
        throw new Error(`Failed to fetch bookings for user: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, available: boolean): Promise<void> {
  console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function called ---`);
  // console.log(`[updatePropertyAvailability - CLIENT SDK] Args: propertyId=${propertyId} (slug), checkIn=${format(checkInDate, 'yyyy-MM-dd')}, checkOut=${format(checkOutDate, 'yyyy-MM-dd')} (exclusive), available=${available}`);

  if (!db) {
    console.error("❌ [updatePropertyAvailability - CLIENT SDK] Firestore Client SDK (db) is not initialized.");
    throw new Error("Firestore Client SDK is not initialized.");
  }

  if (checkOutDate <= checkInDate) {
    console.warn(`[updatePropertyAvailability] Check-out date (${format(checkOutDate, 'yyyy-MM-dd')}) must be after check-in date (${format(checkInDate, 'yyyy-MM-dd')}). No update performed.`);
    return;
  }

  const start = startOfDay(checkInDate);
  const end = startOfDay(subDays(checkOutDate, 1)); 

  const datesToUpdate = eachDayOfInterval({ start, end });

  if (datesToUpdate.length === 0) {
    // console.log("[updatePropertyAvailability - CLIENT SDK] No dates need updating.");
    return;
  }
  // console.log(`[updatePropertyAvailability - CLIENT SDK] Dates to update (${datesToUpdate.length}): ${datesToUpdate.map(d => format(d, 'yyyy-MM-dd')).join(', ')}`);

  const updatesByMonth: { [month: string]: { [day: number]: boolean } } = {};
  datesToUpdate.forEach(date => {
    const monthStr = format(date, 'yyyy-MM'); 
    const dayOfMonth = date.getUTCDate(); 
    if (!updatesByMonth[monthStr]) {
      updatesByMonth[monthStr] = {};
    }
    updatesByMonth[monthStr][dayOfMonth] = available;
  });
  // console.log(`[updatePropertyAvailability - CLIENT SDK] Updates grouped by month:`, JSON.stringify(updatesByMonth));

  const batch = clientWriteBatch(db);
  const availabilityCollection = collection(db, 'availability');
  // console.log(`[updatePropertyAvailability - CLIENT SDK] Initialized Firestore Client batch.`);

  try {
    const monthStrings = Object.keys(updatesByMonth);
    // console.log(`[updatePropertyAvailability - CLIENT SDK] Processing months: ${monthStrings.join(', ')}`);

    if (monthStrings.length === 0) return;

    const docIdsToFetch = monthStrings.map(monthStr => `${propertyId}_${monthStr}`);
    // console.log(`[updatePropertyAvailability - CLIENT SDK] Fetching existing availability docs for ${monthStrings.length} months...`);

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
    // console.log(`[updatePropertyAvailability - CLIENT SDK] Fetched ${fetchedDocsMap.size} existing doc snapshots.`);

    monthStrings.forEach(monthStr => {
      const availabilityDocId = `${propertyId}_${monthStr}`; 
      // console.log(`[updatePropertyAvailability Batch Prep] Processing month ${monthStr} (Doc ID: ${availabilityDocId}). Days: ${Object.keys(updatesByMonth[monthStr]).join(', ')}`);
      const availabilityDocRef = doc(availabilityCollection, availabilityDocId);
      const updatesForDay = updatesByMonth[monthStr];

      const updatePayload: { [key: string]: any } = {};
      for (const day in updatesForDay) {
        updatePayload[`available.${String(day)}`] = updatesForDay[day];
      }
      updatePayload.updatedAt = clientServerTimestamp();
      // console.log(`[updatePropertyAvailability Batch Prep] Payload for ${availabilityDocId}:`, JSON.stringify({ ...updatePayload, updatedAt: 'ServerTimestamp' }));


      const existingDoc = fetchedDocsMap.get(availabilityDocId);

      if (existingDoc) {
        // console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} exists. Adding UPDATE.`);
        batch.update(availabilityDocRef, updatePayload);
      } else {
        // console.log(`[updatePropertyAvailability Batch Prep] Doc ${availabilityDocId} DOES NOT exist. Creating initial.`);
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
        // console.log(`[updatePropertyAvailability Batch Prep] Adding SET (merge: true) to client batch for ${availabilityDocId}.`);
        batch.set(availabilityDocRef, newDocData, { merge: true });
      }
    });

    // console.log(`[updatePropertyAvailability - CLIENT SDK] Committing client batch for property ${propertyId}...`);
    await batch.commit();
    // console.log(`✅ [updatePropertyAvailability - CLIENT SDK] Batch committed for property ${propertyId}.`);
    // console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function finished successfully ---`);

  } catch (error) {
    console.error(`❌ Error during Client SDK batch update/creation for property availability ${propertyId}:`, error);
    // console.log(`--- [updatePropertyAvailability - CLIENT SDK] Function throwing error ---`);
     if (error instanceof Error && (error.message.includes('PERMISSION_DENIED') || error.message.includes('Missing or insufficient permissions'))) {
        throw new Error(`Permission denied updating availability for property ${propertyId}. Check Firestore rules.`);
     }
    throw new Error(`Failed to update local property availability using Client SDK: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function triggerExternalSyncForDateUpdate(propertyId: string, checkInDate: Date, checkOutDate: Date, isAvailable: boolean): Promise<void> {
    // console.log(`[Sync Trigger] Syncing availability change for property ${propertyId} (slug) (${isAvailable ? 'Release' : 'Block'})`);
     try {
       const propertyDetails = await getPropertyForSync(propertyId);
       if (propertyDetails) {
           if (propertyDetails.channelIds?.airbnb) {
               await updateAirbnbListingAvailability(propertyDetails.channelIds.airbnb, isAvailable, checkInDate, checkOutDate);
           }
           if (propertyDetails.channelIds.booking_com) {
               await updateBookingComListingAvailability(propertyDetails.channelIds.booking_com, isAvailable, checkInDate, checkOutDate);
           }
       } else {
           // console.warn(`[Sync Trigger] Could not find property ${propertyId} for external sync.`);
       }
   } catch (syncError) {
        // console.error(`❌ [Sync Trigger] Error syncing externally for property ${propertyId}:`, syncError);
   }
}


export async function getUnavailableDatesForProperty(propertySlug: string, monthsToFetch: number = 12): Promise<Date[]> {
  const unavailableDates: Date[] = [];
  // console.log(`--- [getUnavailableDatesForProperty] Function called ---`);
  // console.log(`[getUnavailableDatesForProperty] Fetching for property ${propertySlug} for the next ${monthsToFetch} months.`);

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
      monthDocIds.push(`${propertySlug}_${monthStr}`);
    }

     if (monthDocIds.length === 0) {
        // console.log("[getUnavailableDatesForProperty] No month document IDs to query.");
        return [];
    }
    // console.log(`[getUnavailableDatesForProperty] Querying for document IDs: ${monthDocIds.join(', ')}`);

    const queryBatches: string[][] = [];
    for (let i = 0; i < monthDocIds.length; i += 30) {
        queryBatches.push(monthDocIds.slice(i, i + 30));
    }
    // console.log(`[getUnavailableDatesForProperty] Split into ${queryBatches.length} query batches due to 'in' operator limit.`);


    const allQuerySnapshots = await Promise.all(
      queryBatches.map(async (batchIds, index) => {
          // console.log(`[getUnavailableDatesForProperty] Executing query for batch ${index + 1}: ${batchIds.join(', ')}`);
          const q = query(availabilityCollection, where(documentId(), 'in', batchIds));
          return getDocs(q);
      })
    );
    // console.log(`[getUnavailableDatesForProperty] Fetched results from ${allQuerySnapshots.length} batches.`);

    let docCount = 0;
    allQuerySnapshots.forEach((querySnapshot, batchIndex) => {
        // console.log(`[getUnavailableDatesForProperty] Processing batch ${batchIndex + 1}: Found ${querySnapshot.docs.length} documents.`);
         docCount += querySnapshot.docs.length;
         querySnapshot.forEach((doc) => {
            const data = doc.data() as Partial<Availability>;
            const docId = doc.id;
             if (data.propertyId !== propertySlug) {
                 // console.warn(`[getUnavailableDates] Mismatch: Doc ${docId} has propertyId ${data.propertyId}, expected ${propertySlug}. Skipping.`);
                 return;
             }

            const monthStr = data.month || docId.split('_')[1]; 

             if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
                 // console.warn(`[getUnavailableDates] Invalid month string for doc ${docId}. Skipping.`);
                 return;
             }

            if (data.available && typeof data.available === 'object') {
                const [year, monthIndex] = monthStr.split('-').map(num => parseInt(num, 10));
                const month = monthIndex - 1; 

                for (const dayStr in data.available) {
                    const day = parseInt(dayStr, 10);
                    if (!isNaN(day) && data.available[day] === false) {
                        try {
                            const date = new Date(Date.UTC(year, month, day));
                             if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                                const todayUtcStart = startOfDay(new Date()); 
                                if (date >= todayUtcStart) {
                                    unavailableDates.push(date);
                                }
                             } else {
                                 // console.warn(`[getUnavailableDates] Invalid date created for ${monthStr}-${dayStr}. Skipping.`);
                             }
                        } catch (dateError) {
                             // console.warn(`[getUnavailableDates] Error creating date ${monthStr}-${dayStr}:`, dateError);
                        }
                    }
                }
            }
        });
    });
    // console.log(`[getUnavailableDates] Processed ${docCount} total documents.`);

    unavailableDates.sort((a, b) => a.getTime() - b.getTime());
    // console.log(`[getUnavailableDates] Found ${unavailableDates.length} unavailable dates for ${propertySlug}.`);
    // console.log(`--- [getUnavailableDatesForProperty] Function finished successfully ---`);
    return unavailableDates;

  } catch (error) {
    console.error(`❌ Error fetching unavailable dates for property ${propertySlug}:`, error);
    // console.log(`--- [getUnavailableDatesForProperty] Function finished with error ---`);
    return [];
  }
}