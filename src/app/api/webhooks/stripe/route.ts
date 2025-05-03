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
  throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables.');
}

const stripe = new Stripe(stripeSecretKey);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeWebhookSecret
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ Error verifying webhook signature: ${errorMessage}`);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log('✅ checkout.session.completed event received:', session.id);

    // --- Validate session data ---
    if (session.payment_status !== 'paid') {
        console.warn(`⚠️ Session ${session.id} payment status is ${session.payment_status}. No booking created.`);
        // Respond early, no booking needed if not paid
        return NextResponse.json({ received: true, message: 'Payment not completed' });
    }

    const metadata = session.metadata;
    if (!metadata) {
      console.error(`❌ Missing metadata in session ${session.id}`);
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    // --- Prepare booking data from metadata ---
    // It's crucial that the metadata keys match exactly what you set in createCheckoutSession
    const bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
      propertyId: metadata.propertyId,
      // Placeholder guest info - ideally retrieve from session or customer object if available
      // In a real app, you might require login or collect guest details before checkout
      guestInfo: {
        firstName: metadata.guestFirstName || 'Guest', // Example: get from metadata or session
        lastName: metadata.guestLastName || 'User',
        email: session.customer_details?.email || 'unknown@example.com', // Get email from customer details
        // Add other guest fields if collected and passed in metadata
      },
      checkInDate: metadata.checkInDate, // Pass as ISO string
      checkOutDate: metadata.checkOutDate, // Pass as ISO string
      numberOfGuests: parseInt(metadata.numberOfGuests, 10) || 1,
      pricing: {
        baseRate: parseFloat(metadata.pricePerNight) || 0, // From metadata
        numberOfNights: parseInt(metadata.numberOfNights, 10) || 0, // From metadata
        cleaningFee: parseFloat(metadata.cleaningFee) || 0, // From metadata
        // Calculate subtotal based on fetched data
        subtotal: (parseFloat(metadata.pricePerNight) * parseInt(metadata.numberOfNights, 10)) + parseFloat(metadata.cleaningFee),
        // Taxes might be calculated or retrieved differently
        taxes: session.total_details?.amount_tax ? session.total_details.amount_tax / 100 : 0, // Get tax from session if available
        total: session.amount_total ? session.amount_total / 100 : 0, // Total from session (in dollars)
      },
      status: 'confirmed', // Set status to confirmed since payment is successful
      paymentInfo: {
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : '',
        amount: session.amount_total ? session.amount_total / 100 : 0, // Amount from session (in dollars)
        status: session.payment_status, // e.g., 'paid'
        paidAt: session.payment_status === 'paid' ? new Date().toISOString() : null, // Set paidAt if paid
      },
      source: 'website',
      // Add other relevant fields from metadata if needed
    };

    // --- Create booking in Firestore ---
    try {
      const bookingId = await createBooking(bookingData as any); // Use 'as any' temporarily if types mismatch, refine later
      console.log(`✅ Booking ${bookingId} created successfully for session ${session.id}`);

      // TODO:
      // 1. Update property availability in Firestore for the booked dates.
      //    - You'll need a function `updatePropertyAvailability(propertyId, startDate, endDate, isAvailable)`
      // 2. Send confirmation email to the guest.
      // 3. Send notification email/SMS to the property owner.

    } catch (error) {
      console.error(`❌ Error saving booking for session ${session.id}:`, error);
      // Return 500 status to indicate failure to Stripe, prompting retries
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 });
    }
  } else {
    console.log(`ℹ️ Received unhandled event type: ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}
