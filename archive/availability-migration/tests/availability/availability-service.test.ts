/**
 * @fileoverview Unit tests for the availability service with feature flags
 * 
 * Tests all three modes: LEGACY, DUAL_CHECK, and SINGLE_SOURCE
 * Covers edge cases, error handling, and discrepancy detection
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { checkAvailabilityWithFlags, getAvailabilityFeatureStatus } from '../../src/lib/availability-service';
import { FEATURES } from '../../src/config/features';
import { addDays, format } from 'date-fns';

// Mock dependencies
jest.mock('../../src/config/features', () => ({
  FEATURES: {
    AVAILABILITY_SINGLE_SOURCE: false,
    AVAILABILITY_DUAL_CHECK: false,
    AVAILABILITY_LEGACY_FALLBACK: true
  }
}));

jest.mock('../../src/lib/firebaseAdminPricing');
jest.mock('../../src/lib/pricing/pricing-with-db');

describe('Availability Service with Feature Flags', () => {
  const TEST_PROPERTY = 'test-property';
  const today = new Date();
  const checkInDate = addDays(today, 7);
  const checkOutDate = addDays(today, 9);

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset feature flags to default state
    (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = false;
    (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
    (FEATURES as any).AVAILABILITY_LEGACY_FALLBACK = true;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Feature Flag Status', () => {
    it('should return correct feature flag status', () => {
      const status = getAvailabilityFeatureStatus();
      expect(status).toEqual({
        AVAILABILITY_SINGLE_SOURCE: false,
        AVAILABILITY_DUAL_CHECK: false,
        AVAILABILITY_LEGACY_FALLBACK: true,
        mode: 'legacy'
      });
    });

    it('should detect dual check mode', () => {
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = true;
      const status = getAvailabilityFeatureStatus();
      expect(status.mode).toBe('dual_check');
    });

    it('should detect single source mode', () => {
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;
      const status = getAvailabilityFeatureStatus();
      expect(status.mode).toBe('single_source');
    });
  });

  describe('Legacy Mode (Default)', () => {
    beforeEach(() => {
      // Ensure legacy mode
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = false;
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
    });

    it('should use priceCalendars only in legacy mode', async () => {
      // Mock priceCalendars to return available dates
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: checkInDate.getFullYear(),
        month: checkInDate.getMonth() + 1,
        days: {
          [checkInDate.getDate()]: { available: true, baseOccupancyPrice: 100 },
          [checkOutDate.getDate() - 1]: { available: true, baseOccupancyPrice: 100 }
        }
      });

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('priceCalendars');
      expect(result.isAvailable).toBe(true);
      expect(result.unavailableDates).toHaveLength(0);
      expect(result.discrepanciesFound).toBeUndefined();
    });

    it('should detect unavailable dates in legacy mode', async () => {
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: checkInDate.getFullYear(),
        month: checkInDate.getMonth() + 1,
        days: {
          [checkInDate.getDate()]: { available: false, baseOccupancyPrice: 100 },
          [checkOutDate.getDate() - 1]: { available: true, baseOccupancyPrice: 100 }
        }
      });

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('priceCalendars');
      expect(result.isAvailable).toBe(false);
      expect(result.unavailableDates).toContain(format(checkInDate, 'yyyy-MM-dd'));
    });
  });

  describe('Single Source Mode', () => {
    beforeEach(() => {
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
    });

    it('should use availability collection only in single source mode', async () => {
      // Mock Firebase Admin SDK
      const mockDoc = {
        exists: true,
        data: () => ({
          available: {
            [checkInDate.getDate()]: true,
            [checkOutDate.getDate() - 1]: true
          },
          holds: {}
        })
      };

      const mockCollection = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc)
        })
      };

      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('availability');
      expect(result.isAvailable).toBe(true);
      expect(mockDb.collection).toHaveBeenCalledWith('availability');
    });

    it('should detect holds as unavailable in single source mode', async () => {
      const mockDoc = {
        exists: true,
        data: () => ({
          available: {
            [checkInDate.getDate()]: true,
            [checkOutDate.getDate() - 1]: true
          },
          holds: {
            [checkInDate.getDate()]: 'hold-booking-123'
          }
        })
      };

      const mockCollection = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc)
        })
      };

      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('availability');
      expect(result.isAvailable).toBe(false);
      expect(result.unavailableDates).toContain(format(checkInDate, 'yyyy-MM-dd'));
    });

    it('should handle missing availability documents', async () => {
      const mockDoc = {
        exists: false,
        data: () => null
      };

      const mockCollection = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockDoc)
        })
      };

      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('availability');
      expect(result.isAvailable).toBe(false);
      // Should consider all dates unavailable when document doesn't exist
      expect(result.unavailableDates.length).toBeGreaterThan(0);
    });
  });

  describe('Dual Check Mode', () => {
    beforeEach(() => {
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = true;
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = false;
    });

    it('should compare both sources and detect discrepancies', async () => {
      // Mock availability collection to return unavailable
      const mockAvailabilityDoc = {
        exists: true,
        data: () => ({
          available: {
            [checkInDate.getDate()]: false // Unavailable in availability collection
          },
          holds: {}
        })
      };

      // Mock priceCalendars to return available
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: checkInDate.getFullYear(),
        month: checkInDate.getMonth() + 1,
        days: {
          [checkInDate.getDate()]: { available: true, baseOccupancyPrice: 100 } // Available in priceCalendars
        }
      });

      const mockCollection = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockAvailabilityDoc)
        })
      };

      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.discrepanciesFound).toBe(true);
      expect(result.source).toBe('priceCalendars'); // Should use priceCalendars as primary when SINGLE_SOURCE is false
    });

    it('should use availability collection as primary when SINGLE_SOURCE is enabled', async () => {
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;

      // Mock both sources to return different results
      const mockAvailabilityDoc = {
        exists: true,
        data: () => ({
          available: {
            [checkInDate.getDate()]: false
          },
          holds: {}
        })
      };

      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: checkInDate.getFullYear(),
        month: checkInDate.getMonth() + 1,
        days: {
          [checkInDate.getDate()]: { available: true, baseOccupancyPrice: 100 }
        }
      });

      const mockCollection = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue(mockAvailabilityDoc)
        })
      };

      const mockDb = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('availability'); // Should use availability as primary
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('Error Handling and Fallback', () => {
    beforeEach(() => {
      (FEATURES as any).AVAILABILITY_LEGACY_FALLBACK = true;
    });

    it('should fallback to priceCalendars when availability collection fails', async () => {
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;

      // Mock availability collection to fail
      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockRejectedValue(new Error('Database connection failed'));

      // Mock priceCalendars to succeed
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: checkInDate.getFullYear(),
        month: checkInDate.getMonth() + 1,
        days: {
          [checkInDate.getDate()]: { available: true, baseOccupancyPrice: 100 }
        }
      });

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      expect(result.source).toBe('fallback');
      expect(result.errorDetails).toContain('Database connection failed');
      expect(result.isAvailable).toBe(true);
    });

    it('should throw error when both sources fail', async () => {
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = true;

      // Mock both sources to fail
      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockRejectedValue(new Error('Database connection failed'));

      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockRejectedValue(new Error('Price calendar failed'));

      await expect(
        checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate)
      ).rejects.toThrow('Both availability sources failed');
    });

    it('should not fallback when fallback is disabled', async () => {
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;
      (FEATURES as any).AVAILABILITY_LEGACY_FALLBACK = false;

      // Mock availability collection to fail
      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate)
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle same-day check-in/check-out', async () => {
      const sameDay = addDays(today, 7);
      
      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: sameDay.getFullYear(),
        month: sameDay.getMonth() + 1,
        days: {}
      });

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, sameDay, sameDay);
      
      expect(result.unavailableDates).toHaveLength(0);
      expect(result.isAvailable).toBe(true);
    });

    it('should handle month boundaries correctly', async () => {
      // Test dates spanning two months
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
      const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1); // First day of next month
      
      const testCheckIn = endOfMonth;
      const testCheckOut = addDays(startOfNextMonth, 1);

      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockImplementation(async (propertyId, year, month) => ({
        year,
        month,
        days: {
          [testCheckIn.getDate()]: { available: true, baseOccupancyPrice: 100 },
          [startOfNextMonth.getDate()]: { available: true, baseOccupancyPrice: 100 }
        }
      }));

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, testCheckIn, testCheckOut);
      
      expect(result.isAvailable).toBe(true);
      expect(mockGetPriceCalendarWithDb).toHaveBeenCalledTimes(2); // Should query both months
    });

    it('should handle leap year dates', async () => {
      const leapYear = 2024; // Known leap year
      const feb29 = new Date(leapYear, 1, 29); // February 29th
      const mar1 = new Date(leapYear, 2, 1); // March 1st

      const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;
      mockGetPriceCalendarWithDb.mockResolvedValue({
        year: leapYear,
        month: 2, // February
        days: {
          '29': { available: true, baseOccupancyPrice: 100 }
        }
      });

      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, feb29, mar1);
      
      expect(result.isAvailable).toBe(true);
    });
  });
});