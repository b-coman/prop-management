// src/app/actions/booking-actions.ts
"use server";

import { z } from 'zod';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK
import type { Booking, Property } from '@/types';
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
  }).passthrough(),
  status: z.literal('pending'),
  appliedCouponCode: z.string().trim().toUpperCase().nullable().optional().transform(val => val ? sanitizeText(val) : null),
});

type CreatePendingBookingInput = z.infer<typeof CreatePendingBookingSchema>;

export async function createPendingBookingAction(
  input: CreatePendingBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  const validationResult = CreatePendingBookingSchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createPendingBookingAction] Validation Error:", errorMessages);
    return { error: `Invalid pending booking data: ${errorMessages}` };
  }

  const {
    propertyId,
    guestInfo, // Already sanitized by Zod transform
    checkInDate: checkInStr,
    checkOutDate: checkOutStr,
    numberOfGuests,
    pricing,
    status,
    appliedCouponCode, // Already sanitized by Zod transform
  } = validationResult.data;

  try {
    const bookingsCollection = collection(db, 'bookings');
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    const bookingData: Omit<Booking, 'id' | 'paymentInfo'> = {
      propertyId: propertyId,
      guestInfo, // Sanitized guestInfo
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests,
      pricing,
      status: 'pending',
      appliedCouponCode: appliedCouponCode ?? null, // Sanitized appliedCouponCode
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentInfo: {
        stripePaymentIntentId: '',
        amount: pricing.total,
        status: 'pending',
        paidAt: null,
      },
      source: 'website-pending',
    };

    const docRef = await addDoc(bookingsCollection, bookingData);
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
