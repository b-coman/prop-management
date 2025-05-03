
"use server";

import type { Property } from '@/types';
import { headers } from 'next/headers';
import Stripe from 'stripe';

// Ensure Stripe secret key is set in environment variables
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
  totalPrice: number; // In dollars
  numberOfNights: number;
  // Optional guest info if available upfront
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string; // Pass guest email if available
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
  const {
    property,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice,
    numberOfNights,
    guestEmail, // Capture guest email if provided
    guestFirstName,
    guestLastName,
  } = input;

  const origin = headers().get('origin') || 'http://localhost:9002'; // Default for local dev

  // Calculate number of extra guests
  const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)`,
              description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}.`,
              images: [property.images.find(img => img.isFeatured)?.url || property.images[0]?.url || ''], // Use featured or first image
            },
            // Ensure totalPrice is converted to cents correctly
            unit_amount: Math.round(totalPrice * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking/cancel?property_slug=${property.slug}`,
       // Include customer email if available, helps Stripe populate customer info
      customer_email: guestEmail, // Pass guest email to Stripe
      // Pass necessary booking details in metadata for the webhook
      metadata: {
        propertyId: property.id,
        propertyName: property.name, // Keep for potential display on success page
        checkInDate: checkInDate, // ISO String
        checkOutDate: checkOutDate, // ISO String
        numberOfGuests: String(numberOfGuests),
        numberOfNights: String(numberOfNights),
        totalPrice: String(totalPrice), // Total price paid (in dollars)
        cleaningFee: String(property.cleaningFee),
        pricePerNight: String(property.pricePerNight),
        baseOccupancy: String(property.baseOccupancy), // Add base occupancy
        extraGuestFee: String(property.extraGuestFee), // Add extra guest fee
        numberOfExtraGuests: String(numberOfExtraGuests), // Add number of extra guests
        // Include guest name if available
        guestFirstName: guestFirstName || '',
        guestLastName: guestLastName || '',
        // Add any other relevant info needed by the webhook (e.g., userId if logged in)
        // userId: loggedInUserId || '',
      },
       // payment_intent_data: {
      //   capture_method: 'automatic', // Or 'manual' if you capture later
      // },
    });

    if (!session.id) {
        throw new Error('Failed to create Stripe session.');
    }

    return { sessionId: session.id };
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    // Return a structured error
    return { error: `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}` };
  }
}

