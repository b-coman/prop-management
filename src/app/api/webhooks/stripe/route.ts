// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking, CurrencyCode } from '@/types';
import { SUPPORTED_CURRENCIES } from '@/types';
import { loggers } from '@/lib/logger';

const logger = loggers.stripe;

// Lazily initialize Stripe to avoid startup issues
let stripe: Stripe | null = null;

function getStripe(): Stripe | null {
  if (stripe) return stripe;

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    logger.warn('STRIPE_SECRET_KEY is not set - Stripe functionality will be limited');
    return null;
  }

  stripe = new Stripe(stripeSecretKey);
  return stripe;
}

export async function POST(req: NextRequest) {
  logger.info('Webhook received');

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey) {
    logger.error('STRIPE_SECRET_KEY missing');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  
  const stripeInstance = getStripe();
  if (!stripeInstance) {
    return NextResponse.json({ error: 'Stripe initialization failed' }, { status: 500 });
  }
  
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  let event: Stripe.Event;
  let body: string;

  try {
    body = await req.text();
    logger.debug('Received raw body', { bodyStart: body.substring(0, 200) });

    if (!stripeWebhookSecret && process.env.NODE_ENV !== 'production') {
        logger.warn('Skipping signature verification (DEV mode & secret missing)');
        event = JSON.parse(body) as Stripe.Event;
    } else if (!stripeWebhookSecret) {
        logger.error('STRIPE_WEBHOOK_SECRET missing in production');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    } else if (!signature) {
        logger.error('Missing stripe-signature header');
        return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
    } else {
        event = stripeInstance.webhooks.constructEvent(body, signature, stripeWebhookSecret);
        logger.info('Signature verified', { eventId: event.id });
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Error constructing/verifying event', err as Error);
    return NextResponse.json({ error: `Webhook signature verification failed: ${errorMessage}` }, { status: 400 });
  }

  logger.info('Processing event', { eventType: event.type, eventId: event.id });

  // --- Handle Checkout Session Completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    logger.info('Handling checkout.session.completed', { sessionId });

    if (session.payment_status !== 'paid') {
        logger.warn('Session payment not completed', { sessionId, paymentStatus: session.payment_status });
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

     if (!paymentIntentId) {
       logger.error('Missing payment_intent ID in session', undefined, { sessionId });
       return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 });
     }

    const metadata = session.metadata;
    if (!metadata) {
      logger.error('Missing metadata in session', undefined, { sessionId });
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }
    logger.debug('Session metadata received', { sessionId, metadata });

    // --- Determine payment type from metadata ---
    const paymentType = metadata.type; // e.g., 'booking_full', 'booking_hold'
    const propertyId = metadata.propertyId; // Slug
    const bookingId = metadata.pendingBookingId || metadata.holdBookingId; // Use appropriate ID from metadata
    const paymentCurrency = (metadata.priceCurrency || metadata.holdCurrency) as CurrencyCode | undefined; // Currency from metadata

    if (!bookingId) {
        logger.error('Missing booking ID in metadata', undefined, { sessionId });
        return NextResponse.json({ error: "Missing booking reference" }, { status: 400 });
    }
    if (!propertyId) {
         logger.error('Missing propertyId in metadata', undefined, { sessionId });
         return NextResponse.json({ error: "Missing property reference" }, { status: 400 });
    }
     if (!paymentCurrency || !SUPPORTED_CURRENCIES.includes(paymentCurrency)) {
         logger.error('Missing or invalid currency in metadata', undefined, { sessionId, paymentCurrency });
         return NextResponse.json({ error: "Missing or invalid currency in metadata" }, { status: 400 });
     }
     if (!paymentType || (paymentType !== 'booking_full' && paymentType !== 'booking_hold')) {
          logger.error('Missing or invalid payment type in metadata', undefined, { sessionId, paymentType });
          return NextResponse.json({ error: "Missing or invalid payment type in metadata" }, { status: 400 });
     }

    logger.info('Processing payment', { paymentType, bookingId, propertyId, paymentCurrency });

    const paymentInfo: Booking['paymentInfo'] = {
        stripePaymentIntentId: paymentIntentId,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        status: 'succeeded', // Use 'succeeded' as payment_status was 'paid'
        paidAt: session.created ? new Date(session.created * 1000) : new Date(),
    };
    logger.debug('Prepared paymentInfo', { bookingId, paymentInfo });

    try {
      const isHold = paymentType === 'booking_hold';
      logger.info('Updating booking payment info', { bookingId, isHold });

      // Update booking status in the database
      await updateBookingPaymentInfo(bookingId, paymentInfo, propertyId, paymentCurrency, isHold);
      logger.info('Booking successfully updated', { bookingId, sessionId, paymentType });

      // Send booking confirmation email
      try {
        // Dynamically import the email service to avoid loading it unnecessarily
        const { sendBookingConfirmationEmail, sendHoldConfirmationEmail } = await import('@/services/emailService');

        // Send the appropriate confirmation email based on payment type
        let emailResult;
        if (isHold) {
          logger.info('Sending hold confirmation email', { bookingId });
          emailResult = await sendHoldConfirmationEmail(bookingId);
        } else {
          logger.info('Sending booking confirmation email', { bookingId });
          emailResult = await sendBookingConfirmationEmail(bookingId);
        }

        if (emailResult.success) {
          logger.info('Confirmation email sent', { bookingId, isHold, previewUrl: emailResult.previewUrl });
        } else {
          logger.warn('Failed to send confirmation email', { bookingId, isHold, error: emailResult.error });
          // Don't fail the webhook if just the email fails
        }

        // TODO: Send notification to property owner/admin
        // This could be implemented similarly, using the owner's email from the property details

        // Housekeeping WhatsApp notification (non-blocking)
        if (!isHold && propertyId) {
          try {
            const { sendChangeNotification } = await import('@/services/housekeepingService');
            await sendChangeNotification(propertyId, bookingId, 'new');
          } catch (hkErr) {
            logger.warn('Housekeeping notification failed (non-blocking)', { bookingId });
          }
        }
      } catch (emailError) {
        logger.error('Error sending confirmation email', emailError as Error, { bookingId });
        // Don't fail the webhook if just the email fails
      }
    } catch (error) {
      logger.error('Error updating booking', error as Error, { sessionId, bookingId });
      // Return 500 to signal Stripe to retry? Or 400 if it's a data issue? For now, 500.
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
    }
  }
  // --- Handle Checkout Session Expired (user abandoned or session timed out) ---
  else if (event.type === 'checkout.session.expired') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    logger.info('Handling checkout.session.expired', { sessionId });

    const metadata = session.metadata;
    const bookingId = metadata?.pendingBookingId || metadata?.holdBookingId;

    if (!bookingId) {
      logger.warn('No booking ID in expired session metadata', { sessionId });
      return NextResponse.json({ received: true });
    }

    try {
      const { getBookingById } = await import('@/services/bookingService');
      const booking = await getBookingById(bookingId);

      if (!booking) {
        logger.warn('Booking not found for expired session', { bookingId, sessionId });
        return NextResponse.json({ received: true });
      }

      // Only mark as failed if still pending — don't overwrite a successful payment
      if (booking.status === 'pending') {
        const { updateBookingStatus } = await import('@/services/bookingService');
        await updateBookingStatus(bookingId, 'payment_failed');
        logger.info('Booking marked as payment_failed due to expired session', { bookingId, sessionId });
      } else {
        logger.info('Booking already processed, skipping expired session', { bookingId, currentStatus: booking.status, sessionId });
      }
    } catch (error) {
      logger.error('Error handling expired session', error as Error, { bookingId, sessionId });
      return NextResponse.json({ error: 'Failed to handle expired session' }, { status: 500 });
    }
  }
  // --- Handle Payment Intent Failed (card declined during checkout — user can still retry) ---
  else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const lastError = paymentIntent.last_payment_error;
    logger.warn('Payment attempt failed', {
      paymentIntentId: paymentIntent.id,
      declineCode: lastError?.decline_code || 'unknown',
      errorType: lastError?.type || 'unknown',
      errorMessage: lastError?.message || 'No details',
    });
    // NOTE: Do NOT mark booking as failed here. With Checkout Sessions, the user
    // stays on the payment page and can retry with a different card.
    // The booking will be marked as payment_failed when checkout.session.expired fires.
  }
  else if (event.type === 'payment_intent.succeeded') {
    logger.info('Handling payment_intent.succeeded', { paymentIntentId: (event.data.object as Stripe.PaymentIntent).id });
    // Primary confirmation handled by checkout.session.completed above
  }
  else {
    logger.debug('Received unhandled event type', { eventType: event.type });
  }

  logger.info('Webhook processing complete', { eventId: event.id });
  return NextResponse.json({ received: true }, { status: 200 });
}

// Add GET handler for health checks (in case Cloud Run hits this endpoint)
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Stripe webhook endpoint is ready',
    configured: !!process.env.STRIPE_SECRET_KEY 
  });
}