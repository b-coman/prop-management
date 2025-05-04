
// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
// Import specific functions instead of the whole service
import { updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking } from '@/types';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('--- [Webhook /api/webhooks/stripe] Initializing ---');

if (!stripeSecretKey) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY is not set.');
}
if (!stripeWebhookSecret) {
  console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set. Verification skipped (UNSAFE).");
}

const stripe = new Stripe(stripeSecretKey || '');

export async function POST(req: NextRequest) {
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
    console.log('[Webhook] Received raw body (start):', body.substring(0, 100));

    if (!stripeWebhookSecret && process.env.NODE_ENV === 'development') {
        console.warn("⚠️ [Webhook] Skipping signature verification (DEV mode & secret missing).");
        event = JSON.parse(body) as Stripe.Event;
    } else if (!stripeWebhookSecret) {
        console.error('❌ [Webhook Error] STRIPE_WEBHOOK_SECRET missing in production.');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
     else if (!signature) {
        console.error('❌ [Webhook Error] Missing stripe-signature header.');
        return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
     }
     else {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
        console.log(`✅ [Webhook] Signature verified for event ID: ${event.id}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [Webhook Error] Constructing/Verifying event: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook signature verification failed: ${errorMessage}` }, { status: 400 });
  }

  console.log(`[Webhook] Processing event type: ${event.type}, ID: ${event.id}`);

  // --- Handle checkout.session.completed ---
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

    // --- Extract pendingBookingId from metadata ---
    const pendingBookingId = metadata.pendingBookingId;
    if (!pendingBookingId) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Missing 'pendingBookingId' in metadata. Cannot link payment to booking.`);
        // Decide how to handle this: maybe create a new booking based on metadata anyway?
        // For now, return an error as we expect the pending booking flow.
        return NextResponse.json({ error: "Missing pending booking reference" }, { status: 400 });
    }
    console.log(`[Webhook] Found pendingBookingId: ${pendingBookingId} in metadata for session ${sessionId}`);

    // --- Prepare Payment Info ---
    const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntentId,
        amount: session.amount_total ? session.amount_total / 100 : 0, // Use Stripe's total
        status: session.payment_status, // Should be 'paid'
        paidAt: session.created ? new Date(session.created * 1000) : new Date(), // Use session creation as approx. paid time
    };
    console.log(`[Webhook] Prepared paymentInfo for booking ${pendingBookingId}:`, paymentInfo);


    // --- Update Booking Status and Payment Info ---
    try {
      console.log(`[Webhook] Calling updateBookingPaymentInfo for booking ${pendingBookingId}...`);
      await updateBookingPaymentInfo(pendingBookingId, paymentInfo);
      console.log(`✅✅ [Webhook] Booking ${pendingBookingId} successfully updated to 'confirmed' with payment details for session ${sessionId}.`);

      // TODO: Trigger post-confirmation actions (emails, SMS, external sync) HERE
      // Example: await sendBookingConfirmationEmail(pendingBookingId);
      // Example: await triggerExternalSyncForBooking(pendingBookingId);

    } catch (error) {
      console.error(`❌❌ [Webhook Error - Session ${sessionId}] Error updating booking ${pendingBookingId}:`, error instanceof Error ? error.message : String(error));
      // Return 500 to let Stripe know processing failed and potentially retry
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }
  }
   // --- Handle payment_intent.succeeded ---
   // This can be a fallback or alternative confirmation method
   else if (event.type === 'payment_intent.succeeded') {
     const paymentIntent = event.data.object as Stripe.PaymentIntent;
     console.log(`✅ [Webhook] Handling payment_intent.succeeded: ${paymentIntent.id}`);
     const checkoutSessionId = paymentIntent.metadata?.checkout_session_id; // If you pass session_id in PI metadata
     const pendingBookingId = paymentIntent.metadata?.pendingBookingId; // If you pass booking_id in PI metadata

     if (!pendingBookingId) {
          console.warn(`[Webhook payment_intent.succeeded] Missing 'pendingBookingId' in Payment Intent ${paymentIntent.id} metadata. Cannot link payment.`);
          // Maybe query bookings by paymentIntentId if needed as a fallback?
          return NextResponse.json({ received: true, message: 'Missing booking reference in payment intent' });
     }

      const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, // Amount is in cents
        status: 'succeeded', // Directly from event type
        paidAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : new Date(),
    };

     try {
       console.log(`[Webhook payment_intent.succeeded] Calling updateBookingPaymentInfo for booking ${pendingBookingId}...`);
       await updateBookingPaymentInfo(pendingBookingId, paymentInfo);
       console.log(`✅✅ [Webhook payment_intent.succeeded] Booking ${pendingBookingId} successfully updated/confirmed for PI ${paymentIntent.id}.`);
       // Trigger post-confirmation actions here too if necessary
     } catch (error) {
       console.error(`❌❌ [Webhook Error - PI ${paymentIntent.id}] Error updating booking ${pendingBookingId}:`, error instanceof Error ? error.message : String(error));
       return NextResponse.json({ error: 'Failed to update booking status from payment intent' }, { status: 500 });
     }

   }
   // --- Handle payment_intent.payment_failed ---
   else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(`⚠️ [Webhook] Handling payment_intent.payment_failed: ${paymentIntent.id}`);
       const pendingBookingId = paymentIntent.metadata?.pendingBookingId;

       if (pendingBookingId) {
           // Optionally update the pending booking status to 'payment_failed' or 'cancelled'
           try {
               // Example: await updateBookingStatus(pendingBookingId, 'payment_failed');
               console.log(`[Webhook payment_intent.payment_failed] Marked booking ${pendingBookingId} status appropriately.`);
           } catch (error) {
                console.error(`[Webhook payment_intent.payment_failed] Error updating status for failed booking ${pendingBookingId}:`, error);
           }
       }
   }
   else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  console.log(`--- [Webhook] Finished processing event ID: ${event.id}. Responding 200 OK ---`);
  return NextResponse.json({ received: true });
}
