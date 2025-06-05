# Availability Testing Strategy Implementation

**Status**: ✅ IMPLEMENTED  
**Issue**: [#9 Testing strategy for availability deduplication](https://github.com/b-coman/prop-management/issues/9)  
**Date**: June 3, 2025  

## Overview

Comprehensive testing strategy for the availability deduplication system, covering all modes of operation, edge cases, and performance requirements. This testing infrastructure ensures safe migration from dual-storage to single-source availability architecture.

## Test Architecture

### Test Suites

1. **Unit Tests** (`tests/availability/`)
   - Availability service logic with all feature flags
   - Error handling and fallback scenarios  
   - Edge cases (leap years, month boundaries, etc.)

2. **Integration Tests** (`tests/api/`)
   - API endpoint testing (original vs v2)
   - Feature flag behavior validation
   - Pricing calculation consistency

3. **End-to-End Tests** (`tests/e2e/`)
   - Complete booking workflows
   - Hold creation and expiration
   - Concurrent booking scenarios

4. **Performance Tests** (`tests/performance/`)
   - Response time benchmarks
   - Load testing with concurrent requests
   - Memory usage validation

## Implementation Files

### Test Infrastructure

```
tests/
├── setup.js                           # Global test configuration
├── availability/
│   └── availability-service.test.ts   # Unit tests for availability service
├── api/
│   └── check-pricing-integration.test.ts  # API integration tests
├── e2e/
│   └── booking-flow.test.ts          # End-to-end workflow tests
└── performance/
    └── availability-performance.test.ts   # Performance benchmarks

jest.config.js                        # Jest configuration
scripts/test-availability.sh          # Comprehensive test runner
```

### Configuration Files

- **Jest Configuration**: Optimized for Next.js with TypeScript support
- **Test Setup**: Mocks, utilities, and global test data
- **Coverage Thresholds**: 80%+ overall, 90%+ for critical components

## Test Coverage

### Feature Flag Modes

All test suites validate behavior across three modes:

1. **LEGACY Mode** (priceCalendars only)
   - Zero risk baseline testing
   - Validates existing system behavior

2. **DUAL CHECK Mode** (both sources)
   - Discrepancy detection testing  
   - Fallback behavior validation
   - Performance impact measurement

3. **SINGLE SOURCE Mode** (availability collection only)
   - Target architecture validation
   - Error handling and fallback testing

### Edge Cases Covered

- **Date Handling**
  - Same-day check-in/check-out
  - Month boundary spanning
  - Leap year dates (February 29th)
  - Past date validation
  - Maximum date range limits

- **Booking Scenarios**
  - Overlapping date ranges
  - Back-to-back bookings
  - Concurrent booking conflicts
  - Hold expiration timing
  - Minimum stay violations

- **Error Conditions**
  - Database connection failures
  - Missing price calendars
  - Network timeouts
  - Invalid date formats
  - Malformed requests

### Performance Requirements

- **Response Times**
  - Single night check: < 100ms
  - Standard range (3-7 nights): < 500ms
  - Long range (30+ nights): < 1000ms
  - Cross-month queries: < 800ms

- **Concurrency**
  - 10 concurrent requests: < 200ms average
  - 50 request batches: < 2x performance degradation
  - Memory leaks: < 1MB increase over 100 iterations

- **Feature Flag Overhead**
  - Single source vs legacy: < 2x performance ratio
  - Dual check overhead: < 300ms additional

## Running Tests

### Quick Commands

```bash
# Run all tests
./scripts/test-availability.sh

# Run specific test suites
./scripts/test-availability.sh unit
./scripts/test-availability.sh integration
./scripts/test-availability.sh e2e
./scripts/test-availability.sh performance

# Run feature flag validation
./scripts/test-availability.sh flags

# Generate coverage report
./scripts/test-availability.sh coverage
```

### Individual Test Suites

```bash
# Unit tests only
npm test -- --testPathPattern="availability-service.test"

# API integration tests
npm test -- --testPathPattern="check-pricing-integration.test"

# End-to-end tests
npm test -- --testPathPattern="booking-flow.test"

# Performance tests
npm test -- --testPathPattern="availability-performance.test" --testTimeout=60000

# With coverage
npm test -- --coverage
```

### Environment-Specific Testing

```bash
# Test legacy mode
export AVAILABILITY_SINGLE_SOURCE=false
export AVAILABILITY_DUAL_CHECK=false
npm test

# Test dual check mode
export AVAILABILITY_DUAL_CHECK=true
npm test

# Test single source mode
export AVAILABILITY_SINGLE_SOURCE=true
export AVAILABILITY_DUAL_CHECK=false
npm test
```

## Test Data Management

### Mock Data Structure

```typescript
// Global test properties
global.testData = {
  properties: {
    'prahova-mountain-chalet': {
      pricePerNight: 200,
      baseOccupancy: 4,
      extraGuestFee: 25,
      cleaningFee: 75
    }
  },
  guestInfo: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com'
  }
};
```

### Mock Configurations

- **Fast Mocks**: For performance testing with minimal latency
- **Error Mocks**: For failure scenario testing
- **Realistic Mocks**: For integration testing with actual data structures

## Validation Criteria

### Success Metrics

- **Code Coverage**: 90%+ for availability service, 80%+ overall
- **Performance**: All benchmarks within defined thresholds
- **Feature Flags**: All three modes pass identical test scenarios
- **Error Handling**: Graceful degradation in all failure scenarios
- **Consistency**: Original and v2 APIs return identical results

### Quality Gates

1. **Pre-Deployment Validation**
   - All test suites must pass
   - Coverage thresholds must be met
   - Performance benchmarks must be satisfied
   - No memory leaks detected

2. **Feature Flag Readiness**
   - Legacy mode maintains existing behavior
   - Dual check mode detects discrepancies correctly
   - Single source mode handles all scenarios
   - Rollback procedures validated

3. **Production Readiness**
   - Load testing shows acceptable performance
   - Error scenarios handled gracefully
   - Monitoring and alerting configured
   - Documentation complete

## Integration with CI/CD

### Automated Testing

```yaml
# Example GitHub Actions workflow
- name: Run Availability Tests
  run: |
    npm install
    ./scripts/test-availability.sh all
    
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/lcov.info

- name: Upload Test Results
  uses: actions/upload-artifact@v2
  with:
    name: test-reports
    path: test-reports/
```

### Pre-commit Hooks

```bash
# Run critical tests before commits
./scripts/test-availability.sh unit
./scripts/test-availability.sh flags
```

## Test Maintenance

### Regular Updates

- **Weekly**: Run full test suite with performance benchmarks
- **Before Deployments**: Complete validation including load tests
- **After Changes**: Affected test suites plus regression testing

### Test Data Refresh

- Update mock data to reflect production scenarios
- Add new edge cases as they're discovered
- Maintain realistic performance characteristics

## Monitoring Test Health

### Key Metrics

- **Test Execution Time**: Track trends in test suite duration
- **Test Stability**: Monitor flaky test rates
- **Coverage Trends**: Ensure coverage doesn't degrade
- **Performance Baselines**: Alert on significant regressions

### Alerting

- Failed test runs in CI/CD pipelines
- Coverage drops below thresholds
- Performance regressions > 20%
- Memory leak detection

## Documentation Integration

### Test Reports

- **HTML Reports**: Detailed test results with execution times
- **Coverage Reports**: Line-by-line coverage analysis
- **Performance Reports**: Benchmark comparisons over time

### Living Documentation

- Test scenarios document expected behavior
- Edge case tests serve as specification examples
- Performance tests define SLA requirements

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**: Screenshots of admin interfaces
2. **Database State Validation**: Verify data consistency post-migration
3. **Real Production Data**: Anonymized production data for testing
4. **Chaos Engineering**: Fault injection testing

### Cleanup After Migration

Once availability deduplication is complete and stable:

- Remove feature flag-specific tests
- Simplify test setup (no more dual modes)
- Archive migration-specific test scenarios
- Update documentation to reflect final architecture

## Related Documentation

- [Availability Feature Flags](availability-feature-flags.md)
- [Availability Deduplication Plan](availability-deduplication-plan.md)
- [Hold Cleanup Deployment](hold-cleanup-deployment.md)

---

**Success Criteria**: All test suites pass consistently, providing confidence for safe production deployment of the availability deduplication system.