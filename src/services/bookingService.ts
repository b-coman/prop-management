// src/services/bookingService.ts
'use server'; // Mark this module for server-side execution

import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import your initialized Firestore instance
import type { Booking } from '@/types';

// Define the structure for creating a booking, based on bookingExample and required inputs.
// Omit fields that are auto-generated or should not be provided at creation.
type CreateBookingData = Omit<Booking,
  'id' | // Firestore generates ID
  'checkInDate' | // Will be converted from string
  'checkOutDate' | // Will be converted from string
  'createdAt' | // Firestore server timestamp
  'updatedAt' | // Firestore server timestamp
  'paymentInfo' // Will be constructed from input
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
 *
 * @param bookingData - The data for the new booking, conforming to CreateBookingData.
 * @returns The ID of the newly created booking document.
 * @throws Throws an error if the booking cannot be created.
 */
export async function createBooking(bookingData: CreateBookingData): Promise<string> {
   console.log('[createBooking Data] Received:', JSON.stringify(bookingData, null, 2));

  try {
    const bookingsCollection = collection(db, 'bookings');

    // Validate date strings before conversion
    if (!bookingData.checkInDate || !bookingData.checkOutDate || isNaN(new Date(bookingData.checkInDate).getTime()) || isNaN(new Date(bookingData.checkOutDate).getTime())) {
        throw new Error('Invalid check-in or check-out date format received.');
    }

    // Convert date strings to Firestore Timestamps
    const checkInTimestamp = Timestamp.fromDate(new Date(bookingData.checkInDate));
    const checkOutTimestamp = Timestamp.fromDate(new Date(bookingData.checkOutDate));

    // Construct the paymentInfo object
    const paymentInfo: Booking['paymentInfo'] = {
      stripePaymentIntentId: bookingData.paymentInput.stripePaymentIntentId,
      amount: bookingData.paymentInput.amount,
      status: bookingData.paymentInput.status,
      // Set paidAt timestamp only if payment status indicates success
      // Use Timestamp.now() because serverTimestamp() can only be used in set/update/add directly
      paidAt: bookingData.paymentInput.status === 'succeeded' || bookingData.paymentInput.status === 'paid'
        ? Timestamp.now()
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
    };

    console.log('[Firestore Doc Data] Saving:', JSON.stringify(docData, (key, value) =>
        // Custom replacer to handle Timestamp objects for logging, as they don't stringify well
        value instanceof Timestamp ? value.toDate().toISOString() : value,
    2));


    // Add the document to the 'bookings' collection
    const docRef = await addDoc(bookingsCollection, docData);

    console.log(`✅ Booking created successfully with ID: ${docRef.id}`);
    return docRef.id;

  } catch (error) {
    console.error('❌ Error creating booking in Firestore:', error);
    // Log the data that caused the error
    console.error('[createBooking Error Data] Data causing error:', JSON.stringify(bookingData, null, 2));
    // Re-throw the error to be handled by the caller (e.g., the webhook handler)
    throw new Error(`Failed to create booking: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// TODO: Add functions for:
// - getBookingById(bookingId: string): Promise<Booking | null>
// - updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void>
// - getBookingsForProperty(propertyId: string): Promise<Booking[]>
// - getBookingsForUser(userId: string): Promise<Booking[]>
// - Function to update property availability based on a new booking
//   - async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, booked: boolean)
