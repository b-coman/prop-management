# Logging Strategy for RentalSpot v2

## Overview

The v2 logging system provides a flexible, performance-aware logging solution that can be controlled without code changes.

## Features

### 1. **Namespace-Based Logging**
- Hierarchical namespaces (e.g., `booking:context`, `booking:api`)
- Wildcard support for enabling groups of loggers
- Fine-grained control over what gets logged

### 2. **Multiple Configuration Methods**

#### Environment Variables (Server & Build Time)
```bash
# .env.local
RENTAL_SPOT_LOG_LEVEL=DEBUG
RENTAL_SPOT_LOG_NAMESPACES=booking:*,pricing
RENTAL_SPOT_LOG_PRODUCTION=true
```

#### URL Parameters (Development/Debugging)
```
https://app.com/booking?debug=booking:context,booking:api
```

#### Browser Console (Runtime)
```javascript
// Enable all booking logs
LoggerConfig.enableDebug('booking:*');

// Enable specific namespaces
LoggerConfig.enableDebug(['booking:context', 'pricing']);

// Disable all logs
LoggerConfig.disable();

// Reset to defaults
LoggerConfig.reset();
```

#### LocalStorage (Persistent Client Config)
```javascript
// Set custom configuration
LoggerConfig.setConfig({
  level: LogLevel.DEBUG,
  namespaces: ['booking:*', 'pricing'],
  enabledInProduction: true,
  prettyPrint: true
});
```

### 3. **Log Levels**
- `DEBUG` - Detailed information for debugging
- `INFO` - General informational messages
- `WARN` - Warning messages
- `ERROR` - Error messages with stack traces
- `NONE` - Disable all logging

### 4. **Performance Features**
- Zero overhead when disabled (no function calls in production)
- Lazy evaluation of expensive operations
- Built-in timing utilities
- Group logging for related operations

## Usage Examples

### Basic Usage
```typescript
import { loggers } from '@/lib/logger';

// In BookingContext
const logger = loggers.bookingContext;

logger.debug('State updated', { 
  checkIn: checkInDate, 
  checkOut: checkOutDate 
});

logger.info('Fetching pricing from API');

logger.warn('Session storage cleared unexpectedly');

logger.error('Failed to fetch pricing from API', error, {
  propertyId: property.id,
  dates: { checkIn, checkOut }
});
```

### Performance Logging
```typescript
logger.time('fetchPricing');
const pricing = await fetchPricingAPI();
logger.timeEnd('fetchPricing');
```

### Grouped Operations
```typescript
logger.group('Booking Submission');
logger.info('Validating form data');
logger.info('Creating pending booking');
logger.info('Initiating Stripe checkout');
logger.groupEnd();
```

### Conditional Logging
```typescript
// Only compute expensive data if logging is enabled
logger.debug('Detailed state analysis', () => ({
  stateSize: JSON.stringify(state).length,
  deepAnalysis: expensiveAnalysisFunction()
}));
```

## Namespace Convention

```
app:module:component
```

Examples:
- `booking` - All booking-related logs
- `booking:context` - BookingContext state management
- `booking:api` - API calls and responses
- `booking:storage` - Session storage operations
- `booking:ui` - UI component lifecycle
- `pricing` - Pricing API operations
- `availability` - Availability checking
- `stripe` - Stripe integration
- `performance` - Performance metrics

## Production Debugging

### Temporary Debug Mode
Add `?debug=booking:*` to any URL to enable debug logging for that session:
```
https://rentalspot.com/booking/check/property?debug=booking:context,pricing
```

### Persistent Debug Mode
In the browser console:
```javascript
// Enable specific loggers
LoggerConfig.enableDebug(['booking:api', 'stripe']);

// Check current config
localStorage.getItem('RENTAL_SPOT_LOG_CONFIG');
```

### Remote Debugging
For production issues, you can:
1. Ask users to add `?debug=*` to their URL
2. Have them reproduce the issue
3. Ask them to copy console logs
4. Or implement external logging service integration

## Best Practices

### 1. Use Appropriate Log Levels
```typescript
logger.debug('Detailed state change', { before, after });
logger.info('User action completed');
logger.warn('Deprecated API usage');
logger.error('Critical failure', error);
```

### 2. Include Relevant Context
```typescript
logger.error('Booking failed', error, {
  bookingId,
  userId,
  propertyId,
  timestamp: Date.now()
});
```

### 3. Use Namespaces Effectively
```typescript
// Too broad
const logger = createLogger('app');

// Better
const logger = createLogger('booking:availability:calendar');
```

### 4. Performance Considerations
```typescript
// Bad - always computes expensive data
logger.debug('State', computeExpensiveData());

// Good - only computes if logging is enabled
if (logger.shouldLog(LogLevel.DEBUG)) {
  logger.debug('State', computeExpensiveData());
}
```

## Integration with v2 Migration

### Phase 1: Add Logging to New Components
```typescript
// BookingContextV2.tsx
const logger = loggers.bookingContext;

export function BookingProviderV2({ children }: Props) {
  logger.info('BookingProviderV2 initialized');
  
  // Log state changes
  const updateState = (updates: Partial<State>) => {
    logger.debug('State update', { updates });
    setState(prev => ({ ...prev, ...updates }));
  };
}
```

### Phase 2: Monitor Migration Progress
```typescript
if (FEATURES.BOOKING_V2) {
  logger.info('Using v2 booking system');
} else {
  logger.info('Using v1 booking system');
}
```

### Phase 3: Production Monitoring
- Enable logging for canary deployments
- Monitor error rates and performance
- Use namespace filtering to focus on v2 components

## External Service Integration

The logger is designed to integrate with external services:

```typescript
private sendToExternalLogger(level: LogLevel, message: string, metadata?: LogMetadata) {
  // Sentry integration
  if (level === LogLevel.ERROR && window.Sentry) {
    window.Sentry.captureException(metadata?.error, {
      level: 'error',
      tags: { namespace: this.namespace },
      extra: metadata
    });
  }
  
  // Custom analytics
  if (window.analytics) {
    window.analytics.track('Log Event', {
      level: LogLevel[level],
      namespace: this.namespace,
      message,
      ...metadata
    });
  }
}
```

## Summary

This logging system provides:
- ✅ Easy on/off control without code changes
- ✅ Namespace-based filtering
- ✅ Multiple configuration methods
- ✅ Production-safe with zero overhead when disabled
- ✅ Structured logging with metadata
- ✅ Performance utilities
- ✅ External service integration ready

The key is that logs are always in the code but have zero performance impact when disabled, making it safe to leave detailed logging in production code.