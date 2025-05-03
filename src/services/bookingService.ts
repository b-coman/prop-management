// src/services/bookingService.ts
'use server'; // Mark this module for server-side execution

import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import your initialized Firestore instance
import type { Booking } from '@/types';

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


/**
 * Creates a new booking document in Firestore based on the bookingExample structure.
 * Includes enhanced error handling and logging.
 *
 * @param bookingData - The data for the new booking, conforming to CreateBookingData.
 * @returns The ID of the newly created booking document.
 * @throws Throws an error if the booking cannot be created, including context like Payment Intent ID.
 */
export async function createBooking(bookingData: CreateBookingData): Promise<string> {
   const paymentIntentId = bookingData?.paymentInput?.stripePaymentIntentId || 'N/A';
   console.log(`[createBooking] Received data for Payment Intent [${paymentIntentId}]:`, JSON.stringify(bookingData, null, 2));

  try {
    const bookingsCollection = collection(db, 'bookings');

    // --- Input Validation ---
    if (!bookingData.propertyId) throw new Error('Missing propertyId.');
    if (!bookingData.guestInfo?.email) throw new Error('Missing guest email.');
    if (!bookingData.checkInDate || !bookingData.checkOutDate || isNaN(new Date(bookingData.checkInDate).getTime()) || isNaN(new Date(bookingData.checkOutDate).getTime())) {
        throw new Error('Invalid check-in or check-out date format received.');
    }
     if (new Date(bookingData.checkOutDate) <= new Date(bookingData.checkInDate)) {
         throw new Error('Check-out date must be after check-in date.');
     }
    if (!bookingData.paymentInput?.stripePaymentIntentId) throw new Error('Missing Stripe Payment Intent ID.');
    if (typeof bookingData.paymentInput?.amount !== 'number' || bookingData.paymentInput.amount <= 0) throw new Error('Invalid payment amount.');
    if (!bookingData.pricing?.total || bookingData.pricing.total <= 0) throw new Error('Invalid pricing total.');
    // Add more specific validations as needed...

    // --- Data Transformation ---
    // Convert date strings to Firestore Timestamps
    const checkInTimestamp = Timestamp.fromDate(new Date(bookingData.checkInDate));
    const checkOutTimestamp = Timestamp.fromDate(new Date(bookingData.checkOutDate));

    // Construct the paymentInfo object
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
        ...restOfBookingData, // Spread the rest of the data
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

    console.log(`✅ Booking created successfully with ID: ${docRef.id} for Payment Intent [${paymentIntentId}]`);
    return docRef.id;

  } catch (error) {
    // --- Error Handling & Logging ---
    console.error(`❌ Error creating booking in Firestore for Payment Intent [${paymentIntentId}]:`, error);
    // Log the data that caused the error for easier debugging
    console.error(`[createBooking Error Data - Payment Intent: ${paymentIntentId}] Data causing error:`, JSON.stringify(bookingData, null, 2));

    // Construct a more informative error message
    const errorMessage = `Failed to create booking (Payment Intent: ${paymentIntentId}): ${error instanceof Error ? error.message : String(error)}`;
    // Re-throw the error to be handled by the caller (e.g., the webhook handler)
    throw new Error(errorMessage);
  }
}

// TODO: Add functions for:
// - getBookingById(bookingId: string): Promise<Booking | null>
// - updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void>
// - getBookingsForProperty(propertyId: string): Promise<Booking[]>
// - getBookingsForUser(userId: string): Promise<Booking[]>
// - Function to update property availability based on a new booking
//   - async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, booked: boolean)
