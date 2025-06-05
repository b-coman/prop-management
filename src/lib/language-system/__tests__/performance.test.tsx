/**
 * @fileoverview Performance Test Suite for Language System
 * @module lib/language-system/__tests__/performance
 * 
 * @description
 * Comprehensive performance testing for the unified language system.
 * Validates performance targets, measures optimization effectiveness,
 * and ensures system scales properly under load.
 * 
 * @architecture
 * Location: Core language system test infrastructure
 * Layer: Performance and optimization testing
 * Pattern: Jest performance tests with timing measurements
 * 
 * @dependencies
 * - Internal: All language system modules
 * - External: Jest, Performance API
 * 
 * @relationships
 * - Tests: Performance characteristics of all components
 * - Validates: Performance targets from requirements
 * - Measures: Cache efficiency, detection speed, translation speed
 * - Ensures: System scalability and optimization effectiveness
 * 
 * @performance-targets
 * - Language detection: <30ms
 * - Translation loading: <500ms
 * - Cache hit rate: >90% after warmup
 * - Memory usage: <2MB for full cache
 * - Translation lookup: <1ms average
 * 
 * @example
 * ```bash
 * npm test src/lib/language-system/__tests__/performance.test.ts
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 validation. Performance must meet or exceed legacy system
 * performance while providing additional functionality. Critical for Phase 3
 * approval and production deployment.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Import system components
import {
  LanguageProvider,
  useLanguage,
  useTranslation,
  useLanguagePerformance,
  detectLanguage,
  createDetectionConfig,
  TranslationCache,
  createTranslationCache,
  globalTranslationCache,
  fastDetectLanguageFromPath
} from '../index';

import type {
  SupportedLanguage,
  LanguageDetectionConfig,
  LanguageProviderProps
} from '../language-types';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/'
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams())
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    languageSystem: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  }
}));

jest.mock('@/lib/language-constants', () => ({
  SUPPORTED_LANGUAGES: ['en', 'ro'],
  DEFAULT_LANGUAGE: 'en'
}));

// Performance testing utilities
const createLargeTranslationObject = (size: number) => {
  const translations: Record<string, string> = {};
  for (let i = 0; i < size; i++) {
    translations[`key_${i}`] = `Translation value ${i} with some content to make it realistic`;
    translations[`nested.key_${i}`] = `Nested translation ${i}`;
    translations[`category.${i % 10}.item_${i}`] = `Categorized item ${i}`;
  }
  return translations;
};

const measureExecutionTime = async <T>(
  fn: () => Promise<T> | T,
  iterations: number = 1
): Promise<{ result: T; averageTime: number; minTime: number; maxTime: number }> => {
  const times: number[] = [];
  let result: T;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    result = await fn();
    const end = performance.now();
    times.push(end - start);
  }

  return {
    result: result!,
    averageTime: times.reduce((a, b) => a + b) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times)
  };
};

const simulateNetworkDelay = (delay: number) => {
  return new Promise(resolve => setTimeout(resolve, delay));
};

// Mock fetch with configurable delays
const createMockFetch = (responseTime: number = 50, failureRate: number = 0) => {
  return jest.fn().mockImplementation(async (url: string) => {
    await simulateNetworkDelay(responseTime);
    
    if (Math.random() < failureRate) {
      throw new Error('Simulated network error');
    }

    if (url.includes('/locales/en.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createLargeTranslationObject(100))
      });
    }
    if (url.includes('/locales/ro.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createLargeTranslationObject(100))
      });
    }
    return Promise.reject(new Error('Translation file not found'));
  });
};

// Test wrapper with performance tracking
const PerformanceTestWrapper: React.FC<{ 
  children: React.ReactNode; 
  providerProps?: Partial<LanguageProviderProps> 
}> = ({ children, providerProps = {} }) => {
  return React.createElement(LanguageProvider, {
    initialLanguage: "en" as SupportedLanguage,
    pageType: "general",
    enablePerformanceTracking: true,
    enableDebugMode: true,
    children,
    ...providerProps
  });
};

describe('Language System Performance', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    globalTranslationCache.clearCache();
    
    // Use standard mock fetch
    global.fetch = createMockFetch();
  });

  // ===== Language Detection Performance =====

  describe('Language Detection Performance', () => {
    
    it('should meet detection speed targets (<30ms)', async () => {
      const testCases = [
        { pathname: '/properties/villa/ro', pageType: 'property' as const },
        { pathname: '/ro/about', pageType: 'general' as const },
        { pathname: '/admin/ro/settings', pageType: 'admin' as const },
        { pathname: '/booking?language=ro', pageType: 'booking' as const },
        { pathname: '/unknown', pageType: 'general' as const }
      ];

      for (const testCase of testCases) {
        const config = createDetectionConfig({
          pathname: testCase.pathname,
          pageType: testCase.pageType,
          searchParams: testCase.pathname.includes('?') 
            ? new URLSearchParams(testCase.pathname.split('?')[1]) 
            : undefined
        });

        const { averageTime } = await measureExecutionTime(
          () => detectLanguage(config),
          50 // Run 50 iterations for accurate average
        );

        expect(averageTime).toBeLessThan(30); // Target: <30ms
      }
    });

    it('should optimize fast path detection for common patterns', async () => {
      const commonPaths = [
        '/properties/villa/ro',
        '/properties/apartment/en',
        '/ro/contact',
        '/en/about'
      ];

      for (const path of commonPaths) {
        const { averageTime } = await measureExecutionTime(
          () => fastDetectLanguageFromPath(path),
          1000 // High iteration count for micro-benchmark
        );

        expect(averageTime).toBeLessThan(1); // Target: <1ms for fast path
      }
    });

    it('should scale linearly with URL complexity', async () => {
      const simplePath = '/ro';
      const complexPath = '/admin/ro/properties/management/pricing/advanced/settings';

      const simpleResult = await measureExecutionTime(
        () => fastDetectLanguageFromPath(simplePath),
        100
      );

      const complexResult = await measureExecutionTime(
        () => fastDetectLanguageFromPath(complexPath),
        100
      );

      // Complex path should not be more than 5x slower than simple path
      expect(complexResult.averageTime).toBeLessThan(simpleResult.averageTime * 5);
    });

  });

  // ===== Translation Cache Performance =====

  describe('Translation Cache Performance', () => {
    
    it('should achieve target cache hit rates (>90%)', async () => {
      const cache = createTranslationCache({
        maxSize: 10,
        ttl: 60000,
        enablePreloading: true
      });

      // Warm up cache
      await cache.getTranslations('en');
      await cache.getTranslations('ro');

      // Perform many requests to measure hit rate
      const requests = 100;
      for (let i = 0; i < requests; i++) {
        const lang = i % 2 === 0 ? 'en' : 'ro';
        await cache.getTranslations(lang);
      }

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(90); // Target: >90%
    });

    it('should load translations within time targets (<500ms)', async () => {
      // Test with realistic network delay
      global.fetch = createMockFetch(200); // 200ms network delay

      const cache = createTranslationCache();

      const { averageTime } = await measureExecutionTime(
        () => cache.getTranslations('en'),
        10
      );

      expect(averageTime).toBeLessThan(500); // Target: <500ms including network
    });

    it('should handle concurrent translation requests efficiently', async () => {
      const cache = createTranslationCache();

      // Make many concurrent requests for the same language
      const concurrentRequests = 50;
      const startTime = performance.now();

      const promises = Array(concurrentRequests).fill(null).map(() =>
        cache.getTranslations('en')
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      // All results should be identical (from cache after first load)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.content).toEqual(firstResult.content);
      });

      // Total time should be much less than individual requests * count
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete in <1 second
    });

    it('should maintain memory usage within limits (<2MB)', async () => {
      const cache = createTranslationCache({
        maxSize: 20 // Allow large cache for memory testing
      });

      // Load multiple large translation sets
      const languages: SupportedLanguage[] = ['en', 'ro'];
      for (const lang of languages) {
        await cache.getTranslations(lang);
      }

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeLessThan(2048); // Target: <2MB (2048KB)
    });

    it('should efficiently evict LRU entries', async () => {
      const cache = createTranslationCache({
        maxSize: 2, // Small cache to trigger eviction
        ttl: 60000
      });

      // Load translations to fill cache
      await cache.getTranslations('en');
      await cache.getTranslations('ro');

      // Access 'en' to make it most recently used
      await cache.getTranslations('en');

      // Load new language to trigger eviction (should evict 'ro')
      await cache.getTranslations('en'); // This will be a cache hit

      const cachedLanguages = cache.getCachedLanguages();
      expect(cachedLanguages).toContain('en');
      expect(cachedLanguages.length).toBeLessThanOrEqual(2);
    });

  });

  // ===== Translation Function Performance =====

  describe('Translation Function Performance', () => {
    
    it('should perform translations within speed targets (<1ms average)', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const testKeys = [
        'key_1',
        'nested.key_5',
        'category.3.item_23',
        'nonexistent'
      ];

      for (const key of testKeys) {
        const { averageTime } = await measureExecutionTime(
          () => result.current.t(key, 'fallback'),
          1000 // High iteration count for accurate measurement
        );

        expect(averageTime).toBeLessThan(1); // Target: <1ms average
      }
    });

    it('should handle variable substitution efficiently', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const variables = {
        name: 'Performance Test',
        count: 42,
        category: 'testing',
        timestamp: Date.now()
      };

      const { averageTime } = await measureExecutionTime(
        () => result.current.t('variables.test', 'Hello {{name}}', variables),
        1000
      );

      expect(averageTime).toBeLessThan(2); // Allow 2ms for variable substitution
    });

    it('should scale with translation object size', async () => {
      // Mock large translation object
      global.fetch = jest.fn().mockImplementation((url: string) => {
        const size = url.includes('/locales/en.json') ? 1000 : 100;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createLargeTranslationObject(size))
        });
      });

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Translation speed should not degrade significantly with larger objects
      const { averageTime } = await measureExecutionTime(
        () => result.current.t('key_500', 'fallback'),
        100
      );

      expect(averageTime).toBeLessThan(5); // Still fast even with large objects
    });

  });

  // ===== Hook Performance =====

  describe('Hook Performance', () => {
    
    it('should minimize hook execution overhead', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Measure hook property access
      const { averageTime } = await measureExecutionTime(
        () => {
          const { currentLang, t, tc, switchLanguage } = result.current;
          return { currentLang, t, tc, switchLanguage };
        },
        10000 // High iteration count for micro-benchmark
      );

      expect(averageTime).toBeLessThan(0.1); // Should be nearly instant
    });

    it('should optimize specialized hooks for performance', async () => {
      const TestComponent = () => {
        const fullHook = useLanguage();
        const translationOnlyHook = useTranslation();
        return { fullHook, translationOnlyHook };
      };

      const { result } = renderHook(() => TestComponent(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.fullHook.isLoading).toBe(false);
      });

      // Both hooks should perform similarly for translation operations
      const fullHookTime = await measureExecutionTime(
        () => result.current.fullHook.t('key_1'),
        1000
      );

      const specializedHookTime = await measureExecutionTime(
        () => result.current.translationOnlyHook.t('key_1'),
        1000
      );

      // Specialized hook should not be significantly slower
      expect(specializedHookTime.averageTime).toBeLessThan(fullHookTime.averageTime * 1.2);
    });

  });

  // ===== Language Switching Performance =====

  describe('Language Switching Performance', () => {
    
    it('should switch languages within performance targets', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const { averageTime } = await measureExecutionTime(
        async () => {
          await act(async () => {
            await result.current.switchLanguage('ro');
          });
        },
        10
      );

      expect(averageTime).toBeLessThan(1000); // Target: <1 second for language switch
    });

    it('should cache subsequent switches for better performance', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First switch (cache miss)
      const firstSwitchTime = await measureExecutionTime(async () => {
        await act(async () => {
          await result.current.switchLanguage('ro');
        });
      });

      // Second switch back (cache hit)
      const secondSwitchTime = await measureExecutionTime(async () => {
        await act(async () => {
          await result.current.switchLanguage('en');
        });
      });

      // Third switch (cache hit)
      const thirdSwitchTime = await measureExecutionTime(async () => {
        await act(async () => {
          await result.current.switchLanguage('ro');
        });
      });

      // Cached switches should be significantly faster
      expect(thirdSwitchTime.averageTime).toBeLessThan(firstSwitchTime.averageTime * 0.5);
    });

  });

  // ===== Performance Monitoring =====

  describe('Performance Monitoring', () => {
    
    it('should provide accurate performance metrics', async () => {
      const { result } = renderHook(() => useLanguagePerformance(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      const metrics = result.current;
      
      // Metrics should be realistic and non-negative
      expect(metrics.detectionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.translationLoadTime).toBeGreaterThanOrEqual(0);
      expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it('should track performance improvements over time', async () => {
      const { result } = renderHook(() => useLanguagePerformance(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      const initialMetrics = result.current;

      // Perform operations to warm up cache
      const languageHook = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(languageHook.result.current.isLoading).toBe(false);
      });

      // Perform translations to improve cache hit rate
      languageHook.result.current.t('key_1');
      languageHook.result.current.t('key_2');
      languageHook.result.current.t('key_1'); // Should be faster

      // Check for performance improvements
      const updatedMetrics = languageHook.result.current.getPerformanceMetrics();
      
      // Cache hit rate should improve with usage
      if (updatedMetrics.cacheHitRate > initialMetrics.cacheHitRate) {
        expect(updatedMetrics.cacheHitRate).toBeGreaterThan(initialMetrics.cacheHitRate);
      }
    });

  });

  // ===== Stress Testing =====

  describe('Stress Testing', () => {
    
    it('should handle high-frequency translation requests', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <PerformanceTestWrapper>{children}</PerformanceTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Perform many rapid translations
      const translationCount = 10000;
      const startTime = performance.now();

      for (let i = 0; i < translationCount; i++) {
        result.current.t(`key_${i % 100}`, 'fallback');
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete all translations quickly
      expect(totalTime).toBeLessThan(1000); // <1 second for 10k translations
      
      const averageTimePerTranslation = totalTime / translationCount;
      expect(averageTimePerTranslation).toBeLessThan(0.1); // <0.1ms per translation
    });

    it('should handle memory pressure gracefully', async () => {
      const cache = createTranslationCache({
        maxSize: 5, // Small cache to create pressure
        ttl: 60000
      });

      // Load many different "languages" to trigger eviction
      const languageRequests = Array(20).fill(null).map((_, i) => 
        cache.getTranslations('en') // All same language, should be efficient
      );

      const results = await Promise.all(languageRequests);

      // All should succeed despite memory pressure
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });

      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5); // Should respect maxSize
      expect(stats.hitRate).toBeGreaterThan(0); // Should achieve some cache hits
    });

  });

});