# Booking Page Language Detection Migration

**Created**: 2025-06-05  
**Status**: Implementation Phase  
**Issue**: [#34](https://github.com/b-coman/prop-management/issues/34)

## Executive Summary

Migrating booking page language detection from search parameter approach (`?lang=ro`) to path-based approach (`/booking/check/slug/ro`) to eliminate race conditions and achieve architectural consistency with property pages.

## Current Architecture Analysis

### Current Booking Page Structure
```
File: /src/app/booking/check/[slug]/page.tsx
URL:  /booking/check/prahova-mountain-chalet?checkIn=2025-06-24&checkOut=2025-06-27&lang=ro
```

### Current Language Detection Flow
```typescript
// Server-side detection (lines 75-83)
const { checkIn, checkOut, currency, lang, language } = await searchParams;
const rawLanguage = lang || language;
const detectedLanguage = rawLanguage && SUPPORTED_LANGUAGES.includes(rawLanguage) 
  ? rawLanguage 
  : DEFAULT_LANGUAGE;

// Client-side hydration
<BookingPageV2 initialLanguage={detectedLanguage} />
```

### Identified Problems
1. **Race Condition**: Search params not available during initial client hydration
2. **Language Flicker**: Romanian → English → Romanian transition
3. **Architecture Inconsistency**: Property pages use paths, booking pages use search params
4. **Complexity**: Dual detection system (server + client) with timing conflicts

## Target Architecture

### New Booking Page Structure
```
File: /src/app/booking/check/[slug]/[[...path]]/page.tsx
URL:  /booking/check/prahova-mountain-chalet/ro?checkIn=2025-06-24&checkOut=2025-06-27
```

### New Language Detection Flow
```typescript
// Server-side detection (same as property pages)
let language = DEFAULT_LANGUAGE;
if (path?.length > 0 && SUPPORTED_LANGUAGES.includes(path[0])) {
  language = path[0];
}

// Client-side hydration (immediate, no race condition)
<BookingPageV2 initialLanguage={language} />
```

## Detailed Migration Plan

### Phase 1: Routing Structure Update

#### Step 1.1: File System Changes
```bash
# Current structure
src/app/booking/check/[slug]/page.tsx

# New structure  
src/app/booking/check/[slug]/[[...path]]/page.tsx
```

#### Step 1.2: Route Handler Updates
```typescript
// New page component signature
export default async function BookingCheckPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    currency?: string;
    // Remove: lang?: string; language?: string;
  }>;
}) {
  const { slug } = await params;
  const path = await params.path; // New: optional path segments
  
  // Language detection from path (not search params)
  let language = DEFAULT_LANGUAGE;
  if (path?.length > 0 && SUPPORTED_LANGUAGES.includes(path[0])) {
    language = path[0];
  }
}
```

### Phase 2: Language Detection Implementation

#### Step 2.1: Copy Property Page Logic
```typescript
// Source: /src/app/properties/[slug]/[[...path]]/page.tsx (lines 136-144)
// Destination: New booking page

// Extract language from path if present
let language = DEFAULT_LANGUAGE;
let actualPath = path;

// Check if the first path segment is a supported language
if (actualPath.length > 0 && SUPPORTED_LANGUAGES.includes(actualPath[0])) {
  language = actualPath[0];
  actualPath = actualPath.slice(1); // Remove language from path
}
```

#### Step 2.2: Remove Search Parameter Detection
```typescript
// REMOVE these lines from booking page:
const { lang, language } = await searchParams;
const rawLanguage = lang || language;
const detectedLanguage = rawLanguage && SUPPORTED_LANGUAGES.includes(rawLanguage) 
  ? rawLanguage 
  : DEFAULT_LANGUAGE;
```

### Phase 3: URL Generation Updates

#### Step 3.1: Property Site Navigation
```typescript
// Update booking link generation in property pages
// From: `/booking/check/${slug}?lang=${currentLang}&dates`
// To:   `/booking/check/${slug}/${currentLang}?dates`
```

#### Step 3.2: Language Selector Updates
```typescript
// Update language switching in LanguageProvider
// For booking pages, update URL path instead of search params
if (pageType === 'booking') {
  // From: currentSearchParams.set('lang', language);
  // To:   navigate to path-based URL
  const newPath = `/booking/check/${propertySlug}/${language}${searchParams}`;
  router.replace(newPath);
}
```

### Phase 4: Testing Strategy

#### Step 4.1: Unit Tests
```typescript
// Test path parsing logic
describe('Booking Page Language Detection', () => {
  it('should extract language from path', () => {
    const path = ['ro'];
    const result = extractLanguageFromPath(path);
    expect(result).toBe('ro');
  });
  
  it('should default to English for invalid language', () => {
    const path = ['invalid'];
    const result = extractLanguageFromPath(path);
    expect(result).toBe('en');
  });
});
```

#### Step 4.2: Integration Tests
```typescript
// Test user navigation flows
describe('Property to Booking Navigation', () => {
  it('should preserve language context in URL', () => {
    // Navigate from property page in Romanian
    // Verify booking URL includes /ro path
  });
});
```

#### Step 4.3: Manual Test Cases
```
Test Case 1: Property Site Navigation
1. Browse property page in Romanian
2. Click "Book Now"
3. Verify: URL is /booking/check/slug/ro?dates
4. Verify: No language flicker
5. Verify: All text in Romanian

Test Case 2: Shared Booking Link
1. Fresh browser session
2. Navigate to /booking/check/slug/ro?dates
3. Verify: Immediate Romanian rendering
4. Verify: No flicker or English flash

Test Case 3: Invalid Language Path
1. Navigate to /booking/check/slug/invalid?dates
2. Verify: Falls back to English
3. Verify: URL remains as-is (graceful handling)
```

### Phase 5: Legacy Code Cleanup

#### Step 5.1: Search Parameter Detection Removal
```typescript
// Files to update:
// - /src/app/booking/check/[slug]/[[...path]]/page.tsx
// - Remove search param language detection logic
// - Remove lang/language from searchParams interface
```

#### Step 5.2: Unused Import Cleanup
```typescript
// Remove unused imports related to search param detection
// Update any utility functions that handled search param language detection
```

#### Step 5.3: Documentation Updates
```markdown
// Update:
// - This file (mark as completed)
// - Architecture overview docs
// - Language system documentation
// - Any API documentation mentioning booking URLs
```

## Risk Assessment

### Low Risk
- ✅ **No external users**: No breaking changes for existing users
- ✅ **Proven pattern**: Property pages already use this approach successfully
- ✅ **Backward compatible**: Can handle URLs without language gracefully

### Medium Risk
- ⚠️ **Route changes**: Next.js routing structure modification
- ⚠️ **URL generation**: Need to update all booking link generation
- ⚠️ **Testing coverage**: Need comprehensive testing of both user flows

### Mitigation Strategies
- **Gradual rollout**: Implement and test each phase independently
- **Comprehensive testing**: Cover both navigation scenarios thoroughly
- **Documentation**: Clear documentation of new URL patterns
- **Rollback plan**: Keep original file structure until fully tested

## Success Metrics

### Technical Metrics
- [ ] No language flicker on booking page loads
- [ ] Consistent language detection timing with property pages
- [ ] All tests passing (unit, integration, manual)
- [ ] Zero legacy search parameter detection code remaining

### User Experience Metrics
- [ ] Smooth property → booking navigation (context preservation)
- [ ] Reliable shared booking links (path-based language)
- [ ] Consistent behavior across all page types
- [ ] Fast language switching without page reloads

## Rollback Plan

If issues arise during implementation:

1. **Phase 1-2 Issues**: Revert to original file structure
2. **Phase 3 Issues**: Rollback URL generation changes
3. **Phase 4 Issues**: Keep both systems temporarily, debug in isolation
4. **Phase 5 Issues**: Restore removed code, investigate further

## Timeline Estimate

- **Phase 1**: 2-3 hours (routing changes)
- **Phase 2**: 1-2 hours (detection logic)
- **Phase 3**: 2-3 hours (URL generation updates)
- **Phase 4**: 3-4 hours (comprehensive testing)
- **Phase 5**: 1-2 hours (cleanup)

**Total**: 9-14 hours over 2-3 development sessions

## Dependencies

- Next.js routing system understanding
- Existing property page language detection logic
- Language system provider implementation
- Translation system functionality

## Next Steps

1. Review and approve this migration plan
2. Update GitHub Issue #34 with implementation progress
3. Begin Phase 1: Routing structure updates
4. Implement each phase with testing
5. Document completion and close related issues