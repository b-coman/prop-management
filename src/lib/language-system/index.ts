/**
 * @fileoverview Unified Language System - Main Entry Point
 * @module lib/language-system
 * 
 * @description
 * Central export module for the unified language system. Provides clean,
 * organized access to all language functionality including components,
 * hooks, utilities, and types for the entire application.
 * 
 * @architecture
 * Location: Core language system infrastructure
 * Layer: Public API and export interface
 * Pattern: Barrel export with organized sections
 * 
 * @dependencies
 * - Internal: All language system modules
 * - External: None (aggregation module)
 * 
 * @relationships
 * - Provides: Unified export interface for external consumers
 * - Consumes: All internal language system modules
 * - Children: External components importing language functionality
 * - Parent: None (top-level export module)
 * 
 * @performance
 * - Optimizations: Tree-shakeable exports, organized imports
 * - Concerns: Bundle size if entire module imported
 * 
 * @example
 * ```typescript
 * // Main usage
 * import { LanguageProvider, useLanguage } from '@/lib/language-system';
 * 
 * // Specialized hooks
 * import { useTranslation, useLanguageSwitcher } from '@/lib/language-system';
 * 
 * // Utilities
 * import { detectLanguage, TranslationCache } from '@/lib/language-system';
 * 
 * // Types
 * import type { SupportedLanguage, LanguageProviderProps } from '@/lib/language-system';
 * ```
 * 
 * @migration-notes
 * Part of Phase 2 language system migration. Provides single entry point
 * for all language functionality, replacing fragmented imports from
 * multiple legacy files with clean, organized interface.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

// ===== Core Components =====

/**
 * Main language provider component - single source of truth for language state
 */
export { 
  LanguageProvider,
  useLanguage as useUnifiedLanguage,
  useTranslation as useTranslationFromProvider,
  useLanguageSwitcher as useLanguageSwitcherFromProvider
} from './LanguageProvider';

// ===== Hooks =====

/**
 * Primary hooks for language functionality
 */
export {
  useLanguage,
  useTranslation,
  useLanguageSwitcher,
  useLanguagePerformance,
  useLanguageDetection,
  useLanguageValidation,
  useLanguageUrls,
  useLanguageDebug,
  
  // Backwards compatibility hooks
  useLegacyLanguage,
  useOptimizedLanguage,
  useSmartLanguage,
  
  // Default export
  default as useLanguageDefault
} from './useLanguage';

// ===== Language Detection =====

/**
 * Language detection utilities and functions
 */
export {
  detectLanguage,
  createDetectionConfig,
  detectFromHeaders,
  isSupportedLanguage,
  normalizeLanguage,
  getAvailableLanguages,
  getDefaultLanguage,
  createLocalizedPath,
  fastDetectLanguageFromPath,
  compareDetectionResults
} from './language-detection';

// ===== Translation Cache =====

/**
 * Translation caching system for performance optimization
 */
export {
  TranslationCache,
  globalTranslationCache,
  createTranslationCache,
  preloadTranslations,
  getTranslation,
  validateCacheHealth,
  optimizeCache
} from './translation-cache';

// ===== Types =====

/**
 * Core type definitions
 */
export type {
  // Core language types
  SupportedLanguage,
  DefaultLanguage,
  LanguageDetectionSource,
  PageType,
  
  // Detection types
  LanguageDetectionConfig,
  LanguageDetectionResult,
  
  // Translation types
  TranslationContent,
  MultilingualContent,
  TranslationFunction,
  ContentTranslationFunction,
  
  // Cache types
  TranslationCacheConfig,
  CachedTranslation,
  TranslationCacheStats,
  
  // Performance types
  LanguagePerformanceMetrics,
  PerformanceConfig,
  
  // Context and hook types
  UnifiedLanguageState,
  UnifiedLanguageActions,
  UnifiedLanguageContextType,
  TranslationHookResult,
  LanguageSwitcherHookResult,
  
  // Configuration types
  LanguageSwitchOptions,
  UnifiedLanguageProviderConfig,
  LanguageProviderProps,
  
  
  // Error types
  LanguageErrorCode,
  LanguageError,
  
  // Utility types
  DeepReadonly,
  ExtractLanguageFromPath,
  
  // Type collections
  CoreLanguageTypes,
  ContextHookTypes,
  ConfigurationTypes
} from './language-types';

// ===== Constants =====

/**
 * Language constants re-exported for convenience
 */
export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// ===== Default Export =====

/**
 * Default export for convenience imports
 */
export { useLanguage as default } from './useLanguage';