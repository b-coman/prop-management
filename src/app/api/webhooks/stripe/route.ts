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

// Mock data for testing
const mockBookingData: CreateBookingData = {
  propertyId: "some-property-id",
  guestInfo: {
    firstName: "Test",
    lastName: "Guest",
    email: "test@example.com",
    userId: "some-user-id",
  },
  checkInDate: new Date().toISOString(),
  checkOutDate: new Date(Date.now() + 86400000 * 2).toISOString(),
  numberOfGuests: 2,
  pricing: {
    baseRate: 100,
    numberOfNights: 2,
    cleaningFee: 20,
    subtotal: 220,
    taxes: 0,
    total: 220,
  },
  paymentInput: {
    stripePaymentIntentId: "mock-payment-intent-id",
    amount: 220,
    status: "succeeded",
  },
};

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

  // --- Check for Test Mode ---
  const headersList = headers();
  const testMode = headersList.get('x-test-mode');
  if (testMode === 'true') {
      console.warn("⚠️ [Webhook] Test mode enabled. Using mocked data.");
      const bookingId = await createBooking(mockBookingData);
      console.log(`✅ [Webhook] Mock Booking ${bookingId} created successfully (Test Mode)`);
      return NextResponse.json({ received: true, testMode: true });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    console.log(`✅ [Webhook] checkout.session.completed event received: ${sessionId}`);
    console.log(`[Webhook Session ${sessionId}] Payment Status: ${session.payment_status}, Amount Total: ${session.amount_total}`);

    // --- Validate session data ---
    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ [Webhook] Session ${sessionId} payment status is ${session.payment_status}. No booking created.`);
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }

    // Ensure payment_intent is a string or retrieve it if needed
    const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id; // Handle expanded object case if necessary

     if (!paymentIntentId) {
       console.error(`❌ [Webhook Error] Missing payment_intent ID in session ${sessionId}`);
       return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 });
     }
     console.log(`[Webhook Session ${sessionId}] Payment Intent ID: ${paymentIntentId}`);


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
     const totalPrice = parseFloat(metadata.totalPrice || '0'); // Total price passed from frontend
     const guestFirstName = metadata.guestFirstName || 'Guest';
     const guestLastName = metadata.guestLastName || ''; // Default to empty string if not provided
     const guestEmail = session.customer_details?.email; // Get email from customer_details

     // Validate required metadata
     if (!propertyId || !checkInDate || !checkOutDate || isNaN(numberOfGuests) || numberOfGuests <= 0 || isNaN(numberOfNights) || numberOfNights <= 0 || isNaN(pricePerNight) || isNaN(cleaningFee) || isNaN(totalPrice) || !guestEmail) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Invalid or missing metadata fields. Metadata:`, metadata);
        console.error(`[Validation Check] propId: ${propertyId}, checkIn: ${checkInDate}, checkOut: ${checkOutDate}, guests: ${numberOfGuests}, nights: ${numberOfNights}, price: ${pricePerNight}, cleaning: ${cleaningFee}, total: ${totalPrice}, email: ${guestEmail}`);
        return NextResponse.json({ error: 'Invalid or missing metadata fields' }, { status: 400 });
     }
      if (new Date(checkOutDate) <= new Date(checkInDate)) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Check-out date must be after check-in date.`);
         return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
      }


     // Calculate subtotal based on metadata provided
     const calculatedSubtotal = (pricePerNight * numberOfNights) + cleaningFee;
     // Use total from session if available (convert cents to dollars), otherwise use totalPrice from metadata
     const finalTotal = session.amount_total ? session.amount_total / 100 : totalPrice;
     // Estimate taxes as the difference
     const taxes = finalTotal - calculatedSubtotal;


    // --- Prepare booking data conforming to CreateBookingData structure ---
    // Ensure all required fields for CreateBookingData are present
    const bookingDataForDb: CreateBookingData = {
      propertyId: propertyId,
      guestInfo: {
        firstName: guestFirstName,
        lastName: guestLastName,
        email: guestEmail,
        // Add other fields if available and needed by your schema
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
      paymentInput: { // This specific structure is expected by createBooking
        stripePaymentIntentId: paymentIntentId,
        amount: finalTotal,
        status: session.payment_status, // e.g., 'paid'
      },
      // Add optional fields if present in metadata
      source: metadata.source || 'website',
      notes: metadata.notes || undefined,
      externalId: metadata.externalId || undefined,
    };

    console.log(`[Webhook Data - Session ${sessionId}] Prepared for createBooking:`, JSON.stringify(bookingDataForDb, null, 2));

    // --- Create booking in Firestore ---
    try {
      // Call createBooking with the correctly typed data
      const bookingId = await createBooking(bookingDataForDb);
      console.log(`✅ [Webhook] Booking ${bookingId} created successfully for session ${sessionId} (Payment Intent: ${paymentIntentId})`);

      // TODO:
      // 1. Update property availability in Firestore for the booked dates.
      //    - Call a function like: await updatePropertyAvailability(propertyId, new Date(checkInDate), new Date(checkOutDate), false);
      // 2. Send confirmation email to the guest.
      // 3. Send notification email/SMS to the property owner.

    } catch (error) {
      // Error is already logged within createBooking, but we log again here for webhook context
      console.error(`❌ [Webhook Error - Session ${sessionId}] Error saving booking:`, error instanceof Error ? error.message : String(error));
      // Return 500 to indicate failure processing the webhook event
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
    }
  } else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
