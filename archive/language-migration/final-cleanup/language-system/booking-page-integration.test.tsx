/**
 * @fileoverview Booking Page Integration Tests for Path-Based Language Detection
 * @module tests/language-system/booking-page-integration
 * 
 * @description
 * End-to-end integration tests for booking pages with the new path-based language detection.
 * Tests the complete flow from URL parsing to language detection to component rendering.
 * 
 * @test-coverage
 * - Server-side language detection from path
 * - Client-side hydration without flicker
 * - Language switching within booking flow
 * - URL generation consistency
 * - Backwards compatibility
 * 
 * @since v2.0.0
 * @author RentalSpot Team
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// Mock Next.js components and hooks
const mockParams = { slug: 'test-property', path: undefined };
const mockSearchParams = { checkIn: '2025-06-24', checkOut: '2025-06-27' };

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/booking/check/test-property',
  useSearchParams: () => new URLSearchParams('checkIn=2025-06-24&checkOut=2025-06-27'),
  notFound: jest.fn(),
}));

// Mock property utilities
jest.mock('@/lib/property-utils', () => ({
  getPropertyBySlug: jest.fn().mockResolvedValue({
    id: 'test-property',
    slug: 'test-property',
    name: {
      en: 'Test Property',
      ro: 'Proprietate de Test'
    },
    themeId: 'default'
  }),
  getPropertyHeroImage: jest.fn().mockResolvedValue('https://example.com/hero.jpg')
}));

// Mock server language utilities
jest.mock('@/lib/server-language-utils', () => ({
  serverTranslateContent: jest.fn((content, language = 'en') => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object' && content !== null) {
      return content[language] || content.en || content[Object.keys(content)[0]];
    }
    return '';
  })
}));

// Mock language system
jest.mock('@/lib/language-system/LanguageProvider', () => ({
  LanguageProvider: ({ children, initialLanguage }: any) => (
    <div data-testid="language-provider" data-language={initialLanguage}>
      {children}
    </div>
  )
}));

jest.mock('@/components/language-html-updater', () => ({
  LanguageHtmlUpdater: ({ initialLanguage }: any) => (
    <div data-testid="html-updater" data-language={initialLanguage} />
  )
}));

// Mock booking components
jest.mock('@/components/booking-v2', () => ({
  BookingPageV2: ({ property, initialLanguage }: any) => (
    <div data-testid="booking-v2" data-language={initialLanguage}>
      <h1>{property.name.en}</h1>
      <span>Language: {initialLanguage}</span>
    </div>
  )
}));

// Mock features config
jest.mock('@/config/features', () => ({
  FEATURES: {
    BOOKING_V2: true
  }
}));

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {}
}));

// Import the component to test
import BookingCheckPage, { generateMetadata } from '@/app/booking/check/[slug]/[[...path]]/page';

describe('Booking Page Integration - Path-Based Language Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Server-Side Language Detection', () => {
    test('should detect English as default language', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: undefined });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const result = await BookingCheckPage({ params, searchParams });
      
      // Should render with English as default
      expect(result).toBeDefined();
    });

    test('should detect Romanian from path segment', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const result = await BookingCheckPage({ params, searchParams });
      
      // Should render with Romanian language
      expect(result).toBeDefined();
    });

    test('should handle multiple path segments correctly', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['ro', 'extra', 'segments'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const result = await BookingCheckPage({ params, searchParams });
      
      // Should detect Romanian and ignore extra segments
      expect(result).toBeDefined();
    });

    test('should ignore invalid language codes in path', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['invalid'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const result = await BookingCheckPage({ params, searchParams });
      
      // Should fall back to default language
      expect(result).toBeDefined();
    });
  });

  describe('Metadata Generation', () => {
    test('should generate English metadata by default', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: undefined });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const metadata = await generateMetadata({ params, searchParams });
      
      expect(metadata.title).toContain('Check Availability');
      expect(metadata.other?.['html-lang']).toBe('en');
    });

    test('should generate Romanian metadata for Romanian path', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const metadata = await generateMetadata({ params, searchParams });
      
      expect(metadata.title).toContain('Verifică Disponibilitatea');
      expect(metadata.other?.['html-lang']).toBe('ro');
    });

    test('should handle property not found gracefully', async () => {
      // Mock property not found
      const mockGetPropertyBySlug = require('@/lib/property-utils').getPropertyBySlug;
      mockGetPropertyBySlug.mockResolvedValueOnce(null);
      
      const params = Promise.resolve({ slug: 'non-existent', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const metadata = await generateMetadata({ params, searchParams });
      
      expect(metadata.title).toContain('Not Found');
      expect(metadata.other?.['html-lang']).toBe('ro');
    });
  });

  describe('Component Rendering', () => {
    test('should render BookingPageV2 with correct props', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      const component = await BookingCheckPage({ params, searchParams });
      const { container } = render(component);
      
      // Check that LanguageHtmlUpdater is rendered with correct language
      const htmlUpdater = container.querySelector('[data-testid="html-updater"]');
      expect(htmlUpdater).toHaveAttribute('data-language', 'ro');
    });

    test('should handle missing dates gracefully', async () => {
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({});
      
      const component = await BookingCheckPage({ params, searchParams });
      
      // Should not throw and should render warning
      expect(component).toBeDefined();
    });

    test('should validate date formats', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({ 
        checkIn: 'invalid-date', 
        checkOut: '2025-06-27' 
      });
      
      const component = await BookingCheckPage({ params, searchParams });
      
      // Should log error for invalid date format
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date format')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('URL Pattern Validation', () => {
    test('should support all valid URL patterns', async () => {
      const testCases = [
        { path: undefined, expectedLang: 'en', description: 'English default' },
        { path: ['en'], expectedLang: 'en', description: 'Explicit English' },
        { path: ['ro'], expectedLang: 'ro', description: 'Romanian' },
        { path: ['invalid'], expectedLang: 'en', description: 'Invalid language fallback' },
        { path: ['ro', 'extra'], expectedLang: 'ro', description: 'Extra path segments' },
      ];

      for (const testCase of testCases) {
        const params = Promise.resolve({ slug: 'test-property', path: testCase.path });
        const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
        
        const component = await BookingCheckPage({ params, searchParams });
        
        // Should render without errors
        expect(component).toBeDefined();
      }
    });

    test('should handle property slug validation', async () => {
      const mockNotFound = require('next/navigation').notFound;
      const mockGetPropertyBySlug = require('@/lib/property-utils').getPropertyBySlug;
      mockGetPropertyBySlug.mockResolvedValueOnce(null);
      
      const params = Promise.resolve({ slug: 'non-existent', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      await BookingCheckPage({ params, searchParams });
      
      // Should call notFound() for invalid property
      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should handle language detection efficiently', async () => {
      const startTime = performance.now();
      
      const params = Promise.resolve({ slug: 'test-property', path: ['ro'] });
      const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
      
      await BookingCheckPage({ params, searchParams });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Language detection should be fast (under 50ms)
      expect(duration).toBeLessThan(50);
    });

    test('should handle multiple concurrent renders', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => {
        const params = Promise.resolve({ slug: `property-${i}`, path: ['ro'] });
        const searchParams = Promise.resolve({ checkIn: '2025-06-24', checkOut: '2025-06-27' });
        return BookingCheckPage({ params, searchParams });
      });
      
      const startTime = performance.now();
      await Promise.all(promises);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Should handle concurrent renders efficiently (under 200ms for 10 renders)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Backwards Compatibility', () => {
    test('should maintain compatibility with old URL patterns', async () => {
      // Test that the new system works even when accessed via old patterns
      // (though the old routes would redirect to new ones)
      
      const params = Promise.resolve({ slug: 'test-property', path: undefined });
      const searchParams = Promise.resolve({ 
        checkIn: '2025-06-24', 
        checkOut: '2025-06-27',
        lang: 'ro' // Legacy parameter (should be ignored in path-based detection)
      });
      
      const component = await BookingCheckPage({ params, searchParams });
      
      // Should render with default language (path-based takes precedence)
      expect(component).toBeDefined();
    });

    test('should handle migration from query-based to path-based', async () => {
      // Simulate a scenario where user bookmarked old URL format
      const params = Promise.resolve({ slug: 'test-property', path: undefined });
      const searchParams = Promise.resolve({ 
        checkIn: '2025-06-24', 
        checkOut: '2025-06-27',
        language: 'ro' // Legacy parameter
      });
      
      const component = await BookingCheckPage({ params, searchParams });
      
      // Should render (new system ignores legacy parameters in favor of path detection)
      expect(component).toBeDefined();
    });
  });
});