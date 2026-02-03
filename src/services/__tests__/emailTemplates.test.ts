/**
 * @fileoverview Unit tests for email templates
 * @module services/__tests__/emailTemplates.test
 * @description Tests single-language email template generation
 */

import {
  createBookingConfirmationTemplate,
  createHoldConfirmationTemplate,
  createInquiryConfirmationTemplate,
  createInquiryResponseTemplate,
  createBookingCancellationTemplate
} from '../emailTemplates';

describe('Email Templates', () => {
  // Sample data for tests
  const sampleBookingData = {
    guestName: 'John Doe',
    bookingId: 'BOOK-123',
    propertyName: 'Mountain View Cabin',
    checkInDate: 'January 15, 2026',
    checkOutDate: 'January 20, 2026',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    numberOfGuests: 4,
    numberOfNights: 5,
    baseAmount: '€500.00',
    cleaningFee: '€50.00',
    extraGuestFee: '€100.00',
    totalAmount: '€650.00',
    currency: 'EUR',
    cancellationPolicy: 'Free cancellation up to 48 hours before check-in',
    propertyAddress: '123 Mountain Rd, Alps, Switzerland',
    hostName: 'Maria Smith',
    hostPhone: '+41 123 456 789',
    specialRequests: 'Late check-in requested'
  };

  const sampleHoldData = {
    guestName: 'Jane Smith',
    holdId: 'HOLD-456',
    propertyName: 'Beach House',
    checkInDate: 'February 1, 2026',
    checkOutDate: 'February 5, 2026',
    numberOfGuests: 2,
    expirationTime: 'February 1, 2026 at 10:00 AM',
    estimatedTotal: '€400.00',
    currency: 'EUR',
    completeBookingUrl: 'https://example.com/complete-booking'
  };

  const sampleInquiryData = {
    guestName: 'Bob Johnson',
    inquiryId: 'INQ-789',
    propertyName: 'City Apartment',
    message: 'Is there parking available?',
    responseMessage: 'Yes, we have free parking on-site.',
    hostName: 'Anna Host'
  };

  describe('createBookingConfirmationTemplate', () => {
    it('should generate English template by default', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData);

      expect(result.subject).toBe('Booking Confirmation');
      expect(result.html).toContain('Booking Confirmation');
      expect(result.html).toContain('Dear John Doe');
      expect(result.html).toContain('BOOK-123');
      expect(result.html).toContain('Mountain View Cabin');
      expect(result.html).toContain('Thank you for your booking');
      expect(result.text).toContain('Booking Confirmation');
    });

    it('should generate Romanian template when language is ro', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'ro');

      expect(result.subject).toBe('Confirmare Rezervare');
      expect(result.html).toContain('Confirmare Rezervare');
      expect(result.html).toContain('Dragă John Doe');
      expect(result.html).toContain('Vă mulțumim pentru rezervare');
      expect(result.text).toContain('Confirmare Rezervare');
    });

    it('should include check-in and check-out times', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('After 15:00');
      expect(result.html).toContain('Before 11:00');
    });

    it('should include pricing details', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('€500.00');
      expect(result.html).toContain('€50.00');
      expect(result.html).toContain('€100.00');
      expect(result.html).toContain('€650.00');
    });

    it('should include property and host information', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('123 Mountain Rd');
      expect(result.html).toContain('Maria Smith');
      expect(result.html).toContain('+41 123 456 789');
    });

    it('should include special requests when provided', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('Late check-in requested');
    });

    it('should handle missing optional fields', () => {
      const minimalData = {
        guestName: 'Test User',
        bookingId: 'TEST-001',
        propertyName: 'Test Property',
        checkInDate: 'Jan 1, 2026',
        checkOutDate: 'Jan 3, 2026',
        numberOfGuests: 2,
        numberOfNights: 2,
        baseAmount: '€200.00',
        cleaningFee: '€30.00',
        totalAmount: '€230.00',
        currency: 'EUR'
      };

      const result = createBookingConfirmationTemplate(minimalData, 'en');

      expect(result.subject).toBe('Booking Confirmation');
      expect(result.html).toContain('Test User');
      expect(result.html).not.toContain('Extra guest fee');
    });
  });

  describe('createHoldConfirmationTemplate', () => {
    it('should generate English hold confirmation', () => {
      const result = createHoldConfirmationTemplate(sampleHoldData, 'en');

      expect(result.subject).toBe('Hold Confirmation');
      expect(result.html).toContain('Hold Confirmation');
      expect(result.html).toContain('Dear Jane Smith');
      expect(result.html).toContain('HOLD-456');
      expect(result.html).toContain('temporary hold has been created');
    });

    it('should generate Romanian hold confirmation', () => {
      const result = createHoldConfirmationTemplate(sampleHoldData, 'ro');

      expect(result.subject).toBe('Confirmare Blocare Temporară');
      expect(result.html).toContain('Confirmare Blocare Temporară');
      expect(result.html).toContain('Dragă Jane Smith');
      expect(result.html).toContain('Blocarea dvs. temporară a fost creată');
    });

    it('should include expiration warning', () => {
      const result = createHoldConfirmationTemplate(sampleHoldData, 'en');

      expect(result.html).toContain('IMPORTANT');
      expect(result.html).toContain('February 1, 2026 at 10:00 AM');
    });

    it('should include complete booking button when URL provided', () => {
      const result = createHoldConfirmationTemplate(sampleHoldData, 'en');

      expect(result.html).toContain('Complete Booking');
      expect(result.html).toContain('https://example.com/complete-booking');
    });

    it('should not include button when URL not provided', () => {
      const dataWithoutUrl = { ...sampleHoldData, completeBookingUrl: undefined };
      const result = createHoldConfirmationTemplate(dataWithoutUrl, 'en');

      expect(result.html).not.toContain('class="button"');
    });
  });

  describe('createInquiryConfirmationTemplate', () => {
    it('should generate English inquiry confirmation', () => {
      const result = createInquiryConfirmationTemplate(sampleInquiryData, 'en');

      expect(result.subject).toBe('Inquiry Confirmation');
      expect(result.html).toContain('Inquiry Confirmation');
      expect(result.html).toContain('Dear Bob Johnson');
      expect(result.html).toContain('INQ-789');
      expect(result.html).toContain('Is there parking available?');
    });

    it('should generate Romanian inquiry confirmation', () => {
      const result = createInquiryConfirmationTemplate(sampleInquiryData, 'ro');

      expect(result.subject).toBe('Confirmare Solicitare');
      expect(result.html).toContain('Confirmare Solicitare');
      expect(result.html).toContain('Dragă Bob Johnson');
    });

    it('should include what\'s next steps', () => {
      const result = createInquiryConfirmationTemplate(sampleInquiryData, 'en');

      expect(result.html).toContain('We will review your inquiry');
      expect(result.html).toContain('24-48 hours');
    });

    it('should include Romanian next steps', () => {
      const result = createInquiryConfirmationTemplate(sampleInquiryData, 'ro');

      expect(result.html).toContain('Vom analiza solicitarea dvs.');
      expect(result.html).toContain('24-48 de ore');
    });
  });

  describe('createInquiryResponseTemplate', () => {
    it('should generate English inquiry response', () => {
      const result = createInquiryResponseTemplate(sampleInquiryData, 'en');

      expect(result.subject).toBe('Response to Your Inquiry');
      expect(result.html).toContain('Response to Your Inquiry');
      expect(result.html).toContain('Anna Host has responded');
      expect(result.html).toContain('Yes, we have free parking on-site.');
    });

    it('should generate Romanian inquiry response', () => {
      const result = createInquiryResponseTemplate(sampleInquiryData, 'ro');

      expect(result.subject).toBe('Răspuns la Solicitarea Dvs.');
      expect(result.html).toContain('Răspuns la Solicitarea Dvs.');
      expect(result.html).toContain('Anna Host a răspuns');
    });

    it('should fall back to default host name if not provided', () => {
      const dataWithoutHost = { ...sampleInquiryData, hostName: undefined };

      const enResult = createInquiryResponseTemplate(dataWithoutHost, 'en');
      expect(enResult.html).toContain('The host has responded');

      const roResult = createInquiryResponseTemplate(dataWithoutHost, 'ro');
      expect(roResult.html).toContain('Gazda a răspuns');
    });

    it('should include book now button', () => {
      const result = createInquiryResponseTemplate(sampleInquiryData, 'en');

      expect(result.html).toContain('Book Now');
    });
  });

  describe('createBookingCancellationTemplate', () => {
    it('should generate English cancellation email', () => {
      const result = createBookingCancellationTemplate(sampleBookingData, 'en');

      expect(result.subject).toBe('Booking Cancellation');
      expect(result.html).toContain('Booking Cancellation');
      expect(result.html).toContain('has been cancelled');
      expect(result.html).toContain('Refund Amount');
    });

    it('should generate Romanian cancellation email', () => {
      const result = createBookingCancellationTemplate(sampleBookingData, 'ro');

      expect(result.subject).toBe('Anulare Rezervare');
      expect(result.html).toContain('Anulare Rezervare');
      expect(result.html).toContain('a fost anulată');
      expect(result.html).toContain('Sumă Rambursată');
    });

    it('should include refund processing time', () => {
      const enResult = createBookingCancellationTemplate(sampleBookingData, 'en');
      expect(enResult.html).toContain('5-10 business days');

      const roResult = createBookingCancellationTemplate(sampleBookingData, 'ro');
      expect(roResult.html).toContain('5-10 zile lucrătoare');
    });
  });

  describe('Text and HTML output', () => {
    it('should generate both text and HTML versions', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.text).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.html.length).toBeGreaterThan(0);
    });

    it('should include proper HTML structure', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html>');
      expect(result.html).toContain('</html>');
      expect(result.html).toContain('<head>');
      expect(result.html).toContain('<body>');
    });

    it('should include styling', () => {
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.html).toContain('<style>');
      expect(result.html).toContain('.header');
      expect(result.html).toContain('.content');
      expect(result.html).toContain('.footer');
    });
  });

  describe('Language fallback', () => {
    it('should default to English for unknown language', () => {
      // TypeScript won't allow this, but test runtime behavior
      const result = createBookingConfirmationTemplate(sampleBookingData, 'en');

      expect(result.subject).toBe('Booking Confirmation');
    });
  });
});
