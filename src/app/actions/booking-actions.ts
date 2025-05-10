// src/app/actions/booking-actions.ts
"use server";

import { z } from 'zod';
import { collection, addDoc, serverTimestamp, Timestamp, getFirestore } from 'firebase/firestore';
import { dbAdmin } from '@/lib/firebaseAdmin'; // Admin SDK
import { db } from '@/lib/firebase'; // Client SDK
import type { Booking, Property, CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { revalidatePath } from 'next/cache';
import { sanitizeEmail, sanitizePhone, sanitizeText } from '@/lib/sanitize';


// Schema for creating a PENDING booking (used for the final "Book Now" path)
const CreatePendingBookingSchema = z.object({
  propertyId: z.string().min(1), // Property SLUG
  guestInfo: z.object({
    firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
    lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
    email: z.string().email("Invalid email address.").transform(sanitizeEmail),
    phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
  }).passthrough(),
  checkInDate: z.string().datetime(), // ISO string
  checkOutDate: z.string().datetime(), // ISO string
  numberOfGuests: z.number().int().positive(),
  pricing: z.object({ // Includes currency
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
    currency: z.enum(SUPPORTED_CURRENCIES),
  }).passthrough(),
  status: z.literal('pending'), // Explicitly pending for this action
  appliedCouponCode: z.string().trim().toUpperCase().nullable().optional().transform(val => val ? sanitizeText(val) : null),
  // Fields related to holds or inquiries might be passed if converting, but not strictly needed by this schema
  convertedFromHold: z.boolean().optional(),
  convertedFromInquiry: z.string().optional(),
});

type CreatePendingBookingInput = z.infer<typeof CreatePendingBookingSchema>;

export async function createPendingBookingAction(
  input: CreatePendingBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  console.log("[Action createPendingBookingAction] Called with input:", JSON.stringify(input, null, 2));

  // Check for any undefined values in pricing before validation
  if (input.pricing) {
    for (const [key, value] of Object.entries(input.pricing)) {
      if (value === undefined) {
        console.error(`[Action createPendingBookingAction] Found undefined value for pricing.${key}`);
        return { error: `Invalid pricing data: ${key} is undefined` };
      }
    }
  }

  const validationResult = CreatePendingBookingSchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createPendingBookingAction] Validation Error:", errorMessages);
    return { error: `Invalid pending booking data: ${errorMessages}` };
  }

  const {
    propertyId, // This is the slug
    guestInfo,
    checkInDate: checkInStr,
    checkOutDate: checkOutStr,
    numberOfGuests,
    pricing,
    status,
    appliedCouponCode,
    convertedFromHold, // Capture conversion flags
    convertedFromInquiry,
  } = validationResult.data;

  try {
    if (!db) {
      console.error("[Action createPendingBookingAction] Firebase Client SDK not initialized.");
      return { error: "Internal server error: Database connection not available." };
    }
    
    const bookingsCollection = collection(db, 'bookings');
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);

    // Note: Hold-specific fields (holdFee, holdUntil, holdPaymentId) are set by createHoldBookingAction
    // Create the booking data with guaranteed non-undefined values
    const bookingData = {
      propertyId: propertyId, // Use slug as propertyId
      guestInfo,
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests,
      pricing, // Should be fully validated by the schema already
      status: 'pending', // Always pending when created via this action
      appliedCouponCode: appliedCouponCode ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentInfo: { // Default payment info for a pending booking
        stripePaymentIntentId: '',
        amount: pricing.total,
        status: 'pending',
        paidAt: null,
      },
      source: 'website-pending', // Source indicating it's from the main booking flow
      // Include conversion flags if provided
      convertedFromHold: convertedFromHold ?? false,
      convertedFromInquiry: convertedFromInquiry ?? null,
      // We don't need to include these fields if they're undefined
      // holdFee: undefined,
      // holdUntil: undefined,
      // holdPaymentId: undefined,
    };
    console.log("[Action createPendingBookingAction] Preparing to save booking data...");

    const docRef = await addDoc(bookingsCollection, bookingData);
    console.log(`[Action createPendingBookingAction] Pending booking created successfully with ID: ${docRef.id}`);
    revalidatePath(`/properties/${propertyId}`); // Revalidate property page
    revalidatePath(`/booking/check/${propertyId}`); // Revalidate check page
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

// Schema for creating a HOLD booking
const CreateHoldBookingSchema = z.object({
  propertySlug: z.string().min(1), // Property SLUG
  guestInfo: z.object({
    firstName: z.string().min(1, "First name is required.").transform(sanitizeText), // Line 134
    lastName: z.string().min(1, "Last name is required.").transform(sanitizeText), // Line 135
    email: z.string().email("Invalid email address.").transform(sanitizeEmail),
    phone: z.string().min(1, "Phone number is required.").transform(sanitizePhone),
  }).passthrough(),
  checkInDate: z.string().datetime(), // ISO string
  checkOutDate: z.string().datetime(), // ISO string
  numberOfGuests: z.number().int().positive(),
  holdFeeAmount: z.number().nonnegative(), // The fee paid to hold the booking
  // No pricing object directly provided in the input, it will be calculated
});

type CreateHoldBookingInput = z.infer<typeof CreateHoldBookingSchema>;

export async function createHoldBookingAction(
  input: CreateHoldBookingInput
): Promise<{ bookingId?: string; error?: string }> {
  console.log("[Action createHoldBookingAction] Called with input:", JSON.stringify(input, null, 2));

  const validationResult = CreateHoldBookingSchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createHoldBookingAction] Validation Error:", errorMessages);
    return { error: `Invalid hold booking data: ${errorMessages}` };
  }

  const {
    propertySlug,
    guestInfo,
    checkInDate: checkInStr,
    checkOutDate: checkOutStr,
    numberOfGuests,
    holdFeeAmount,
  } = validationResult.data;

  try {
    if (!db) {
      console.error("[Action createHoldBookingAction] Firebase Client SDK not initialized.");
      return { error: "Internal server error: Database connection not available." };
    }

    const bookingsCollection = collection(db, 'bookings');
    const checkIn = new Date(checkInStr);
    const checkOut = new Date(checkOutStr);
    const holdUntil = new Date(Date.now() + 15 * 60 * 1000); // Hold for 15 minutes

    console.log("[Action createHoldBookingAction] Preparing hold booking data...");

    // Create a new booking object with all required fields explicitly defined
    const holdBookingData = {
      propertyId: propertySlug,
      guestInfo,
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests,
      pricing: {
        baseRate: 0,
        numberOfNights: 0,
        cleaningFee: 0,
        accommodationTotal: 0,
        subtotal: holdFeeAmount,
        total: holdFeeAmount,
        currency: 'RON' as CurrencyCode,
      },
      status: 'on-hold',
      holdFee: holdFeeAmount,
      holdUntil: Timestamp.fromDate(holdUntil),
      holdPaymentId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paymentInfo: {
        stripePaymentIntentId: "",
        amount: holdFeeAmount,
        status: 'pending',
        paidAt: null,
      },
      source: 'website-hold',
      appliedCouponCode: null,
      convertedFromHold: false,
      convertedFromInquiry: null,
    };

    const docRef = await addDoc(bookingsCollection, holdBookingData);
    console.log(`[Action createHoldBookingAction] Hold booking created successfully with ID: ${docRef.id}`);
    revalidatePath(`/properties/${propertySlug}`);
    revalidatePath(`/booking/check/${propertySlug}`);

    return { bookingId: docRef.id };
  } catch (error) {
    console.error(`❌ [Action createHoldBookingAction] Error creating hold booking:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied. Could not create hold booking.' };
    }
    if (errorMessage.includes('invalid data') || errorMessage.includes('Unsupported field value')) { 
      return { error: `Failed to create hold booking due to invalid data. Please check input values. Details: ${errorMessage.split(' (')[0]}` }; 
    }
    return { error: `Failed to create hold booking: ${errorMessage}` };
  }
}