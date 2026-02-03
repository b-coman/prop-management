// src/app/actions/createHoldBookingAction.ts
"use server";

import { z } from "zod";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Booking, Property } from "@/types"; // Assuming Property type includes holdFeeAmount
import { sanitizeEmail, sanitizePhone, sanitizeText } from "@/lib/sanitize";
import { revalidatePath } from "next/cache";
import { addHours, differenceInDays } from 'date-fns'; // For calculating hold expiry

// Schema for creating an ON-HOLD booking
const CreateHoldBookingSchema = z.object({
  propertySlug: z.string().min(1, "Property slug is required."),
  checkInDate: z.string().datetime("Invalid check-in date."),
  checkOutDate: z.string().datetime("Invalid check-out date."),
  guestCount: z.number().int().positive("Invalid guest count."),
  guestInfo: z.object({
    firstName: z.string().min(1, "First name is required.").transform(sanitizeText),
    lastName: z.string().min(1, "Last name is required.").transform(sanitizeText),
    email: z.string().email("Invalid email address.").transform(sanitizeEmail),
    phone: z.string().optional().transform(val => val ? sanitizePhone(val) : undefined),
  }),
  holdFeeAmount: z.number().positive("Hold fee amount must be positive."), // Hold fee from property settings
  holdDurationHours: z.number().int().positive().optional(), // Hold duration in hours (default 24)
  holdFeeRefundable: z.boolean().optional(), // Whether hold fee is refundable (default true)
  selectedCurrency: z.string().optional(), // User's selected currency from header dropdown
}).refine(data => new Date(data.checkOutDate) > new Date(data.checkInDate), {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"],
});

type CreateHoldBookingInput = z.infer<typeof CreateHoldBookingSchema>;

export async function createHoldBookingAction(
  input: CreateHoldBookingInput
): Promise<{ bookingId?: string; error?: string; errorType?: string; retry?: boolean }> {
  console.log("[Action createHoldBookingAction] Called with input:", JSON.stringify(input, null, 2));
  const validationResult = CreateHoldBookingSchema.safeParse(input);

  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error("[Action createHoldBookingAction] Validation Error:", errorMessages);
    return { error: `Invalid hold booking data: ${errorMessages}` };
  }

  const {
    propertySlug,
    checkInDate,
    checkOutDate,
    guestCount,
    guestInfo,
    holdFeeAmount,
    holdDurationHours = 24, // Default to 24 hours
    holdFeeRefundable = true, // Default to refundable
    selectedCurrency,
  } = validationResult.data;

  try {
    const bookingsCollection = collection(db, 'bookings');
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const now = new Date();
    const holdUntil = addHours(now, holdDurationHours); // Use property's hold duration setting
    
    // Calculate the number of nights
    const numberOfNights = differenceInDays(checkOut, checkIn);
    
    console.log(`[Action createHoldBookingAction] Calculated ${numberOfNights} nights between ${checkIn.toISOString()} and ${checkOut.toISOString()}`);

    const bookingData = {
      propertyId: propertySlug,
      guestInfo: guestInfo,
      checkInDate: Timestamp.fromDate(checkIn),
      checkOutDate: Timestamp.fromDate(checkOut),
      numberOfGuests: guestCount,
      status: "on-hold",
      holdFee: holdFeeAmount,
      holdUntil: Timestamp.fromDate(holdUntil),
      holdPaymentId: null, // Will be set by webhook after payment
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: 'website-hold',
      
      // Define a pricing object structure for the hold - all accommodation pricing is 0
      // since this is just a hold, not a full booking yet
      pricing: {
        baseRate: 0, // We'll calculate this when converting to a full booking
        numberOfNights: numberOfNights,
        cleaningFee: 0, // We'll calculate this when converting to a full booking
        accommodationTotal: 0, // Will be set when converting to full booking
        subtotal: 0, // For holds, this should be 0 as it's not a full booking yet
        total: 0, // For holds, this should be 0 as it's not a full booking yet
        currency: selectedCurrency || 'RON', // Use the user's selected currency
      },
      // The hold fee amount is stored in the paymentInfo since it's not part of the accommodation cost
      paymentInfo: {
        amount: holdFeeAmount, // This is the hold fee amount that will be charged
        status: 'pending', // Status of the hold fee payment
        paidAt: null,
        stripePaymentIntentId: "", // Will be filled by the webhook
      },
      // Add other fields as needed, defaulting to null/undefined/false
      appliedCouponCode: null,
      convertedFromHold: false,
      convertedFromInquiry: null,
      holdFeeRefundable: holdFeeRefundable, // Store whether the hold fee is refundable
      holdDurationHours: holdDurationHours, // Store the hold duration for reference
    };
    
    console.log("[Action createHoldBookingAction] Prepared Firestore Data:", bookingData);

    const docRef = await addDoc(bookingsCollection, bookingData);
    console.log(`[Action createHoldBookingAction] Hold booking created successfully with ID: ${docRef.id}`);

    revalidatePath(`/properties/${propertySlug}`);
    revalidatePath(`/booking/check/${propertySlug}`);
    return { bookingId: docRef.id };
  } catch (error) {
    console.error(`❌ [Action createHoldBookingAction] Error creating hold booking:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return { 
        error: 'Permission denied. Could not create hold booking.',
        errorType: 'permission_denied',
        retry: false 
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return { 
        error: 'Network error. Please check your connection and try again.',
        errorType: 'network_error',
        retry: true 
      };
    }
    
    return { 
      error: `Failed to create hold booking: ${errorMessage}`,
      retry: false
    };
  }
}