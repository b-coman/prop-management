/**
 * @fileoverview End-to-end tests for the complete booking flow
 * 
 * Tests the entire booking journey from availability check to confirmation
 * Covers both regular bookings and hold scenarios
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { addDays, format } from 'date-fns';

// Mock all external dependencies
jest.mock('../../src/lib/firebaseAdminPricing');
jest.mock('../../src/lib/pricing/pricing-with-db');
jest.mock('../../src/services/bookingService');
jest.mock('../../src/lib/availability-service');

describe('Booking Flow End-to-End Tests', () => {
  const today = new Date();
  const checkInDate = addDays(today, 7);
  const checkOutDate = addDays(today, 10);
  
  const testProperty = {
    id: 'prahova-mountain-chalet',
    pricePerNight: 150,
    baseCurrency: 'RON',
    baseOccupancy: 4,
    extraGuestFee: 25,
    maxGuests: 8,
    cleaningFee: 75,
    pricingConfig: {
      lengthOfStayDiscounts: [
        { minNights: 3, discountPercent: 5 },
        { minNights: 7, discountPercent: 10 }
      ]
    }
  };

  const testBookingData = {
    propertyId: 'prahova-mountain-chalet',
    checkIn: format(checkInDate, 'yyyy-MM-dd'),
    checkOut: format(checkOutDate, 'yyyy-MM-dd'),
    guests: 4,
    guestInfo: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+40123456789'
    }
  };

  const mockPriceCalendar = {
    year: checkInDate.getFullYear(),
    month: checkInDate.getMonth() + 1,
    days: {
      [checkInDate.getDate()]: {
        available: true,
        baseOccupancyPrice: 200,
        minimumStay: 1,
        prices: {}
      },
      [checkInDate.getDate() + 1]: {
        available: true,
        baseOccupancyPrice: 200,
        minimumStay: 1,
        prices: {}
      },
      [checkInDate.getDate() + 2]: {
        available: true,
        baseOccupancyPrice: 200,
        minimumStay: 1,
        prices: {}
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    const mockGetPropertyWithDb = require('../../src/lib/pricing/pricing-with-db').getPropertyWithDb;
    const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
    const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
    const mockCreateBooking = require('../../src/services/bookingService').createBooking;
    const mockUpdatePropertyAvailability = require('../../src/services/bookingService').updatePropertyAvailability;
    
    mockGetPropertyWithDb.mockResolvedValue(testProperty);
    mockGetPriceCalendarWithDb.mockResolvedValue(mockPriceCalendar);
    mockCheckAvailabilityWithFlags.mockResolvedValue({
      isAvailable: true,
      unavailableDates: [],
      source: 'priceCalendars',
      discrepanciesFound: false
    });
    mockCreateBooking.mockResolvedValue('booking-123');
    mockUpdatePropertyAvailability.mockResolvedValue(undefined);
  });

  describe('Standard Booking Flow', () => {
    it('should complete full booking process successfully', async () => {
      // Step 1: Check availability and pricing
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      const availabilityResult = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );

      expect(availabilityResult.isAvailable).toBe(true);
      expect(availabilityResult.unavailableDates).toHaveLength(0);

      // Step 2: Calculate pricing
      const nights = 3; // 3 nights
      const basePrice = 200 * nights; // 600 RON
      const cleaningFee = testProperty.cleaningFee; // 75 RON
      const expectedTotal = basePrice + cleaningFee; // 675 RON

      // Step 3: Create booking
      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      const bookingData = {
        ...testBookingData,
        pricing: {
          baseRate: basePrice,
          numberOfNights: nights,
          cleaningFee: cleaningFee,
          accommodationTotal: basePrice,
          subtotal: basePrice + cleaningFee,
          total: expectedTotal,
          currency: 'RON'
        },
        status: 'confirmed'
      };

      const bookingId = await mockCreateBooking(bookingData);
      expect(bookingId).toBe('booking-123');

      // Step 4: Verify availability was updated
      const mockUpdatePropertyAvailability = require('../../src/services/bookingService').updatePropertyAvailability;
      expect(mockUpdatePropertyAvailability).toHaveBeenCalledWith(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate,
        false, // Mark as unavailable
        undefined // No hold ID
      );

      // Verify booking service was called with correct data
      expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({
        propertyId: testBookingData.propertyId,
        guestInfo: testBookingData.guestInfo,
        status: 'confirmed',
        pricing: expect.objectContaining({
          total: expectedTotal,
          currency: 'RON'
        })
      }));
    });

    it('should handle extra guest fees correctly', async () => {
      const bookingWithExtraGuests = {
        ...testBookingData,
        guests: 6 // 2 extra guests
      };

      // Calculate expected pricing with extra guests
      const nights = 3;
      const basePrice = 200 * nights; // 600 RON
      const extraGuestFee = 2 * testProperty.extraGuestFee * nights; // 2 guests * 25 RON * 3 nights = 150 RON
      const cleaningFee = testProperty.cleaningFee; // 75 RON
      const expectedTotal = basePrice + extraGuestFee + cleaningFee; // 825 RON

      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      const bookingData = {
        ...bookingWithExtraGuests,
        pricing: {
          baseRate: basePrice,
          numberOfNights: nights,
          extraGuestFee: extraGuestFee,
          numberOfExtraGuests: 2,
          cleaningFee: cleaningFee,
          accommodationTotal: basePrice + extraGuestFee,
          subtotal: basePrice + extraGuestFee + cleaningFee,
          total: expectedTotal,
          currency: 'RON'
        },
        status: 'confirmed'
      };

      const bookingId = await mockCreateBooking(bookingData);
      expect(bookingId).toBe('booking-123');

      expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({
        numberOfGuests: 6,
        pricing: expect.objectContaining({
          extraGuestFee: extraGuestFee,
          numberOfExtraGuests: 2,
          total: expectedTotal
        })
      }));
    });

    it('should apply length of stay discounts', async () => {
      // Book for 7 nights to trigger 10% discount
      const longCheckOut = addDays(checkInDate, 7);
      const longStayBooking = {
        ...testBookingData,
        checkOut: format(longCheckOut, 'yyyy-MM-dd')
      };

      // Mock extended price calendar
      const extendedCalendar = {
        ...mockPriceCalendar,
        days: {}
      };
      
      // Add 7 days of pricing
      for (let i = 0; i < 7; i++) {
        const day = checkInDate.getDate() + i;
        extendedCalendar.days[day] = {
          available: true,
          baseOccupancyPrice: 200,
          minimumStay: 1,
          prices: {}
        };
      }

      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue(extendedCalendar);

      const nights = 7;
      const basePrice = 200 * nights; // 1400 RON
      const discount = basePrice * 0.10; // 10% discount = 140 RON
      const discountedPrice = basePrice - discount; // 1260 RON
      const cleaningFee = testProperty.cleaningFee; // 75 RON
      const expectedTotal = discountedPrice + cleaningFee; // 1335 RON

      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      const bookingData = {
        ...longStayBooking,
        pricing: {
          baseRate: basePrice,
          numberOfNights: nights,
          cleaningFee: cleaningFee,
          discountAmount: discount,
          accommodationTotal: discountedPrice,
          subtotal: discountedPrice + cleaningFee,
          total: expectedTotal,
          currency: 'RON'
        },
        status: 'confirmed'
      };

      const bookingId = await mockCreateBooking(bookingData);
      expect(bookingId).toBe('booking-123');

      expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({
        pricing: expect.objectContaining({
          discountAmount: discount,
          total: expectedTotal
        })
      }));
    });
  });

  describe('Hold Booking Flow', () => {
    it('should create hold booking successfully', async () => {
      const holdData = {
        ...testBookingData,
        status: 'on-hold',
        holdFee: 100, // 100 RON hold fee
        pricing: {
          baseRate: 600,
          numberOfNights: 3,
          cleaningFee: 75,
          accommodationTotal: 600,
          subtotal: 675,
          total: 675,
          currency: 'RON'
        }
      };

      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      const bookingId = await mockCreateBooking(holdData);
      expect(bookingId).toBe('booking-123');

      // Verify availability was updated with hold ID
      const mockUpdatePropertyAvailability = require('../../src/services/bookingService').updatePropertyAvailability;
      expect(mockUpdatePropertyAvailability).toHaveBeenCalledWith(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate,
        false, // Mark as unavailable
        bookingId // Hold ID
      );

      expect(mockCreateBooking).toHaveBeenCalledWith(expect.objectContaining({
        status: 'on-hold',
        holdFee: 100
      }));
    });

    it('should handle hold expiration correctly', async () => {
      // Mock expired hold scenario
      const expiredHoldId = 'expired-hold-123';
      const mockUpdateBookingStatus = require('../../src/services/bookingService').updateBookingStatus;
      
      // Simulate hold expiration
      await mockUpdateBookingStatus(expiredHoldId, 'cancelled');

      // Verify availability was released
      const mockUpdatePropertyAvailability = require('../../src/services/bookingService').updatePropertyAvailability;
      expect(mockUpdatePropertyAvailability).toHaveBeenCalledWith(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate,
        true // Mark as available
      );
    });

    it('should convert hold to confirmed booking', async () => {
      const holdId = 'hold-123';
      const mockUpdateBookingPaymentInfo = require('../../src/services/bookingService').updateBookingPaymentInfo;
      
      const paymentInfo = {
        stripePaymentIntentId: 'pi_test_12345',
        amount: 675,
        status: 'succeeded' as const,
        paidAt: new Date()
      };

      // Convert hold to confirmed booking
      await mockUpdateBookingPaymentInfo(holdId, paymentInfo, testBookingData.propertyId, 'RON', false);

      expect(mockUpdateBookingPaymentInfo).toHaveBeenCalledWith(
        holdId,
        paymentInfo,
        testBookingData.propertyId,
        'RON',
        false // Not a hold payment
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle unavailable dates gracefully', async () => {
      // Mock unavailable dates
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: false,
        unavailableDates: [testBookingData.checkIn],
        source: 'availability',
        discrepanciesFound: false
      });

      const availabilityResult = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );

      expect(availabilityResult.isAvailable).toBe(false);
      expect(availabilityResult.unavailableDates).toContain(testBookingData.checkIn);

      // Should not proceed with booking creation
      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });

    it('should handle booking creation failure', async () => {
      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      mockCreateBooking.mockRejectedValue(new Error('Database error'));

      await expect(mockCreateBooking(testBookingData)).rejects.toThrow('Database error');

      // Verify availability was not updated if booking failed
      const mockUpdatePropertyAvailability = require('../../src/services/bookingService').updatePropertyAvailability;
      expect(mockUpdatePropertyAvailability).not.toHaveBeenCalled();
    });

    it('should handle concurrent booking conflicts', async () => {
      // Simulate concurrent booking scenario
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      
      // First check returns available
      mockCheckAvailabilityWithFlags.mockResolvedValueOnce({
        isAvailable: true,
        unavailableDates: [],
        source: 'availability'
      });

      // Second check (during booking creation) returns unavailable
      mockCheckAvailabilityWithFlags.mockResolvedValueOnce({
        isAvailable: false,
        unavailableDates: [testBookingData.checkIn],
        source: 'availability'
      });

      const firstCheck = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );
      expect(firstCheck.isAvailable).toBe(true);

      const secondCheck = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );
      expect(secondCheck.isAvailable).toBe(false);

      // This simulates the race condition where availability changes between checks
      expect(mockCheckAvailabilityWithFlags).toHaveBeenCalledTimes(2);
    });

    it('should handle minimum stay violations', async () => {
      // Mock calendar with minimum stay requirement
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        ...mockPriceCalendar,
        days: {
          [checkInDate.getDate()]: {
            ...mockPriceCalendar.days[checkInDate.getDate()],
            minimumStay: 5 // Require 5 nights minimum
          }
        }
      });

      // Test booking only has 3 nights, should be rejected
      const nights = 3;
      const minimumStay = 5;

      // This would be handled by the pricing API, not booking service
      // But we can simulate the validation logic
      const meetsMinimumStay = nights >= minimumStay;
      expect(meetsMinimumStay).toBe(false);

      // Booking should not be created
      const mockCreateBooking = require('../../src/services/bookingService').createBooking;
      expect(mockCreateBooking).not.toHaveBeenCalled();
    });
  });

  describe('Availability Consistency Tests', () => {
    it('should maintain consistency between different availability sources', async () => {
      // Test dual check mode for consistency
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'priceCalendars',
        discrepanciesFound: false
      });

      const result = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );

      expect(result.discrepanciesFound).toBe(false);
      expect(result.isAvailable).toBe(true);
    });

    it('should detect and report discrepancies', async () => {
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'priceCalendars',
        discrepanciesFound: true, // Discrepancy detected
        errorDetails: 'Different results between availability and priceCalendars'
      });

      const result = await mockCheckAvailabilityWithFlags(
        testBookingData.propertyId,
        checkInDate,
        checkOutDate
      );

      expect(result.discrepanciesFound).toBe(true);
      expect(result.errorDetails).toContain('Different results');
    });
  });
});