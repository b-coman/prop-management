
// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking, CurrencyCode } from '@/types'; // Added CurrencyCode
import { SUPPORTED_CURRENCIES } from '@/types';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

console.log('--- [Webhook /api/webhooks/stripe] Initializing ---');

if (!stripeSecretKey) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY is not set.');
}
if (!stripeWebhookSecret && process.env.NODE_ENV !== 'development') {
  console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set. Verification skipped (UNSAFE in prod).");
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
    console.log('[Webhook] Received raw body (start):', body.substring(0, 200));

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

    const pendingBookingId = metadata.pendingBookingId;
    const propertyId = metadata.propertyId; 
    const priceCurrency = metadata.priceCurrency as CurrencyCode | undefined; // Currency from metadata

    if (!pendingBookingId) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Missing 'pendingBookingId' in metadata. Cannot link payment to booking.`);
        return NextResponse.json({ error: "Missing pending booking reference" }, { status: 400 });
    }
    if (!propertyId) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Missing 'propertyId' (slug) in metadata.`);
         return NextResponse.json({ error: "Missing property reference in metadata" }, { status: 400 });
    }
     if (!priceCurrency || !SUPPORTED_CURRENCIES.includes(priceCurrency)) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Missing or invalid 'priceCurrency' in metadata. Got: ${priceCurrency}`);
         return NextResponse.json({ error: "Missing or invalid currency in metadata" }, { status: 400 });
     }

    console.log(`[Webhook] Found pendingBookingId: ${pendingBookingId}, propertyId (slug): ${propertyId}, currency: ${priceCurrency} in metadata for session ${sessionId}`);

    const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntentId,
        amount: session.amount_total ? session.amount_total / 100 : 0, 
        status: session.payment_status, 
        paidAt: session.created ? new Date(session.created * 1000) : new Date(), 
        // Note: The currency of the payment (session.currency) might differ from priceCurrency if Stripe does conversion.
        // We are primarily concerned with recording the amount *paid* in the currency *charged*.
        // The booking.pricing.currency field holds the property's base currency.
    };
    console.log(`[Webhook] Prepared paymentInfo for booking ${pendingBookingId}:`, paymentInfo);

    try {
      console.log(`[Webhook] Calling updateBookingPaymentInfo for booking ${pendingBookingId}...`);
      await updateBookingPaymentInfo(pendingBookingId, paymentInfo, propertyId, priceCurrency); // Pass priceCurrency
      console.log(`✅✅ [Webhook] Booking ${pendingBookingId} successfully updated to 'confirmed' with payment details for session ${sessionId}.`);
    } catch (error) {
      console.error(`❌❌ [Webhook Error - Session ${sessionId}] Error updating booking ${pendingBookingId}:`, error instanceof Error ? error.message : String(error));
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }
  }
   else if (event.type === 'payment_intent.succeeded') {
     const paymentIntent = event.data.object as Stripe.PaymentIntent;
     console.log(`✅ [Webhook] Handling payment_intent.succeeded: ${paymentIntent.id}`);
     const pendingBookingId = paymentIntent.metadata?.pendingBookingId; 
     const propertyId = paymentIntent.metadata?.propertyId;
     const priceCurrency = paymentIntent.metadata?.priceCurrency as CurrencyCode | undefined;

     if (!pendingBookingId) {
          console.warn(`[Webhook payment_intent.succeeded] Missing 'pendingBookingId' in Payment Intent ${paymentIntent.id} metadata. Cannot link payment.`);
          return NextResponse.json({ received: true, message: 'Missing booking reference in payment intent' });
     }
      if (!propertyId) {
         console.warn(`[Webhook payment_intent.succeeded] Missing 'propertyId' (slug) in Payment Intent ${paymentIntent.id} metadata.`);
         return NextResponse.json({ received: true, message: 'Missing property reference in payment intent' });
     }
      if (!priceCurrency || !SUPPORTED_CURRENCIES.includes(priceCurrency)) {
         console.error(`❌ [Webhook payment_intent.succeeded] Missing or invalid 'priceCurrency' in metadata for PI ${paymentIntent.id}. Got: ${priceCurrency}`);
         return NextResponse.json({ error: "Missing or invalid currency in PI metadata" }, { status: 400 });
      }

      const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100, 
        status: 'succeeded', 
        paidAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : new Date(),
    };

     try {
       console.log(`[Webhook payment_intent.succeeded] Calling updateBookingPaymentInfo for booking ${pendingBookingId}...`);
       await updateBookingPaymentInfo(pendingBookingId, paymentInfo, propertyId, priceCurrency); 
       console.log(`✅✅ [Webhook payment_intent.succeeded] Booking ${pendingBookingId} successfully updated/confirmed for PI ${paymentIntent.id}.`);
     } catch (error) {
       console.error(`❌❌ [Webhook Error - PI ${paymentIntent.id}] Error updating booking ${pendingBookingId}:`, error instanceof Error ? error.message : String(error));
       return NextResponse.json({ error: 'Failed to update booking status from payment intent' }, { status: 500 });
     }

   }
   else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.warn(`⚠️ [Webhook] Handling payment_intent.payment_failed: ${paymentIntent.id}`);
       const pendingBookingId = paymentIntent.metadata?.pendingBookingId;

       if (pendingBookingId) {
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