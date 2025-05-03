// src/app/api/webhooks/stripe/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { createBooking } from '@/services/bookingService'; // Import your Firestore booking service
import type { Booking } from '@/types'; // Import Booking type

// Ensure Stripe secret key and webhook secret are set
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}
if (!stripeWebhookSecret) {
  console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set. Webhook verification will fail in production.");
  // Allow local testing without secret, but log warning.
  // In production, this should throw an error or be handled securely.
  // throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    // Skip verification if secret is missing (for local testing only)
    if (!stripeWebhookSecret) {
        console.warn("⚠️ Skipping webhook signature verification (STRIPE_WEBHOOK_SECRET not set).");
        event = JSON.parse(body) as Stripe.Event; // Parse directly, UNSAFE for production
    } else {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          stripeWebhookSecret
        );
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ [Webhook Error] Error verifying webhook signature: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`✅ [Webhook] checkout.session.completed event received: ${session.id}`);
    console.log(`[Webhook Session] Payment Status: ${session.payment_status}, Amount Total: ${session.amount_total}`);

    // --- Validate session data ---
    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ [Webhook] Session ${session.id} payment status is ${session.payment_status}. No booking created.`);
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }

    // Ensure payment_intent is a string or retrieve it if needed
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id; // Handle expanded object case if necessary

     if (!paymentIntentId) {
       console.error(`❌ [Webhook Error] Missing payment_intent ID in session ${session.id}`);
       return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 });
     }
     console.log(`[Webhook Session] Payment Intent ID: ${paymentIntentId}`);


    const metadata = session.metadata;
    if (!metadata) {
      console.error(`❌ [Webhook Error] Missing metadata in session ${session.id}`);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }
     console.log('[Webhook Metadata] Received:', JSON.stringify(metadata, null, 2));

     // --- Safely parse metadata ---
     const propertyId = metadata.propertyId;
     const checkInDate = metadata.checkInDate; // ISO string
     const checkOutDate = metadata.checkOutDate; // ISO string
     const numberOfGuests = parseInt(metadata.numberOfGuests || '1', 10);
     const numberOfNights = parseInt(metadata.numberOfNights || '0', 10);
     const pricePerNight = parseFloat(metadata.pricePerNight || '0');
     const cleaningFee = parseFloat(metadata.cleaningFee || '0');
     const totalPrice = parseFloat(metadata.totalPrice || '0'); // Total price passed from frontend
     const guestFirstName = metadata.guestFirstName || 'Guest';
     const guestLastName = metadata.guestLastName || ''; // Default to empty string if not provided
     const guestEmail = session.customer_details?.email;

     // Validate required metadata
     if (!propertyId || !checkInDate || !checkOutDate || isNaN(numberOfGuests) || isNaN(numberOfNights) || isNaN(pricePerNight) || isNaN(cleaningFee) || isNaN(totalPrice) || !guestEmail) {
        console.error(`❌ [Webhook Error] Invalid or missing metadata fields in session ${session.id}. Metadata:`, metadata);
        return NextResponse.json({ error: 'Invalid or missing metadata fields' }, { status: 400 });
     }

     // Calculate subtotal based on metadata provided
     const calculatedSubtotal = (pricePerNight * numberOfNights) + cleaningFee;
     // Use total from session if available, otherwise use totalPrice from metadata
     const finalTotal = session.amount_total ? session.amount_total / 100 : totalPrice;
     // Estimate taxes as the difference
     const taxes = finalTotal - calculatedSubtotal;


    // --- Prepare booking data conforming to CreateBookingData structure ---
    const bookingDataForDb = {
      propertyId: propertyId,
      guestInfo: {
        firstName: guestFirstName,
        lastName: guestLastName,
        email: guestEmail,
        userId: metadata.userId || undefined, // Include if you pass userId in metadata
      },
      checkInDate: checkInDate, // Pass ISO string
      checkOutDate: checkOutDate, // Pass ISO string
      numberOfGuests: numberOfGuests,
      pricing: {
        baseRate: pricePerNight,
        numberOfNights: numberOfNights,
        cleaningFee: cleaningFee,
        subtotal: calculatedSubtotal,
        taxes: taxes > 0 ? taxes : 0, // Ensure taxes aren't negative
        total: finalTotal,
      },
      status: 'confirmed' as Booking['status'], // Set initial status to confirmed
      paymentInput: {
        stripePaymentIntentId: paymentIntentId,
        amount: finalTotal,
        status: session.payment_status, // e.g., 'paid'
      },
      source: metadata.source || 'website',
      notes: metadata.notes || undefined,
      externalId: metadata.externalId || undefined,
    };

    console.log('[Webhook Data] Prepared for createBooking:', JSON.stringify(bookingDataForDb, null, 2));

    // --- Create booking in Firestore ---
    try {
      const bookingId = await createBooking(bookingDataForDb as any); // Using 'as any' temporarily if strict type mismatches occur due to Omit<>
      console.log(`✅ [Webhook] Booking ${bookingId} created successfully for session ${session.id}`);

      // TODO:
      // 1. Update property availability in Firestore for the booked dates.
      //    - Call a function like: await updatePropertyAvailability(propertyId, new Date(checkInDate), new Date(checkOutDate), false);
      // 2. Send confirmation email to the guest.
      // 3. Send notification email/SMS to the property owner.

    } catch (error) {
      console.error(`❌ [Webhook Error] Error saving booking for session ${session.id}:`, error);
      // Consider sending an alert here (e.g., to an error tracking service)
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
    }
  } else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}