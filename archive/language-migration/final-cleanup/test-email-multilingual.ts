import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from '../src/services/emailService';
import type { CompleteBookingData } from '../src/types';

// Test data
const testBookingData: CompleteBookingData = {
  bookingInfo: {
    propertyName: 'Prahova Mountain Chalet',
    checkIn: new Date('2025-05-18'),
    checkOut: new Date('2025-05-20'),
    totalPrice: 300,
    nights: 2,
    guests: 4,
    guestName: 'John Smith',
    guestEmail: 'test@example.com',
    guestPhone: '+40721234567',
    bookingId: 'test-booking-001'
  },
  stripePaymentId: 'pi_test_123456'
};

async function testMultilingualEmails() {
  console.log('Testing multilingual email templates...\n');

  try {
    // Test booking confirmation email
    console.log('Testing booking confirmation email...');
    const confirmationResult = await sendBookingConfirmationEmail(testBookingData);
    console.log('✓ Booking confirmation sent successfully\n');

    // Test booking cancellation email
    console.log('Testing booking cancellation email...');
    const cancellationResult = await sendBookingCancellationEmail(testBookingData);
    console.log('✓ Booking cancellation sent successfully\n');

    console.log('Email tests completed successfully!');
    console.log('\nNote: Check your email provider logs to verify the bilingual content.');
  } catch (error) {
    console.error('Error testing emails:', error);
  }
}

// Run the test
testMultilingualEmails();