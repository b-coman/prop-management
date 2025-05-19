// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking, CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Only log when the function is actually called, not at module level
if (!stripeSecretKey) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY is not set.');
}
// Allow skipping verification in dev if secret is missing, but log warning
if (!stripeWebhookSecret && process.env.NODE_ENV === 'production') {
  console.error("❌ FATAL: STRIPE_WEBHOOK_SECRET is not set in production. Verification required.");
} else if (!stripeWebhookSecret && process.env.NODE_ENV !== 'production') {
    console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set. Skipping verification (UNSAFE in prod).");
}


const stripe = new Stripe(stripeSecretKey || '');

export async function POST(req: NextRequest) {
  console.log('--- [Webhook /api/webhooks/stripe] Initializing ---');
  console.log('--- [Webhook /api/webhooks/stripe] Received POST request ---');
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!stripeSecretKey) {
      console.error('❌ [Webhook Error] STRIPE_SECRET_KEY missing.');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  let body: string;

  try {
    body = await req.text();
    console.log('[Webhook] Received raw body (start):', body.substring(0, 200));

    if (!stripeWebhookSecret && process.env.NODE_ENV !== 'production') {
        console.warn("⚠️ [Webhook] Skipping signature verification (DEV mode & secret missing).");
        event = JSON.parse(body) as Stripe.Event;
    } else if (!stripeWebhookSecret) {
        console.error('❌ [Webhook Error] STRIPE_WEBHOOK_SECRET missing in production.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    } else if (!signature) {
        console.error('❌ [Webhook Error] Missing stripe-signature header.');
        return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
    } else {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
        console.log(`✅ [Webhook] Signature verified for event ID: ${event.id}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [Webhook Error] Constructing/Verifying event: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook signature verification failed: ${errorMessage}` }, { status: 400 });
  }

  console.log(`[Webhook] Processing event type: ${event.type}, ID: ${event.id}`);

  // --- Handle Checkout Session Completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    console.log(`✅ [Webhook] Handling checkout.session.completed: ${sessionId}`);

    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ [Webhook] Session ${sessionId} payment status: ${session.payment_status}. No booking update.`);
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

     if (!paymentIntentId) {
       console.error(`❌ [Webhook Error] Missing payment_intent ID in session ${sessionId}`);
       return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 });
     }

    const metadata = session.metadata;
    if (!metadata) {
      console.error(`❌ [Webhook Error] Missing metadata in session ${sessionId}`);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }
    console.log(`[Webhook Metadata ${sessionId}] Received:`, JSON.stringify(metadata, null, 2));

    // --- Determine payment type from metadata ---
    const paymentType = metadata.type; // e.g., 'booking_full', 'booking_hold'
    const propertyId = metadata.propertyId; // Slug
    const bookingId = metadata.pendingBookingId || metadata.holdBookingId; // Use appropriate ID from metadata
    const paymentCurrency = (metadata.priceCurrency || metadata.holdCurrency) as CurrencyCode | undefined; // Currency from metadata

    if (!bookingId) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Missing 'pendingBookingId' or 'holdBookingId' in metadata.`);
        return NextResponse.json({ error: "Missing booking reference" }, { status: 400 });
    }
    if (!propertyId) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Missing 'propertyId' (slug) in metadata.`);
         return NextResponse.json({ error: "Missing property reference" }, { status: 400 });
    }
     if (!paymentCurrency || !SUPPORTED_CURRENCIES.includes(paymentCurrency)) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Missing or invalid currency ('priceCurrency' or 'holdCurrency') in metadata. Got: ${paymentCurrency}`);
         return NextResponse.json({ error: "Missing or invalid currency in metadata" }, { status: 400 });
     }
     if (!paymentType || (paymentType !== 'booking_full' && paymentType !== 'booking_hold')) {
          console.error(`❌ [Webhook Error - Session ${sessionId}] Missing or invalid 'type' in metadata. Expected 'booking_full' or 'booking_hold'. Got: ${paymentType}`);
          return NextResponse.json({ error: "Missing or invalid payment type in metadata" }, { status: 400 });
     }

    console.log(`[Webhook] Processing ${paymentType} for Booking ID: ${bookingId}, Property: ${propertyId}, Currency: ${paymentCurrency}`);

    const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntentId,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        status: 'succeeded', // Use 'succeeded' as payment_status was 'paid'
        paidAt: session.created ? new Date(session.created * 1000) : new Date(),
    };
    console.log(`[Webhook] Prepared paymentInfo for booking ${bookingId}:`, paymentInfo);

    try {
      const isHold = paymentType === 'booking_hold';
      console.log(`[Webhook] Calling updateBookingPaymentInfo for booking ${bookingId} (isHold: ${isHold})...`);

      // Update booking status in the database
      await updateBookingPaymentInfo(bookingId, paymentInfo, propertyId, paymentCurrency, isHold);
      console.log(`✅✅ [Webhook] Booking ${bookingId} successfully updated for session ${sessionId} (type: ${paymentType}).`);

      // Send booking confirmation email
      try {
        // Dynamically import the email service to avoid loading it unnecessarily
        const { sendBookingConfirmationEmail, sendHoldConfirmationEmail } = await import('@/services/emailService');

        // Send the appropriate confirmation email based on payment type
        let emailResult;
        if (isHold) {
          console.log(`[Webhook] Sending hold-specific email for booking ${bookingId}`);
          emailResult = await sendHoldConfirmationEmail(bookingId);
        } else {
          console.log(`[Webhook] Sending standard booking confirmation for booking ${bookingId}`);
          emailResult = await sendBookingConfirmationEmail(bookingId);
        }

        if (emailResult.success) {
          console.log(`✅ [Webhook] ${isHold ? 'Hold' : 'Booking'} confirmation email sent for booking ${bookingId}${emailResult.previewUrl ? ` (Preview: ${emailResult.previewUrl})` : ''}`);
        } else {
          console.warn(`⚠️ [Webhook] Failed to send ${isHold ? 'hold' : 'booking'} confirmation email for booking ${bookingId}: ${emailResult.error}`);
          // Don't fail the webhook if just the email fails
        }

        // TODO: Send notification to property owner/admin
        // This could be implemented similarly, using the owner's email from the property details
      } catch (emailError) {
        console.error(`❌ [Webhook] Error sending confirmation email for booking ${bookingId}:`, emailError instanceof Error ? emailError.message : String(emailError));
        // Don't fail the webhook if just the email fails
      }
    } catch (error) {
      console.error(`❌❌ [Webhook Error - Session ${sessionId}] Error updating booking ${bookingId}:`, error instanceof Error ? error.message : String(error));
      // Return 500 to signal Stripe to retry? Or 400 if it's a data issue? For now, 500.
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }
  }
  // --- Handle Payment Intent Events (Optional but recommended for robustness) ---
  // (Keep existing payment_intent.succeeded and payment_intent.payment_failed handlers if needed)
  // Ensure they also check metadata.type if you implement them.
  else if (event.type === 'payment_intent.succeeded') {
      // ... similar logic using paymentIntent.metadata ...
      console.log(`[Webhook] Handling payment_intent.succeeded: ${ (event.data.object as Stripe.PaymentIntent).id}`);
  }
  else if (event.type === 'payment_intent.payment_failed') {
      // ... logic to handle failed payments ...
       console.warn(`⚠️ [Webhook] Handling payment_intent.payment_failed: ${(event.data.object as Stripe.PaymentIntent).id}`);
  }
  else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  console.log(`--- [Webhook] Finished processing event ID: ${event.id}. Responding 200 OK ---`);
  return NextResponse.json({ received: true }, { status: 200 });
}
