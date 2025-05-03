
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
}

const stripe = new Stripe(stripeSecretKey);

// Mock data for testing - Updated pricing structure
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
  numberOfGuests: 3, // Example: More than base
  pricing: { // Updated pricing structure
    baseRate: 100,
    numberOfNights: 2,
    cleaningFee: 20,
    extraGuestFee: 15, // Example extra fee
    numberOfExtraGuests: 1, // Example: 1 extra guest
    accommodationTotal: (100 * 2) + (15 * 1 * 2), // base * nights + (extraFee * extraGuests * nights)
    subtotal: (100 * 2) + (15 * 1 * 2) + 20, // accommodation + cleaning
    taxes: 0,
    total: (100 * 2) + (15 * 1 * 2) + 20 + 0, // subtotal + taxes
  },
  paymentInput: {
    stripePaymentIntentId: "mock-payment-intent-id",
    amount: (100 * 2) + (15 * 1 * 2) + 20 + 0,
    status: "succeeded",
  },
  status: 'confirmed',
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
      try {
        const bookingId = await createBooking(mockBookingData);
        console.log(`✅ [Webhook] Mock Booking ${bookingId} created successfully (Test Mode)`);
      } catch(error) {
        console.error(`❌ [Webhook Test Mode Error] Failed to create mock booking:`, error);
        return NextResponse.json({ error: 'Failed to create mock booking in test mode' }, { status: 500 });
      }
      return NextResponse.json({ received: true, testMode: true });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    console.log(`✅ [Webhook] checkout.session.completed event received: ${sessionId}`);

    // --- Validate session data ---
    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ [Webhook] Session ${sessionId} payment status is ${session.payment_status}. No booking created.`);
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

     // --- Safely parse metadata (including new fields) ---
     const propertyId = metadata.propertyId;
     const checkInDate = metadata.checkInDate; // ISO string
     const checkOutDate = metadata.checkOutDate; // ISO string
     const numberOfGuests = parseInt(metadata.numberOfGuests || '1', 10);
     const numberOfNights = parseInt(metadata.numberOfNights || '0', 10);
     const pricePerNight = parseFloat(metadata.pricePerNight || '0');
     const cleaningFee = parseFloat(metadata.cleaningFee || '0');
     const baseOccupancy = parseInt(metadata.baseOccupancy || '1', 10); // Parse base occupancy
     const extraGuestFee = parseFloat(metadata.extraGuestFee || '0'); // Parse extra guest fee
     const numberOfExtraGuests = parseInt(metadata.numberOfExtraGuests || '0', 10); // Parse number of extra guests
     const finalTotal = session.amount_total ? session.amount_total / 100 : parseFloat(metadata.totalPrice || '0'); // Use session amount if available
     const guestFirstName = metadata.guestFirstName || 'Guest';
     const guestLastName = metadata.guestLastName || ''; // Default to empty string if not provided
     const guestEmail = session.customer_details?.email; // Get email from customer_details

     // Validate required metadata (add checks for new fields if necessary)
     if (!propertyId || !checkInDate || !checkOutDate || isNaN(numberOfGuests) || numberOfGuests <= 0 || isNaN(numberOfNights) || numberOfNights <= 0 || isNaN(pricePerNight) || isNaN(cleaningFee) || isNaN(finalTotal) || !guestEmail || isNaN(baseOccupancy) || isNaN(extraGuestFee) || isNaN(numberOfExtraGuests)) {
        console.error(`❌ [Webhook Error - Session ${sessionId}] Invalid or missing metadata fields. Metadata:`, metadata);
        // Log all parsed values for easier debugging
        console.error(`[Validation Check] propId: ${propertyId}, checkIn: ${checkInDate}, checkOut: ${checkOutDate}, guests: ${numberOfGuests}, nights: ${numberOfNights}, price: ${pricePerNight}, cleaning: ${cleaningFee}, total: ${finalTotal}, email: ${guestEmail}, baseOcc: ${baseOccupancy}, extraFee: ${extraGuestFee}, extraGuests: ${numberOfExtraGuests}`);
        return NextResponse.json({ error: 'Invalid or missing metadata fields' }, { status: 400 });
     }
      if (new Date(checkOutDate) <= new Date(checkInDate)) {
         console.error(`❌ [Webhook Error - Session ${sessionId}] Check-out date must be after check-in date.`);
         return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 });
      }


     // Calculate accommodation total and subtotal based on metadata
     const calculatedAccommodationTotal = (pricePerNight * numberOfNights) + (extraGuestFee * numberOfExtraGuests * numberOfNights);
     const calculatedSubtotal = calculatedAccommodationTotal + cleaningFee;
     // Estimate taxes as the difference between Stripe's total and our calculated subtotal
     const taxes = finalTotal - calculatedSubtotal;


    // --- Prepare booking data conforming to CreateBookingData structure ---
    const bookingDataForDb: CreateBookingData = {
      propertyId: propertyId,
      guestInfo: {
        firstName: guestFirstName,
        lastName: guestLastName,
        email: guestEmail,
        userId: metadata.userId || undefined,
      },
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: numberOfGuests,
      pricing: { // Match the updated pricing structure
        baseRate: pricePerNight,
        numberOfNights: numberOfNights,
        cleaningFee: cleaningFee,
        extraGuestFee: extraGuestFee,
        numberOfExtraGuests: numberOfExtraGuests,
        accommodationTotal: calculatedAccommodationTotal,
        subtotal: calculatedSubtotal,
        taxes: taxes > 0 ? taxes : 0, // Ensure taxes aren't negative
        total: finalTotal,
      },
      status: 'confirmed' as Booking['status'], // Set initial status
      paymentInput: {
        stripePaymentIntentId: paymentIntentId,
        amount: finalTotal,
        status: session.payment_status, // e.g., 'paid'
      },
      source: metadata.source || 'website',
      notes: metadata.notes || undefined,
      externalId: metadata.externalId || undefined,
    };

    console.log(`[Webhook Data - Session ${sessionId}] Prepared for createBooking:`, JSON.stringify(bookingDataForDb, null, 2));

    // --- Create booking in Firestore ---
    try {
      const bookingId = await createBooking(bookingDataForDb);
      console.log(`✅ [Webhook] Booking ${bookingId} created successfully for session ${sessionId} (Payment Intent: ${paymentIntentId})`);

      // TODO:
      // 1. Update property availability (already called within createBooking)
      // 2. Send confirmation email to the guest.
      // 3. Send notification email/SMS to the property owner.

    } catch (error) {
      console.error(`❌ [Webhook Error - Session ${sessionId}] Error saving booking:`, error instanceof Error ? error.message : String(error));
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
    }
  } else {
    console.log(`ℹ️ [Webhook] Received unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}

