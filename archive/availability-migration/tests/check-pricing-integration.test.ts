/**
 * @fileoverview Integration tests for check-pricing API endpoints
 * 
 * Tests both original and v2 endpoints with feature flags
 * Covers pricing calculation, availability checking, and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST as originalCheckPricing } from '../../src/app/api/check-pricing/route';
import { POST as v2CheckPricing } from '../../src/app/api/check-pricing-v2/route';
import { addDays, format } from 'date-fns';

// Mock dependencies
jest.mock('../../src/lib/pricing/pricing-with-db');
jest.mock('../../src/lib/availability-service');
jest.mock('../../src/config/features');

describe('Check Pricing API Integration Tests', () => {
  const today = new Date();
  const checkInDate = addDays(today, 7);
  const checkOutDate = addDays(today, 9);
  
  const validRequest = {
    propertyId: 'prahova-mountain-chalet',
    checkIn: format(checkInDate, 'yyyy-MM-dd'),
    checkOut: format(checkOutDate, 'yyyy-MM-dd'),
    guests: 4
  };

  const mockProperty = {
    id: 'prahova-mountain-chalet',
    pricePerNight: 100,
    baseCurrency: 'RON',
    baseOccupancy: 4,
    extraGuestFee: 25,
    maxGuests: 8,
    cleaningFee: 50,
    pricingConfig: {
      lengthOfStayDiscounts: []
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
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock pricing dependencies
    const mockGetPropertyWithDb = require('../../src/lib/pricing/pricing-with-db').getPropertyWithDb;
    const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
    
    mockGetPropertyWithDb.mockResolvedValue(mockProperty);
    mockGetPriceCalendarWithDb.mockResolvedValue(mockPriceCalendar);
  });

  describe('Original Check Pricing API (/api/check-pricing)', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/check-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    it('should return available pricing for valid request', async () => {
      const request = createRequest(validRequest);
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.pricing).toBeDefined();
      expect(data.pricing.currency).toBe('RON');
      expect(data.pricing.total).toBeGreaterThan(0);
    });

    it('should reject past check-in dates', async () => {
      const pastDate = format(addDays(today, -1), 'yyyy-MM-dd');
      const request = createRequest({
        ...validRequest,
        checkIn: pastDate
      });
      
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('past');
    });

    it('should reject invalid date ranges', async () => {
      const request = createRequest({
        ...validRequest,
        checkIn: validRequest.checkOut,
        checkOut: validRequest.checkIn
      });
      
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('after check-in');
    });

    it('should handle unavailable dates', async () => {
      // Mock unavailable calendar
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        ...mockPriceCalendar,
        days: {
          [checkInDate.getDate()]: {
            ...mockPriceCalendar.days[checkInDate.getDate()],
            available: false
          }
        }
      });

      const request = createRequest(validRequest);
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.reason).toBe('unavailable_dates');
      expect(data.unavailableDates).toContain(validRequest.checkIn);
    });

    it('should handle missing price calendars', async () => {
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue(null);

      const request = createRequest(validRequest);
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Price information not available');
    });

    it('should calculate extra guest fees correctly', async () => {
      const requestWithExtraGuests = {
        ...validRequest,
        guests: 6 // 2 extra guests beyond baseOccupancy of 4
      };

      const request = createRequest(requestWithExtraGuests);
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      
      // Should include extra guest fees in pricing
      const expectedExtraFee = 2 * mockProperty.extraGuestFee; // 2 extra guests * 25 = 50
      const nightlyRate = mockPriceCalendar.days[checkInDate.getDate()].baseOccupancyPrice + expectedExtraFee;
      
      expect(data.pricing.total).toBeGreaterThan(nightlyRate * 2); // 2 nights plus cleaning fee
    });

    it('should enforce minimum stay requirements', async () => {
      // Mock calendar with minimum stay of 3 nights
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        ...mockPriceCalendar,
        days: {
          [checkInDate.getDate()]: {
            ...mockPriceCalendar.days[checkInDate.getDate()],
            minimumStay: 3
          }
        }
      });

      const request = createRequest(validRequest); // Only 2 nights
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.reason).toBe('minimum_stay');
      expect(data.minimumStay).toBe(3);
    });

    it('should handle server errors gracefully', async () => {
      const mockGetPropertyWithDb = require('../../src/lib/pricing/pricing-with-db').getPropertyWithDb;
      mockGetPropertyWithDb.mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest(validRequest);
      const response = await originalCheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check pricing');
    });
  });

  describe('V2 Check Pricing API (/api/check-pricing-v2)', () => {
    const createRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/check-pricing-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    beforeEach(() => {
      // Mock availability service
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      const mockGetAvailabilityFeatureStatus = require('../../src/lib/availability-service').getAvailabilityFeatureStatus;
      
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'priceCalendars',
        discrepanciesFound: false
      });

      mockGetAvailabilityFeatureStatus.mockReturnValue({
        AVAILABILITY_SINGLE_SOURCE: false,
        AVAILABILITY_DUAL_CHECK: false,
        AVAILABILITY_LEGACY_FALLBACK: true,
        mode: 'legacy'
      });
    });

    it('should return available pricing with feature flag metadata', async () => {
      const request = createRequest(validRequest);
      const response = await v2CheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.pricing).toBeDefined();
      expect(data.meta).toBeDefined();
      expect(data.meta.source).toBe('priceCalendars');
      expect(data.meta.featureFlags).toBeDefined();
      expect(data.meta.discrepanciesFound).toBe(false);
    });

    it('should handle availability service unavailable response', async () => {
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: false,
        unavailableDates: [validRequest.checkIn],
        source: 'availability',
        discrepanciesFound: false
      });

      const request = createRequest(validRequest);
      const response = await v2CheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.reason).toBe('unavailable_dates');
      expect(data.unavailableDates).toContain(validRequest.checkIn);
      expect(data.meta.source).toBe('availability');
    });

    it('should report discrepancies in dual check mode', async () => {
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      const mockGetAvailabilityFeatureStatus = require('../../src/lib/availability-service').getAvailabilityFeatureStatus;
      
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'priceCalendars',
        discrepanciesFound: true
      });

      mockGetAvailabilityFeatureStatus.mockReturnValue({
        AVAILABILITY_SINGLE_SOURCE: false,
        AVAILABILITY_DUAL_CHECK: true,
        AVAILABILITY_LEGACY_FALLBACK: true,
        mode: 'dual_check'
      });

      const request = createRequest(validRequest);
      const response = await v2CheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.meta.discrepanciesFound).toBe(true);
      expect(data.meta.featureFlags.mode).toBe('dual_check');
    });

    it('should handle availability service errors with fallback info', async () => {
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'fallback',
        errorDetails: 'Database connection failed'
      });

      const request = createRequest(validRequest);
      const response = await v2CheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(true);
      expect(data.meta.source).toBe('fallback');
      expect(data.meta.errorDetails).toBe('Database connection failed');
    });

    it('should handle complete availability service failure', async () => {
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockRejectedValue(new Error('Complete availability failure'));

      const request = createRequest(validRequest);
      const response = await v2CheckPricing(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check pricing');
      expect(data.details).toContain('Complete availability failure');
      expect(data.meta.featureFlags).toBeDefined();
    });
  });

  describe('API Comparison Tests', () => {
    it('should return consistent pricing between original and v2 APIs', async () => {
      // Setup mocks for consistent responses
      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: true,
        unavailableDates: [],
        source: 'priceCalendars'
      });

      const originalRequest = new NextRequest('http://localhost:3000/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });

      const v2Request = new NextRequest('http://localhost:3000/api/check-pricing-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });

      const [originalResponse, v2Response] = await Promise.all([
        originalCheckPricing(originalRequest),
        v2CheckPricing(v2Request)
      ]);

      const originalData = await originalResponse.json();
      const v2Data = await v2Response.json();

      expect(originalResponse.status).toBe(v2Response.status);
      expect(originalData.available).toBe(v2Data.available);
      
      if (originalData.available && v2Data.available) {
        expect(originalData.pricing.total).toBe(v2Data.pricing.total);
        expect(originalData.pricing.currency).toBe(v2Data.pricing.currency);
      }
    });

    it('should handle unavailable dates consistently', async () => {
      // Mock unavailable in both systems
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        ...mockPriceCalendar,
        days: {
          [checkInDate.getDate()]: {
            ...mockPriceCalendar.days[checkInDate.getDate()],
            available: false
          }
        }
      });

      const mockCheckAvailabilityWithFlags = require('../../src/lib/availability-service').checkAvailabilityWithFlags;
      mockCheckAvailabilityWithFlags.mockResolvedValue({
        isAvailable: false,
        unavailableDates: [validRequest.checkIn],
        source: 'priceCalendars'
      });

      const originalRequest = new NextRequest('http://localhost:3000/api/check-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });

      const v2Request = new NextRequest('http://localhost:3000/api/check-pricing-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });

      const [originalResponse, v2Response] = await Promise.all([
        originalCheckPricing(originalRequest),
        v2CheckPricing(v2Request)
      ]);

      const originalData = await originalResponse.json();
      const v2Data = await v2Response.json();

      expect(originalData.available).toBe(false);
      expect(v2Data.available).toBe(false);
      expect(originalData.unavailableDates).toEqual(v2Data.unavailableDates);
    });
  });
});