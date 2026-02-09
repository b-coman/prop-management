/**
 * @fileoverview Smart Language Detection System
 * @module lib/language-system/language-detection
 * 
 * @description
 * Intelligent language detection with multiple sources and priority-based resolution.
 * Handles URL paths, query parameters, localStorage, and browser preferences with
 * SSR-safe initialization and performance optimization.
 * 
 * @architecture
 * Location: Core language system infrastructure  
 * Layer: Business logic and detection algorithms
 * Pattern: Functional detection with priority ordering and fallback chain
 * 
 * @dependencies
 * - Internal: @/lib/language-constants, @/lib/logger, ./language-types
 * - External: None (browser APIs accessed safely)
 * 
 * @relationships
 * - Provides: Language detection logic for LanguageProvider
 * - Consumes: Browser APIs, URL parameters, localStorage
 * - Children: None (leaf utility module)
 * - Parent: LanguageProvider.tsx uses this for initial detection
 * 
 * @performance
 * - Optimizations: Cached detection results, efficient regex patterns, early returns
 * - Concerns: localStorage access, regex parsing performance
 * 
 * @example
 * ```typescript
 * import { detectLanguage, createDetectionConfig } from '@/lib/language-system/language-detection';
 * 
 * const config = createDetectionConfig({
 *   pathname: '/properties/test/ro',
 *   pageType: 'property'
 * });
 * 
 * const result = await detectLanguage(config);
 * console.log(result.language); // 'ro'
 * console.log(result.source); // 'url-path'
 * console.log(result.confidence); // 1.0
 * ```
 * 
 * @migration-notes
 * Language system migration COMPLETED (2025-06-05). Unified detection system successfully
 * replaced legacy fragmented implementations. Archived legacy files available in
 * archive/language-migration/ for reference.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { loggers } from '@/lib/logger';
import type {
  SupportedLanguage,
  LanguageDetectionConfig,
  LanguageDetectionResult,
  LanguageDetectionSource,
  PageType
} from './language-types';

const logger = loggers.languageSystem;

// ===== Detection Configuration =====

/**
 * Default detection configuration
 */
const DEFAULT_DETECTION_CONFIG: Partial<LanguageDetectionConfig> = {
  pageType: 'general',
  enableBrowserDetection: true,
  enableLocalStorageDetection: true
};

/**
 * Creates a complete detection configuration with defaults
 */
export function createDetectionConfig(
  config: Partial<LanguageDetectionConfig>
): LanguageDetectionConfig {
  return {
    ...DEFAULT_DETECTION_CONFIG,
    ...config
  } as LanguageDetectionConfig;
}

// ===== Core Detection Functions =====

/**
 * Main language detection function with priority-based resolution
 */
export async function detectLanguage(
  config: LanguageDetectionConfig
): Promise<LanguageDetectionResult> {
  const startTime = performance.now();
  
  logger.debug('Starting language detection', {
    pathname: config.pathname,
    pageType: config.pageType,
    legacySearchParamsRemoved: true
  });

  try {
    // Priority 1: URL path detection (highest confidence)
    const urlPathResult = detectFromUrlPath(config);
    if (urlPathResult) {
      const endTime = performance.now();
      logger.debug('Language detected from URL path', {
        language: urlPathResult.language,
        source: urlPathResult.source,
        detectionTime: endTime - startTime
      });
      return {
        ...urlPathResult,
        metadata: {
          ...urlPathResult.metadata,
          detectionTime: endTime - startTime
        }
      };
    }

    // Priority 2: localStorage detection (if enabled)
    if (config.enableLocalStorageDetection) {
      const storageResult = await detectFromLocalStorage(config);
      if (storageResult) {
        const endTime = performance.now();
        logger.debug('Language detected from localStorage', {
          language: storageResult.language,
          source: storageResult.source,
          detectionTime: endTime - startTime
        });
        return {
          ...storageResult,
          metadata: {
            ...storageResult.metadata,
            detectionTime: endTime - startTime
          }
        };
      }
    }

    // Priority 3: Browser language detection (if enabled)
    if (config.enableBrowserDetection) {
      const browserResult = detectFromBrowser(config);
      if (browserResult) {
        const endTime = performance.now();
        logger.debug('Language detected from browser', {
          language: browserResult.language,
          source: browserResult.source,
          detectionTime: endTime - startTime
        });
        return {
          ...browserResult,
          metadata: {
            ...browserResult.metadata,
            detectionTime: endTime - startTime
          }
        };
      }
    }

    // Priority 4: Default fallback
    const endTime = performance.now();
    const defaultResult: LanguageDetectionResult = {
      language: DEFAULT_LANGUAGE as SupportedLanguage,
      source: 'default',
      confidence: 0.1,
      metadata: {
        fallbackReason: 'No other detection method succeeded',
        detectionTime: endTime - startTime
      }
    };

    logger.debug('Using default language fallback', {
      language: defaultResult.language,
      detectionTime: endTime - startTime
    });

    return defaultResult;

  } catch (error) {
    const endTime = performance.now();
    logger.error('Language detection failed', error, {
      pathname: config.pathname,
      pageType: config.pageType,
      detectionTime: endTime - startTime
    });

    // Return default language on error
    return {
      language: DEFAULT_LANGUAGE as SupportedLanguage,
      source: 'default',
      confidence: 0.1,
      metadata: {
        fallbackReason: 'Detection error occurred',
        detectionTime: endTime - startTime
      }
    };
  }
}

// ===== URL Path Detection =====

/**
 * Detects language from URL path segments
 * Handles different page types with specific URL patterns
 */
function detectFromUrlPath(
  config: LanguageDetectionConfig
): LanguageDetectionResult | null {
  const { pathname, pageType } = config;
  
  try {
    const segments = pathname.split('/').filter(Boolean);

    // Property pages: /properties/[slug]/[lang]
    if (pageType === 'property' || pathname.includes('/properties/')) {
      const propertyIndex = segments.indexOf('properties');
      if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
        const possibleLang = segments[propertyIndex + 2];
        if (isSupportedLanguage(possibleLang)) {
          return {
            language: possibleLang,
            source: 'url-path',
            confidence: 1.0,
            metadata: {
              originalValue: possibleLang,
              patternType: 'property-page'
            }
          };
        }
      }
    }

    // General pages: /[lang]/path
    if (segments.length > 0) {
      const firstSegment = segments[0];
      if (isSupportedLanguage(firstSegment)) {
        return {
          language: firstSegment,
          source: 'url-path',
          confidence: 0.9,
          metadata: {
            originalValue: firstSegment,
            patternType: 'general-page'
          }
        };
      }
    }

    // Admin pages: /admin/[lang]/path
    if (pageType === 'admin' && segments.includes('admin')) {
      const adminIndex = segments.indexOf('admin');
      if (adminIndex >= 0 && segments[adminIndex + 1]) {
        const possibleLang = segments[adminIndex + 1];
        if (isSupportedLanguage(possibleLang)) {
          return {
            language: possibleLang,
            source: 'url-path',
            confidence: 0.9,
            metadata: {
              originalValue: possibleLang,
              patternType: 'admin-page'
            }
          };
        }
      }
    }

    return null;

  } catch (error) {
    logger.warn('URL path detection failed', { pathname, error });
    return null;
  }
}

// ===== Query Parameter Detection =====
// REMOVED: Legacy search params language detection no longer supported.
// Language detection now uses path-based detection only for consistency
// and improved SEO. Query parameters are preserved for booking data only.

// ===== localStorage Detection =====

/**
 * Detects language from localStorage with SSR safety
 */
async function detectFromLocalStorage(
  config: LanguageDetectionConfig
): Promise<LanguageDetectionResult | null> {
  // SSR safety check
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedLang = localStorage.getItem('preferredLanguage');
    
    if (savedLang && isSupportedLanguage(savedLang)) {
      return {
        language: savedLang,
        source: 'localStorage',
        confidence: 0.6,
        metadata: {
          originalValue: savedLang,
          storageKey: 'preferredLanguage'
        }
      };
    }

    return null;

  } catch (error) {
    logger.warn('localStorage detection failed', { error });
    return null;
  }
}

// ===== Browser Detection =====

/**
 * Detects language from browser preferences with SSR safety
 */
function detectFromBrowser(
  config: LanguageDetectionConfig
): LanguageDetectionResult | null {
  // SSR safety check
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  try {
    // Check navigator.language
    const browserLang = navigator.language?.toLowerCase();
    if (browserLang) {
      // Extract primary language code (e.g., 'en' from 'en-US')
      const primaryLang = browserLang.split('-')[0];
      
      if (isSupportedLanguage(primaryLang)) {
        return {
          language: primaryLang,
          source: 'browser',
          confidence: 0.4,
          metadata: {
            originalValue: browserLang,
            primaryLanguage: primaryLang
          }
        };
      }
    }

    // Check navigator.languages array
    if (navigator.languages && Array.isArray(navigator.languages)) {
      for (const lang of navigator.languages) {
        const primaryLang = lang.toLowerCase().split('-')[0];
        if (isSupportedLanguage(primaryLang)) {
          return {
            language: primaryLang,
            source: 'browser',
            confidence: 0.3,
            metadata: {
              originalValue: lang,
              primaryLanguage: primaryLang,
              fromLanguagesArray: true
            }
          };
        }
      }
    }

    return null;

  } catch (error) {
    logger.warn('Browser detection failed', { error });
    return null;
  }
}

// ===== Header Detection (Server-side) =====

/**
 * Detects language from Accept-Language header (server-side)
 */
export function detectFromHeaders(
  headers: Headers
): LanguageDetectionResult | null {
  try {
    const acceptLang = headers.get('accept-language');
    
    if (!acceptLang) {
      return null;
    }

    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ro;q=0.8")
    const languages = acceptLang
      .split(',')
      .map(lang => {
        const [language, quality] = lang.trim().split(';q=');
        return {
          language: language.toLowerCase().split('-')[0],
          quality: quality ? parseFloat(quality) : 1.0
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported language
    for (const { language, quality } of languages) {
      if (isSupportedLanguage(language)) {
        return {
          language,
          source: 'browser',
          confidence: Math.min(quality * 0.5, 0.5), // Max confidence 0.5 for headers
          metadata: {
            originalValue: acceptLang,
            primaryLanguage: language,
            quality
          }
        };
      }
    }

    return null;

  } catch (error) {
    logger.warn('Header detection failed', { error });
    return null;
  }
}

// ===== Language Validation =====

/**
 * Type guard to check if a string is a supported language
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

/**
 * Validates and normalizes a language code
 */
export function normalizeLanguage(lang: string): SupportedLanguage {
  const normalizedLang = lang.toLowerCase().trim();
  
  // Handle common variations
  const languageMap: Record<string, SupportedLanguage> = {
    'romanian': 'ro',
    'english': 'en',
    'eng': 'en',
    'rom': 'ro'
  };

  const mapped = languageMap[normalizedLang];
  if (mapped) {
    return mapped;
  }

  // Extract primary language code
  const primaryLang = normalizedLang.split('-')[0];
  
  if (isSupportedLanguage(primaryLang)) {
    return primaryLang;
  }

  return DEFAULT_LANGUAGE as SupportedLanguage;
}

// ===== Utility Functions =====

/**
 * Gets all available languages
 */
export function getAvailableLanguages(): SupportedLanguage[] {
  return [...SUPPORTED_LANGUAGES] as SupportedLanguage[];
}

/**
 * Gets the default language
 */
export function getDefaultLanguage(): SupportedLanguage {
  return DEFAULT_LANGUAGE as SupportedLanguage;
}

/**
 * Creates localized URL path based on page type
 */
export function createLocalizedPath(
  path: string,
  language: SupportedLanguage,
  pageType: PageType = 'general'
): string {
  try {
    const segments = path.split('/').filter(Boolean);

    // Property pages: /properties/[slug]/[lang]
    if (pageType === 'property' || path.includes('/properties/')) {
      const propertyIndex = segments.indexOf('properties');
      if (propertyIndex >= 0 && segments[propertyIndex + 1]) {
        // Remove existing language if present
        if (segments[propertyIndex + 2] && isSupportedLanguage(segments[propertyIndex + 2])) {
          segments.splice(propertyIndex + 2, 1);
        }

        // Add new language if not default
        if (language !== DEFAULT_LANGUAGE) {
          segments.splice(propertyIndex + 2, 0, language);
        }

        return '/' + segments.join('/');
      }

      // Custom domain: property page type but path doesn't include /properties/
      // Treat like general page for localization (add /{lang} prefix)
      if (segments.length > 0 && isSupportedLanguage(segments[0])) {
        segments.shift();
      }
      if (language !== DEFAULT_LANGUAGE) {
        segments.unshift(language);
      }
      return segments.length > 0 ? '/' + segments.join('/') : '/';
    }

    // General pages: /[lang]/path
    if (pageType === 'general') {
      // Remove existing language prefix if present
      if (segments.length > 0 && isSupportedLanguage(segments[0])) {
        segments.shift();
      }
      
      // Add new language prefix if not default
      if (language !== DEFAULT_LANGUAGE) {
        segments.unshift(language);
      }
      
      return segments.length > 0 ? '/' + segments.join('/') : '/';
    }

    // Booking pages: preserve original path (use query params instead)
    if (pageType === 'booking') {
      return path;
    }

    return path;

  } catch (error) {
    logger.warn('Path localization failed', { path, language, pageType, error });
    return path;
  }
}

/**
 * Performance-optimized detection for hot paths
 */
export function fastDetectLanguageFromPath(pathname: string): SupportedLanguage | null {
  const segments = pathname.split('/');
  
  // Quick property page check: /properties/[slug]/[lang]
  const propertyIndex = segments.indexOf('properties');
  if (propertyIndex >= 0 && segments[propertyIndex + 2]) {
    const lang = segments[propertyIndex + 2];
    return isSupportedLanguage(lang) ? lang : null;
  }
  
  // Quick general page check: /[lang]/path
  if (segments.length > 1 && segments[1]) {
    const lang = segments[1];
    return isSupportedLanguage(lang) ? lang : null;
  }
  
  return null;
}

// ===== Migration Support =====

/**
 * Compares new detection with legacy detection for dual-check mode
 */
export function compareDetectionResults(
  newResult: LanguageDetectionResult,
  legacyResult: any
): {
  matches: boolean;
  discrepancies: string[];
} {
  const discrepancies: string[] = [];
  
  // Compare language
  if (newResult.language !== legacyResult.language) {
    discrepancies.push(`Language mismatch: new=${newResult.language}, legacy=${legacyResult.language}`);
  }
  
  // Compare confidence (if available)
  if (legacyResult.confidence !== undefined && 
      Math.abs(newResult.confidence - legacyResult.confidence) > 0.1) {
    discrepancies.push(`Confidence mismatch: new=${newResult.confidence}, legacy=${legacyResult.confidence}`);
  }
  
  return {
    matches: discrepancies.length === 0,
    discrepancies
  };
}