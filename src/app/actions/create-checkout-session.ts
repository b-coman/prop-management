
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
  totalPrice: number; // FINAL price in dollars (after discount)
  numberOfNights: number;
  // Optional guest info if available upfront
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string; // Pass guest email if available
  // Optional coupon info
  appliedCouponCode?: string;
  discountPercentage?: number;
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
  const {
    property,
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice, // This is the final price AFTER discount
    numberOfNights,
    guestEmail, // Capture guest email if provided
    guestFirstName,
    guestLastName,
    appliedCouponCode, // Get coupon code
    discountPercentage, // Get discount percentage
  } = input;

  const origin = headers().get('origin') || 'http://localhost:9002'; // Default for local dev

  // Calculate number of extra guests
  const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);

  // --- Prepare metadata ---
  const metadata: Stripe.MetadataParam = {
    propertyId: property.id,
    propertyName: property.name,
    checkInDate: checkInDate,
    checkOutDate: checkOutDate,
    numberOfGuests: String(numberOfGuests),
    numberOfNights: String(numberOfNights),
    totalPrice: String(totalPrice), // Final price paid
    cleaningFee: String(property.cleaningFee),
    pricePerNight: String(property.pricePerNight),
    baseOccupancy: String(property.baseOccupancy),
    extraGuestFee: String(property.extraGuestFee),
    numberOfExtraGuests: String(numberOfExtraGuests),
    guestFirstName: guestFirstName || '',
    guestLastName: guestLastName || '',
    // userId: loggedInUserId || '', // Add user ID if available
  };

  // Add coupon info to metadata if applied
  if (appliedCouponCode && discountPercentage !== undefined) {
    metadata.appliedCouponCode = appliedCouponCode;
    metadata.discountPercentage = String(discountPercentage);
    // Optionally, calculate and add original subtotal and discount amount
    // const subtotalBeforeDiscount = (property.pricePerNight * numberOfNights) + (property.extraGuestFee * numberOfExtraGuests * numberOfNights) + property.cleaningFee;
    // const discountAmount = subtotalBeforeDiscount * (discountPercentage / 100);
    // metadata.subtotalBeforeDiscount = String(subtotalBeforeDiscount);
    // metadata.discountAmount = String(discountAmount);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)${appliedCouponCode ? ` - Coupon: ${appliedCouponCode}` : ''}`, // Add coupon info to name
              description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}.`,
              images: [property.images.find(img => img.isFeatured)?.url || property.images[0]?.url || ''], // Use featured or first image
            },
            // Ensure totalPrice is converted to cents correctly
            unit_amount: Math.round(totalPrice * 100), // Use final price
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking/cancel?property_slug=${property.slug}`,
       // Include customer email if available, helps Stripe populate customer info
      customer_email: guestEmail, // Pass guest email to Stripe
      phone_number_collection: { enabled: true,},
      // Pass necessary booking details in metadata for the webhook
      metadata: metadata, // Pass the prepared metadata
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
