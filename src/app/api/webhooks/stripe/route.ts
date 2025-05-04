// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createBooking, type CreateBookingData } from '@/services/bookingService'; // Import your Firestore booking service and type
import type { Booking } from '@/types'; // Import Booking type

// Ensure Stripe secret key and webhook secret are set
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('--- [Webhook /api/webhooks/stripe] Received POST request ---');

if (!stripeSecretKey) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY is not set in environment variables.');
  // In a real app, you might want to prevent startup or return an error immediately
}
if (!stripeWebhookSecret) {
  console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set. Webhook verification will be skipped (UNSAFE for production).");
}

const stripe = new Stripe(stripeSecretKey || ''); // Initialize even if key is missing to avoid early crash

export async function POST(req: NextRequest) {
  // --- DETAILED LOGGING START ---
  console.log('--- [Webhook /api/webhooks/stripe] Received POST request ---');
  const headersList = headers();
  const signature = headersList.get('stripe-signature');
  console.log('[Webhook] Stripe Signature Header:', signature ? 'Present' : 'Missing');
  // --- DETAILED LOGGING END ---

  if (!stripeSecretKey) {
      console.error('❌ [Webhook Error] STRIPE_SECRET_KEY is missing. Cannot process webhook.');
      return NextResponse.json({ error: 'Stripe not configured on server' }, { status: 500 });
  }

  let event: Stripe.Event;
  let body: string; // Declare body outside try block

  try {
    body = await req.text(); // Read body first
    console.log('[Webhook] Received raw body (first 100 chars):', body.substring(0, 100));

    // --- DETAILED LOGGING START ---
    console.log('[Webhook] Attempting event construction...');
    // --- DETAILED LOGGING END ---

    // Skip verification only if secret is missing AND in development
    if (!stripeWebhookSecret && process.env.NODE_ENV === 'development') {
        console.warn("⚠️ [Webhook] Skipping signature verification (DEV mode & STRIPE_WEBHOOK_SECRET not set).");
        event = JSON.parse(body) as Stripe.Event;
        console.log('[Webhook] Parsed event body directly (DEV mode). Event ID:', event.id);
    } else if (!stripeWebhookSecret) {
        console.error('❌ [Webhook Error] STRIPE_WEBHOOK_SECRET is missing in production. Cannot verify webhook.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
     else {
        console.log('[Webhook] Attempting signature verification with secret...');
        event = stripe.webhooks.constructEvent(
          body,
          signature as string, // Cast signature, already checked for presence conceptually
          stripeWebhookSecret
        );
        console.log(`✅ [Webhook] Signature verified successfully for event ID: ${event.id}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [Webhook Error] Error constructing/verifying webhook event: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook signature verification failed: ${errorMessage}` }, { status: 400 });
  }

  console.log(`[Webhook] Processing event type: ${event.type}, ID: ${event.id}`);

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    console.log(`✅ [Webhook] Handling checkout.session.completed event: ${sessionId}`);

    // --- DETAILED LOGGING START ---
    console.log(`[Webhook] Session ${sessionId} details:`, {
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        customer_email: session.customer_details?.email,
        metadata_keys: Object.keys(session.metadata || {}),
    });
    // --- DETAILED LOGGING END ---


    // --- Validate session data ---
    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ [Webhook] Session ${sessionId} payment status is ${session.payment_status}. No booking created.`);
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }
    console.log(`[Webhook] Session ${sessionId} payment status: ${session.payment_status}`);

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

     if (!paymentIntentId) {
       console.error(`❌ [Webhook Error] Missing payment_intent ID in session ${sessionId}`);
       return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 });
     }
     console.log(`[Webhook] Session ${sessionId} Payment Intent ID: ${paymentIntentId}`);

    const metadata = session.metadata;
    if (!metadata) {
      console.error(`❌ [Webhook Error] Missing metadata in session ${sessionId}`);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }
     console.log(`[Webhook Metadata ${sessionId}] Received:`, JSON.stringify(metadata, null, 2));

     // --- Safely parse metadata ---
     const propertyId = metadata.propertyId;
     const checkInDate = metadata.checkInDate; // ISO string
     const checkOutDate = metadata.checkOutDate; // ISO string
     const numberOfGuests = parseInt(metadata.numberOfGuests || '1', 10);
     const numberOfNights = parseInt(metadata.numberOfNights || '0', 10);
     const pricePerNight = parseFloat(metadata.pricePerNight || '0');
     const cleaningFee = parseFloat(metadata.cleaningFee || '0');
     const baseOccupancy = parseInt(metadata.baseOccupancy || '1', 10);
     const extraGuestFee = parseFloat(metadata.extraGuestFee || '0');
     const numberOfExtraGuests = parseInt(metadata.numberOfExtraGuests || '0', 10);
     // Use amount_total from session if available, fallback to metadata (converting cents to dollars)
     const finalTotal = session.amount_total ? session.amount_total / 100 : parseFloat(metadata.totalPrice || '0');
     const guestFirstName = metadata.guestFirstName || 'Guest';
     const guestLastName = metadata.guestLastName || '';
     const guestEmail = session.customer_details?.email;
     const appliedCouponCode = metadata.appliedCouponCode;
     const discountPercentage = metadata.discountPercentage ? parseFloat(metadata.discountPercentage) : undefined;

     console.log(`[Webhook Parsed Metadata ${sessionId}] propertyId=${propertyId}, checkIn=${checkInDate}, checkOut=${checkOutDate}, guests=${numberOfGuests}, nights=${numberOfNights}, total=${finalTotal}, email=${guestEmail}`);

     // --- Validate required metadata ---
     if (!propertyId || !checkInDate || !checkOutDate || isNaN(numberOfGuests) || numberOfGuests <= 0 || isNaN(numberOfNights) || numberOfNights <= 0 || isNaN(pricePerNight) || isNaN(cleaningFee) || isNaN(finalTotal) || !guestEmail || isNaN(baseOccupancy) || isNaN(extraGuestFee) || isNaN(numberOfExtraGuests)) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Invalid or missing metadata fields. Raw Metadata:`, metadata);
        console.error(`[Validation Check] propId: ${propertyId}, checkIn: ${checkInDate}, checkOut: ${checkOutDate}, guests: ${numberOfGuests}, nights: ${numberOfNights}, price: ${pricePerNight}, cleaning: ${cleaningFee}, total: ${finalTotal}, email: ${guestEmail}, baseOcc: ${baseOccupancy}, extraFee: ${extraGuestFee}, extraGuests: ${numberOfExtraGuests}`);
        return NextResponse.json({ error: 'Invalid or missing metadata fields' }, { status: 400 });
     }
     if (new Date(checkOutDate) <= new Date(checkInDate)) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Check-out date must be after check-in date.`);
         return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
     }
     console.log(`[Webhook] Metadata validation passed for session ${sessionId}`);


     // --- Calculate pricing details ---
     // Recalculate to ensure consistency, especially if discount was applied
     const calculatedAccommodationTotal = (pricePerNight * numberOfNights) + (extraGuestFee * numberOfExtraGuests * numberOfNights);
     const calculatedSubtotal = calculatedAccommodationTotal + cleaningFee;
     const calculatedDiscountAmount = discountPercentage ? calculatedSubtotal * (discountPercentage / 100) : 0;
     // Taxes can be tricky, best to derive from the final total Stripe charged vs calculated pre-tax total
     const calculatedTotalBeforeTax = calculatedSubtotal - calculatedDiscountAmount;
     const taxes = Math.max(0, finalTotal - calculatedTotalBeforeTax); // Ensure taxes aren't negative due to rounding
     console.log(`[Webhook Pricing Calc ${sessionId}] Accommodation: ${calculatedAccommodationTotal}, Subtotal: ${calculatedSubtotal}, Discount: ${calculatedDiscountAmount}, Taxes: ${taxes}, FinalTotal (from Stripe): ${finalTotal}`);


    // --- Prepare booking data ---
    const bookingDataForDb: CreateBookingData = {
      propertyId: propertyId,
      guestInfo: {
        firstName: guestFirstName,
        lastName: guestLastName,
        email: guestEmail,
        userId: metadata.userId || undefined,
        phone: session.customer_details?.phone || undefined, // Try to get phone from Stripe customer details
      },
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: numberOfGuests,
      pricing: { // Use calculated values for consistency
        baseRate: pricePerNight,
        numberOfNights: numberOfNights,
        cleaningFee: cleaningFee,
        extraGuestFee: extraGuestFee,
        numberOfExtraGuests: numberOfExtraGuests,
        accommodationTotal: calculatedAccommodationTotal,
        subtotal: calculatedSubtotal,
        taxes: taxes,
        discountAmount: calculatedDiscountAmount,
        total: finalTotal, // Use the actual amount charged by Stripe
      },
      appliedCouponCode: appliedCouponCode,
      status: 'confirmed' as Booking['status'],
      paymentInput: {
        stripePaymentIntentId: paymentIntentId,
        amount: finalTotal,
        status: session.payment_status, // Use actual status from Stripe
      },
      source: metadata.source || 'website-stripe', // Indicate source
      notes: metadata.notes || undefined,
      externalId: metadata.externalId || undefined,
    };

    console.log(`[Webhook Data - Session ${sessionId}] Prepared for createBooking:`, JSON.stringify(bookingDataForDb, null, 2));

    // --- Create booking in Firestore ---
    try {
      console.log(`[Webhook] Calling createBooking for session ${sessionId}...`);
      const bookingId = await createBooking(bookingDataForDb); // Pass the prepared data
      console.log(`✅✅ [Webhook] Booking ${bookingId} created successfully for session ${sessionId} (Payment Intent: ${paymentIntentId})`);

      // TODO: Add post-booking actions like sending confirmation emails here

    } catch (error) {
      console.error(`❌❌ [Webhook Error - Session ${sessionId}] Error calling createBooking:`, error instanceof Error ? error.message : String(error));
      // Optionally: Add more specific error handling or retry logic here
      // Respond with 500 to let Stripe know it failed and potentially retry
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
    }
  } else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  console.log(`--- [Webhook] Finished processing event ID: ${event.id}. Responding 200 OK ---`);
  return NextResponse.json({ received: true });
}