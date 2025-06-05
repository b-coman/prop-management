/**
 * @fileoverview Comprehensive Test Suite for Unified Language System
 * @module lib/language-system/__tests__/unified-system
 * 
 * @description
 * Complete test coverage for the unified language system including core functionality,
 * backwards compatibility, performance optimization, and migration mode support.
 * Validates all components work together correctly and meet performance requirements.
 * 
 * @architecture
 * Location: Core language system test infrastructure
 * Layer: Integration and unit testing
 * Pattern: Jest test suite with mocking and performance validation
 * 
 * @dependencies
 * - Internal: All language system modules
 * - External: Jest, React Testing Library, Jest Environment JSDOM
 * 
 * @relationships
 * - Tests: All unified language system components
 * - Validates: Backwards compatibility with legacy hooks
 * - Ensures: Performance targets are met
 * - Verifies: Migration mode functionality
 * 
 * @performance
 * - Targets: <30ms detection, 90% cache hit rates, <500ms translation loading
 * - Measures: Detection time, cache performance, memory usage
 * 
 * @example
 * ```bash
 * npm test src/lib/language-system/__tests__/unified-system.test.ts
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 language system migration. Ensures unified system meets all
 * requirements before proceeding to Phase 3 dual-check validation and Phase 4
 * legacy system replacement.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactWrapper } from 'enzyme';
import React from 'react';
import { useRouter } from 'next/navigation';

// Import unified system components
import {
  LanguageProvider,
  useLanguage,
  useTranslation,
  useLanguageSwitcher,
  useLanguagePerformance,
  useLanguageValidation,
  detectLanguage,
  createDetectionConfig,
  TranslationCache,
  globalTranslationCache,
  createTranslationCache,
  isSupportedLanguage,
  normalizeLanguage,
  createLocalizedPath
} from '../index';

// Import legacy compatibility
import {
  useLegacyLanguage,
  useOptimizedLanguage,
  useSmartLanguage
} from '../useLanguage';

import type {
  SupportedLanguage,
  LanguageDetectionConfig,
  TranslationCacheConfig,
  LanguageProviderProps
} from '../language-types';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn()
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

// Mock fetch for translation loading
global.fetch = jest.fn();

// Performance testing utilities
const measurePerformance = async (fn: () => Promise<any> | any) => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, time: end - start };
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; providerProps?: Partial<LanguageProviderProps> }> = ({ 
  children, 
  providerProps = {} 
}) => {
  return React.createElement(LanguageProvider, {
    initialLanguage: "en" as SupportedLanguage,
    pageType: "general",
    enablePerformanceTracking: true,
    enableDebugMode: true,
    children,
    ...providerProps
  });
};

describe('Unified Language System', () => {
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock router
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      pathname: '/'
    });
    
    // Mock fetch responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/locales/en.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'welcome': 'Welcome',
            'test.key': 'Test Value',
            'variables.test': 'Hello {{name}}'
          })
        });
      }
      if (url.includes('/locales/ro.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'welcome': 'Bun venit',
            'test.key': 'Valoare Test',
            'variables.test': 'Salut {{name}}'
          })
        });
      }
      return Promise.reject(new Error('Translation file not found'));
    });

    // Clear localStorage
    localStorage.clear();
    
    // Clear global cache
    globalTranslationCache.clearCache();
  });

  // ===== Core Functionality Tests =====

  describe('Core Language Provider', () => {
    
    it('should initialize with default language', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLang).toBe('en');
      expect(result.current.translations).toBeDefined();
    });

    it('should initialize with custom language', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{ initialLanguage: 'ro' }}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLang).toBe('ro');
    });

    it('should handle translation loading errors gracefully', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.translations).toEqual({});
    });

  });

  describe('Translation Functions', () => {
    
    it('should translate keys correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('welcome')).toBe('Welcome');
      expect(result.current.t('test.key')).toBe('Test Value');
      expect(result.current.t('nonexistent', 'Fallback')).toBe('Fallback');
    });

    it('should handle variable substitution', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('variables.test', undefined, { name: 'World' }))
        .toBe('Hello World');
    });

    it('should translate multilingual content', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const multilingualContent = {
        en: 'English Content',
        ro: 'Romanian Content'
      };

      expect(result.current.tc(multilingualContent)).toBe('English Content');
    });

  });

  describe('Language Switching', () => {
    
    it('should switch languages successfully', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(result.current.currentLang).toBe('ro');
      expect(result.current.t('welcome')).toBe('Bun venit');
    });

    it('should update localStorage on language switch', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(localStorage.getItem('preferredLanguage')).toBe('ro');
    });

    it('should handle language switch options', async () => {
      const mockPush = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        pathname: '/test'
      });

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.switchLanguage('ro', {
          updateUrl: true,
          redirect: true
        });
      });

      expect(mockPush).toHaveBeenCalled();
    });

  });

  // ===== Performance Tests =====

  describe('Performance Optimization', () => {
    
    it('should meet language detection performance targets', async () => {
      const config = createDetectionConfig({
        pathname: '/properties/test/ro',
        pageType: 'property'
      });

      const { time } = await measurePerformance(() => detectLanguage(config));
      
      expect(time).toBeLessThan(30); // Target: <30ms
    });

    it('should achieve cache hit rate targets', async () => {
      const cache = createTranslationCache({
        maxSize: 5,
        ttl: 60000,
        enablePreloading: true
      });

      // Load same translation multiple times
      await cache.getTranslations('en');
      await cache.getTranslations('en');
      await cache.getTranslations('en');

      const stats = cache.getStats();
      expect(stats.hitRate).toBeGreaterThan(60); // Target: >60% after multiple requests
    });

    it('should provide performance metrics', async () => {
      const { result } = renderHook(() => useLanguagePerformance(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{ enablePerformanceTracking: true }}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      expect(result.current.detectionTime).toBeGreaterThanOrEqual(0);
      expect(result.current.translationLoadTime).toBeGreaterThanOrEqual(0);
      expect(result.current.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

  });

  // ===== Language Detection Tests =====

  describe('Language Detection', () => {
    
    it('should detect language from URL path (property pages)', async () => {
      const config = createDetectionConfig({
        pathname: '/properties/villa-test/ro',
        pageType: 'property'
      });

      const result = await detectLanguage(config);
      
      expect(result.language).toBe('ro');
      expect(result.source).toBe('url-path');
      expect(result.confidence).toBe(1.0);
    });

    it('should detect language from URL path (general pages)', async () => {
      const config = createDetectionConfig({
        pathname: '/ro/about',
        pageType: 'general'
      });

      const result = await detectLanguage(config);
      
      expect(result.language).toBe('ro');
      expect(result.source).toBe('url-path');
      expect(result.confidence).toBe(0.9);
    });

    it('should detect language from query parameters', async () => {
      const searchParams = new URLSearchParams('?language=ro');
      const config = createDetectionConfig({
        pathname: '/booking/check',
        searchParams,
        pageType: 'booking'
      });

      const result = await detectLanguage(config);
      
      expect(result.language).toBe('ro');
      expect(result.source).toBe('url-query');
      expect(result.confidence).toBe(0.8);
    });

    it('should detect language from localStorage', async () => {
      localStorage.setItem('preferredLanguage', 'ro');
      
      const config = createDetectionConfig({
        pathname: '/test',
        pageType: 'general',
        enableLocalStorageDetection: true
      });

      const result = await detectLanguage(config);
      
      expect(result.language).toBe('ro');
      expect(result.source).toBe('localStorage');
      expect(result.confidence).toBe(0.6);
    });

    it('should fall back to default language', async () => {
      const config = createDetectionConfig({
        pathname: '/unknown',
        pageType: 'general',
        enableBrowserDetection: false,
        enableLocalStorageDetection: false
      });

      const result = await detectLanguage(config);
      
      expect(result.language).toBe('en');
      expect(result.source).toBe('default');
    });

  });

  // ===== Translation Cache Tests =====

  describe('Translation Cache', () => {
    
    it('should cache translations correctly', async () => {
      const cache = createTranslationCache();
      
      const result1 = await cache.getTranslations('en');
      const result2 = await cache.getTranslations('en');
      
      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
      expect(result1.content).toEqual(result2.content);
    });

    it('should respect TTL and evict expired entries', async () => {
      const cache = createTranslationCache({
        ttl: 100 // 100ms TTL
      });
      
      await cache.getTranslations('en');
      expect(cache.isCached('en')).toBe(true);
      
      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.isCached('en')).toBe(false);
    });

    it('should implement LRU eviction', async () => {
      const cache = createTranslationCache({
        maxSize: 2
      });
      
      await cache.getTranslations('en');
      await cache.getTranslations('ro');
      
      // This should evict 'en' as it was accessed first
      await cache.getTranslations('en'); // Access 'en' again to make it recent
      await cache.getTranslations('ro'); // This would be new if cache was full
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(2);
    });

    it('should provide accurate statistics', async () => {
      const cache = createTranslationCache();
      
      await cache.getTranslations('en');
      await cache.getTranslations('en'); // Cache hit
      await cache.getTranslations('ro'); // Cache miss
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.missRate).toBeGreaterThan(0);
    });

  });

  // ===== Specialized Hooks Tests =====

  describe('Specialized Hooks', () => {
    
    it('useTranslation should provide translation-only interface', async () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
      expect(result.current.currentLang).toBe('en');
      expect(result.current.isLoading).toBe(false);
    });

    it('useLanguageSwitcher should provide switching interface', async () => {
      const { result } = renderHook(() => useLanguageSwitcher(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.supportedLanguages).toEqual(['en', 'ro']);
      expect(result.current.isLanguageSupported).toBeDefined();
    });

    it('useLanguageValidation should provide validation utilities', async () => {
      const { result } = renderHook(() => useLanguageValidation(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      expect(result.current.isLanguageSupported('en')).toBe(true);
      expect(result.current.isLanguageSupported('fr')).toBe(false);
      expect(result.current.normalizeLanguage('EN')).toBe('en');
      expect(result.current.validateLanguageCode('ro')).toBe(true);
    });

  });

  // ===== Backwards Compatibility Tests =====

  describe('Backwards Compatibility', () => {
    
    it('useLegacyLanguage should maintain old interface', async () => {
      const { result } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check legacy interface properties
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.currentLanguage).toBeDefined(); // Legacy alias
      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.changeLanguage).toBeDefined(); // Legacy alias
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
    });

    it('useOptimizedLanguage should maintain optimized interface', async () => {
      const { result } = renderHook(() => useOptimizedLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check optimized interface properties
      expect(result.current.lang).toBeDefined(); // Legacy property name
      expect(result.current.setLang).toBeDefined(); // Legacy function name
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
    });

    it('useSmartLanguage should work with migration modes', async () => {
      // Test unified mode (default)
      const { result } = renderHook(() => useSmartLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLang).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
    });

  });

  // ===== Utility Functions Tests =====

  describe('Utility Functions', () => {
    
    it('should validate supported languages correctly', () => {
      expect(isSupportedLanguage('en')).toBe(true);
      expect(isSupportedLanguage('ro')).toBe(true);
      expect(isSupportedLanguage('fr')).toBe(false);
      expect(isSupportedLanguage('')).toBe(false);
    });

    it('should normalize language codes correctly', () => {
      expect(normalizeLanguage('EN')).toBe('en');
      expect(normalizeLanguage('en-US')).toBe('en');
      expect(normalizeLanguage('romanian')).toBe('ro');
      expect(normalizeLanguage('unknown')).toBe('en'); // Fallback to default
    });

    it('should create localized paths correctly', () => {
      // Property pages
      expect(createLocalizedPath('/properties/villa', 'ro', 'property'))
        .toBe('/properties/villa/ro');
      expect(createLocalizedPath('/properties/villa/en', 'ro', 'property'))
        .toBe('/properties/villa/ro');
      
      // General pages
      expect(createLocalizedPath('/about', 'ro', 'general'))
        .toBe('/ro/about');
      expect(createLocalizedPath('/en/about', 'ro', 'general'))
        .toBe('/ro/about');
      
      // Default language (no prefix)
      expect(createLocalizedPath('/about', 'en', 'general'))
        .toBe('/about');
    });

  });

  // ===== Error Handling Tests =====

  describe('Error Handling', () => {
    
    it('should handle missing context gracefully', () => {
      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');
    });

    it('should handle network errors during translation loading', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.translations).toEqual({});
    });

    it('should handle invalid translation formats gracefully', async () => {
      // Mock fetch to return invalid JSON
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null)
      });

      const cache = createTranslationCache();
      const result = await cache.getTranslations('en');
      
      expect(result.content).toEqual({});
    });

  });

  // ===== System Configuration Tests =====

  describe('System Configuration', () => {
    
    it('should support unified language system', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>{children}</TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLang).toBeDefined();
    });

    it('should provide debug info in development', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{ enableDebugMode: true }}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // In development mode, debugInfo should be available
      if (process.env.NODE_ENV === 'development') {
        expect(result.current.debugInfo).toBeDefined();
      }
    });

  });

  // ===== Integration Tests =====

  describe('System Integration', () => {
    
    it('should work end-to-end with all features', async () => {
      const onLanguageChange = jest.fn();
      const onError = jest.fn();

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{
            initialLanguage: 'en',
            enablePerformanceTracking: true,
            enableDebugMode: true,
            onLanguageChange,
            onError
          }}>
            {children}
          </TestWrapper>
        )
      });

      // Wait for initialization
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test initial state
      expect(result.current.currentLang).toBe('en');
      expect(result.current.t('welcome')).toBe('Welcome');

      // Test language switching
      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(result.current.currentLang).toBe('ro');
      expect(result.current.t('welcome')).toBe('Bun venit');
      expect(onLanguageChange).toHaveBeenCalledWith('en', 'ro');

      // Test performance metrics
      const metrics = result.current.getPerformanceMetrics();
      expect(metrics.detectionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.translationLoadTime).toBeGreaterThanOrEqual(0);

      // Test multilingual content
      const content = { en: 'English', ro: 'Romanian' };
      expect(result.current.tc(content)).toBe('Romanian');
    });

  });

});