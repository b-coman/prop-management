
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

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<{
  sessionId?: string;
  sessionUrl?: string | null;
  error?: string;
  errorType?: string;
  retry?: boolean;
  paymentProvider?: string;
}> {
  try {
    // Input validation first
    if (!input || !input.property || !input.checkInDate || !input.checkOutDate) {
      console.error("[createCheckoutSession] Missing required input parameters:",
        JSON.stringify({
          hasProperty: !!input?.property,
          hasCheckInDate: !!input?.checkInDate,
          hasCheckOutDate: !!input?.checkOutDate,
        }));

      return {
        error: "Missing required booking information. Please fill in all required fields.",
        errorType: "validation_error"
      };
    }

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
      pendingBookingId,
      selectedCurrency, // User's selected currency
    } = input;

    // Validate total price - must be greater than zero
    if (!totalPrice || totalPrice <= 0) {
      return {
        error: "Invalid booking price. Please try again.",
        errorType: "validation_error"
      };
    }

    // Get origin for success/cancel URLs
    const headersList = await headers();
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

    const numberOfExtraGuests = Math.max(0, numberOfGuests - property.baseOccupancy);

    // Use the user's selected currency or fall back to property's base currency
    const stripeCurrency = (selectedCurrency || property.baseCurrency).toLowerCase() as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Currency;

    // Create metadata for tracking booking details in Stripe
    const metadata: Stripe.MetadataParam = {
      propertyId: property.slug,
      propertyName: property.name,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: String(numberOfGuests),
      numberOfNights: String(numberOfNights),
      totalPrice: String(totalPrice),
      priceCurrency: selectedCurrency || property.baseCurrency,
      cleaningFee: String(property.cleaningFee || 0),
      pricePerNight: String(property.pricePerNight || 0),
      baseOccupancy: String(property.baseOccupancy || 1),
      extraGuestFee: String(property.extraGuestFee || 0),
      numberOfExtraGuests: String(numberOfExtraGuests),
      guestFirstName: guestFirstName || '',
      guestLastName: guestLastName || '',
      pendingBookingId: pendingBookingId || '',
      type: 'booking_full', // Explicitly set payment type for the webhook
    };

    // Add coupon info to metadata if applicable
    if (appliedCouponCode && discountPercentage !== undefined) {
      metadata.appliedCouponCode = appliedCouponCode;
      metadata.discountPercentage = String(discountPercentage);
    }

    // Set up URLs for success and cancel pages
    const success_url = `${origin}/booking/success?session_id={CHECKOUT_SESSION_ID}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`;
    const cancel_url = `${origin}/booking/cancel?property_slug=${property.slug}${pendingBookingId ? `&booking_id=${pendingBookingId}` : ''}`;

    // Check if Stripe is configured
    if (!stripe) {
      console.error('[createCheckoutSession] Stripe not initialized');
      return {
        error: "Payment system is currently unavailable. Please try again later.",
        errorType: "service_unavailable",
        retry: true
      };
    }

    // Set up a timeout to detect hanging operations
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Stripe connection timed out. Please try again."));
      }, 15000); // 15 second timeout
    });

    // Create Stripe session with timeout protection
    const session = await Promise.race([
      stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              product_data: {
                name: `${property.name} (${numberOfNights} nights, ${numberOfGuests} guests)${appliedCouponCode ? ` - Coupon: ${appliedCouponCode}` : ''}`,
                description: `Booking from ${new Date(checkInDate).toLocaleDateString()} to ${new Date(checkOutDate).toLocaleDateString()}. Ref: ${pendingBookingId || 'N/A'}`,
                // Only include images if we have valid URLs
                ...(property.images && property.images.length > 0 && property.images.some(img => !!img.url)
                    ? { images: [property.images.find(img => img.isFeatured)?.url || property.images.find(img => !!img.url)?.url].filter(Boolean) }
                    : {}),
              },
              unit_amount: Math.round(totalPrice * 100), // Amount in smallest currency unit (cents, bani, etc.)
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: success_url,
        cancel_url: cancel_url,
        customer_email: guestEmail,
        phone_number_collection: { enabled: true },
        metadata: metadata,
        // Add expires_at for better UX - session expires after 30 minutes
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      }),
      timeoutPromise
    ]);

    // Verify session was created successfully
    if (!session.id || !session.url) {
      throw new Error('Failed to create Stripe session or missing session URL.');
    }

    // Log success
    if (pendingBookingId && session.payment_intent) {
      console.log(`[createCheckoutSession] Stripe session ${session.id} created, linked to pending booking ${pendingBookingId} via metadata. Payment Intent: ${session.payment_intent}`);
    }

    // Return successful result
    return {
      sessionId: session.id,
      sessionUrl: session.url,
      paymentProvider: 'stripe'
    };
  } catch (error) {
    // Import error utilities for better error handling
    const { logError, getErrorMessage, isNetworkError } = await import('@/lib/error-utils');

    // Log the error
    logError('createCheckoutSession', error, {
      propertyId: input.property?.slug,
      guestEmail: input.guestEmail,
      pendingBookingId: input.pendingBookingId
    });

    const errorMessage = getErrorMessage(error);
    const isNetwork = isNetworkError(error);

    console.error('[createCheckoutSession] Error:', errorMessage);

    // Handle specific error types
    if (errorMessage.includes('timed out')) {
      return {
        error: "Connection to payment provider timed out. Please try again.",
        errorType: "network_error",
        retry: true
      };
    }

    if (isNetwork) {
      return {
        error: "Network error connecting to payment provider. Please check your connection and try again.",
        errorType: "network_error",
        retry: true
      };
    }

    // Handle Stripe-specific errors
    if (errorMessage.includes('Stripe')) {
      if (errorMessage.includes('card') || errorMessage.includes('payment_method')) {
        return {
          error: "There was an issue with the payment information. Please check your details and try again.",
          errorType: "payment_error",
          retry: true
        };
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('rate_limit')) {
        return {
          error: "Too many payment requests. Please wait a moment and try again.",
          errorType: "rate_limit_error",
          retry: true
        };
      }
    }

    // Generic error message
    return {
      error: "We couldn't process your payment request. Please try again or contact support.",
      errorType: "unknown_error",
      retry: true
    };
  }
}