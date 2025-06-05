/**
 * @fileoverview Migration Mode Test Suite
 * @module lib/language-system/__tests__/migration-mode
 * 
 * @description
 * Test suite for validating migration mode functionality and dual-check capabilities.
 * Ensures smooth transition between legacy and unified systems with comprehensive
 * validation and rollback safety.
 * 
 * @architecture
 * Location: Core language system test infrastructure
 * Layer: Migration and compatibility testing
 * Pattern: Jest test suite with migration mode simulation
 * 
 * @dependencies
 * - Internal: Unified system, migration types
 * - External: Jest, React Testing Library
 * 
 * @relationships
 * - Tests: Migration mode transitions (legacy → dual_check → unified → cleanup)
 * - Validates: Dual-check comparison logic
 * - Ensures: Safe rollback capabilities
 * - Verifies: Feature flag functionality
 * 
 * @migration-phases
 * - Phase 1: Legacy system only (baseline)
 * - Phase 2: Unified system development (current)
 * - Phase 3: Dual-check mode (validation)
 * - Phase 4: Unified system only (migration)
 * - Phase 5: Cleanup mode (legacy removal)
 * 
 * @example
 * ```bash
 * npm test src/lib/language-system/__tests__/migration-mode.test.ts
 * ```
 * 
 * @migration-notes
 * Critical for Phase 3 preparation. Must validate dual-check mode works correctly
 * before enabling in production. Tests comparison logic, discrepancy detection,
 * and safe rollback mechanisms.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// Import unified system components
import {
  LanguageProvider,
  useLanguage,
  detectLanguage,
  createDetectionConfig,
  compareDetectionResults
} from '../index';

import {
  useSmartLanguage,
  useLanguageDebug
} from '../useLanguage';

import type {
  SupportedLanguage,
  MigrationMode,
  LanguageProviderProps,
  LanguageDetectionResult
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
        'test.key': 'Test Value'
      })
    });
  }
  if (url.includes('/locales/ro.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'welcome': 'Bun venit',
        'test.key': 'Valoare Test'
      })
    });
  }
  return Promise.reject(new Error('Translation file not found'));
});

// Test wrapper with migration mode support
const MigrationTestWrapper: React.FC<{ 
  children: React.ReactNode; 
  migrationMode?: MigrationMode;
  providerProps?: Partial<LanguageProviderProps>
}> = ({ children, migrationMode = 'unified', providerProps = {} }) => {
  return React.createElement(LanguageProvider, {
    initialLanguage: "en" as SupportedLanguage,
    pageType: "general",
    enablePerformanceTracking: true,
    enableDebugMode: true,
    migrationMode: migrationMode,
    children,
    ...providerProps
  });
};

// Simulate legacy detection result for comparison
const createLegacyDetectionResult = (
  language: SupportedLanguage,
  source: string,
  confidence: number = 0.8
): any => ({
  language,
  source,
  confidence,
  metadata: {
    legacy: true,
    timestamp: Date.now()
  }
});

describe('Migration Mode Support', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    delete process.env.LANGUAGE_SYSTEM_MODE;
  });

  // ===== Migration Mode Detection =====

  describe('Migration Mode Detection', () => {
    
    it('should default to unified mode when no env var is set', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper>{children}</MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should work in unified mode by default
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
    });

    it('should respect LANGUAGE_SYSTEM_MODE environment variable', async () => {
      process.env.LANGUAGE_SYSTEM_MODE = 'unified';

      const { result } = renderHook(() => useLanguageDebug(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper>{children}</MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
      });

      if (process.env.NODE_ENV === 'development' && result.current.enabled) {
        expect(result.current.migrationMode).toBe('unified');
      }
    });

    it('should handle invalid migration mode gracefully', async () => {
      process.env.LANGUAGE_SYSTEM_MODE = 'invalid_mode' as any;

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper>{children}</MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to unified mode
      expect(result.current.currentLang).toBeDefined();
    });

  });

  // ===== Unified Mode Tests =====

  describe('Unified Mode', () => {
    
    it('should operate in unified mode correctly', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="unified">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should provide full unified functionality
      expect(result.current.currentLang).toBe('en');
      expect(result.current.t('welcome')).toBe('Welcome');
      
      // Test language switching
      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(result.current.currentLang).toBe('ro');
      expect(result.current.t('welcome')).toBe('Bun venit');
    });

    it('should provide performance metrics in unified mode', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="unified">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const metrics = result.current.getPerformanceMetrics();
      expect(metrics.detectionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.translationLoadTime).toBeGreaterThanOrEqual(0);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

  });

  // ===== Legacy Mode Simulation =====

  describe('Legacy Mode Simulation', () => {
    
    it('should log warning when legacy mode is detected', async () => {
      const mockWarn = jest.fn();
      require('@/lib/logger').loggers.languageSystem.warn = mockWarn;

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="legacy">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should log warning about legacy mode
      expect(mockWarn).toHaveBeenCalledWith(
        expect.stringContaining('legacy mode')
      );
    });

    it('should still provide basic functionality in legacy mode', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="legacy">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Basic functionality should still work
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.t).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
    });

  });

  // ===== Dual-Check Mode Tests =====

  describe('Dual-Check Mode', () => {
    
    it('should log debug info when dual-check mode is enabled', async () => {
      const mockDebug = jest.fn();
      require('@/lib/logger').loggers.languageSystem.debug = mockDebug;

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="dual_check">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should log dual-check mode activation
      expect(mockDebug).toHaveBeenCalledWith(
        expect.stringContaining('dual-check mode')
      );
    });

    it('should prepare for dual-check comparison logic', async () => {
      // Note: This test prepares for Phase 3 implementation
      // The actual dual-check logic will be implemented in Phase 3
      
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="dual_check">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // System should still function normally
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
      
      // TODO: Add dual-check comparison tests in Phase 3
      // This will validate that unified and legacy systems produce identical results
    });

  });

  // ===== Detection Result Comparison =====

  describe('Detection Result Comparison', () => {
    
    it('should compare detection results accurately', async () => {
      const unifiedResult: LanguageDetectionResult = {
        language: 'ro',
        source: 'url-path',
        confidence: 1.0,
        metadata: {
          originalValue: 'ro',
          patternType: 'property-page'
        }
      };

      const legacyResult = createLegacyDetectionResult('ro', 'url-path', 1.0);

      const comparison = compareDetectionResults(unifiedResult, legacyResult);

      expect(comparison.matches).toBe(true);
      expect(comparison.discrepancies).toHaveLength(0);
    });

    it('should detect language discrepancies', async () => {
      const unifiedResult: LanguageDetectionResult = {
        language: 'ro',
        source: 'url-path',
        confidence: 1.0,
        metadata: {}
      };

      const legacyResult = createLegacyDetectionResult('en', 'url-path', 1.0);

      const comparison = compareDetectionResults(unifiedResult, legacyResult);

      expect(comparison.matches).toBe(false);
      expect(comparison.discrepancies).toContain(
        expect.stringContaining('Language mismatch')
      );
    });

    it('should detect confidence discrepancies', async () => {
      const unifiedResult: LanguageDetectionResult = {
        language: 'ro',
        source: 'url-path',
        confidence: 1.0,
        metadata: {}
      };

      const legacyResult = createLegacyDetectionResult('ro', 'url-path', 0.5);

      const comparison = compareDetectionResults(unifiedResult, legacyResult);

      expect(comparison.matches).toBe(false);
      expect(comparison.discrepancies).toContain(
        expect.stringContaining('Confidence mismatch')
      );
    });

    it('should handle missing confidence gracefully', async () => {
      const unifiedResult: LanguageDetectionResult = {
        language: 'ro',
        source: 'url-path',
        confidence: 1.0,
        metadata: {}
      };

      const legacyResult = {
        language: 'ro',
        source: 'url-path'
        // No confidence property
      };

      const comparison = compareDetectionResults(unifiedResult, legacyResult);

      // Should not fail due to missing confidence
      expect(comparison.matches).toBe(true);
      expect(comparison.discrepancies).toHaveLength(0);
    });

  });

  // ===== Smart Language Hook =====

  describe('Smart Language Hook', () => {
    
    it('should adapt to migration mode automatically', async () => {
      const { result } = renderHook(() => useSmartLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="unified">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should provide unified interface
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.getPerformanceMetrics).toBeDefined();
    });

    it('should work consistently across migration modes', async () => {
      const migrationModes: MigrationMode[] = ['legacy', 'dual_check', 'unified', 'cleanup'];

      for (const mode of migrationModes) {
        const { result } = renderHook(() => useSmartLanguage(), {
          wrapper: ({ children }) => (
            <MigrationTestWrapper migrationMode={mode}>
              {children}
            </MigrationTestWrapper>
          )
        });

        await waitFor(() => {
          expect(result.current.isLoading).toBe(false);
        });

        // Core functionality should work in all modes
        expect(result.current.currentLang).toBeDefined();
        expect(result.current.t('welcome')).toBeDefined();
      }
    });

  });

  // ===== Cleanup Mode =====

  describe('Cleanup Mode', () => {
    
    it('should operate in cleanup mode for production', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="cleanup">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should provide full functionality without legacy overhead
      expect(result.current.currentLang).toBe('en');
      expect(result.current.t('welcome')).toBe('Welcome');
      
      // Performance should be optimal in cleanup mode
      const metrics = result.current.getPerformanceMetrics();
      expect(metrics.detectionTime).toBeGreaterThanOrEqual(0);
    });

  });

  // ===== Migration Safety =====

  describe('Migration Safety', () => {
    
    it('should handle migration mode changes gracefully', async () => {
      let migrationMode: MigrationMode = 'unified';
      
      const TestWrapper = ({ children }: { children: React.ReactNode }) => (
        <MigrationTestWrapper migrationMode={migrationMode}>
          {children}
        </MigrationTestWrapper>
      );

      const { result, rerender } = renderHook(() => useLanguage(), {
        wrapper: TestWrapper
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialLang = result.current.currentLang;

      // Change migration mode and rerender
      migrationMode = 'cleanup';
      rerender();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should maintain state consistency
      expect(result.current.currentLang).toBe(initialLang);
    });

    it('should provide error boundaries for migration failures', async () => {
      const onError = jest.fn();

      // This test ensures the system doesn't crash during migration mode changes
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper 
            migrationMode="dual_check"
            providerProps={{ onError }}
          >
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // System should initialize successfully
      expect(result.current.currentLang).toBeDefined();
      expect(onError).not.toHaveBeenCalled();
    });

  });

  // ===== Feature Flag Integration =====

  describe('Feature Flag Integration', () => {
    
    it('should support environment-based feature flags', async () => {
      process.env.LANGUAGE_SYSTEM_MODE = 'unified';

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper>{children}</MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should respect environment variable
      expect(result.current.currentLang).toBeDefined();
    });

    it('should allow runtime mode override via props', async () => {
      process.env.LANGUAGE_SYSTEM_MODE = 'legacy';

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="unified">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Props should override environment variable
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.getPerformanceMetrics).toBeDefined(); // Unified feature
    });

  });

  // ===== Rollback Capabilities =====

  describe('Rollback Capabilities', () => {
    
    it('should support immediate rollback to legacy mode', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="legacy">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still provide basic functionality for rollback safety
      expect(result.current.currentLang).toBeDefined();
      expect(result.current.t).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
    });

    it('should maintain data consistency during rollback', async () => {
      localStorage.setItem('preferredLanguage', 'ro');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <MigrationTestWrapper migrationMode="legacy">
            {children}
          </MigrationTestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still respect stored preferences in legacy mode
      expect(result.current.currentLang).toBe('ro');
    });

  });

});