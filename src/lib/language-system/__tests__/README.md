# Language System Test Suite

Comprehensive test coverage for the unified language system migration. This test suite validates all aspects of the language system including functionality, performance, backwards compatibility, and migration safety.

## Test Structure

### Core Test Files

- **`unified-system.test.ts`** - Primary functionality tests for the unified language system
- **`backwards-compatibility.test.ts`** - Validates legacy hook compatibility and interface consistency
- **`performance.test.ts`** - Performance testing and optimization validation
- **`migration-mode.test.ts`** - Migration mode support and dual-check preparation

## Test Categories

### 1. Core Functionality Tests (`unified-system.test.ts`)

Tests the primary functionality of the unified language system:

- **Language Provider**: Initialization, error handling, configuration
- **Translation Functions**: Key lookup, variable substitution, multilingual content
- **Language Switching**: Language changes, URL updates, localStorage persistence
- **Specialized Hooks**: Translation-only, switcher-only, validation hooks
- **Language Detection**: URL path, query params, localStorage, browser detection
- **Translation Cache**: Caching, LRU eviction, TTL handling, statistics
- **Error Handling**: Network failures, invalid formats, missing context
- **System Integration**: End-to-end functionality testing

### 2. Backwards Compatibility Tests (`backwards-compatibility.test.ts`)

Ensures seamless migration with zero breaking changes:

- **Legacy Hook Interface**: `useLegacyLanguage` compatibility
- **Optimized Hook Interface**: `useOptimizedLanguage` compatibility
- **Smart Hook**: Migration mode adaptation
- **Debug Hook**: Development support
- **Interface Consistency**: State synchronization across hooks
- **Performance Regression**: No performance degradation in legacy interfaces
- **Error Handling**: Consistent error behavior

### 3. Performance Tests (`performance.test.ts`)

Validates performance targets and optimization effectiveness:

- **Detection Performance**: <30ms language detection target
- **Cache Performance**: >90% hit rate after warmup
- **Translation Speed**: <1ms average translation lookup
- **Memory Usage**: <2MB cache memory limit
- **Language Switching**: <1 second switch time
- **Concurrent Requests**: Efficient handling of simultaneous requests
- **Stress Testing**: High-frequency operations, memory pressure

### 4. Migration Mode Tests (`migration-mode.test.ts`)

Prepares for and validates migration phases:

- **Mode Detection**: Environment variable handling
- **Unified Mode**: Full functionality validation
- **Legacy Mode**: Fallback behavior simulation
- **Dual-Check Mode**: Comparison logic preparation (Phase 3)
- **Cleanup Mode**: Production-ready operation
- **Safety Features**: Rollback capabilities, error boundaries
- **Feature Flags**: Environment and runtime configuration

## Performance Targets

The test suite validates these performance requirements:

| Metric | Target | Test Location |
|--------|--------|---------------|
| Language Detection | <30ms | `performance.test.ts` |
| Translation Loading | <500ms | `performance.test.ts` |
| Cache Hit Rate | >90% | `performance.test.ts` |
| Translation Lookup | <1ms | `performance.test.ts` |
| Memory Usage | <2MB | `performance.test.ts` |
| Language Switch | <1s | `performance.test.ts` |

## Running Tests

### All Tests
```bash
npm test src/lib/language-system/__tests__/
```

### Specific Test Suites
```bash
# Core functionality
npm test src/lib/language-system/__tests__/unified-system.test.ts

# Backwards compatibility
npm test src/lib/language-system/__tests__/backwards-compatibility.test.ts

# Performance validation
npm test src/lib/language-system/__tests__/performance.test.ts

# Migration mode support
npm test src/lib/language-system/__tests__/migration-mode.test.ts
```

### With Coverage
```bash
npm test src/lib/language-system/__tests__/ -- --coverage
```

### Performance Benchmarking
```bash
npm test src/lib/language-system/__tests__/performance.test.ts -- --verbose
```

## Test Environment Setup

### Required Dependencies

```json
{
  "@testing-library/react": "^13.0.0",
  "@testing-library/jest-dom": "^5.16.0",
  "jest": "^28.0.0",
  "jest-environment-jsdom": "^28.0.0"
}
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/src/lib/language-system/__tests__/**/*.test.ts',
    '<rootDir>/src/lib/language-system/__tests__/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'src/lib/language-system/**/*.{ts,tsx}',
    '!src/lib/language-system/**/*.d.ts',
    '!src/lib/language-system/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## Mock Setup

### Common Mocks

All test files use consistent mocking for:

- **Next.js Navigation**: `useRouter`, `usePathname`, `useSearchParams`
- **Logger**: Centralized logging system
- **Language Constants**: Supported languages and defaults
- **Fetch API**: Translation file loading with configurable responses
- **Local Storage**: Browser storage for preferences
- **Performance API**: Timing measurements

### Translation Mock Data

Tests use realistic translation structures:

```javascript
const mockTranslations = {
  en: {
    'welcome': 'Welcome',
    'test.key': 'Test Value',
    'variables.test': 'Hello {{name}}'
  },
  ro: {
    'welcome': 'Bun venit',
    'test.key': 'Valoare Test',
    'variables.test': 'Salut {{name}}'
  }
};
```

## Test Data Patterns

### Performance Test Patterns
- Large translation objects (1000+ keys) for memory testing
- High-frequency operations (10,000+ iterations) for stress testing
- Concurrent request simulation for load testing
- Network delay simulation for realistic conditions

### Compatibility Test Patterns
- Interface shape validation
- Functional equivalence testing
- State synchronization verification
- Performance regression detection

### Migration Test Patterns
- Mode transition simulation
- Comparison result validation
- Rollback safety verification
- Feature flag behavior testing

## Coverage Targets

- **Statements**: >80%
- **Branches**: >80%
- **Functions**: >80%
- **Lines**: >80%

## Integration with CI/CD

### GitHub Actions Workflow

```yaml
- name: Run Language System Tests
  run: |
    npm test src/lib/language-system/__tests__/ -- --coverage --ci
    
- name: Performance Regression Check
  run: |
    npm test src/lib/language-system/__tests__/performance.test.ts -- --verbose
```

### Quality Gates

Tests must pass before:
- Phase 3 migration (dual-check mode)
- Production deployment
- Legacy system deprecation

## Debugging Test Failures

### Common Issues

1. **Timing-related failures**: Increase `waitFor` timeouts
2. **Mock inconsistencies**: Check mock setup in `beforeEach`
3. **Performance flakiness**: Run tests multiple times, check system load
4. **Memory leaks**: Verify cleanup in `afterEach` hooks

### Debug Mode

Enable debug mode for detailed logging:

```javascript
const TestWrapper = ({ children }) => (
  <LanguageProvider
    enableDebugMode={true}
    enablePerformanceTracking={true}
  >
    {children}
  </LanguageProvider>
);
```

## Future Test Additions

### Phase 3 (Dual-Check Mode)
- Dual-check comparison validation
- Legacy vs unified result verification
- Discrepancy detection and reporting
- Performance impact measurement

### Phase 4 (Migration Completion)
- Legacy hook removal validation
- Dead code elimination verification
- Bundle size optimization testing

### Phase 5 (Cleanup)
- Final performance benchmarking
- Production readiness validation
- Long-term stability testing

## Contributing

When adding new language system features:

1. Add corresponding tests to appropriate test file
2. Maintain performance targets
3. Ensure backwards compatibility
4. Update migration mode tests if needed
5. Add performance benchmarks for new functionality

## Test Results Interpretation

### Success Criteria
- All tests pass
- Performance targets met
- Coverage thresholds achieved
- No regression in existing functionality

### Failure Investigation
1. Check test logs for specific failure points
2. Verify mock setup and data consistency
3. Validate performance environment
4. Ensure test isolation and cleanup