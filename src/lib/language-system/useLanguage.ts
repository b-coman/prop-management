/**
 * @fileoverview Unified useLanguage Hook Interface
 * @module lib/language-system/useLanguage
 * 
 * @description
 * Unified hook interface that provides all language functionality through a single,
 * consistent API. Replaces multiple fragmented hooks with a comprehensive solution
 * offering translation, switching, detection, and performance monitoring.
 * 
 * @architecture
 * Location: Core language system infrastructure
 * Layer: React Hook abstraction
 * Pattern: Custom React Hook with memoized return values
 * 
 * @dependencies
 * - Internal: ./LanguageProvider, ./language-types
 * - External: React hooks (useMemo, useCallback)
 * 
 * @relationships
 * - Provides: Unified language interface for all components
 * - Consumes: UnifiedLanguageContext from LanguageProvider
 * - Children: Components using language functionality
 * - Parent: LanguageProvider.tsx provides the context
 * 
 * @performance
 * - Optimizations: Memoized return values, selective re-renders, efficient callbacks
 * - Concerns: Context value changes trigger all consuming components
 * 
 * @example
 * ```typescript
 * import { useLanguage } from '@/lib/language-system';
 * 
 * function MyComponent() {
 *   const { currentLang, t, tc, switchLanguage, isLoading } = useLanguage();
 *   
 *   return (
 *     <div>
 *       <h1>{t('welcome', 'Welcome')}</h1>
 *       <p>{tc(multilingualContent)}</p>
 *       <button onClick={() => switchLanguage('ro')}>
 *         Switch to Romanian
 *       </button>
 *       {isLoading && <span>Loading...</span>}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 language system migration. Provides unified interface that
 * maintains full backwards compatibility with existing useLanguage and
 * useOptimizedLanguage hooks while adding new functionality.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { useMemo, useCallback } from 'react';
import { useLanguage as useUnifiedLanguage } from './LanguageProvider';
import type {
  SupportedLanguage,
  UnifiedLanguageContextType,
  TranslationHookResult,
  LanguageSwitcherHookResult,
  LanguageSwitchOptions,
  LanguagePerformanceMetrics
} from './language-types';

// ===== Main Unified Hook =====

/**
 * Primary unified language hook - replaces all legacy language hooks
 * 
 * @description
 * Provides complete language functionality including translation, switching,
 * detection, and performance monitoring through a single interface.
 * 
 * @returns Complete language context with all functionality
 * 
 * @example
 * ```typescript
 * const { currentLang, t, tc, switchLanguage } = useLanguage();
 * ```
 */
export function useLanguage(): UnifiedLanguageContextType {
  return useUnifiedLanguage();
}

// ===== Specialized Hooks =====

/**
 * Translation-only hook for components that only need translation functions
 * 
 * @description
 * Lightweight hook that provides only translation functionality.
 * Optimized for components that don't need language switching capabilities.
 * 
 * @returns Translation functions and current language state
 * 
 * @example
 * ```typescript
 * const { t, tc, currentLang } = useTranslation();
 * const title = t('page.title', 'Default Title');
 * const content = tc(multilingualContent);
 * ```
 */
export function useTranslation(): TranslationHookResult {
  const { t, tc, currentLang, isLoading } = useUnifiedLanguage();
  
  return useMemo(() => ({
    t,
    tc,
    currentLang,
    isLoading
  }), [t, tc, currentLang, isLoading]);
}

/**
 * Language switcher hook for navigation components
 * 
 * @description
 * Lightweight hook focused on language switching functionality.
 * Ideal for navigation components, language selectors, and settings panels.
 * 
 * @returns Language switching functions and supported languages
 * 
 * @example
 * ```typescript
 * const { currentLang, switchLanguage, supportedLanguages } = useLanguageSwitcher();
 * 
 * return (
 *   <select value={currentLang} onChange={(e) => switchLanguage(e.target.value)}>
 *     {supportedLanguages.map(lang => (
 *       <option key={lang} value={lang}>{lang.toUpperCase()}</option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useLanguageSwitcher(): LanguageSwitcherHookResult {
  const { 
    currentLang, 
    switchLanguage, 
    isLoading, 
    isLanguageSupported,
    getAvailableLanguages 
  } = useUnifiedLanguage();
  
  return useMemo(() => ({
    currentLang,
    switchLanguage,
    supportedLanguages: getAvailableLanguages(),
    isLoading,
    isLanguageSupported
  }), [currentLang, switchLanguage, isLoading, isLanguageSupported, getAvailableLanguages]);
}

// ===== Performance and Utility Hooks =====

/**
 * Performance metrics hook for monitoring language system performance
 * 
 * @description
 * Provides access to language system performance metrics including
 * detection time, translation loading time, and cache statistics.
 * 
 * @returns Current performance metrics
 * 
 * @example
 * ```typescript
 * const metrics = useLanguagePerformance();
 * 
 * if (metrics.detectionTime > 100) {
 *   console.warn('Slow language detection:', metrics.detectionTime + 'ms');
 * }
 * 
 * console.log('Cache hit rate:', metrics.cacheHitRate + '%');
 * ```
 */
export function useLanguagePerformance(): LanguagePerformanceMetrics {
  const { getPerformanceMetrics } = useUnifiedLanguage();
  
  return useMemo(() => {
    return getPerformanceMetrics();
  }, [getPerformanceMetrics]);
}

/**
 * Language detection hook for accessing detection results
 * 
 * @description
 * Provides access to language detection results including source,
 * confidence level, and detection metadata.
 * 
 * @returns Detection result information
 * 
 * @example
 * ```typescript
 * const detection = useLanguageDetection();
 * 
 * console.log('Language detected from:', detection.source);
 * console.log('Detection confidence:', detection.confidence);
 * ```
 */
export function useLanguageDetection() {
  const { detectionResult } = useUnifiedLanguage();
  
  return useMemo(() => {
    return detectionResult;
  }, [detectionResult]);
}

// ===== Advanced Utility Hooks =====

/**
 * Language validation hook for form inputs and user input
 * 
 * @description
 * Provides language validation utilities for validating user input,
 * normalizing language codes, and checking language support.
 * 
 * @returns Language validation functions
 * 
 * @example
 * ```typescript
 * const { isLanguageSupported, normalizeLanguage } = useLanguageValidation();
 * 
 * const handleLanguageInput = (input: string) => {
 *   const normalized = normalizeLanguage(input);
 *   if (isLanguageSupported(normalized)) {
 *     switchLanguage(normalized);
 *   }
 * };
 * ```
 */
export function useLanguageValidation() {
  const { isLanguageSupported, getAvailableLanguages } = useUnifiedLanguage();
  
  const normalizeLanguage = useCallback((input: string): SupportedLanguage | null => {
    const normalized = input.toLowerCase().trim();
    
    // Check direct match
    if (isLanguageSupported(normalized)) {
      return normalized as SupportedLanguage;
    }
    
    // Check primary language code (e.g., 'en' from 'en-US')
    const primaryLang = (normalized as string).split('-')[0];
    if (isLanguageSupported(primaryLang)) {
      return primaryLang as SupportedLanguage;
    }
    
    return null;
  }, [isLanguageSupported]);
  
  const validateLanguageCode = useCallback((code: string): boolean => {
    return normalizeLanguage(code) !== null;
  }, [normalizeLanguage]);
  
  return useMemo(() => ({
    isLanguageSupported,
    normalizeLanguage,
    validateLanguageCode,
    supportedLanguages: getAvailableLanguages()
  }), [isLanguageSupported, normalizeLanguage, validateLanguageCode, getAvailableLanguages]);
}

/**
 * Language URL utilities hook for path and query management
 * 
 * @description
 * Provides utilities for generating localized URLs, managing language
 * parameters, and handling different page types (property, booking, general).
 * 
 * @returns URL utility functions
 * 
 * @example
 * ```typescript
 * const { getLocalizedPath, createLanguageUrl } = useLanguageUrls();
 * 
 * const localizedPath = getLocalizedPath('/properties/villa', 'ro');
 * const bookingUrl = createLanguageUrl('/booking/check', 'ro', 'booking');
 * ```
 */
export function useLanguageUrls() {
  const { getLocalizedPath, currentLang } = useUnifiedLanguage();
  
  const createLanguageUrl = useCallback((
    path: string, 
    language: SupportedLanguage, 
    pageType: 'property' | 'booking' | 'general' = 'general'
  ): string => {
    if (pageType === 'booking') {
      // Updated for path-based language detection migration
      // Convert /booking/check/slug to /booking/check/slug/language
      const url = new URL(path, window.location.origin);
      let pathname = url.pathname;
      
      // Only add language path segment if not English (default)
      if (language !== 'en') {
        // If it's a booking path, append language as path segment
        if (pathname.startsWith('/booking/check/')) {
          pathname = pathname + '/' + language;
        } else {
          // For other booking paths, fall back to general localization
          return getLocalizedPath(path, language);
        }
      }
      
      return pathname + url.search;
    }
    
    return getLocalizedPath(path, language);
  }, [getLocalizedPath]);
  
  const getCurrentLanguageUrl = useCallback((path: string): string => {
    return getLocalizedPath(path, currentLang);
  }, [getLocalizedPath, currentLang]);
  
  return useMemo(() => ({
    getLocalizedPath,
    createLanguageUrl,
    getCurrentLanguageUrl,
    currentLang
  }), [getLocalizedPath, createLanguageUrl, getCurrentLanguageUrl, currentLang]);
}

// ===== Backwards Compatibility Hooks =====

/**
 * Legacy compatibility hook - maintains old useLanguage interface
 * 
 * @description
 * Provides backwards compatibility with the original useLanguage hook.
 * Maps old interface to new unified system for seamless migration.
 * 
 * @deprecated Use useLanguage() from the unified system instead
 * 
 * @returns Legacy-compatible interface
 * 
 * @example
 * ```typescript
 * // Legacy usage (still works)
 * const { currentLang, switchLanguage, t, tc } = useLegacyLanguage();
 * ```
 */
export function useLegacyLanguage() {
  const { 
    currentLang, 
    switchLanguage, 
    t, 
    tc, 
    isLoading,
    getLocalizedPath,
    isLanguageSupported
  } = useUnifiedLanguage();
  
  // Map to legacy interface
  const changeLanguage = useCallback((lang: SupportedLanguage) => {
    return switchLanguage(lang);
  }, [switchLanguage]);
  
  return useMemo(() => ({
    currentLang,
    currentLanguage: currentLang, // Legacy alias
    switchLanguage,
    changeLanguage, // Legacy alias
    t,
    tc,
    isLoading,
    getLocalizedPath,
    isLanguageSupported
  }), [
    currentLang, 
    switchLanguage, 
    changeLanguage, 
    t, 
    tc, 
    isLoading, 
    getLocalizedPath, 
    isLanguageSupported
  ]);
}

/**
 * Optimized language hook - maintains useOptimizedLanguage interface
 * 
 * @description
 * Provides backwards compatibility with the useOptimizedLanguage hook.
 * The unified system is already optimized, so this maps to the standard interface.
 * 
 * @deprecated Use useLanguage() from the unified system instead
 * 
 * @returns Optimized interface (same as main interface)
 * 
 * @example
 * ```typescript
 * // Legacy optimized usage (still works)
 * const { lang, setLang, t, tc } = useOptimizedLanguage();
 * ```
 */
export function useOptimizedLanguage() {
  const { currentLang, switchLanguage, t, tc, isLoading } = useUnifiedLanguage();
  
  // Map to legacy optimized interface
  const setLang = useCallback((lang: SupportedLanguage) => {
    return switchLanguage(lang);
  }, [switchLanguage]);
  
  return useMemo(() => ({
    lang: currentLang, // Legacy property name
    setLang, // Legacy function name
    t,
    tc,
    isLoading
  }), [currentLang, setLang, t, tc, isLoading]);
}

// ===== Conditional Hooks for Migration =====

/**
 * Smart language hook - unified system only
 * 
 * @description
 * Provides the unified language system interface. Maintained for backwards
 * compatibility with components that previously used migration mode switching.
 * 
 * @returns Unified language interface
 * 
 * @example
 * ```typescript
 * const { currentLang, t, switchLanguage } = useSmartLanguage();
 * ```
 */
export function useSmartLanguage() {
  return useUnifiedLanguage();
}

// ===== Development and Debug Hooks =====

/**
 * Debug hook for development and troubleshooting
 * 
 * @description
 * Provides debug information about the language system including
 * cache statistics, performance metrics, and system status.
 * Only available in development mode.
 * 
 * @returns Debug information object
 * 
 * @example
 * ```typescript
 * const debug = useLanguageDebug();
 * 
 * console.log('Cache stats:', debug.cacheStats);
 * console.log('Performance:', debug.performance);
 * console.log('Migration mode:', debug.migrationMode);
 * ```
 */
export function useLanguageDebug() {
  const context = useUnifiedLanguage();
  
  return useMemo(() => {
    if (process.env.NODE_ENV !== 'development') {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      currentState: {
        currentLang: context.currentLang,
        isLoading: context.isLoading,
        error: context.error,
        translationCount: Object.keys(context.translations).length
      },
      performance: context.getPerformanceMetrics(),
      debugInfo: context.debugInfo
    };
  }, [context]);
}

// ===== Re-exports =====

// Re-export main hook as default for convenience
export default useLanguage;

// Re-export types for external use
export type {
  SupportedLanguage,
  UnifiedLanguageContextType,
  TranslationHookResult,
  LanguageSwitcherHookResult,
  LanguagePerformanceMetrics
} from './language-types';