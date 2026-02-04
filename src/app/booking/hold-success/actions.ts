'use server';

import { getBookingById, updateBookingPaymentInfo } from '@/services/bookingService';
import type { Booking } from '@/types';
import Stripe from 'stripe';
import { Timestamp } from 'firebase/firestore';
import { loggers } from '@/lib/logger';

const logger = loggers.booking;

/**
 * Fetches hold booking details by ID for the success page
 * @param bookingId The ID of the hold booking to retrieve
 * @returns The booking details or null if not found
 */
export async function getHoldBookingDetails(bookingId: string): Promise<Booking | null> {
  try {
    if (!bookingId) {
      logger.error('No booking ID provided');
      return null;
    }

    logger.debug('Fetching hold booking', { bookingId });
    const booking = await getBookingById(bookingId);

    if (!booking) {
      logger.warn('No booking found', { bookingId });
      return null;
    }

    // Sanitize booking data for client
    const sanitizedBooking: Booking = {
      ...booking
    };

    return sanitizedBooking;
  } catch (error) {
    logger.error('Error fetching hold booking details', error as Error, { bookingId });

    // Handle permission errors gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Missing or insufficient permissions') ||
        errorMessage.includes('permission-denied')) {
      logger.warn('Permission error for hold booking', { bookingId });
      return null;
    }

    // For other errors, throw so they can be caught and displayed
    throw new Error(`Failed to fetch hold booking details: ${errorMessage}`);
  }
}

/**
 * Verifies a Stripe session and updates the booking if the webhook hasn't processed it yet
 * @param sessionId The Stripe checkout session ID
 * @param bookingId The booking ID to update
 * @returns Success status with booking details if updated
 */
export async function verifyAndUpdateHoldBooking(
  sessionId: string,
  bookingId: string
): Promise<{
  success: boolean;
  message: string;
  updated: boolean;
  booking?: Booking;
}> {
  try {
    logger.info('Checking session for hold booking', { sessionId, bookingId });

    // Get current booking state
    const booking = await getBookingById(bookingId);
    if (!booking) {
      logger.error('Booking not found', undefined, { bookingId });
      return {
        success: false,
        message: 'Booking not found',
        updated: false
      };
    }

    // Check if webhook already processed this booking
    if (booking.holdPaymentId &&
        booking.paymentInfo?.status === 'succeeded' &&
        booking.paymentInfo?.paidAt) {
      logger.debug('Booking already updated by webhook', { bookingId });
      return {
        success: true,
        message: 'Booking already updated by webhook',
        updated: false,
        booking
      };
    }

    // If not, check with Stripe directly
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      logger.error('STRIPE_SECRET_KEY not configured');
      return {
        success: false,
        message: 'Stripe configuration error',
        updated: false
      };
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      logger.error('Session not found in Stripe', undefined, { sessionId });
      return {
        success: false,
        message: 'Stripe session not found',
        updated: false
      };
    }

    // Verify session is for this booking
    const sessionBookingId = session.metadata?.holdBookingId;
    if (sessionBookingId !== bookingId) {
      logger.error('Session booking ID mismatch', undefined, { sessionBookingId, bookingId });
      return {
        success: false,
        message: 'Session booking ID mismatch',
        updated: false
      };
    }

    // Check that payment was successful
    if (session.payment_status !== 'paid') {
      logger.warn('Payment not completed', { sessionId, paymentStatus: session.payment_status });
      return {
        success: false,
        message: `Payment status is ${session.payment_status}`,
        updated: false
      };
    }

    // Payment succeeded, update booking
    logger.info('Payment confirmed, updating booking', { bookingId });

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

    if (!paymentIntentId) {
      logger.error('No payment intent ID in session', undefined, { sessionId });
      return {
        success: false,
        message: 'No payment intent ID found',
        updated: false
      };
    }

    // Prepare payment info
    const paymentInfo = {
      stripePaymentIntentId: paymentIntentId,
      amount: session.amount_total ? session.amount_total / 100 : booking.holdFee || 0,
      status: 'succeeded' as const,
      paidAt: new Date(),
    };

    // Get currency from metadata
    const paymentCurrency = session.metadata?.holdCurrency || 'RON';

    // Update the booking using the same function the webhook would use
    await updateBookingPaymentInfo(
      bookingId,
      paymentInfo,
      booking.propertyId,
      paymentCurrency as any,
      true // isHoldPayment
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
    logger.error('Error updating hold booking', error as Error, { bookingId });
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
    logger.info('Sending hold confirmation email', { bookingId });

    // Import the email service dynamically
    const { sendHoldConfirmationEmail: sendEmail } = await import('@/services/emailService');

    // Send the email using our email service
    const result = await sendEmail(bookingId, recipientEmail);

    if (result.success) {
      return {
        success: true,
        message: `Hold confirmation email sent successfully (ID: ${result.messageId})`,
        previewUrl: result.previewUrl // Only available in development
      };
    } else {
      return {
        success: false,
        message: `Failed to send hold confirmation email: ${result.error}`
      };
    }
  } catch (error) {
    logger.error('Error sending hold confirmation email', error as Error, { bookingId });

    // If the email service doesn't have the sendHoldConfirmationEmail function yet
    if (error instanceof TypeError && error.message.includes('sendHoldConfirmationEmail')) {
      logger.warn('sendHoldConfirmationEmail function not implemented in emailService');
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