"use server";

import type { Property, CurrencyCode } from '@/types'; // Added CurrencyCode
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { loggers } from '@/lib/logger';

const logger = loggers.stripe;

interface CreateCheckoutSessionInput {
  property: Property;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  totalPrice: number; // Total price to charge
  numberOfNights: number;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  appliedCouponCode?: string;
  discountPercentage?: number;
  pendingBookingId?: string;
  selectedCurrency?: CurrencyCode; // User's selected currency
}

interface CreateCheckoutSessionResult {
  sessionId?: string;
  sessionUrl?: string;
  error?: string;
  retry?: boolean;
  errorType?: string;
}

// Lazy initialization of Stripe
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (stripe) return stripe;
  
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
  }
  
  stripe = new Stripe(stripeSecretKey);
  return stripe;
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  // console.log('[createCheckoutSession] Starting session creation with input:', {
  //   ...input,
  //   property: { id: input.property.id, name: input.property.name }
  // });

  try {
    const stripeInstance = getStripe();
    
    // Get the origin from the current request
    const headersList = await headers();
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

    // Destructure the input
    const {
      property,
      checkInDate,
      checkOutDate,
      numberOfGuests,
      totalPrice,
      numberOfNights,
      guestFirstName,
      guestLastName,
      guestEmail,
      appliedCouponCode,
      discountPercentage,
      pendingBookingId,
      selectedCurrency = 'EUR',
    } = input;

    // console.log('[createCheckoutSession] Transaction currency:', selectedCurrency);

    // Convert price to cents (Stripe requires smallest currency unit)
    const priceInCents = Math.round(totalPrice * 100);
    // console.log('[createCheckoutSession] Price conversion:', { totalPrice, priceInCents });
    
    let discountCoupon;
    if (appliedCouponCode && discountPercentage) {
        try {
            const couponId = `discount_${Math.round(discountPercentage)}_percent_coupon`;
            const existingCoupons = await stripeInstance.coupons.list({
                limit: 100,
            });
            const existingCoupon = existingCoupons.data.find(c => c.id === couponId);
            
            if (existingCoupon) {
                discountCoupon = existingCoupon.id;
                logger.debug('Using existing Stripe coupon', { couponId });
            } else {
                const coupon = await stripeInstance.coupons.create({
                    id: couponId,
                    percent_off: discountPercentage,
                    duration: 'once',
                    name: `${discountPercentage}% Discount`,
                });
                discountCoupon = coupon.id;
                logger.debug('Created new Stripe coupon', { couponId });
            }
        } catch (error) {
            logger.error('Error creating/checking coupon', error as Error);
            // Continue without discount if coupon creation fails
        }
    }

    // Extract property name as string for Stripe metadata and display (Stripe only accepts strings)
    const { getPropertyNameString } = await import('@/lib/multilingual-utils');
    const propertyName = getPropertyNameString(property.name, 'en');

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`,
      cancel_url: `${origin}/booking/cancel`,
      automatic_tax: { enabled: false },
      metadata: {
        type: 'booking_full', // MUST be 'booking_full' or 'booking_hold'
        propertyId: property.id,
        propertyName: propertyName,
        checkInDate,
        checkOutDate,
        numberOfGuests: String(numberOfGuests),
        numberOfNights: String(numberOfNights),
        guestFirstName: guestFirstName || '',
        guestLastName: guestLastName || '',
        guestEmail: guestEmail || '',
        pendingBookingId: pendingBookingId || '',
        priceCurrency: selectedCurrency, // Critical for webhook to use correct currency
      },
      line_items: [{
        price_data: {
          currency: selectedCurrency.toLowerCase(),
          product_data: {
            name: propertyName,
            description: `Stay from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()} (${numberOfNights} nights)`,
          },
          unit_amount: priceInCents,
        },
        quantity: 1,
      }],
    };

    // Apply discount if available
    if (discountCoupon) {
      sessionParams.discounts = [{
        coupon: discountCoupon,
      }];
    }

    // Add guest email if provided
    if (guestEmail) {
      sessionParams.customer_email = guestEmail;
    }

    // console.log('[createCheckoutSession] Creating Stripe session with params:', {
    //   ...sessionParams,
    //   metadata: sessionParams.metadata,
    //   line_items: sessionParams.line_items,
    // });

    const session = await stripeInstance.checkout.sessions.create(sessionParams, {
      idempotencyKey: `checkout_full_${pendingBookingId || crypto.randomUUID()}`,
    });

    logger.info('Checkout session created successfully', { sessionId: session.id, sessionUrl: session.url });

    return {
      sessionId: session.id,
      sessionUrl: session.url || undefined,
    };
  } catch (error) {
    logger.error('Error creating checkout session', error as Error);

    if (error instanceof Error) {
      return { error: error.message };
    }
    
    return { error: 'An unknown error occurred while creating the checkout session.' };
  }
}