// src/app/actions/createHoldCheckoutSession.ts
"use server";

import type { Property, CurrencyCode } from '@/types';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { getCurrencyRates } from '@/services/configService'; // Import to get currency rates
import { loggers } from '@/lib/logger';

const logger = loggers.stripe;

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

interface CreateHoldCheckoutSessionInput {
  property: Property; // Need property details like name, currency, slug
  holdBookingId: string; // The ID of the 'on-hold' booking document
  holdFeeAmount: number; // The amount for the hold fee
  guestEmail?: string;
  selectedCurrency?: CurrencyCode; // User's selected currency from the header dropdown
}

export async function createHoldCheckoutSession(input: CreateHoldCheckoutSessionInput): Promise<{ sessionId?: string; sessionUrl?: string | null; error?: string; retry?: boolean; errorType?: string }> {
  const {
    property,
    holdBookingId,
    holdFeeAmount,
    guestEmail,
    selectedCurrency,
  } = input;

  const headersList = await headers();
  const origin = headersList.get('origin') || 'http://localhost:9002'; // Adjust default origin if needed

  // Ensure holdFeeAmount is positive
  if (holdFeeAmount <= 0) {
    return { error: "Invalid hold fee amount." };
  }

  // Get the selected currency for Stripe (lowercase for Stripe's API)
  const stripeCurrency = (selectedCurrency || property.baseCurrency).toLowerCase() as string;

  // We need to convert the holdFeeAmount to the selected currency
  let convertedHoldFeeAmount = holdFeeAmount;

  // Only convert if the selected currency is different from the property's base currency
  if (selectedCurrency && selectedCurrency !== property.baseCurrency) {
    try {
      // Get currency rates
      const rates = await getCurrencyRates();

      if (rates) {
        // Convert from property's base currency to selected currency
        const baseRate = rates[property.baseCurrency] || 1;
        const targetRate = rates[selectedCurrency] || 1;

        // First convert to USD (base), then to selected currency
        const amountInUSD = holdFeeAmount / baseRate;
        convertedHoldFeeAmount = amountInUSD * targetRate;

        logger.debug('Converted hold fee', { from: holdFeeAmount, fromCurrency: property.baseCurrency, to: convertedHoldFeeAmount.toFixed(2), toCurrency: selectedCurrency });
      } else {
        logger.warn('Currency rates not available, using original amount');
      }
    } catch (error) {
      logger.error('Error converting currency for hold fee', error as Error);
      // Continue with original amount if conversion fails
    }
  }

  // Extract property name as string for Stripe metadata (Stripe only accepts strings)
  const { getPropertyNameString } = await import('@/lib/multilingual-utils');
  const propertyName = getPropertyNameString(property.name);

  const metadata: Stripe.MetadataParam = {
    type: 'booking_hold', // Differentiate from full booking
    propertyId: property.slug,
    propertyName: propertyName,
    holdBookingId: holdBookingId, // Link session to the hold booking
    holdFeeAmount: String(holdFeeAmount),
    holdCurrency: selectedCurrency || property.baseCurrency, // Store the actual currency used
  };

  // Define success/cancel URLs - Updated for path-based language detection
  // Success could redirect back to the booking page showing hold confirmation,
  // or a dedicated "hold successful" page.
  const success_url = `${origin}/booking/hold-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${holdBookingId}`;
  
  // Cancel URL now uses path-based language detection (no ?lang parameter needed)
  // The booking page will detect language from the path automatically
  const cancel_url = `${origin}/booking/check/${property.slug}?hold_cancelled=true&booking_id=${holdBookingId}`;

  try {
    // Validate essential fields to provide clearer error messages
    if (!guestEmail || guestEmail.trim() === '') {
      logger.error('Missing required guest email for hold checkout');
      return { error: "Missing required guest email. Please fill in your email to continue." };
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Hold Fee - ${propertyName}`,
              description: `24-hour hold reservation fee (Booking Ref: ${holdBookingId})`,
              // Add property image if desired
              // images: [property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || ''],
            },
            // Amount must be in the smallest currency unit (e.g., cents)
            // Use the converted amount for the selected currency
            unit_amount: Math.round(convertedHoldFeeAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment', // One-time payment for the hold fee
      success_url: success_url,
      cancel_url: cancel_url,
      customer_email: guestEmail, // Pre-fill email if available
      metadata: metadata,
    };

    const stripeInstance = getStripe();
    const session = await stripeInstance.checkout.sessions.create(sessionParams);

    if (!session.id || !session.url) {
      throw new Error('Failed to create Stripe session or missing session URL.');
    }

    logger.info('Hold checkout session created', { sessionId: session.id, holdBookingId });
    return { sessionId: session.id, sessionUrl: session.url };
  } catch (error) {
    logger.error('Error creating hold checkout session', error as Error, { holdBookingId });
    return { error: `Failed to create hold checkout session: ${error instanceof Error ? error.message : String(error)}` };
  }
}
