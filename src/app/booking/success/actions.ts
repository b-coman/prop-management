'use server';

import { getBookingById, updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking } from '@/types';
import Stripe from 'stripe';

/**
 * Fetches booking details by ID for the success page
 * @param bookingId The ID of the booking to retrieve
 * @returns The booking details or null if not found
 */
export async function getBookingDetails(bookingId: string): Promise<Booking | null> {
  try {
    if (!bookingId) {
      console.error('[getBookingDetails] No booking ID provided');
      return null;
    }

    console.log(`[getBookingDetails] Fetching booking with ID: ${bookingId}`);
    const booking = await getBookingById(bookingId);

    if (!booking) {
      console.warn(`[getBookingDetails] No booking found with ID: ${bookingId}`);
      return null;
    }

    // Sanitize booking data for client - could be extended to hide sensitive info if needed
    const sanitizedBooking: Booking = {
      ...booking
    };

    return sanitizedBooking;
  } catch (error) {
    console.error(`[getBookingDetails] Error fetching booking details for ID ${bookingId}:`, error);

    // Handle permission errors gracefully - the booking exists but can't be accessed due to Firestore rules
    // NOTE: After updating Firestore rules to allow public read access to bookings,
    // this error should no longer occur. If it does, there might be an issue with the rules deployment.
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Missing or insufficient permissions') ||
        errorMessage.includes('permission-denied')) {
      console.warn(`[getBookingDetails] Permission error for booking ${bookingId}. This should not happen with updated Firestore rules that allow public read access to bookings.`);
      console.warn(`[getBookingDetails] Please verify that the updated Firestore rules have been deployed.`);
      // Return null instead of throwing, so the UI can show a friendly message
      return null;
    }

    // For other errors, throw so they can be caught and displayed
    throw new Error(`Failed to fetch booking details: ${errorMessage}`);
  }
}

/**
 * Sends a booking confirmation email using the email service
 * @param bookingId The ID of the booking to send confirmation for
 * @param recipientEmail Optional: Override recipient email (defaults to guest email)
 * @returns Success status with additional details
 */
export async function sendBookingConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    console.log(`[sendBookingConfirmationEmail] Sending confirmation email for booking: ${bookingId}`);

    // Import the email service dynamically to avoid loading it unnecessarily
    const { sendBookingConfirmationEmail: sendEmail } = await import('@/services/emailService');

    // Send the email using our email service
    const result = await sendEmail(bookingId, recipientEmail);

    if (result.success) {
      return {
        success: true,
        message: `Booking confirmation email sent successfully (ID: ${result.messageId})`,
        previewUrl: result.previewUrl // Only available in development
      };
    } else {
      return {
        success: false,
        message: `Failed to send booking confirmation email: ${result.error}`
      };
    }
  } catch (error) {
    console.error(`[sendBookingConfirmationEmail] Error sending confirmation email for booking ${bookingId}:`, error);
    return {
      success: false,
      message: `Failed to send confirmation email: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Verifies a Stripe session and updates the booking if the webhook hasn't processed it yet
 * Works for both regular bookings and hold bookings
 * @param sessionId The Stripe checkout session ID
 * @param bookingId The booking ID to update
 * @returns Success status with booking details if updated
 */
export async function verifyAndUpdateBooking(
  sessionId: string,
  bookingId: string
): Promise<{
  success: boolean;
  message: string;
  updated: boolean;
  booking?: Booking;
}> {
  try {
    console.log(`🔍 [verifyAndUpdateBooking] Checking session ${sessionId} for booking ${bookingId}`);

    // Get current booking state
    const booking = await getBookingById(bookingId);
    if (!booking) {
      console.error(`❌ [verifyAndUpdateBooking] Booking ${bookingId} not found`);
      return {
        success: false,
        message: 'Booking not found',
        updated: false
      };
    }

    // Determine if this is a hold or regular booking
    const isHold = booking.status === 'on-hold' || !!booking.holdUntil;

    // Check if webhook already processed this booking
    if (isHold) {
      if (booking.holdPaymentId &&
          booking.paymentInfo?.status === 'succeeded' &&
          booking.paymentInfo?.paidAt) {
        console.log(`✅ [verifyAndUpdateBooking] Hold booking ${bookingId} already updated by webhook`);
        return {
          success: true,
          message: 'Booking already updated by webhook',
          updated: false,
          booking
        };
      }
    } else {
      if (booking.paymentInfo?.status === 'succeeded' && booking.paymentInfo?.paidAt) {
        console.log(`✅ [verifyAndUpdateBooking] Booking ${bookingId} already updated by webhook`);
        return {
          success: true,
          message: 'Booking already updated by webhook',
          updated: false,
          booking
        };
      }
    }

    // If not, check with Stripe directly
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error(`❌ [verifyAndUpdateBooking] STRIPE_SECRET_KEY not configured`);
      return {
        success: false,
        message: 'Stripe configuration error',
        updated: false
      };
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      console.error(`❌ [verifyAndUpdateBooking] Session ${sessionId} not found in Stripe`);
      return {
        success: false,
        message: 'Stripe session not found',
        updated: false
      };
    }

    // Verify session is for this booking
    const sessionBookingId = session.metadata?.holdBookingId || session.metadata?.bookingId;
    if (sessionBookingId !== bookingId) {
      console.error(`❌ [verifyAndUpdateBooking] Session booking ID mismatch: ${sessionBookingId} vs ${bookingId}`);
      return {
        success: false,
        message: 'Session booking ID mismatch',
        updated: false
      };
    }

    // Check that payment was successful
    if (session.payment_status !== 'paid') {
      console.warn(`⚠️ [verifyAndUpdateBooking] Session ${sessionId} payment status: ${session.payment_status}`);
      return {
        success: false,
        message: `Payment status is ${session.payment_status}`,
        updated: false
      };
    }

    // Payment succeeded, update booking
    console.log(`🔄 [verifyAndUpdateBooking] Payment confirmed for booking ${bookingId}, updating...`);

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!paymentIntentId) {
      console.error(`❌ [verifyAndUpdateBooking] No payment intent ID in session ${sessionId}`);
      return {
        success: false,
        message: 'No payment intent ID found',
        updated: false
      };
    }

    // Prepare payment info
    const paymentInfo = {
      stripePaymentIntentId: paymentIntentId,
      amount: session.amount_total ? session.amount_total / 100 : (isHold ? booking.holdFee || 0 : booking.pricing?.total || 0),
      status: 'succeeded' as const,
      paidAt: new Date(),
    };

    // Get currency from metadata or booking
    const paymentCurrency = session.metadata?.holdCurrency || session.metadata?.currency || booking.pricing?.currency || 'EUR';

    // Update the booking using the same function the webhook would use
    await updateBookingPaymentInfo(
      bookingId,
      paymentInfo,
      booking.propertyId,
      paymentCurrency as any,
      isHold // isHoldPayment
    );

    // Fetch the updated booking
    const updatedBooking = await getBookingById(bookingId);

    return {
      success: true,
      message: 'Successfully updated booking payment info',
      updated: true,
      booking: updatedBooking || undefined
    };
  } catch (error) {
    console.error(`❌ [verifyAndUpdateBooking] Error updating booking ${bookingId}:`, error);
    return {
      success: false,
      message: `Error updating booking: ${error instanceof Error ? error.message : String(error)}`,
      updated: false
    };
  }
}

/**
 * Sends a hold confirmation email using the email service
 * @param bookingId The ID of the hold booking to send confirmation for
 * @param recipientEmail Optional: Override recipient email (defaults to guest email)
 * @returns Success status with additional details
 */
export async function sendHoldConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string;
}> {
  try {
    console.log(`[sendHoldConfirmationEmail] Sending confirmation email for hold booking: ${bookingId}`);

    // Import the email service dynamically
    const { sendHoldConfirmationEmail: sendEmail } = await import('@/services/emailService');

    // Send the email using our email service
    const result = await sendEmail(bookingId, recipientEmail);

    if (result.success) {
      return {
        success: true,
        message: `Hold confirmation email sent successfully (ID: ${result.messageId})`,
        previewUrl: result.previewUrl
      };
    } else {
      return {
        success: false,
        message: `Failed to send hold confirmation email: ${result.error}`
      };
    }
  } catch (error) {
    console.error(`[sendHoldConfirmationEmail] Error sending confirmation email for booking ${bookingId}:`, error);

    // If the email service doesn't have the sendHoldConfirmationEmail function yet
    if (error instanceof TypeError && error.message.includes('sendHoldConfirmationEmail')) {
      console.warn(`[sendHoldConfirmationEmail] The sendHoldConfirmationEmail function is not implemented in emailService yet.`);
      return {
        success: false,
        message: "Hold confirmation email service is not fully implemented yet."
      };
    }

    return {
      success: false,
      message: `Failed to send confirmation email: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}