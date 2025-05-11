'use server';

import { getBookingById } from '@/services/bookingService';
import type { Booking } from '@/types';

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