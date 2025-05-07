
"use server";

import type { Property, CurrencyCode } from '@/types'; // Added CurrencyCode
import { headers } from 'next/headers';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

interface CreateCheckoutSessionInput {
  property: Property; 
  checkInDate: string; 
  checkOutDate: string; 
  numberOfGuests: number;
  totalPrice: number; // FINAL price in property's base currency
  numberOfNights: number;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string; 
  appliedCouponCode?: string;
  discountPercentage?: number;
  pendingBookingId?: string; 
}

export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ sessionId?: string; sessionUrl?: string | null; error?: string }> {
  const {
    property, 
    checkInDate,
    checkOutDate,
    numberOfGuests,
    totalPrice, // This should be in property.baseCurrency
    numberOfNights,
    guestEmail,
    guestFirstName,
    guestLastName,
    appliedCouponCode,
    discountPercentage,
    pendingBookingId, 
  } = input;

  const headersList = await headers(); 
  const origin = headersList.get('origin') || 'http://localhost:9002';

  const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);
  const stripeCurrency = property.baseCurrency.toLowerCase() as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Currency; // Ensure Stripe compatible format

  const metadata: Stripe.MetadataParam = {
    propertyId: property.slug, 
    propertyName: property.name,
    checkInDate: checkInDate,
    checkOutDate: checkOutDate,
    numberOfGuests: String(numberOfGuests),
    numberOfNights: String(numberOfNights),
    totalPrice: String(totalPrice), // Price in base currency
    priceCurrency: property.baseCurrency, // Store the currency used for this price
    cleaningFee: String(property.cleaningFee),
    pricePerNight: String(property.pricePerNight),
    baseOccupancy: String(property.baseOccupancy),
    extraGuestFee: String(property.extraGuestFee),
    numberOfExtraGuests: String(numberOfExtraGuests),
    guestFirstName: guestFirstName || '',
    guestLastName: guestLastName || '',
    pendingBookingId: pendingBookingId || '', 
  };

  if (appliedCouponCode && discountPercentage !== undefined) {
    metadata.appliedCouponCode = appliedCouponCode;
    metadata.discountPercentage = String(discountPercentage);
  }

  const success_url = `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; 
  const cancel_url = `${origin}/booking/cancel?property_slug=${property.slug}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`; 

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency, // Use property's base currency
            product_data: {
              name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)${appliedCouponCode ? ` - Coupon: ${appliedCouponCode}` : ''}`,
              description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}. Ref: ${pendingBookingId || 'N/A'}`, 
              images: [property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || ''], 
            },
            unit_amount: Math.round(totalPrice * 100), // Amount in smallest currency unit (cents for USD/EUR, bani for RON)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: guestEmail,
      phone_number_collection: { enabled: true,}, 
      metadata: metadata, 
    });

    if (!session.id || !session.url) { 
        throw new Error('Failed to create Stripe session or missing session URL.');
    }

    if (pendingBookingId && session.payment_intent) {
        console.log(`[createCheckoutSession] Stripe session ${session.id} created, linked to pending booking ${pendingBookingId} via metadata. Payment Intent: ${session.payment_intent}`);
    }

    return { sessionId: session.id, sessionUrl: session.url };
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    return { error: `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}` };
  }
}