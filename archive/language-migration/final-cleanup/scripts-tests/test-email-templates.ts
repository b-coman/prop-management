import { createBookingConfirmationTemplate, createBookingCancellationTemplate, createInquiryResponseTemplate } from '../src/services/emailTemplates';
import type { BookingEmailData, InquiryResponseEmailData } from '../src/services/emailTemplates';

// Test data
const testBookingData: BookingEmailData = {
  propertyName: 'Prahova Mountain Chalet',
  checkInDate: new Date('2025-05-18'),
  checkOutDate: new Date('2025-05-20'),
  totalPrice: 300,
  nights: 2,
  guests: 4,
  guestName: 'John Smith',
  guestEmail: 'test@example.com',
  guestPhone: '+40721234567',
  bookingId: 'test-booking-001'
};

const testInquiryData: InquiryResponseEmailData = {
  propertyName: 'Prahova Mountain Chalet',
  guestName: 'Jane Doe',
  message: 'Hello, I have a question about availability for next weekend. Can you provide more details?',
  hostResponse: 'Thank you for your inquiry. The property is available next weekend and we would be happy to host you.'
};

function testBilingualTemplates() {
  console.log('Testing bilingual email templates...\n');

  try {
    // Test booking confirmation template
    console.log('=== Booking Confirmation Template ===');
    const confirmationTemplate = createBookingConfirmationTemplate(testBookingData);
    console.log('Text version:\n', confirmationTemplate.text.substring(0, 200) + '...');
    console.log('\nHTML preview available (too long to display)');
    console.log('✓ Booking confirmation template generated successfully\n');

    // Test booking cancellation template
    console.log('=== Booking Cancellation Template ===');
    const cancellationTemplate = createBookingCancellationTemplate(testBookingData);
    console.log('Text version:\n', cancellationTemplate.text.substring(0, 200) + '...');
    console.log('\nHTML preview available (too long to display)');
    console.log('✓ Booking cancellation template generated successfully\n');

    // Test inquiry response template
    console.log('=== Inquiry Response Template ===');
    const inquiryTemplate = createInquiryResponseTemplate(testInquiryData);
    console.log('Text version:\n', inquiryTemplate.text.substring(0, 200) + '...');
    console.log('\nHTML preview available (too long to display)');
    console.log('✓ Inquiry response template generated successfully\n');

    console.log('All email templates generated successfully!');
    console.log('\nNote: Templates show both English and Romanian versions side by side.');
  } catch (error) {
    console.error('Error testing templates:', error);
  }
}

// Run the test
testBilingualTemplates();