# Language System Architecture Analysis & Design

## Current State (LEGACY)

### Fragmented Architecture
```
Current Language System (FRAGMENTED)
├── 📁 Multiple Contexts (3 found)
│   ├── LanguageContext.tsx (Property pages)
│   ├── BookingProvider.tsx (Booking pages - wrapped)
│   └── SimpleAuthContext.tsx (Contains language logic)
│
├── 🎣 Multiple Hooks (2 found)  
│   ├── useLanguage.ts (Complex detection logic)
│   └── useOptimizedLanguage.ts (Performance variant)
│
├── 🔍 Detection Methods (4 different)
│   ├── URL Paths: /properties/[slug]/[lang]
│   ├── Query Params: ?language=en
│   ├── localStorage: preferredLanguage  
│   └── Browser: navigator.language
│
├── 🌐 Translation Systems (2 separate)
│   ├── t() function (UI strings)
│   └── tc() function (Content objects)
│
└── ⚠️ Issues Identified
    ├── Hydration mismatches (2 files)
    ├── Performance overhead (4 files)
    ├── Mixed URL/query usage (14 files)
    └── Multiple context conflicts
```

### Current File Distribution
- **Contexts**: 3 files (conflicting systems)
- **Hooks**: 2 files (redundant implementations)  
- **Components**: 80 files (using language features)
- **Utils**: 0 files (scattered utility functions)
- **Translations**: 0 files (external locale files)

### Current Problems
1. **Multiple Sources of Truth**: 3 different contexts managing language
2. **Hydration Issues**: Server/client language detection mismatches
3. **Performance Overhead**: Multiple systems running simultaneously  
4. **Inconsistent APIs**: Different interfaces across contexts
5. **Mixed Storage Methods**: URL paths + query params + localStorage

## Target State (UNIFIED)

### Clean Unified Architecture
```
New Language System (UNIFIED)
├── 🎯 Single Source of Truth
│   ├── UnifiedLanguageProvider (One context for all)
│   ├── Smart detection with priority order
│   ├── SSR-safe initialization
│   └── Performance optimized caching
│
├── 🎣 Single Hook Interface
│   ├── useLanguage() (Unified API)
│   ├── currentLang: string
│   ├── t(key: string): string
│   ├── tc(content: any): string  
│   ├── switchLanguage(lang: string): void
│   └── isLoading: boolean
│
├── 🔍 Smart Detection Priority
│   ├── 1. URL Path (/properties/[slug]/[lang])
│   ├── 2. Query Param (?language=)
│   ├── 3. localStorage (preferredLanguage)
│   ├── 4. Browser (navigator.language)
│   └── 5. Default (en)
│
├── 🌐 Unified Translation System
│   ├── Cached translation loading
│   ├── Fallback handling
│   ├── Performance monitoring
│   └── Type-safe APIs
│
└── ✅ Benefits Achieved
    ├── Zero hydration issues
    ├── ~30% performance improvement
    ├── Single maintenance point
    └── Consistent behavior everywhere
```

### Target File Structure
```
src/lib/language-system/
├── LanguageProvider.tsx       # Single context provider
├── useLanguage.ts            # Unified hook
├── language-detection.ts     # Smart detection logic
├── translation-cache.ts      # Performance optimization
├── language-types.ts         # TypeScript definitions
└── language-utils.ts         # Helper functions
```

## Migration Architecture (FEATURE FLAGS)

### Phase-Based Migration with Safety
```
Migration Architecture (SAFETY FIRST)
├── 🏗️ Feature Flag Control
│   ├── LANGUAGE_SYSTEM_MODE environment variable
│   ├── Instant rollback capability
│   ├── No deployment needed for rollback
│   └── Real-time mode switching
│
├── 📊 Migration Phases
│   ├── LEGACY: Current system only (baseline)
│   ├── DUAL_CHECK: Both systems, compare results
│   ├── UNIFIED: New system only (target)
│   └── CLEANUP: Remove legacy code
│
├── 🔍 Dual-Check Validation
│   ├── Run both systems in parallel
│   ├── Compare language detection results
│   ├── Log any discrepancies
│   ├── Automatic fallback to legacy on errors
│   └── Performance comparison monitoring
│
└── 🛡️ Safety Mechanisms
    ├── Comprehensive fallback logic
    ├── Real-time health monitoring
    ├── Automatic error recovery
    └── Data preservation guarantees
```

## API Compatibility Matrix

### Current APIs (To Preserve)
```typescript
// LanguageContext APIs (Property pages)
const { currentLang, switchLanguage, t, tc, isLoading } = useLanguageContext();

// useLanguage Hook APIs (Language selector)  
const { currentLang, switchLanguage, getLocalizedPath } = useLanguage();

// BookingProvider APIs (Booking pages)
const { initialLanguage } = props; // Passed through
```

### Unified API (Target)
```typescript
// Single unified interface for all use cases
const { 
  currentLang,           // Current language code
  switchLanguage,        // Smart language switching
  t,                     // UI string translation
  tc,                    // Content object translation
  isLoading,             // Translation loading state
  getLocalizedPath,      // URL generation utility
  supportedLanguages,    // Available languages
  isLanguageSupported    // Validation utility
} = useLanguage();
```

### Backwards Compatibility Strategy
1. **Preserve all existing APIs** during migration
2. **Gradual deprecation** with warning messages
3. **Automatic migration** of simple use cases
4. **Documentation** for manual migration steps

## Performance Architecture

### Current Performance Issues
- **Multiple contexts** creating unnecessary re-renders
- **Redundant detection** running multiple times
- **Inefficient translation loading** without caching
- **Memory leaks** from multiple language systems

### Target Performance Optimizations
```typescript
// Memoized language detection
const currentLang = useMemo(() => detectLanguage(), [pathname, queryParams]);

// Cached translation loading
const translations = useMemo(() => loadCachedTranslations(currentLang), [currentLang]);

// Optimized context value
const contextValue = useMemo(() => ({
  currentLang,
  switchLanguage: useCallback(switchLanguage, []),
  t: useCallback(t, [translations]),
  tc: useCallback(tc, [translations, currentLang])
}), [currentLang, translations]);
```

### Performance Targets
- **30% faster** language detection
- **50% reduction** in re-renders
- **90% reduction** in redundant API calls
- **Zero memory leaks** from language systems

## Security & Data Safety

### Data Preservation Guarantees
- **User language preferences** preserved across migration
- **Translation data** remains unchanged
- **URL structures** maintained for SEO
- **Browser compatibility** preserved

### Migration Safety Features
- **Comprehensive backups** before any changes
- **Rollback verification** before deployment
- **Health monitoring** during migration
- **Emergency procedures** for critical issues

---

**Document Status**: Phase 1 - Analysis Complete
**Next Phase**: Implementation of unified system with feature flags
**Safety Level**: Maximum (following availability migration patterns)