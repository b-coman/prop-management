/**
 * @fileoverview Comprehensive Test Suite for Unified Language System
 * @module language-migration/tests/unified-system
 * 
 * @description
 * Complete test coverage for the unified language system including all migration modes,
 * error conditions, performance edge cases, and backwards compatibility verification.
 * Tests all components, hooks, and services with proper mocking and isolation.
 * 
 * @architecture
 * Location: Migration testing infrastructure
 * Layer: Integration and unit testing
 * Pattern: Jest test suite with React Testing Library and comprehensive mocking
 * 
 * @dependencies
 * - Internal: @/lib/language-system, @/lib/logger
 * - External: Jest, React Testing Library, React
 * - Testing: Jest mocks, fake timers, performance mocking
 * 
 * @relationships
 * - Provides: Comprehensive test coverage for language system
 * - Consumes: All unified language system modules
 * - Children: Individual test cases and suites
 * - Parent: Language migration testing infrastructure
 * 
 * @performance
 * - Optimizations: Mocked external dependencies, efficient test isolation
 * - Concerns: Test execution time with large test suites
 * 
 * @example
 * ```bash
 * # Run all unified system tests
 * npm test language-migration/tests/unified-system.test.ts
 * 
 * # Run with coverage
 * npm test -- --coverage language-migration/tests/unified-system.test.ts
 * 
 * # Run specific test suite
 * npm test -- --testNamePattern="LanguageProvider"
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 language system migration. Provides comprehensive testing
 * to ensure new unified system works correctly in all migration modes and
 * maintains backwards compatibility with existing functionality.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { 
  LanguageProvider, 
  useLanguage, 
  useTranslation,
  useLanguageSwitcher,
  detectLanguage,
  loadTranslations,
  TranslationCache,
  type SupportedLanguage,
  type MigrationMode
} from '@/lib/language-system';
import { loggers } from '@/lib/logger';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    languageSystem: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  }
}));

// Mock fetch for translation loading
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now())
  }
});

// Test data
const mockTranslations = {
  en: {
    'welcome': 'Welcome',
    'page.title': 'Test Page',
    'navigation.home': 'Home',
    'nested.deep.value': 'Deep Value'
  },
  ro: {
    'welcome': 'Bun venit',
    'page.title': 'Pagina de Test',
    'navigation.home': 'Acasă',
    'nested.deep.value': 'Valoare Adâncă'
  }
};

const mockMultilingualContent = {
  en: 'English content',
  ro: 'Conținut română'
};

// Test wrapper component
function TestWrapper({ 
  children, 
  initialLanguage = 'en' as SupportedLanguage,
  pageType = 'general' as any
}) {
  return (
    <LanguageProvider 
      initialLanguage={initialLanguage}
      pageType={pageType}
      enablePerformanceTracking={true}
    >
      {children}
    </LanguageProvider>
  );
}

// Test component for hook testing
function TestComponent() {
  const { currentLang, t, tc, switchLanguage, isLoading } = useLanguage();
  
  return (
    <div>
      <span data-testid="current-lang">{currentLang}</span>
      <span data-testid="translation">{t('welcome', 'Default Welcome')}</span>
      <span data-testid="content-translation">{tc(mockMultilingualContent)}</span>
      <span data-testid="loading">{isLoading ? 'loading' : 'ready'}</span>
      <button 
        data-testid="switch-button"
        onClick={() => switchLanguage('ro')}
      >
        Switch Language
      </button>
    </div>
  );
}

describe('Unified Language System', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Mock Next.js hooks
    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: jest.fn()
    });
    (usePathname as jest.Mock).mockReturnValue('/test-page');
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    
    // Mock successful fetch responses
    mockFetch.mockImplementation((url: string) => {
      const lang = url.includes('/ro.json') ? 'ro' : 'en';
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTranslations[lang])
      });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('LanguageProvider', () => {
    test('provides default language context', async () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });
    });

    test('loads translations on mount', async () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/locales/en.json');
        expect(screen.getByTestId('translation')).toHaveTextContent('Welcome');
      });
    });

    test('handles translation loading errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(loggers.languageSystem.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to load translations'),
          expect.any(Object)
        );
      });
    });

    test('provides SSR-safe initialization', () => {
      // Mock SSR environment
      Object.defineProperty(window, 'window', {
        value: undefined,
        configurable: true
      });

      const { container } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(container).toBeInTheDocument();
      
      // Restore window
      Object.defineProperty(window, 'window', {
        value: window,
        configurable: true
      });
    });

    test('handles different page types correctly', async () => {
      (usePathname as jest.Mock).mockReturnValue('/properties/test-property/ro');

      render(
        <TestWrapper pageType="property">
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });
    });

    test('supports performance tracking', async () => {
      const performanceSpy = jest.spyOn(window.performance, 'now');
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(performanceSpy).toHaveBeenCalled();
      });
    });
  });

  describe('useLanguage Hook', () => {
    test('throws error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');
      
      consoleSpy.mockRestore();
    });

    test('provides all expected properties', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current).toHaveProperty('currentLang');
        expect(result.current).toHaveProperty('t');
        expect(result.current).toHaveProperty('tc');
        expect(result.current).toHaveProperty('switchLanguage');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('performanceMetrics');
        expect(result.current).toHaveProperty('debugInfo');
      });
    });

    test('translation function works correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.t('welcome')).toBe('Welcome');
        expect(result.current.t('nonexistent', 'fallback')).toBe('fallback');
        expect(result.current.t('nonexistent')).toBe('nonexistent');
      });
    });

    test('content translation function works correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.tc(mockMultilingualContent)).toBe('English content');
        expect(result.current.tc('string content')).toBe('string content');
        expect(result.current.tc(null, 'fallback')).toBe('fallback');
      });
    });

    test('language switching works correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchLanguage('ro');
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('ro');
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/locales/ro.json');
      });
    });

    test('handles invalid language switching gracefully', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.switchLanguage('invalid' as SupportedLanguage);
      });

      // Should remain on current language
      expect(result.current.currentLang).toBe('en');
    });

    test('performance utilities work correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const metrics = result.current.getPerformanceMetrics();
      expect(metrics).toHaveProperty('detectionTime');
      expect(metrics).toHaveProperty('renderTime');

      expect(result.current.isLanguageSupported('en')).toBe(true);
      expect(result.current.isLanguageSupported('invalid')).toBe(false);

      const languages = result.current.getAvailableLanguages();
      expect(languages).toContain('en');
      expect(languages).toContain('ro');
    });
  });

  describe('Specialized Hooks', () => {
    test('useTranslation provides translation-only access', async () => {
      const { result } = renderHook(() => useTranslation(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current).toHaveProperty('t');
        expect(result.current).toHaveProperty('tc');
        expect(result.current).toHaveProperty('currentLang');
        expect(result.current).not.toHaveProperty('switchLanguage');
      });
    });

    test('useLanguageSwitcher provides switching-only access', async () => {
      const { result } = renderHook(() => useLanguageSwitcher(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current).toHaveProperty('currentLang');
        expect(result.current).toHaveProperty('switchLanguage');
        expect(result.current).toHaveProperty('supportedLanguages');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).not.toHaveProperty('t');
      });
    });
  });

  describe('Language Detection', () => {
    test('detects language from URL path', async () => {
      const result = await detectLanguage({
        pathname: '/properties/test/ro',
        pageType: 'property'
      });

      expect(result.language).toBe('ro');
      expect(result.source).toBe('url-path');
      expect(result.confidence).toBe(1.0);
    });

    test('detects language from query parameters', async () => {
      const searchParams = new URLSearchParams('?language=ro');
      
      const result = await detectLanguage({
        pathname: '/booking/check',
        searchParams,
        pageType: 'booking'
      });

      expect(result.language).toBe('ro');
      expect(result.source).toBe('url-query');
    });

    test('detects language from localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue('ro');

      const result = await detectLanguage({
        pathname: '/test',
        pageType: 'general'
      });

      expect(result.language).toBe('ro');
      expect(result.source).toBe('localStorage');
    });

    test('falls back to default language', async () => {
      const result = await detectLanguage({
        pathname: '/test',
        pageType: 'general'
      });

      expect(result.language).toBe('en');
      expect(result.source).toBe('default');
    });

    test('handles detection errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = await detectLanguage({
        pathname: '/test',
        pageType: 'general'
      });

      expect(result.language).toBe('en');
      expect(loggers.languageSystem.warn).toHaveBeenCalled();
    });
  });

  describe('Translation Cache', () => {
    test('caches translations correctly', async () => {
      const cache = new TranslationCache();
      
      const result1 = await cache.getTranslations('en');
      const result2 = await cache.getTranslations('en');

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('handles cache size limits', async () => {
      const cache = new TranslationCache({ maxSize: 1 });
      
      await cache.getTranslations('en');
      await cache.getTranslations('ro');

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });

    test('handles translation load timeouts', async () => {
      const cache = new TranslationCache({ loadTimeout: 100 });
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      const result = await cache.getTranslations('en');
      expect(result.content).toEqual({});
    });

    test('preloads critical translations', async () => {
      const cache = new TranslationCache({ 
        enablePreloading: true,
        preloadLanguages: ['en', 'ro']
      });

      await cache.preloadCritical(['en', 'ro']);

      // Both languages should be cached
      const enResult = await cache.getTranslations('en');
      const roResult = await cache.getTranslations('ro');

      expect(enResult.fromCache).toBe(true);
      expect(roResult.fromCache).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('complete language switching workflow', async () => {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
        expect(screen.getByTestId('translation')).toHaveTextContent('Welcome');
      });

      // Switch language
      fireEvent.click(screen.getByTestId('switch-button'));

      // Wait for language switch
      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
        expect(screen.getByTestId('translation')).toHaveTextContent('Bun venit');
      });

      // Verify localStorage was updated
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('preferredLanguage', 'ro');
    });

    test('handles property page URL updates', async () => {
      const mockPush = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
      (usePathname as jest.Mock).mockReturnValue('/properties/test-property/en');

      render(
        <TestWrapper pageType="property">
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      fireEvent.click(screen.getByTestId('switch-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/properties/test-property/ro');
      });
    });

    test('handles booking page query parameter updates', async () => {
      const mockPush = jest.fn();
      (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
      (usePathname as jest.Mock).mockReturnValue('/booking/check');

      // Mock window.location for URL construction
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost/booking/check?property=test'
        },
        configurable: true
      });

      render(
        <TestWrapper pageType="booking">
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
      });

      fireEvent.click(screen.getByTestId('switch-button'));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('language=ro')
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready');
        expect(loggers.languageSystem.error).toHaveBeenCalled();
      });
    });

    test('handles malformed translation files', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(loggers.languageSystem.error).toHaveBeenCalled();
      });
    });

    test('recovers from localStorage errors', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Migration Mode Support', () => {
    test('supports different migration modes', () => {
      // Test legacy mode
      process.env.LANGUAGE_SYSTEM_MODE = 'legacy';
      const { container: legacyContainer } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      expect(legacyContainer).toBeInTheDocument();

      // Test unified mode
      process.env.LANGUAGE_SYSTEM_MODE = 'unified';
      const { container: unifiedContainer } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      expect(unifiedContainer).toBeInTheDocument();

      // Cleanup
      delete process.env.LANGUAGE_SYSTEM_MODE;
    });
  });

  describe('Performance Tests', () => {
    test('measures translation performance', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const metrics = result.current.getPerformanceMetrics();
      expect(typeof metrics.detectionTime).toBe('number');
      expect(typeof metrics.renderTime).toBe('number');
    });

    test('warns about slow translations in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      // Mock slow performance
      (window.performance.now as jest.Mock)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(50); // 50ms translation time

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      result.current.t('welcome');

      expect(loggers.languageSystem.warn).toHaveBeenCalledWith(
        'Slow translation detected',
        expect.any(Object)
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});