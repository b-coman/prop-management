// src/app/actions/createHoldCheckoutSession.ts
"use server";

import type { Property, CurrencyCode } from '@/types';
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

interface CreateHoldCheckoutSessionInput {
  property: Property; // Need property details like name, currency, slug
  holdBookingId: string; // The ID of the 'on-hold' booking document
  holdFeeAmount: number; // The amount for the hold fee
  guestEmail?: string;
}

export async function createHoldCheckoutSession(input: CreateHoldCheckoutSessionInput): Promise<{ sessionId?: string; sessionUrl?: string | null; error?: string }> {
  const {
    property,
    holdBookingId,
    holdFeeAmount,
    guestEmail,
  } = input;

  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:9002'; // Adjust default origin if needed

  // Ensure holdFeeAmount is positive
  if (holdFeeAmount <= 0) {
    return { error: "Invalid hold fee amount." };
  }

  // Determine currency - use property's base currency for the hold fee
  const stripeCurrency = property.baseCurrency.toLowerCase() as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Currency;

  const metadata: Stripe.MetadataParam = {
    type: 'booking_hold', // Differentiate from full booking
    propertyId: property.slug,
    propertyName: property.name,
    holdBookingId: holdBookingId, // Link session to the hold booking
    holdFeeAmount: String(holdFeeAmount),
    holdCurrency: property.baseCurrency,
  };

  // Define success/cancel URLs - These might need adjustment.
  // Success could redirect back to the booking page showing hold confirmation,
  // or a dedicated "hold successful" page.
  const success_url = `${origin}/booking/hold-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${holdBookingId}`;
  const cancel_url = `${origin}/booking/check/${property.slug}?hold_cancelled=true&booking_id=${holdBookingId}`; // Go back to check page

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Hold Fee - ${property.name}`,
              description: `24-hour hold reservation fee (Booking Ref: ${holdBookingId})`,
              // Add property image if desired
              // images: [property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || ''],
            },
            // Amount must be in the smallest currency unit (e.g., cents)
            unit_amount: Math.round(holdFeeAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment for the hold fee
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: guestEmail, // Pre-fill email if available
      metadata: metadata,
    });

    if (!session.id || !session.url) {
      throw new Error('Failed to create Stripe session or missing session URL.');
    }

    console.log(`[createHoldCheckoutSession] Stripe session ${session.id} created for hold booking ${holdBookingId}.`);
    return { sessionId: session.id, sessionUrl: session.url };
  } catch (error) {
    console.error('Error creating Stripe Hold Checkout session:', error);
    return { error: `Failed to create hold checkout session: ${error instanceof Error ? error.message : String(error)}` };
  }
}
