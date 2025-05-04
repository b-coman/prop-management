
"use server";

import { z } from 'zod';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Client SDK
import type { Booking, Property } from '@/types';
import { revalidatePath } from 'next/cache'; // May not be needed immediately for pending

// Schema for creating a PENDING booking
const CreatePendingBookingSchema = z.object({
  propertyId: z.string().min(1),
  guestInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(1), // Assuming phone is now required
  }).passthrough(), // Allow extra fields if needed
  checkInDate: z.string().datetime(), // ISO string
  checkOutDate: z.string().datetime(), // ISO string
  numberOfGuests: z.number().int().positive(),
  pricing: z.object({ // Keep pricing details consistent
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
  status: z.literal('pending'), // Explicitly set status
  appliedCouponCode: z.string().optional(),
});

type CreatePendingBookingInput = z.infer<typeof CreatePendingBookingSchema>;

/**
 * Creates a 'pending' booking document in Firestore.
 * This is called before redirecting to Stripe.
 * The webhook will later update this booking to 'confirmed'.
 */
export async function createPendingBookingAction(
  input: CreatePendingBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  console.log("[Action createPendingBookingAction] Called with input:", input);
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
    pricing,
    status,
    appliedCouponCode,
  } = validationResult.data;

  try {
    const bookingsCollection = collection(db, 'bookings');

    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    // Prepare data for Firestore
    const bookingData: Omit<Booking, 'id' | 'paymentInfo'> = { // Exclude paymentInfo for pending
      propertyId,
      guestInfo,
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests,
      pricing,
      status: 'pending', // Ensure status is pending
      appliedCouponCode: appliedCouponCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // Payment info will be added/updated by the webhook
      paymentInfo: { // Add placeholder or minimal payment info
          stripePaymentIntentId: '', // Will be updated by webhook
          amount: pricing.total,
          status: 'pending',
          paidAt: null,
      },
      source: 'website-pending', // Indicate source
    };

     console.log("[Action createPendingBookingAction] Prepared Firestore Data:", bookingData);

    // Add the document
    const docRef = await addDoc(bookingsCollection, bookingData);
    console.log(`[Action createPendingBookingAction] Pending booking created successfully with ID: ${docRef.id}`);

    // No revalidation needed yet, booking isn't confirmed

    return { bookingId: docRef.id };

  } catch (error) {
    console.error(`❌ [Action createPendingBookingAction] Error creating pending booking:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
     if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Could not create pending booking.' };
    }
    return { error: `Failed to create pending booking: ${errorMessage}` };
  }
}

// TODO: Add action `createAvailabilityAlertAction` later
// export async function createAvailabilityAlertAction(input: { propertyId: string, checkInDate: string, checkOutDate: string, contactMethod: 'email' | 'sms', contactInfo: string }) { ... }
