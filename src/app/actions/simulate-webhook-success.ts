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
    totalPrice,
    appliedCouponCode,
    discountPercentage,
  } = validationResult.data;

  console.log(`[Simulate Webhook] Processing simulation for Session ID: ${sessionId}, Property ID: ${propertyId}`);

  try {
    // 1. Fetch Property Details (needed for pricing calculation) - Optional but good practice
    //    In a real webhook, you'd get this from metadata, but here we fetch for accuracy
    const propertyRef = doc(db, 'properties', propertyId);
    const propertySnap = await getDoc(propertyRef);
    if (!propertySnap.exists()) {
      throw new Error(`Property with ID ${propertyId} not found for simulation.`);
    }
    const propertyData = propertySnap.data();
    const baseRate = propertyData.pricePerNight || 0;
    const cleaningFee = propertyData.cleaningFee || 0;
    const extraGuestFee = propertyData.extraGuestFee || 0;
    const baseOccupancy = propertyData.baseOccupancy || 1;

    // 2. Reconstruct Pricing Details (as webhook would)
    const numberOfExtraGuests = Math.max(0, numberOfGuests - baseOccupancy);
    const accommodationTotal = (baseRate * numberOfNights) + (extraGuestFee * numberOfExtraGuests * numberOfNights);
    const subtotal = accommodationTotal + cleaningFee;
    const discountAmount = discountPercentage ? subtotal * (discountPercentage / 100) : 0;
    const taxes = Math.max(0, totalPrice - (subtotal - discountAmount)); // Calculate taxes based on final price

    // 3. Construct Mock Booking Data
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
      pricing: {
        baseRate: baseRate,
        numberOfNights: numberOfNights,
        cleaningFee: cleaningFee,
        extraGuestFee: extraGuestFee,
        numberOfExtraGuests: numberOfExtraGuests,
        accommodationTotal: accommodationTotal,
        subtotal: subtotal,
        taxes: taxes,
        discountAmount: discountAmount,
        total: totalPrice, // Use the final total price from params
      },
      appliedCouponCode: appliedCouponCode,
      paymentInput: {
        stripePaymentIntentId: `sim_${sessionId}`, // Indicate simulation
        amount: totalPrice,
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
    console.log(`[Simulate Webhook] createBooking finished. Booking ID: ${bookingId}`);

    return { success: true, bookingId: bookingId };

  } catch (error) {
    console.error(`❌ [Simulate Webhook] Error during simulation for session ${sessionId}:`, error);
    return { success: false, error: `Simulation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}