/**
 * @fileoverview Unified Language Provider for RentalSpot Application
 * @module lib/language-system/LanguageProvider
 * 
 * @description
 * Single source of truth for language management across the entire application.
 * Replaces the previous fragmented language system with unified architecture.
 * Provides React context for language state, translation loading, and switching.
 * 
 * @architecture
 * Location: Core language system infrastructure
 * Layer: Cross-cutting concern (Context Provider)
 * Pattern: React Context + Provider with centralized state management
 * 
 * @dependencies
 * - Internal: @/lib/language-constants, @/lib/logger, @/hooks/use-session-storage
 * - External: React, react/jsx-runtime
 * - APIs: Translation files from /locales/*.json
 * 
 * @relationships
 * - Provides: Language context to all child components
 * - Consumes: Translation files, browser language preferences, localStorage
 * - Children: All components using language functionality
 * - Parent: Root application component or specific page layouts
 * 
 * @state-management
 * - State Shape: { currentLang: string, translations: object, isLoading: boolean }
 * - Persistence: localStorage key 'preferredLanguage'
 * - Updates: User-triggered via switchLanguage, automatic via detection
 * 
 * @performance
 * - Optimizations: Memoized context value, lazy translation loading, efficient caching
 * - Concerns: Large translation files may cause initial load delay
 * 
 * @example
 * ```typescript
 * import { LanguageProvider, useLanguage } from '@/lib/language-system';
 * 
 * function App() {
 *   return (
 *     <LanguageProvider initialLanguage="en">
 *       <MyComponent />
 *     </LanguageProvider>
 *   );
 * }
 * 
 * function MyComponent() {
 *   const { currentLang, t, switchLanguage } = useLanguage();
 *   return <button onClick={() => switchLanguage('ro')}>{t('switch.language')}</button>;
 * }
 * ```
 * 
 * @migration-notes
 * Replaces multiple legacy systems: LanguageContext, useLanguage hook variants.
 * Migration completed in 2025-06 following availability migration methodology.
 * Maintains backwards compatibility during transition phase.
 * 
 * @v2-dependency: CORE
 * @v2-usage: Primary language system for all components
 * @v2-first-used: 2025-06-XX
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

"use client";

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo,
  useRef
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { loggers } from '@/lib/logger';
import { 
  detectLanguage, 
  createDetectionConfig, 
  createLocalizedPath,
  isSupportedLanguage,
  getAvailableLanguages 
} from './language-detection';
import { 
  globalTranslationCache, 
  TranslationCache,
  createTranslationCache 
} from './translation-cache';
import type {
  SupportedLanguage,
  UnifiedLanguageContextType,
  LanguageProviderProps,
  LanguageSwitchOptions,
  TranslationFunction,
  ContentTranslationFunction,
  LanguagePerformanceMetrics
} from './language-types';

const logger = loggers.languageSystem;

// ===== Context Creation =====

/**
 * Unified language context
 */
const UnifiedLanguageContext = createContext<UnifiedLanguageContextType | null>(null);


// ===== Provider Implementation =====

/**
 * Unified language provider component
 */
export function LanguageProvider({
  children,
  initialLanguage,
  pageType = 'general',
  enablePerformanceTracking = false,
  enableDebugMode = false,
  cacheConfig = {},
  performanceConfig = {},
  onLanguageChange,
  onError
}: LanguageProviderProps) {
  
  // ===== State Management =====
  
  const pathname = usePathname();
  const router = useRouter();
  
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(
    initialLanguage || DEFAULT_LANGUAGE as SupportedLanguage
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  
  // ===== Configuration and References =====
  
  const performanceMetricsRef = useRef<LanguagePerformanceMetrics>({
    detectionTime: 0,
    translationLoadTime: 0,
    renderTime: 0,
    switchTime: 0,
    cacheHitRate: 0,
    totalTranslations: 0
  });
  
  // Create dedicated cache instance if custom config provided
  const translationCache = useMemo(() => {
    if (Object.keys(cacheConfig).length > 0) {
      return createTranslationCache(cacheConfig);
    }
    return globalTranslationCache;
  }, [cacheConfig]);

  // ===== Language Detection on Mount =====
  
  useEffect(() => {
    const performInitialDetection = async () => {
      const detectionStartTime = performance.now();
      
      try {
        // If initialLanguage is provided from server-side detection, use it
        if (initialLanguage && SUPPORTED_LANGUAGES.includes(initialLanguage)) {
          logger.info('🎯 Using server-provided initial language (FIXED)', {
            initialLanguage,
            pathname,
            pageType,
            source: 'server-prop',
            supportedLanguages: SUPPORTED_LANGUAGES
          });

          setCurrentLang(initialLanguage);
          await loadTranslationsForLanguage(initialLanguage);
          
          performanceMetricsRef.current.detectionTime = performance.now() - detectionStartTime;
          return;
        }

        logger.info('🔍 Starting client-side language detection', {
          pathname,
          pageType,
          pathBasedDetectionOnly: true,
          reason: 'no-initial-language-provided'
        });

        // Auto-detect pageType for booking pages
        const detectedPageType = pathname.includes('/booking/') ? 'booking' : pageType;
        
        logger.debug('🔍 Page type detection', {
          pathname,
          originalPageType: pageType,
          detectedPageType,
          isBookingPage: pathname.includes('/booking/')
        });
        
        const detectionConfig = createDetectionConfig({
          pathname,
          pageType: detectedPageType
        });

        const detectionResult = await detectLanguage(detectionConfig);
        const detectionEndTime = performance.now();
        
        performanceMetricsRef.current.detectionTime = detectionEndTime - detectionStartTime;

        logger.info('🎯 Client-side language detection completed', {
          language: detectionResult.language,
          source: detectionResult.source,
          confidence: detectionResult.confidence,
          detectionTime: performanceMetricsRef.current.detectionTime,
          finalResult: `Setting language to: ${detectionResult.language}`
        });

        setCurrentLang(detectionResult.language);

        // Load initial translations
        await loadTranslationsForLanguage(detectionResult.language);

      } catch (error) {
        logger.error('Initial language detection failed', error);
        
        if (onError) {
          onError(error as Error, 'initial-detection');
        }
        
        setError('Failed to detect initial language');
        setCurrentLang(DEFAULT_LANGUAGE as SupportedLanguage);
        
        // Load default language translations as fallback
        await loadTranslationsForLanguage(DEFAULT_LANGUAGE as SupportedLanguage);
      }
    };

    performInitialDetection();
  }, [pathname, pageType, onError, initialLanguage]);

  // ===== Translation Loading =====
  
  const loadTranslationsForLanguage = useCallback(async (language: SupportedLanguage) => {
    const loadStartTime = performance.now();
    setIsLoading(true);
    setError(null);

    try {
      logger.debug('Loading translations', { language });
      
      const cachedTranslation = await translationCache.getTranslations(language);
      const loadEndTime = performance.now();
      
      performanceMetricsRef.current.translationLoadTime = loadEndTime - loadStartTime;
      
      // Update cache hit rate
      const cacheStats = translationCache.getStats();
      performanceMetricsRef.current.cacheHitRate = cacheStats.hitRate;

      setTranslations(cachedTranslation.content);
      performanceMetricsRef.current.totalTranslations = Object.keys(cachedTranslation.content).length;

      logger.debug('Translations loaded successfully', {
        language,
        fromCache: cachedTranslation.fromCache,
        loadTime: performanceMetricsRef.current.translationLoadTime,
        translationCount: performanceMetricsRef.current.totalTranslations
      });

    } catch (error) {
      const loadEndTime = performance.now();
      performanceMetricsRef.current.translationLoadTime = loadEndTime - loadStartTime;
      
      logger.error('Translation loading failed', error, { language });
      
      if (onError) {
        onError(error as Error, 'translation-loading');
      }
      
      setError(`Failed to load translations for ${language}`);
      setTranslations({});
    } finally {
      setIsLoading(false);
    }
  }, [translationCache, onError]);

  // ===== Translation Functions =====
  
  const t: TranslationFunction = useCallback((key: string, fallback?: string, variables?: Record<string, string | number>) => {
    if (!key) return fallback || '';
    
    const performanceStart = enablePerformanceTracking ? performance.now() : 0;
    
    try {
      const keys = key.split('.');
      let value: any = translations;
      
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }
      
      let result = typeof value === 'string' ? value : (fallback || key);
      
      // Variable substitution
      if (variables && typeof result === 'string') {
        Object.entries(variables).forEach(([varKey, varValue]) => {
          result = result.replace(new RegExp(`{{${varKey}}}`, 'g'), String(varValue));
        });
      }
      
      if (enablePerformanceTracking) {
        const performanceEnd = performance.now();
        const translationTime = performanceEnd - performanceStart;
        
        // Warn about slow translations in development
        if (process.env.NODE_ENV === 'development' && translationTime > 10) {
          logger.warn('Slow translation detected', {
            key,
            translationTime,
            currentLang
          });
        }
      }
      
      return result;
      
    } catch (error) {
      logger.warn('Translation function error', { key, error });
      return fallback || key;
    }
  }, [translations, currentLang, enablePerformanceTracking]);

  const tc: ContentTranslationFunction = useCallback((content, fallback?: string) => {
    if (!content) return fallback || '';
    
    try {
      // If content is already a string, return it
      if (typeof content === 'string') {
        return content;
      }
      
      // If content is an object with language keys
      if (typeof content === 'object' && !Array.isArray(content)) {
        // First try the current language
        if (content[currentLang]) {
          return content[currentLang];
        }
        
        // Then try the default language
        if (content[DEFAULT_LANGUAGE]) {
          return content[DEFAULT_LANGUAGE];
        }
        
        // Finally, return the first available translation
        const firstKey = Object.keys(content).find(key => 
          SUPPORTED_LANGUAGES.includes(key as SupportedLanguage)
        );
        if (firstKey && content[firstKey]) {
          return content[firstKey];
        }
      }
      
      return fallback || String(content || '');
      
    } catch (error) {
      logger.warn('Content translation function error', { content, error });
      return fallback || '';
    }
  }, [currentLang]);

  // ===== Language Switching =====
  
  const switchLanguage = useCallback(async (
    language: SupportedLanguage, 
    options: LanguageSwitchOptions = {}
  ) => {
    const switchStartTime = performance.now();
    
    try {
      logger.debug('Switching language', { 
        from: currentLang, 
        to: language,
        options 
      });

      // Validate language
      if (!isSupportedLanguage(language)) {
        logger.warn('Unsupported language switch attempted', { language });
        return;
      }

      // Prevent unnecessary switches
      if (language === currentLang) {
        logger.debug('Language switch skipped - already current', { language });
        return;
      }

      const {
        updateUrl = true,
        preserveQueryParams = true,
        updateLocalStorage = true,
        redirect = false,
        skipTranslationLoad = false
      } = options;

      // Update localStorage if enabled
      if (updateLocalStorage && typeof window !== 'undefined') {
        try {
          localStorage.setItem('preferredLanguage', language);
        } catch (storageError) {
          logger.warn('Failed to update localStorage', { language, error: storageError });
        }
      }

      // Load translations for new language (unless skipped)
      if (!skipTranslationLoad) {
        await loadTranslationsForLanguage(language);
      }

      // Update current language
      const previousLang = currentLang;
      setCurrentLang(language);

      // Call change callback
      if (onLanguageChange) {
        onLanguageChange(previousLang, language);
      }

      // Update URL if enabled
      if (updateUrl && typeof window !== 'undefined') {
        const currentPath = pathname;
        let finalUrl = currentPath;
        
        // Auto-detect page type for URL generation (same logic as initial detection)
        const detectedPageType = currentPath.includes('/booking/') ? 'booking' : pageType;
        
        logger.debug('🔄 Language switch URL generation debug', {
          currentPath,
          originalPageType: pageType,
          detectedPageType,
          targetLanguage: language,
          preserveQueryParams,
          windowLocationSearch: window.location.search
        });
        
        // Preserve query parameters if requested
        if (preserveQueryParams) {
          const currentSearchParams = new URLSearchParams(window.location.search);
          
          // Use path-based language detection for all page types
          if (detectedPageType === 'booking' && currentPath.startsWith('/booking/check/')) {
            // Use path-based approach: /booking/check/slug/language
            const pathParts = currentPath.split('/');
            
            // Build base path: /booking/check/slug (always remove language if present)
            let basePath = `/${pathParts[1]}/${pathParts[2]}/${pathParts[3]}`;
            
            // Add language segment if not English (default)
            finalUrl = language !== 'en' ? `${basePath}/${language}` : basePath;
            
            logger.debug('🔄 Booking page URL generation', {
              currentPath,
              pathParts,
              basePath,
              targetLanguage: language,
              finalUrl
            });
            
            // Preserve non-language query parameters
            if (currentSearchParams.toString()) {
              finalUrl = `${finalUrl}?${currentSearchParams.toString()}`;
            }
          } else {
            // For all other pages, use standard localization
            const newPath = createLocalizedPath(currentPath, language, detectedPageType);
            finalUrl = currentSearchParams.toString() ? `${newPath}?${currentSearchParams.toString()}` : newPath;
          }
        } else {
          // No query parameter preservation
          if (detectedPageType === 'booking' && currentPath.startsWith('/booking/check/')) {
            const pathParts = currentPath.split('/');
            // Build base path: /booking/check/slug (always remove language if present)
            let basePath = `/${pathParts[1]}/${pathParts[2]}/${pathParts[3]}`;
            // Add language segment if not English (default)
            finalUrl = language !== 'en' ? `${basePath}/${language}` : basePath;
          } else {
            finalUrl = createLocalizedPath(currentPath, language, detectedPageType);
          }
        }

        logger.debug('🔄 Final URL routing decision', {
          finalUrl,
          redirect,
          method: redirect ? 'push' : 'replace'
        });
        
        if (redirect) {
          router.push(finalUrl);
        } else {
          router.replace(finalUrl);
        }
      }

      const switchEndTime = performance.now();
      performanceMetricsRef.current.switchTime = switchEndTime - switchStartTime;

      logger.debug('Language switch completed', {
        from: previousLang,
        to: language,
        switchTime: performanceMetricsRef.current.switchTime
      });

    } catch (error) {
      logger.error('Language switch failed', error, { 
        from: currentLang, 
        to: language 
      });
      
      if (onError) {
        onError(error as Error, 'language-switch');
      }
    }
  }, [currentLang, pathname, pageType, router, onLanguageChange, onError, loadTranslationsForLanguage]);

  // ===== Utility Functions =====
  
  const preloadLanguage = useCallback(async (language: SupportedLanguage) => {
    try {
      await translationCache.preloadLanguage(language);
      logger.debug('Language preloaded', { language });
    } catch (error) {
      logger.warn('Language preload failed', { language, error });
      throw error;
    }
  }, [translationCache]);

  const clearCache = useCallback((language?: SupportedLanguage) => {
    translationCache.clearCache(language);
    logger.debug('Translation cache cleared', { language });
  }, [translationCache]);

  const getPerformanceMetrics = useCallback((): LanguagePerformanceMetrics => {
    return { ...performanceMetricsRef.current };
  }, []);

  const isLanguageSupportedCheck = useCallback((language: string): language is SupportedLanguage => {
    return isSupportedLanguage(language);
  }, []);

  const getAvailableLanguagesArray = useCallback(() => {
    return getAvailableLanguages();
  }, []);

  const getLocalizedPath = useCallback((path: string, language?: SupportedLanguage) => {
    const targetLang = language || currentLang;
    return createLocalizedPath(path, targetLang, pageType);
  }, [currentLang, pageType]);


  // ===== Context Value Memoization =====
  
  const contextValue: UnifiedLanguageContextType = useMemo(() => {
    const renderStartTime = performance.now();
    
    const value: UnifiedLanguageContextType = {
      // State
      currentLang,
      isLoading,
      error,
      translations,
      detectionResult: null,
      performanceMetrics: performanceMetricsRef.current,
      
      // Translation functions
      t,
      tc,
      
      // Actions
      switchLanguage,
      preloadLanguage,
      clearCache,
      getPerformanceMetrics,
      isLanguageSupported: isLanguageSupportedCheck,
      getAvailableLanguages: getAvailableLanguagesArray,
      getLocalizedPath,
      
      // Backwards compatibility aliases
      currentLanguage: currentLang,
      changeLanguage: switchLanguage,
      
      // Debug information (development only)
      ...(enableDebugMode && process.env.NODE_ENV === 'development' && {
        debugInfo: {
          detectionHistory: [],
          cacheStats: translationCache.getStats()
        }
      })
    };

    const renderEndTime = performance.now();
    performanceMetricsRef.current.renderTime = renderEndTime - renderStartTime;

    return value;
  }, [
    currentLang,
    isLoading,
    error,
    translations,
    t,
    tc,
    switchLanguage,
    preloadLanguage,
    clearCache,
    getPerformanceMetrics,
    isLanguageSupportedCheck,
    getAvailableLanguagesArray,
    getLocalizedPath,
    enableDebugMode,
    translationCache
  ]);

  // ===== Performance Monitoring =====
  
  useEffect(() => {
    if (enablePerformanceTracking && performance.now) {
      const interval = setInterval(() => {
        const metrics = getPerformanceMetrics();
        
        if (metrics.detectionTime > 100) {
          logger.warn('Slow language detection', { metrics });
        }
        
        if (metrics.translationLoadTime > 1000) {
          logger.warn('Slow translation loading', { metrics });
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [enablePerformanceTracking, getPerformanceMetrics]);

  // ===== System Initialization =====
  
  useEffect(() => {
    logger.debug('Language system initialized', {
      currentLang,
      pageType,
      enablePerformanceTracking
    });
  }, [currentLang, pageType, enablePerformanceTracking]);

  return (
    <UnifiedLanguageContext.Provider value={contextValue}>
      {children}
    </UnifiedLanguageContext.Provider>
  );
}

// ===== Hook for Using Context =====

/**
 * Main hook for accessing unified language system
 */
export function useLanguage(): UnifiedLanguageContextType {
  const context = useContext(UnifiedLanguageContext);
  
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  
  return context;
}

// ===== Specialized Hooks =====

/**
 * Translation-only hook for components that only need translation functions
 */
export function useTranslation() {
  const { t, tc, currentLang, isLoading } = useLanguage();
  
  return useMemo(() => ({
    t,
    tc,
    currentLang,
    isLoading
  }), [t, tc, currentLang, isLoading]);
}

/**
 * Language switcher-only hook for navigation components
 */
export function useLanguageSwitcher() {
  const { 
    currentLang, 
    switchLanguage, 
    isLoading, 
    isLanguageSupported,
    getAvailableLanguages 
  } = useLanguage();
  
  return useMemo(() => ({
    currentLang,
    switchLanguage,
    supportedLanguages: getAvailableLanguages(),
    isLoading,
    isLanguageSupported
  }), [currentLang, switchLanguage, isLoading, isLanguageSupported, getAvailableLanguages]);
}

// ===== Re-exports for Convenience =====

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
export type { 
  SupportedLanguage, 
  UnifiedLanguageContextType,
  LanguageProviderProps 
} from './language-types';