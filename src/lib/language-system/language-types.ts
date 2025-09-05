/**
 * @fileoverview Unified Language System Type Definitions
 * @module lib/language-system/language-types
 * 
 * @description
 * Complete TypeScript definitions for the unified language system.
 * Provides type safety for all language-related operations including detection,
 * translation, caching, and migration modes.
 * 
 * @architecture
 * Location: Core language system infrastructure
 * Layer: Type definitions and interfaces
 * Pattern: TypeScript module with comprehensive type exports
 * 
 * @dependencies
 * - External: React (for component types)
 * - Internal: None (foundation types)
 * 
 * @relationships
 * - Provides: Type definitions for all language system components
 * - Consumes: None (foundation layer)
 * - Children: All language system modules use these types
 * - Parent: None (top-level type definitions)
 * 
 * @performance
 * - Optimizations: Efficient type definitions with proper constraints
 * - Concerns: Type checking performance with large codebases
 * 
 * @example
 * ```typescript
 * import type { 
 *   SupportedLanguage, 
 *   LanguageDetectionResult,
 *   UnifiedLanguageContextType 
 * } from '@/lib/language-system/language-types';
 * 
 * const lang: SupportedLanguage = 'en';
 * const detection: LanguageDetectionResult = {
 *   language: 'ro',
 *   source: 'url-path',
 *   confidence: 1.0
 * };
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 language system migration. Provides unified type definitions
 * replacing fragmented types across multiple legacy contexts and hooks.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { ReactNode } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// ===== Core Language Types =====

/**
 * Supported language codes for the application
 */
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Default language constant with proper typing
 */
export type DefaultLanguage = typeof DEFAULT_LANGUAGE;

/**
 * Language detection sources with priority order
 */
export type LanguageDetectionSource = 
  | 'url-path'        // Highest priority: /properties/[slug]/[lang]
  | 'localStorage'    // Medium priority: stored preference
  | 'browser'         // Low priority: navigator.language
  | 'default';        // Fallback: DEFAULT_LANGUAGE

/**
 * Page types for context-aware language detection
 */
export type PageType = 
  | 'property'        // Property pages: /properties/[slug]/[lang]
  | 'booking'         // Booking pages: /booking/check/[slug]/[lang]
  | 'general'         // General pages: standard behavior
  | 'admin';          // Admin pages: minimal language switching


// ===== Language Detection Types =====

/**
 * Language detection configuration
 */
export interface LanguageDetectionConfig {
  pathname: string;
  pageType: PageType;
  headers?: Headers;
  enableBrowserDetection?: boolean;
  enableLocalStorageDetection?: boolean;
}

/**
 * Language detection result with metadata
 */
export interface LanguageDetectionResult {
  language: SupportedLanguage;
  source: LanguageDetectionSource;
  confidence: number; // 0-1, higher is more confident
  metadata?: {
    originalValue?: string;
    fallbackReason?: string;
    detectionTime?: number;
    legacy?: boolean;
    pattern?: string;
    patternType?: string;
    storageKey?: string;
    primaryLanguage?: string;
    fromLanguagesArray?: boolean;
    quality?: number;
  };
}

// ===== Translation Types =====

/**
 * Translation content structure
 */
export interface TranslationContent {
  [key: string]: string | TranslationContent;
}

/**
 * Multilingual content object
 */
export type MultilingualContent = {
  [K in SupportedLanguage]?: string;
} & Record<string, any>;

/**
 * Translation function type
 */
export type TranslationFunction = (
  key: string, 
  fallback?: string,
  variables?: Record<string, string | number>
) => string;

/**
 * Content translation function type
 */
export type ContentTranslationFunction = (
  content: MultilingualContent | string | null | undefined,
  fallback?: string
) => string;

// ===== Translation Cache Types =====

/**
 * Translation cache configuration
 */
export interface TranslationCacheConfig {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  enablePreloading?: boolean;
  preloadLanguages?: SupportedLanguage[];
  loadTimeout?: number;
}

/**
 * Cached translation entry
 */
export interface CachedTranslation {
  content: TranslationContent;
  timestamp: number;
  loadTime: number;
  fromCache: boolean;
}

/**
 * Translation cache statistics
 */
export interface TranslationCacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageLoadTime: number;
  memoryUsage: number;
}

// ===== Performance Types =====

/**
 * Language system performance metrics
 */
export interface LanguagePerformanceMetrics {
  detectionTime: number;
  translationLoadTime: number;
  renderTime: number;
  switchTime: number;
  cacheHitRate: number;
  totalTranslations: number;
}

/**
 * Performance tracking configuration
 */
export interface PerformanceConfig {
  enableTracking: boolean;
  slowThreshold: number; // Milliseconds
  enableWarnings: boolean;
  sampleRate: number; // 0-1, percentage of operations to track
}

// ===== Context and Hook Types =====

/**
 * Unified language context state
 */
export interface UnifiedLanguageState {
  currentLang: SupportedLanguage;
  isLoading: boolean;
  error: string | null;
  translations: TranslationContent;
  detectionResult: LanguageDetectionResult | null;
  performanceMetrics: LanguagePerformanceMetrics;
}

/**
 * Unified language context actions
 */
export interface UnifiedLanguageActions {
  switchLanguage: (
    language: SupportedLanguage, 
    options?: LanguageSwitchOptions
  ) => Promise<void>;
  
  preloadLanguage: (language: SupportedLanguage) => Promise<void>;
  
  clearCache: (language?: SupportedLanguage) => void;
  
  getPerformanceMetrics: () => LanguagePerformanceMetrics;
  
  isLanguageSupported: (language: string) => language is SupportedLanguage;
  
  getAvailableLanguages: () => SupportedLanguage[];
  
  getLocalizedPath: (path: string, language?: SupportedLanguage) => string;
}

/**
 * Complete unified language context type
 */
export interface UnifiedLanguageContextType extends 
  UnifiedLanguageState, 
  UnifiedLanguageActions {
  
  // Translation functions
  t: TranslationFunction;
  tc: ContentTranslationFunction;
  
  // Backwards compatibility aliases
  currentLanguage: SupportedLanguage; // Alias for currentLang
  changeLanguage: UnifiedLanguageActions['switchLanguage']; // Alias for switchLanguage
  
  // Debug information (development only)
  debugInfo?: {
    detectionHistory: LanguageDetectionResult[];
    cacheStats: TranslationCacheStats;
  };
}

// ===== Language Switch Options =====

/**
 * Language switching options
 */
export interface LanguageSwitchOptions {
  updateUrl?: boolean;
  preserveQueryParams?: boolean;
  updateLocalStorage?: boolean;
  redirect?: boolean;
  skipTranslationLoad?: boolean;
}

// ===== Provider Configuration =====

/**
 * Unified language provider configuration
 */
export interface UnifiedLanguageProviderConfig {
  initialLanguage?: SupportedLanguage;
  pageType?: PageType;
  enablePerformanceTracking?: boolean;
  enableDebugMode?: boolean;
  cacheConfig?: TranslationCacheConfig;
  performanceConfig?: PerformanceConfig;
  onLanguageChange?: (
    from: SupportedLanguage, 
    to: SupportedLanguage
  ) => void;
  onError?: (error: Error, context: string) => void;
}

/**
 * Language provider props
 */
export interface LanguageProviderProps extends UnifiedLanguageProviderConfig {
  children: ReactNode;
}

// ===== Specialized Hook Types =====

/**
 * Translation-only hook interface
 */
export interface TranslationHookResult {
  t: TranslationFunction;
  tc: ContentTranslationFunction;
  currentLang: SupportedLanguage;
  isLoading: boolean;
}

/**
 * Language switcher-only hook interface
 */
export interface LanguageSwitcherHookResult {
  currentLang: SupportedLanguage;
  switchLanguage: UnifiedLanguageActions['switchLanguage'];
  supportedLanguages: SupportedLanguage[];
  isLoading: boolean;
  isLanguageSupported: (language: string) => language is SupportedLanguage;
}


// ===== Error Types =====

/**
 * Language system error codes
 */
export type LanguageErrorCode = 
  | 'TRANSLATION_LOAD_FAILED'
  | 'LANGUAGE_DETECTION_FAILED'
  | 'UNSUPPORTED_LANGUAGE'
  | 'CACHE_ERROR'
  | 'PERFORMANCE_WARNING';

/**
 * Language system error
 */
export interface LanguageError extends Error {
  code: LanguageErrorCode;
  language?: SupportedLanguage;
  context?: string;
  metadata?: Record<string, any>;
}

// ===== Utility Types =====

/**
 * Deep readonly utility for immutable state
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract language from path utility type
 */
export type ExtractLanguageFromPath<T extends string> = 
  T extends `${string}/${infer Lang}/${string}` 
    ? Lang extends SupportedLanguage 
      ? Lang 
      : never
    : never;

// ===== Export Collections =====

/**
 * All core types for external consumption
 */
export type CoreLanguageTypes = {
  SupportedLanguage: SupportedLanguage;
  DefaultLanguage: DefaultLanguage;
  LanguageDetectionSource: LanguageDetectionSource;
  PageType: PageType;
};

/**
 * All context and hook types for external consumption
 */
export type ContextHookTypes = {
  UnifiedLanguageContextType: UnifiedLanguageContextType;
  TranslationHookResult: TranslationHookResult;
  LanguageSwitcherHookResult: LanguageSwitcherHookResult;
  LanguageProviderProps: LanguageProviderProps;
};

/**
 * All configuration types for external consumption
 */
export type ConfigurationTypes = {
  UnifiedLanguageProviderConfig: UnifiedLanguageProviderConfig;
  TranslationCacheConfig: TranslationCacheConfig;
  PerformanceConfig: PerformanceConfig;
  LanguageSwitchOptions: LanguageSwitchOptions;
};