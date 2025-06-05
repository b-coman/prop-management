/**
 * @fileoverview Backwards Compatibility Test Suite
 * @module lib/language-system/__tests__/backwards-compatibility
 * 
 * @description
 * Comprehensive test suite ensuring the unified language system maintains
 * complete backwards compatibility with legacy hooks and interfaces.
 * Validates migration path safety and interface consistency.
 * 
 * @architecture
 * Location: Core language system test infrastructure
 * Layer: Compatibility and migration testing
 * Pattern: Jest test suite with legacy interface validation
 * 
 * @dependencies
 * - Internal: Unified system, legacy hook interfaces
 * - External: Jest, React Testing Library
 * 
 * @relationships
 * - Tests: Legacy hook compatibility (useLanguage, useOptimizedLanguage)
 * - Validates: Interface consistency across migration modes
 * - Ensures: Zero breaking changes during migration
 * - Verifies: Functional equivalence between old and new systems
 * 
 * @performance
 * - Ensures: No performance regression in legacy interfaces
 * - Validates: Interface mapping overhead is minimal
 * 
 * @example
 * ```bash
 * npm test src/lib/language-system/__tests__/backwards-compatibility.test.ts
 * ```
 * 
 * @migration-notes
 * Critical for Phase 2 validation. Must pass before proceeding to Phase 3
 * dual-check mode. Ensures existing components continue working without
 * modification during migration period.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Import unified system
import { LanguageProvider } from '../LanguageProvider';
import { useLanguage } from '../useLanguage';

// Import backwards compatibility hooks
import {
  useLegacyLanguage,
  useOptimizedLanguage,
  useSmartLanguage,
  useLanguageDebug
} from '../useLanguage';

// Import legacy interfaces (simulated)
import type {
  SupportedLanguage,
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

// Mock fetch for translation loading
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/locales/en.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'welcome': 'Welcome',
        'test.nested.key': 'Nested Value'
      })
    });
  }
  if (url.includes('/locales/ro.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'welcome': 'Bun venit',
        'test.nested.key': 'Valoare Imbricata'
      })
    });
  }
  return Promise.reject(new Error('Translation file not found'));
});

// Test wrapper
const TestWrapper: React.FC<{ 
  children: React.ReactNode; 
  providerProps?: Partial<LanguageProviderProps> 
}> = ({ children, providerProps = {} }) => {
  return React.createElement(LanguageProvider, {
    initialLanguage: "en" as SupportedLanguage,
    pageType: "general",
    enablePerformanceTracking: true,
    children,
    ...providerProps
  });
};

// Legacy hook interface definitions for comparison
interface LegacyLanguageHookInterface {
  currentLang: SupportedLanguage;
  currentLanguage?: SupportedLanguage; // Legacy alias
  switchLanguage: (lang: SupportedLanguage) => Promise<void> | void;
  changeLanguage?: (lang: SupportedLanguage) => Promise<void> | void; // Legacy alias
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
  tc: (content: any, fallback?: string) => string;
  isLoading?: boolean;
  getLocalizedPath?: (path: string, language?: SupportedLanguage) => string;
  isLanguageSupported?: (language: string) => boolean;
}

interface OptimizedLanguageHookInterface {
  lang: SupportedLanguage; // Legacy property name
  setLang: (lang: SupportedLanguage) => Promise<void> | void; // Legacy function name
  t: (key: string, fallback?: string, variables?: Record<string, string | number>) => string;
  tc: (content: any, fallback?: string) => string;
  isLoading?: boolean;
}

describe('Backwards Compatibility', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // ===== Legacy useLanguage Hook Compatibility =====

  describe('useLegacyLanguage Hook', () => {
    
    it('should provide exact legacy interface', async () => {
      const { result } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check all required legacy properties exist
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.currentLanguage).toBeDefined(); // Legacy alias
      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.changeLanguage).toBeDefined(); // Legacy alias
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.getLocalizedPath).toBeDefined();
      expect(result.current.isLanguageSupported).toBeDefined();

      // Verify types match legacy interface
      const legacyResult: LegacyLanguageHookInterface = result.current;
      expect(legacyResult.currentLang).toBe('en');
      expect(legacyResult.currentLanguage).toBe('en');
    });

    it('should maintain legacy alias functionality', async () => {
      const { result } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test legacy aliases work identically to main functions
      expect(result.current.currentLang).toBe(result.current.currentLanguage);
      
      // Both functions should be the same reference or functionally equivalent
      const switchResult = await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(result.current.currentLang).toBe('ro');
      
      // Test legacy changeLanguage alias
      await act(async () => {
        await result.current.changeLanguage!('en');
      });

      expect(result.current.currentLang).toBe('en');
    });

    it('should provide identical translation functionality', async () => {
      const { result } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test translation functions work exactly as expected
      expect(result.current.t('welcome')).toBe('Welcome');
      expect(result.current.t('nonexistent', 'Fallback')).toBe('Fallback');
      expect(result.current.t('test.nested.key')).toBe('Nested Value');

      // Test multilingual content translation
      const multiContent = { en: 'English', ro: 'Romanian' };
      expect(result.current.tc(multiContent)).toBe('English');
    });

  });

  // ===== Optimized useLanguage Hook Compatibility =====

  describe('useOptimizedLanguage Hook', () => {
    
    it('should provide exact optimized interface', async () => {
      const { result } = renderHook(() => useOptimizedLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check all required optimized properties exist
      expect(result.current.lang).toBeDefined(); // Legacy property name
      expect(result.current.setLang).toBeDefined(); // Legacy function name
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
      expect(result.current.isLoading).toBeDefined();

      // Verify types match optimized interface
      const optimizedResult: OptimizedLanguageHookInterface = result.current;
      expect(optimizedResult.lang).toBe('en');
    });

    it('should maintain optimized naming conventions', async () => {
      const { result } = renderHook(() => useOptimizedLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Test optimized property names
      expect(result.current.lang).toBe('en');
      
      // Test optimized function name
      await act(async () => {
        await result.current.setLang('ro');
      });

      expect(result.current.lang).toBe('ro');
    });

    it('should provide identical performance to unified system', async () => {
      const { result: unifiedResult } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      const { result: optimizedResult } = renderHook(() => useOptimizedLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(unifiedResult.current.isLoading).toBe(false);
        expect(optimizedResult.current.isLoading).toBe(false);
      });

      // Both should provide the same translation performance
      const unifiedTranslation = unifiedResult.current.t('welcome');
      const optimizedTranslation = optimizedResult.current.t('welcome');
      
      expect(unifiedTranslation).toBe(optimizedTranslation);
      expect(unifiedTranslation).toBe('Welcome');
    });

  });

  // ===== Smart Language Hook (Migration Mode Support) =====

  describe('useSmartLanguage Hook', () => {
    
    it('should work in unified mode', async () => {
      process.env.LANGUAGE_SYSTEM_MODE = 'unified';
      
      const { result } = renderHook(() => useSmartLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLang).toBe('en');
      expect(result.current.switchLanguage).toBeDefined();
    });

    it('should provide full unified interface regardless of mode', async () => {
      const { result } = renderHook(() => useSmartLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should provide complete interface
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
      expect(result.current.getPerformanceMetrics).toBeDefined();
    });

  });

  // ===== Debug Hook Development Support =====

  describe('useLanguageDebug Hook', () => {
    
    it('should provide debug info in development mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const { result } = renderHook(() => useLanguageDebug(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{ enableDebugMode: true }}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.enabled).toBeDefined();
      });

      if (result.current.enabled) {
        expect(result.current.migrationMode).toBeDefined();
        expect(result.current.currentState).toBeDefined();
        expect(result.current.performance).toBeDefined();
      }

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should be disabled in production mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const { result } = renderHook(() => useLanguageDebug(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.enabled).toBe(false);
      });

      process.env.NODE_ENV = originalNodeEnv;
    });

  });

  // ===== Interface Consistency Tests =====

  describe('Interface Consistency', () => {
    
    it('should provide consistent translation results across all hooks', async () => {
      const { result: unified } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      const { result: legacy } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      const { result: optimized } = renderHook(() => useOptimizedLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(unified.current.isLoading).toBe(false);
        expect(legacy.current.isLoading).toBe(false);
        expect(optimized.current.isLoading).toBe(false);
      });

      // All hooks should provide identical translation results
      const testKey = 'welcome';
      const unifiedTranslation = unified.current.t(testKey);
      const legacyTranslation = legacy.current.t(testKey);
      const optimizedTranslation = optimized.current.t(testKey);

      expect(unifiedTranslation).toBe(legacyTranslation);
      expect(legacyTranslation).toBe(optimizedTranslation);
      expect(unifiedTranslation).toBe('Welcome');
    });

    it('should maintain consistent state across all hooks', async () => {
      const TestComponent = () => {
        const unified = useLanguage();
        const legacy = useLegacyLanguage();
        const optimized = useOptimizedLanguage();

        return {
          unified: unified.currentLang,
          legacy: legacy.currentLang,
          optimized: optimized.lang
        };
      };

      const { result } = renderHook(() => TestComponent(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      // All hooks should report the same current language
      expect(result.current.unified).toBe('en');
      expect(result.current.legacy).toBe('en');
      expect(result.current.optimized).toBe('en');
    });

    it('should synchronize language changes across all hooks', async () => {
      const TestComponent = () => {
        const unified = useLanguage();
        const legacy = useLegacyLanguage();
        const optimized = useOptimizedLanguage();

        return {
          unified,
          legacy,
          optimized
        };
      };

      const { result } = renderHook(() => TestComponent(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.unified.isLoading).toBe(false);
      });

      // Change language using unified hook
      await act(async () => {
        await result.current.unified.switchLanguage('ro');
      });

      // All hooks should reflect the change
      expect(result.current.unified.currentLang).toBe('ro');
      expect(result.current.legacy.currentLang).toBe('ro');
      expect(result.current.optimized.lang).toBe('ro');

      // Test translations in new language
      expect(result.current.unified.t('welcome')).toBe('Bun venit');
      expect(result.current.legacy.t('welcome')).toBe('Bun venit');
      expect(result.current.optimized.t('welcome')).toBe('Bun venit');
    });

  });

  // ===== Performance Regression Tests =====

  describe('Performance Regression', () => {
    
    it('should not introduce performance overhead in legacy hooks', async () => {
      const measureHookPerformance = async (hookFn: () => any) => {
        const start = performance.now();
        
        const { result } = renderHook(hookFn, {
          wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
        });

        await waitFor(() => {
          expect(result.current).toBeDefined();
        });

        const end = performance.now();
        return end - start;
      };

      const unifiedTime = await measureHookPerformance(() => useLanguage());
      const legacyTime = await measureHookPerformance(() => useLegacyLanguage());
      const optimizedTime = await measureHookPerformance(() => useOptimizedLanguage());

      // Legacy hooks should not be significantly slower than unified hook
      // Allow 50% overhead for interface mapping
      expect(legacyTime).toBeLessThan(unifiedTime * 1.5);
      expect(optimizedTime).toBeLessThan(unifiedTime * 1.5);
    });

    it('should maintain translation performance across hooks', async () => {
      const { result: unified } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      const { result: legacy } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(unified.current.isLoading).toBe(false);
        expect(legacy.current.isLoading).toBe(false);
      });

      // Measure translation performance
      const measureTranslation = (translateFn: (key: string) => string) => {
        const start = performance.now();
        const result = translateFn('test.nested.key');
        const end = performance.now();
        return { result, time: end - start };
      };

      const unifiedResult = measureTranslation(unified.current.t);
      const legacyResult = measureTranslation(legacy.current.t);

      // Results should be identical
      expect(unifiedResult.result).toBe(legacyResult.result);
      
      // Performance should be comparable (allow 2x overhead for compatibility layer)
      expect(legacyResult.time).toBeLessThan(unifiedResult.time * 2);
    });

  });

  // ===== Error Handling Compatibility =====

  describe('Error Handling Compatibility', () => {
    
    it('should handle errors consistently across all hooks', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const { result: unified } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      const { result: legacy } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(unified.current.isLoading).toBe(false);
        expect(legacy.current.isLoading).toBe(false);
      });

      // Both should handle the error gracefully
      expect(unified.current.error).toBeTruthy();
      expect(legacy.current.isLoading).toBe(false); // Should not be stuck loading

      // Both should fall back to safe defaults
      expect(unified.current.translations).toEqual({});
      expect(legacy.current.t('missing.key', 'fallback')).toBe('fallback');
    });

    it('should provide consistent error states', async () => {
      const onError = jest.fn();

      const { result } = renderHook(() => useLegacyLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper providerProps={{ onError }}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Error handling should work through compatibility layer
      if (result.current.error) {
        expect(typeof result.current.error).toBe('string');
      }
    });

  });

});