
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
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
  const {
    property,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice,
    numberOfNights,
  } = input;

  const origin = headers().get('origin') || 'http://localhost:9002'; // Default for local dev

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${property.name} (${numberOfNights} nights)`,
              description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()} for ${numberOfGuests} guests.`,
              images: [property.images.find(img => img.isFeatured)?.url || property.images[0]?.url || ''], // Use featured or first image
            },
            unit_amount: Math.round(totalPrice * 100), // Price in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking/cancel?property_slug=${property.slug}`,
      metadata: {
        propertyId: property.id,
        propertyName: property.name,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        numberOfGuests: String(numberOfGuests),
        numberOfNights: String(numberOfNights),
        totalPrice: String(totalPrice),
        cleaningFee: String(property.cleaningFee),
        pricePerNight: String(property.pricePerNight),
      },
       // You might need customer email for receipts, etc.
      // customer_email: guestEmail, // Pass guest email if available
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
