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
  try {
    const bookingsCollection = collection(db, 'bookings');

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
        ? Timestamp.now() // Use Timestamp.now() as serverTimestamp cannot be conditionally set easily here
        : null,
    };

    // Prepare the document data for Firestore, aligning with Booking type
    const docData: Omit<Booking, 'id'> = {
      propertyId: bookingData.propertyId,
      guestInfo: bookingData.guestInfo,
      checkInDate: checkInTimestamp,
      checkOutDate: checkOutTimestamp,
      numberOfGuests: bookingData.numberOfGuests,
      pricing: bookingData.pricing,
      status: bookingData.status, // Should be 'confirmed' if payment succeeded
      paymentInfo: paymentInfo,
      notes: bookingData.notes,
      source: bookingData.source,
      externalId: bookingData.externalId,
      createdAt: serverTimestamp(), // Firestore generates timestamp on the server
      updatedAt: serverTimestamp(), // Firestore generates timestamp on the server
    };

    // Add the document to the 'bookings' collection
    const docRef = await addDoc(bookingsCollection, docData);

    console.log('Booking created successfully with ID:', docRef.id);
    return docRef.id;

  } catch (error) {
    console.error('Error creating booking in Firestore:', error);
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
