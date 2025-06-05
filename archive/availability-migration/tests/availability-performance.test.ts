/**
 * @fileoverview Performance tests for availability checking
 * 
 * Tests response times, memory usage, and load handling
 * Compares performance between old and new availability systems
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { checkAvailabilityWithFlags } from '../../src/lib/availability-service';
import { addDays, format } from 'date-fns';

// Mock dependencies for performance testing
jest.mock('../../src/lib/firebaseAdminPricing');
jest.mock('../../src/lib/pricing/pricing-with-db');
jest.mock('../../src/config/features');

describe('Availability Performance Tests', () => {
  const TEST_PROPERTY = 'performance-test-property';
  const today = new Date();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Response Time Benchmarks', () => {
    it('should complete availability check within 500ms', async () => {
      // Mock fast responses
      setupFastMocks();

      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 10);

      const startTime = performance.now();
      
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500); // 500ms threshold
      console.log(`Availability check completed in ${responseTime.toFixed(2)}ms`);
    });

    it('should handle short date ranges efficiently', async () => {
      setupFastMocks();

      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 8); // Single night

      const startTime = performance.now();
      
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(100); // Should be very fast for single night
      console.log(`Single night check completed in ${responseTime.toFixed(2)}ms`);
    });

    it('should handle long date ranges within reasonable time', async () => {
      setupFastMocks();

      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 37); // 30 nights

      const startTime = performance.now();
      
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // 1 second for long ranges
      console.log(`30-night range check completed in ${responseTime.toFixed(2)}ms`);
    });

    it('should handle cross-month date ranges efficiently', async () => {
      setupFastMocks();

      // Test range spanning 3 months
      const checkInDate = new Date(today.getFullYear(), today.getMonth() + 1, 28);
      const checkOutDate = new Date(today.getFullYear(), today.getMonth() + 4, 5);

      const startTime = performance.now();
      
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(800); // 800ms for multi-month queries
      console.log(`Cross-month check completed in ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      setupFastMocks();

      const requests = [];
      const concurrentRequestCount = 10;

      // Create multiple concurrent requests
      for (let i = 0; i < concurrentRequestCount; i++) {
        const checkInDate = addDays(today, 7 + i);
        const checkOutDate = addDays(today, 10 + i);
        
        requests.push(
          checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate)
        );
      }

      const startTime = performance.now();
      
      const results = await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentRequestCount;

      expect(results).toHaveLength(concurrentRequestCount);
      expect(avgTime).toBeLessThan(200); // Average should be under 200ms
      console.log(`${concurrentRequestCount} concurrent requests completed in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });

    it('should maintain performance under load', async () => {
      setupFastMocks();

      const batchSize = 50;
      const batches = 3;
      const totalRequests = batchSize * batches;

      const allResults = [];
      const batchTimes = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchRequests = [];
        
        for (let i = 0; i < batchSize; i++) {
          const requestIndex = batch * batchSize + i;
          const checkInDate = addDays(today, 7 + (requestIndex % 30));
          const checkOutDate = addDays(today, 10 + (requestIndex % 30));
          
          batchRequests.push(
            checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate)
          );
        }

        const batchStartTime = performance.now();
        const batchResults = await Promise.all(batchRequests);
        const batchEndTime = performance.now();
        
        const batchTime = batchEndTime - batchStartTime;
        batchTimes.push(batchTime);
        allResults.push(...batchResults);

        console.log(`Batch ${batch + 1}/${batches} completed in ${batchTime.toFixed(2)}ms`);
      }

      expect(allResults).toHaveLength(totalRequests);
      
      // Check that performance doesn't degrade significantly between batches
      const firstBatchTime = batchTimes[0];
      const lastBatchTime = batchTimes[batchTimes.length - 1];
      const performanceDegradation = lastBatchTime / firstBatchTime;
      
      expect(performanceDegradation).toBeLessThan(2); // Less than 2x slower
      console.log(`Performance degradation: ${performanceDegradation.toFixed(2)}x`);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks during repeated calls', async () => {
      setupFastMocks();

      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const checkInDate = addDays(today, 7 + (i % 30));
        const checkOutDate = addDays(today, 10 + (i % 30));
        
        await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
        
        // Force garbage collection every 25 iterations
        if (i % 25 === 0 && global.gc) {
          global.gc();
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseKB = memoryIncrease / 1024;

      console.log(`Memory increase after ${iterations} iterations: ${memoryIncreaseKB.toFixed(2)}KB`);
      
      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Feature Flag Performance Impact', () => {
    it('should compare performance between legacy and single source modes', async () => {
      const FEATURES = require('../../src/config/features').FEATURES;
      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 10);

      // Test legacy mode
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = false;
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
      setupFastMocks();

      const legacyStartTime = performance.now();
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      const legacyEndTime = performance.now();
      const legacyTime = legacyEndTime - legacyStartTime;

      // Test single source mode
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
      setupFastMocks();

      const singleSourceStartTime = performance.now();
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      const singleSourceEndTime = performance.now();
      const singleSourceTime = singleSourceEndTime - singleSourceStartTime;

      console.log(`Legacy mode: ${legacyTime.toFixed(2)}ms`);
      console.log(`Single source mode: ${singleSourceTime.toFixed(2)}ms`);

      // Single source should not be significantly slower than legacy
      const performanceRatio = singleSourceTime / legacyTime;
      expect(performanceRatio).toBeLessThan(2); // Less than 2x slower
    });

    it('should measure dual check mode overhead', async () => {
      const FEATURES = require('../../src/config/features').FEATURES;
      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 10);

      // Test single source mode
      (FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = false;
      setupFastMocks();

      const singleStartTime = performance.now();
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      const singleEndTime = performance.now();
      const singleTime = singleEndTime - singleStartTime;

      // Test dual check mode
      (FEATURES as any).AVAILABILITY_DUAL_CHECK = true;
      setupFastMocks();

      const dualStartTime = performance.now();
      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      const dualEndTime = performance.now();
      const dualTime = dualEndTime - dualStartTime;

      console.log(`Single check: ${singleTime.toFixed(2)}ms`);
      console.log(`Dual check: ${dualTime.toFixed(2)}ms`);

      const overhead = dualTime - singleTime;
      console.log(`Dual check overhead: ${overhead.toFixed(2)}ms`);

      // Dual check overhead should be reasonable (less than 300ms)
      expect(overhead).toBeLessThan(300);
    });
  });

  describe('Database Query Optimization', () => {
    it('should batch month queries efficiently', async () => {
      const mockDb = setupMockDatabase();
      
      // Test query spanning multiple months
      const checkInDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const checkOutDate = new Date(today.getFullYear(), today.getMonth() + 4, 15); // 3+ months

      (require('../../src/config/features').FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;

      await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);

      // Should have made one query per month
      const expectedQueries = 4; // 4 months
      expect(mockDb.collection().doc().get).toHaveBeenCalledTimes(expectedQueries);
    });

    it('should handle missing data gracefully without performance impact', async () => {
      // Mock database with missing documents
      const mockDb = {
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              exists: false,
              data: () => null
            })
          })
        })
      };

      const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
      mockGetFirestoreForPricing.mockResolvedValue(mockDb);

      (require('../../src/config/features').FEATURES as any).AVAILABILITY_SINGLE_SOURCE = true;

      const checkInDate = addDays(today, 7);
      const checkOutDate = addDays(today, 10);

      const startTime = performance.now();
      const result = await checkAvailabilityWithFlags(TEST_PROPERTY, checkInDate, checkOutDate);
      const endTime = performance.now();

      const responseTime = endTime - startTime;

      expect(result.isAvailable).toBe(false); // Missing data = unavailable
      expect(responseTime).toBeLessThan(200); // Should still be fast
    });
  });

  // Helper function to setup fast mocks
  function setupFastMocks() {
    const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
    const mockGetPriceCalendarWithDb = require('../../src/lib/pricing/pricing-with-db').getPriceCalendarWithDb;

    // Mock fast database responses
    mockGetFirestoreForPricing.mockResolvedValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              available: { 1: true, 2: true, 3: true, 4: true, 5: true },
              holds: {}
            })
          })
        })
      })
    });

    mockGetPriceCalendarWithDb.mockResolvedValue({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      days: {
        1: { available: true, baseOccupancyPrice: 200 },
        2: { available: true, baseOccupancyPrice: 200 },
        3: { available: true, baseOccupancyPrice: 200 },
        4: { available: true, baseOccupancyPrice: 200 },
        5: { available: true, baseOccupancyPrice: 200 }
      }
    });
  }

  function setupMockDatabase() {
    const mockDb = {
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              available: { 1: true, 2: true, 3: true },
              holds: {}
            })
          })
        })
      })
    };

    const mockGetFirestoreForPricing = require('../../src/lib/firebaseAdminPricing').getFirestoreForPricing;
    mockGetFirestoreForPricing.mockResolvedValue(mockDb);

    return mockDb;
  }
});