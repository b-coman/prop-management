// src/app/actions/booking-actions.ts
"use server";

import { z } from 'zod';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK
import type { Booking, Property, CurrencyCode } from '@/types'; // Added CurrencyCode
import { SUPPORTED_CURRENCIES } from '@/types'; // Import supported currencies
import { revalidatePath } from 'next/cache';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize'; // Import sanitizers

// Schema for creating a PENDING booking
const CreatePendingBookingSchema = z.object({
  propertyId: z.string().min(1), // This is the property SLUG now
  guestInfo: z.object({
    firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
    lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
    email: z.string().email("Invalid email address.").transform(sanitizeEmail),
    phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
  }).passthrough(),
  checkInDate: z.string().datetime(), // ISO string
  checkOutDate: z.string().datetime(), // ISO string
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
    currency: z.enum(SUPPORTED_CURRENCIES), // Add currency field
  }).passthrough(),
  status: z.literal('pending'),
  appliedCouponCode: z.string().trim().toUpperCase().nullable().optional().transform(val => val ? sanitizeText(val) : null),
});

type CreatePendingBookingInput = z.infer<typeof CreatePendingBookingSchema>;

export async function createPendingBookingAction(
  input: CreatePendingBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  console.log("[Action createPendingBookingAction] Called with input:", JSON.stringify(input, null, 2));
  const validationResult = CreatePendingBookingSchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createPendingBookingAction] Validation Error:", errorMessages);
    return { error: `Invalid pending booking data: ${errorMessages}` };
  }

  const {
    propertyId,
    guestInfo, 
    checkInDate: checkInStr,
    checkOutDate: checkOutStr,
    numberOfGuests,
    pricing, // Includes currency
    status,
    appliedCouponCode,
  } = validationResult.data;

  try {
    const bookingsCollection = collection(db, 'bookings');
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    const bookingData: Omit<Booking, 'id' | 'paymentInfo'> = {
      propertyId: propertyId,
      guestInfo, 
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests,
      pricing: { // Pass the entire pricing object which now includes currency
        ...pricing,
      },
      status: 'pending',
      appliedCouponCode: appliedCouponCode ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // paymentInfo will be updated by the webhook
      // Ensure paymentInfo is initialized correctly if needed before webhook update
      paymentInfo: { 
        stripePaymentIntentId: '', // Default empty until payment
        amount: pricing.total, // Amount in property's base currency
        status: 'pending',
        paidAt: null,
      },
      source: 'website-pending',
    };
    console.log("[Action createPendingBookingAction] Prepared Firestore Data:", JSON.stringify({
      ...bookingData,
      checkInDate: `Timestamp { seconds: ${bookingData.checkInDate.seconds}, nanoseconds: ${bookingData.checkInDate.nanoseconds} }`,
      checkOutDate: `Timestamp { seconds: ${bookingData.checkOutDate.seconds}, nanoseconds: ${bookingData.checkOutDate.nanoseconds} }`,
      createdAt: 'ServerTimestampFieldValueImpl',
      updatedAt: 'ServerTimestampFieldValueImpl',
    }, null, 2));

    const docRef = await addDoc(bookingsCollection, bookingData);
    console.log(`[Action createPendingBookingAction] Pending booking created successfully with ID: ${docRef.id}`);
    return { bookingId: docRef.id };
  } catch (error) {
    console.error(`❌ [Action createPendingBookingAction] Error creating pending booking:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Could not create pending booking.' };
    }
    if (errorMessage.includes('invalid data') || errorMessage.includes('Unsupported field value')) {
      return { error: `Failed to create pending booking due to invalid data. Please check input values. Details: ${errorMessage.split(' (')[0]}` };
    }
    return { error: `Failed to create pending booking: ${errorMessage}` };
  }
}