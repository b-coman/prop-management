"use server";

import type { Property } from '@/types';
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

interface CreateCheckoutSessionInput {
  property: Property;
  checkInDate: string; // ISO string format
  checkOutDate: string; // ISO string format
  numberOfGuests: number;
  totalPrice: number; // FINAL price in dollars (after discount)
  numberOfNights: number;
  // Optional guest info now expected
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string; // Pass guest email if available
  // Optional coupon info
  appliedCouponCode?: string;
  discountPercentage?: number;
  // Optional pending booking ID
  pendingBookingId?: string; // Added to link Stripe session to pending booking
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ sessionId?: string; sessionUrl?: string | null; error?: string }> {
  const {
    property,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice,
    numberOfNights,
    guestEmail,
    guestFirstName,
    guestLastName,
    appliedCouponCode,
    discountPercentage,
    pendingBookingId, // Get the pending booking ID
  } = input;

  // Await the headers call
  const headersList = await headers(); // Await headers() call
  const origin = headersList.get('origin') || 'http://localhost:9002';

  const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);

  // --- Prepare metadata ---
  const metadata: Stripe.MetadataParam = {
    propertyId: property.id,
    propertyName: property.name,
    checkInDate: checkInDate,
    checkOutDate: checkOutDate,
    numberOfGuests: String(numberOfGuests),
    numberOfNights: String(numberOfNights),
    totalPrice: String(totalPrice),
    cleaningFee: String(property.cleaningFee),
    pricePerNight: String(property.pricePerNight),
    baseOccupancy: String(property.baseOccupancy),
    extraGuestFee: String(property.extraGuestFee),
    numberOfExtraGuests: String(numberOfExtraGuests),
    guestFirstName: guestFirstName || '',
    guestLastName: guestLastName || '',
    // Add pendingBookingId to metadata
    pendingBookingId: pendingBookingId || '', // Include if available
    // userId: loggedInUserId || '', // Add user ID if available
  };

  if (appliedCouponCode && discountPercentage !== undefined) {
    metadata.appliedCouponCode = appliedCouponCode;
    metadata.discountPercentage = String(discountPercentage);
  }

  // --- Construct Success URL ---
  // Keep success URL simple, rely on webhook and booking ID for confirmation logic
  const success_url = `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; // Optionally pass booking ID
  const cancel_url = `${origin}/booking/cancel?property_slug=${property.slug}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; // Pass booking ID to cancel if needed

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)${appliedCouponCode ? ` - Coupon: ${appliedCouponCode}` : ''}`,
              description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}. Ref: ${pendingBookingId || 'N/A'}`, // Add ref
              images: [property.images.find(img => img.isFeatured)?.url || property.images[0]?.url || ''],
            },
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: guestEmail,
      phone_number_collection: { enabled: true,}, // Keep phone collection
      metadata: metadata, // Pass the prepared metadata including pendingBookingId
    });

    if (!session.id || !session.url) { // Check for session URL as well
        throw new Error('Failed to create Stripe session or missing session URL.');
    }

    // Link session to pending booking if ID provided
    if (pendingBookingId && session.payment_intent) {
        // You might want to update the pending booking with the payment_intent ID here
        // This provides another link between the booking and the payment attempt.
        // Example (requires an update action):
        // await updatePendingBookingWithPaymentIntent(pendingBookingId, session.payment_intent as string);
        console.log(`[createCheckoutSession] Stripe session ${session.id} created, linked to pending booking ${pendingBookingId} via metadata. Payment Intent: ${session.payment_intent}`);
    }

    // Return both sessionId and sessionUrl
    return { sessionId: session.id, sessionUrl: session.url };
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    return { error: `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}` };
  }
}

// Optional helper action (if needed)
// async function updatePendingBookingWithPaymentIntent(bookingId: string, paymentIntentId: string) {
//   try {
//     const bookingRef = doc(db, 'bookings', bookingId);
//     await updateDoc(bookingRef, {
//       'paymentInfo.stripePaymentIntentId': paymentIntentId,
//       updatedAt: serverTimestamp(),
//     });
//     console.log(`[updatePendingBooking] Updated booking ${bookingId} with Payment Intent ID: ${paymentIntentId}`);
//   } catch (error) {
//     console.error(`[updatePendingBooking] Error updating booking ${bookingId} with Payment Intent ID:`, error);
//     // Handle error appropriately, maybe log it or notify admin
//   }
// }
