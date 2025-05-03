// src/services/bookingService.ts
'use server'; // Mark this module for server-side execution

import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod'; // Import Zod
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
 * Creates a new booking document in Firestore based on the bookingExample structure.
 * Includes enhanced error handling, logging, and Zod validation.
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
    // Convert date strings to Firestore Timestamps using validated data
    const checkInTimestamp = Timestamp.fromDate(new Date(bookingData.checkInDate));
    const checkOutTimestamp = Timestamp.fromDate(new Date(bookingData.checkOutDate));

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

    console.log(`✅ Booking created successfully with ID: ${docRef.id} for Payment Intent [${paymentIntentId}]`);
    return docRef.id;

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

// TODO: Add functions for:
// - getBookingById(bookingId: string): Promise<Booking | null>
// - updateBookingStatus(bookingId: string, status: Booking['status']): Promise<void>
// - getBookingsForProperty(propertyId: string): Promise<Booking[]>
// - getBookingsForUser(userId: string): Promise<Booking[]>
// - Function to update property availability based on a new booking
//   - async function updatePropertyAvailability(propertyId: string, checkInDate: Date, checkOutDate: Date, booked: boolean)

