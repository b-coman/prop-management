"use server";

import { z } from 'zod';
import { createBooking, type CreateBookingData } from "@/services/bookingService";
import type { Booking } from '@/types'; // Import Booking type
import { getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Schema to validate input parameters from the success page URL
const SimulationInputSchema = z.object({
  sessionId: z.string().min(1),
  propertyId: z.string().min(1),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  numberOfGuests: z.coerce.number().int().positive(),
  numberOfNights: z.coerce.number().int().positive(),
  totalPrice: z.coerce.number().positive(),
  appliedCouponCode: z.string().optional(),
  discountPercentage: z.coerce.number().optional(),
});

export async function simulateWebhookSuccess(
  params: unknown // Accept unknown first for safe parsing
): Promise<{ success: boolean; bookingId?: string; error?: string }> {

  console.log('[Simulate Webhook] Action called.');

  // Only run in development environment
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[Simulate Webhook] Attempted to run simulation in non-development environment. Aborting.');
    return { success: false, error: 'Simulation only allowed in development.' };
  }

  // Validate input parameters
  const validationResult = SimulationInputSchema.safeParse(params);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error('[Simulate Webhook] Invalid input parameters:', errorMessages);
    return { success: false, error: `Invalid simulation parameters: ${errorMessages}` };
  }

  const {
    sessionId,
    propertyId,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    numberOfNights,
    totalPrice, // This is the final price received from the URL
    appliedCouponCode,
    discountPercentage,
  } = validationResult.data;

  console.log(`[Simulate Webhook] Processing simulation for Session ID: ${sessionId}, Property ID: ${propertyId}`);

  try {
    // 1. Fetch Property Details (needed for pricing calculation)
    console.log(`[Simulate Webhook] Fetching property details for ID: ${propertyId}`);
    const propertyRef = doc(db, 'properties', propertyId);
    const propertySnap = await getDoc(propertyRef);
    if (!propertySnap.exists()) {
      console.error(`[Simulate Webhook] Property with ID ${propertyId} not found in Firestore.`);
      throw new Error(`Property with ID ${propertyId} not found for simulation.`);
    }
    const propertyData = propertySnap.data();
    console.log('[Simulate Webhook] Property data fetched successfully.');

    const baseRate = propertyData.pricePerNight ?? 0;
    const cleaningFee = propertyData.cleaningFee ?? 0;
    const extraGuestFee = propertyData.extraGuestFee ?? 0;
    const baseOccupancy = propertyData.baseOccupancy ?? 1;

    // 2. Reconstruct Pricing Details (crucial step, must match createBooking expectations)
    console.log('[Simulate Webhook] Reconstructing pricing details...');
    const numberOfExtraGuests = Math.max(0, numberOfGuests - baseOccupancy);
    const accommodationTotal = (baseRate * numberOfNights) + (extraGuestFee * numberOfExtraGuests * numberOfNights);
    const subtotal = accommodationTotal + cleaningFee;
    const discountAmount = discountPercentage ? subtotal * (discountPercentage / 100) : 0;

    // VERY IMPORTANT: Ensure the totalPrice used in the mock matches the one from the URL params
    // Calculate taxes based on the difference, but ensure the total matches.
    const calculatedTotalBeforeTax = subtotal - discountAmount;
    const taxes = Math.max(0, totalPrice - calculatedTotalBeforeTax); // Derive taxes

    console.log(`[Simulate Webhook Pricing] BaseRate: ${baseRate}, Nights: ${numberOfNights}, ExtraGuests: ${numberOfExtraGuests}, ExtraFee: ${extraGuestFee}`);
    console.log(`[Simulate Webhook Pricing] AccommodationTotal: ${accommodationTotal}, CleaningFee: ${cleaningFee}, Subtotal: ${subtotal}`);
    console.log(`[Simulate Webhook Pricing] Discount: ${discountAmount} (${discountPercentage ?? 0}%), Taxes (derived): ${taxes}`);
    console.log(`[Simulate Webhook Pricing] Final Calculated Total (for validation): ${calculatedTotalBeforeTax + taxes}`);
    console.log(`[Simulate Webhook Pricing] Final Total from URL (used): ${totalPrice}`);


    // 3. Construct Mock Booking Data
    console.log('[Simulate Webhook] Constructing mock booking data...');
    const mockBookingData: CreateBookingData = {
      propertyId: propertyId,
      guestInfo: { // Using generic mock data for guest info
        firstName: "DevSim",
        lastName: "User",
        email: `devsim_${Date.now()}@example.com`,
        userId: "dev-sim-user",
        phone: "+15559998877", // Example phone
      },
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: numberOfGuests,
      pricing: { // Ensure this matches the structure expected by createBooking
        baseRate: baseRate,
        numberOfNights: numberOfNights,
        cleaningFee: cleaningFee,
        extraGuestFee: extraGuestFee,
        numberOfExtraGuests: numberOfExtraGuests,
        accommodationTotal: accommodationTotal,
        subtotal: subtotal,
        taxes: taxes, // Use derived taxes
        discountAmount: discountAmount, // Use calculated discount
        total: totalPrice, // *** USE THE TOTAL PRICE FROM URL PARAMS ***
      },
      appliedCouponCode: appliedCouponCode,
      paymentInput: {
        stripePaymentIntentId: `sim_${sessionId}`, // Indicate simulation
        amount: totalPrice, // Use the final total price from params
        status: "succeeded", // Simulate success
      },
      status: 'confirmed' as Booking['status'], // Directly set status
      source: 'dev-simulation',
      notes: `Simulated booking via success page for session ${sessionId}.`,
    };

    console.log('[Simulate Webhook] Mock booking data constructed:', JSON.stringify(mockBookingData, null, 2));

    // 4. Call createBooking
    console.log('[Simulate Webhook] Calling createBooking...');
    const bookingId = await createBooking(mockBookingData);
    console.log(`[Simulate Webhook] createBooking call finished. Booking ID: ${bookingId}`);

    return { success: true, bookingId: bookingId };

  } catch (error) {
    console.error(`❌ [Simulate Webhook] Error during simulation process for session ${sessionId}:`, error);
    // Provide a more specific error message from the caught error
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check if the error message indicates a booking creation failure specifically
    if (errorMessage.includes("Failed to create booking")) {
        return { success: false, error: errorMessage }; // Return the specific error from createBooking
    }
    // Otherwise, return a generic simulation failure message
    return { success: false, error: `Simulation failed: ${errorMessage}` };
  }
}

    