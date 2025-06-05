# Language System Test Suite

## Overview

This test suite provides comprehensive coverage for the path-based language detection system migration. It ensures that the new architecture works correctly, performs well, and handles edge cases gracefully.

## Migration Context

The test suite validates the migration from query parameter-based language detection (`?lang=ro`) to path-based detection (`/booking/check/slug/ro`) for booking pages. This change eliminates race conditions that caused language flicker during client-side hydration.

## Test Structure

### 1. URL Generation Tests (`url-generation.test.ts`)

**Purpose**: Validates URL generation logic for the new path-based approach.

**Test Coverage**:
- ✅ English URLs without language segments
- ✅ Non-English URLs with language segments  
- ✅ Query parameter preservation
- ✅ Complex URL patterns
- ✅ Edge cases and malformed URLs
- ✅ Performance benchmarks
- ✅ Integration with booking forms
- ✅ Checkout session compatibility

**Key Scenarios**:
```typescript
// English (default) - no language segment
'/booking/check/property-slug' 

// Romanian - with language segment
'/booking/check/property-slug/ro'

// With query parameters preserved
'/booking/check/property-slug/ro?checkIn=2025-06-24&checkOut=2025-06-27'
```

### 2. Language Switching Tests (`language-switching.test.tsx`)

**Purpose**: Tests language switching functionality in booking pages.

**Test Coverage**:
- ✅ Language selector integration
- ✅ Path-based URL construction during switches
- ✅ Legacy query parameter cleanup
- ✅ localStorage integration
- ✅ Error handling for invalid languages
- ✅ Performance of switching operations
- ✅ Race condition prevention

**Key Behaviors**:
- Removes `?lang=` and `?language=` parameters during switches
- Constructs correct path-based URLs
- Preserves other query parameters (dates, currency, etc.)
- Updates localStorage preferences
- Handles navigation failures gracefully

### 3. Booking Page Integration Tests (`booking-page-integration.test.tsx`)

**Purpose**: End-to-end tests for booking pages with path-based language detection.

**Test Coverage**:
- ✅ Server-side language detection from path
- ✅ Metadata generation for different languages
- ✅ Component rendering with correct props
- ✅ URL pattern validation
- ✅ Property slug validation
- ✅ Performance under load
- ✅ Backwards compatibility

**URL Patterns Tested**:
```typescript
// Valid patterns
'/booking/check/property-slug'           // English default
'/booking/check/property-slug/ro'        // Romanian
'/booking/check/property-slug/en'        // Explicit English
'/booking/check/property-slug/invalid'   // Invalid language (falls back)

// Invalid patterns handled gracefully
'/booking/check/non-existent-property'   // 404 handling
'/booking/check/property-slug/ro/extra'  // Extra segments ignored
```

### 4. Performance Tests (`performance.test.ts`)

**Purpose**: Ensures the migration doesn't introduce performance regressions.

**Test Coverage**:
- ✅ Language detection speed (< 5ms average)
- ✅ URL generation efficiency (10,000 URLs < 20ms)
- ✅ Memory usage optimization
- ✅ Concurrent operation handling
- ✅ Bundle size impact assessment
- ✅ Rendering performance maintenance

**Performance Benchmarks**:
- Language detection: < 5ms per operation
- URL generation: 10,000 URLs in < 20ms
- Memory usage: < 5MB increase for 50,000 operations
- Concurrent operations: 100 simultaneous < 100ms

### 5. Edge Cases Tests (`edge-cases.test.ts`)

**Purpose**: Validates system behavior under unusual or error conditions.

**Test Coverage**:
- ✅ Invalid URL patterns and malformed inputs
- ✅ Security considerations (XSS, path traversal)
- ✅ Browser compatibility issues
- ✅ Network and loading failures
- ✅ Memory pressure scenarios
- ✅ Concurrent access and race conditions

**Security Tests**:
- XSS prevention through language parameters
- Path traversal attack mitigation
- Input validation and sanitization
- Safe handling of Unicode and special characters

## Running Tests

### Run Complete Suite
```bash
# Run all language system tests
./scripts/test-language-system.sh

# Or manually with Jest
npm test tests/language-system/
```

### Run Individual Test Files
```bash
# URL generation tests
npx jest tests/language-system/url-generation.test.ts

# Language switching tests  
npx jest tests/language-system/language-switching.test.tsx

# Integration tests
npx jest tests/language-system/booking-page-integration.test.tsx

# Performance tests
npx jest tests/language-system/performance.test.ts

# Edge cases tests
npx jest tests/language-system/edge-cases.test.ts
```

### Coverage Reports
```bash
# Generate coverage report
npx jest tests/language-system/ --coverage

# Generate HTML coverage report
npx jest tests/language-system/ --coverage --coverageReporters=html
```

## Coverage Targets

- **Overall Coverage**: 80%+ lines, 75%+ branches
- **Language System**: 85%+ lines, 80%+ branches  
- **Booking Components**: 80%+ lines, 75%+ branches

## Test Environment Setup

### Required Mocks
- Next.js navigation (`useRouter`, `usePathname`)
- Firebase utilities (`getPropertyBySlug`)
- Language system components
- Performance APIs for Node.js environment

### Environment Variables
```bash
NODE_ENV=test
```

## Continuous Integration

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npm run test:language-system
```

### CI Pipeline Integration
```yaml
# Add to GitHub Actions
- name: Run Language System Tests
  run: |
    npm test tests/language-system/
    npm run test:language-system:coverage
```

## Migration Validation

### Before Migration (Query-Based)
```typescript
// Old URL patterns
'/booking/check/property-slug?lang=ro'
'/booking/check/property-slug?language=en'

// Problems
- Race conditions during hydration
- Search params not available on server
- Language flicker on initial load
```

### After Migration (Path-Based)
```typescript
// New URL patterns  
'/booking/check/property-slug/ro'
'/booking/check/property-slug'  // English default

// Benefits
- No race conditions
- Server-side language detection
- Consistent with property pages
- No language flicker
```

## Regression Prevention

The test suite prevents regressions by:

1. **Functional Testing**: Ensures all URL patterns work correctly
2. **Performance Testing**: Catches performance degradation
3. **Integration Testing**: Validates end-to-end flows
4. **Edge Case Testing**: Handles unusual scenarios
5. **Security Testing**: Prevents vulnerabilities

## Troubleshooting

### Common Test Failures

**Issue**: Tests fail with "Module not found"
**Solution**: Check mock configurations in test files

**Issue**: Performance tests fail intermittently  
**Solution**: Increase timeout values or adjust thresholds

**Issue**: Integration tests fail on routing
**Solution**: Verify Next.js mocks are properly configured

### Debugging Tests
```bash
# Run with verbose output
npx jest tests/language-system/ --verbose

# Run single test with debugging
npx jest tests/language-system/url-generation.test.ts --detectOpenHandles

# Debug mode
node --inspect-brk node_modules/.bin/jest tests/language-system/
```

## Future Enhancements

1. **Visual Regression Tests**: Add screenshot comparisons
2. **Cross-Browser Tests**: Expand browser compatibility testing  
3. **Load Testing**: Add stress testing for high traffic
4. **Accessibility Tests**: Ensure language switching is accessible
5. **Mobile Testing**: Add mobile-specific test scenarios

## Related Documentation

- [Language System Migration Plan](../../docs/implementation/language-system-migration-plan.md)
- [Booking System V2 Specification](../../docs/implementation/booking-system-v2-specification.md)
- [Path-Based Language Detection](../../docs/architecture/overview.md)
- [Testing Best Practices](../../docs/guides/testing-multilingual-system.md)