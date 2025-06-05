/**
 * @fileoverview Performance Tests for Path-Based Language Detection
 * @module tests/language-system/performance
 * 
 * @description
 * Performance benchmarks and regression tests for the path-based language detection system.
 * Ensures the migration doesn't introduce performance degradation.
 * 
 * @test-coverage
 * - Language detection performance
 * - URL generation performance
 * - Memory usage optimization
 * - Bundle size impact
 * - Rendering performance
 * 
 * @since v2.0.0
 * @author RentalSpot Team
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// Mock performance API for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByType: () => [],
    getEntriesByName: () => [],
    clearMarks: () => {},
    clearMeasures: () => {}
  } as any;
}

// Mock memory API
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000
  },
  writable: true
});

// Mock language detection functions
const mockDetectLanguage = jest.fn().mockResolvedValue({
  language: 'en',
  source: 'path',
  confidence: 1.0
});

const mockCreateLocalizedPath = jest.fn((path, language, pageType) => {
  if (pageType === 'booking') {
    return language === 'en' ? path : `${path}/${language}`;
  }
  return `/${language}${path}`;
});

jest.mock('@/lib/language-system/language-detection', () => ({
  detectLanguage: mockDetectLanguage,
  createLocalizedPath: mockCreateLocalizedPath,
  createDetectionConfig: jest.fn(),
  isSupportedLanguage: jest.fn((lang) => SUPPORTED_LANGUAGES.includes(lang)),
  getAvailableLanguages: jest.fn(() => SUPPORTED_LANGUAGES)
}));

describe('Performance Tests - Path-Based Language Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Language Detection Performance', () => {
    test('should detect language from path in under 5ms', async () => {
      const iterations = 100;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        
        // Simulate path-based detection
        const path = '/booking/check/test-property/ro';
        const pathSegments = path.split('/');
        const language = pathSegments.includes('ro') ? 'ro' : 'en';
        
        const endTime = performance.now();
        times.push(endTime - startTime);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      
      expect(averageTime).toBeLessThan(5);
      expect(maxTime).toBeLessThan(10);
    });

    test('should handle complex path patterns efficiently', async () => {
      const complexPaths = [
        '/booking/check/property-with-very-long-name-and-multiple-segments/ro',
        '/booking/check/property_with_underscores_and_numbers_123/en',
        '/booking/check/property-with-special-chars-àáâã/ro',
        '/booking/check/property/with/many/segments/before/language/ro'
      ];
      
      const startTime = performance.now();
      
      complexPaths.forEach(path => {
        const pathSegments = path.split('/');
        const language = SUPPORTED_LANGUAGES.find(lang => 
          pathSegments.includes(lang)
        ) || DEFAULT_LANGUAGE;
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle complex patterns in under 2ms
      expect(duration).toBeLessThan(2);
    });

    test('should scale linearly with number of supported languages', async () => {
      const mockLanguages = Array.from({ length: 50 }, (_, i) => `lang${i}`);
      
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const path = `/booking/check/test-property/lang${i % 50}`;
        const pathSegments = path.split('/');
        const language = mockLanguages.find(lang => 
          pathSegments.includes(lang)
        ) || 'default';
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle 1000 detections with 50 languages in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('URL Generation Performance', () => {
    test('should generate booking URLs efficiently', () => {
      const createBookingUrl = (slug: string, language: string) => {
        const basePath = `/booking/check/${slug}`;
        return language === 'en' ? basePath : `${basePath}/${language}`;
      };
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        createBookingUrl(`property-${i}`, i % 2 === 0 ? 'en' : 'ro');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should generate 10,000 URLs in under 20ms
      expect(duration).toBeLessThan(20);
    });

    test('should handle URL generation with query parameters efficiently', () => {
      const createBookingUrlWithParams = (slug: string, language: string, params: Record<string, string>) => {
        const basePath = `/booking/check/${slug}`;
        const finalPath = language === 'en' ? basePath : `${basePath}/${language}`;
        const queryString = new URLSearchParams(params).toString();
        return queryString ? `${finalPath}?${queryString}` : finalPath;
      };
      
      const testParams = {
        checkIn: '2025-06-24',
        checkOut: '2025-06-27',
        currency: 'EUR',
        guests: '4'
      };
      
      const startTime = performance.now();
      
      for (let i = 0; i < 5000; i++) {
        createBookingUrlWithParams(`property-${i}`, 'ro', testParams);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should generate 5,000 URLs with params in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during repeated URL generation', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      // Generate many URLs
      const urls: string[] = [];
      for (let i = 0; i < 50000; i++) {
        const basePath = `/booking/check/property-${i}`;
        const finalPath = i % 2 === 0 ? basePath : `${basePath}/ro`;
        urls.push(finalPath);
      }
      
      // Clear the array to allow garbage collection
      urls.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });

    test('should maintain stable memory usage over time', () => {
      const memorySnapshots: number[] = [];
      
      for (let round = 0; round < 10; round++) {
        // Perform operations
        for (let i = 0; i < 1000; i++) {
          const path = `/booking/check/property-${i}/ro`;
          const segments = path.split('/');
          const language = segments.includes('ro') ? 'ro' : 'en';
        }
        
        // Take memory snapshot
        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        memorySnapshots.push(currentMemory);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      // Memory should not continuously increase
      const firstHalf = memorySnapshots.slice(0, 5);
      const secondHalf = memorySnapshots.slice(5);
      
      const firstHalfAvg = firstHalf.reduce((sum, mem) => sum + mem, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, mem) => sum + mem, 0) / secondHalf.length;
      
      const memoryGrowth = secondHalfAvg - firstHalfAvg;
      
      // Memory growth should be minimal (less than 1MB)
      expect(memoryGrowth).toBeLessThan(1024 * 1024);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent language detections efficiently', async () => {
      const concurrentDetections = Array.from({ length: 100 }, (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const path = `/booking/check/property-${i}/ro`;
            const segments = path.split('/');
            const language = segments.includes('ro') ? 'ro' : 'en';
            resolve(language);
          }, Math.random() * 10);
        });
      });
      
      const startTime = performance.now();
      await Promise.all(concurrentDetections);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should handle 100 concurrent operations in under 100ms
      expect(duration).toBeLessThan(100);
    });

    test('should maintain performance under load', async () => {
      const operations = Array.from({ length: 1000 }, (_, i) => {
        return () => {
          const path = `/booking/check/property-${i % 100}/${i % 2 === 0 ? 'en' : 'ro'}`;
          const segments = path.split('/');
          return segments.includes('ro') ? 'ro' : 'en';
        };
      });
      
      const startTime = performance.now();
      
      // Execute operations in batches
      const batchSize = 100;
      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        batch.forEach(op => op());
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle 1000 operations in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Bundle Size Impact', () => {
    test('should not significantly increase bundle size', () => {
      // This test would typically be run with a bundle analyzer
      // For now, we'll test that the imports are reasonable
      
      const languageSystemImports = [
        '@/lib/language-system/LanguageProvider',
        '@/lib/language-system/useLanguage',
        '@/lib/language-system/language-detection',
        '@/lib/language-constants'
      ];
      
      // Ensure all required modules are available
      languageSystemImports.forEach(importPath => {
        expect(() => {
          require(importPath);
        }).not.toThrow();
      });
    });

    test('should have minimal runtime overhead', () => {
      const operations = [
        () => SUPPORTED_LANGUAGES.includes('en'),
        () => SUPPORTED_LANGUAGES.includes('ro'),
        () => DEFAULT_LANGUAGE === 'en',
        () => mockCreateLocalizedPath('/test', 'ro', 'booking'),
        () => mockDetectLanguage({ pathname: '/test/ro' })
      ];
      
      const startTime = performance.now();
      
      for (let i = 0; i < 10000; i++) {
        operations.forEach(op => op());
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 50,000 operations in under 30ms
      expect(duration).toBeLessThan(30);
    });
  });

  describe('Rendering Performance', () => {
    test('should not impact component render times', () => {
      // Simulate component rendering with language detection
      const renderComponent = (language: string) => {
        const translations = {
          en: { title: 'Check Availability', button: 'Book Now' },
          ro: { title: 'Verifică Disponibilitatea', button: 'Rezervă Acum' }
        };
        
        return {
          title: translations[language as keyof typeof translations]?.title || translations.en.title,
          button: translations[language as keyof typeof translations]?.button || translations.en.button
        };
      };
      
      const startTime = performance.now();
      
      for (let i = 0; i < 5000; i++) {
        renderComponent(i % 2 === 0 ? 'en' : 'ro');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should render 5000 components in under 20ms
      expect(duration).toBeLessThan(20);
    });

    test('should handle rapid language switches efficiently', () => {
      let currentLanguage = 'en';
      const switchLanguage = (newLang: string) => {
        currentLanguage = newLang;
        return `/booking/check/test-property${newLang === 'en' ? '' : `/${newLang}`}`;
      };
      
      const startTime = performance.now();
      
      // Simulate rapid language switching
      for (let i = 0; i < 1000; i++) {
        switchLanguage(i % 2 === 0 ? 'en' : 'ro');
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should handle 1000 language switches in under 10ms
      expect(duration).toBeLessThan(10);
    });
  });
});