# Error Handling Guidelines

This document outlines the standardized approach to error handling in the RentalSpot platform. Following these guidelines ensures a consistent user experience and makes debugging easier.

## Table of Contents

1. [Principles](#principles)
2. [Error Categorization](#error-categorization)
3. [Client-Side Error Handling](#client-side-error-handling)
4. [Server-Side Error Handling](#server-side-error-handling)
5. [UI Components](#ui-components)
6. [Retry Logic](#retry-logic)
7. [Error Logging](#error-logging)

## Principles

1. **User-Focused**: Error messages should help users understand what went wrong and what actions they can take.
2. **Recoverable**: Whenever possible, provide users with a way to recover from errors.
3. **Informative**: Error messages should be clear without exposing sensitive information.
4. **Contextual**: Errors should be relevant to the action being performed.
5. **Consistent**: Similar errors should be handled in a similar way across the application.

## Error Categorization

We categorize errors into the following types (defined in `src/lib/error-utils.ts`):

| Error Type | Description | Example |
|------------|-------------|---------|
| `validation_error` | Input validation failures | Invalid email format |
| `permission_error` | User lacks required permissions | Unauthorized access |
| `not_found` | Requested resource doesn't exist | Property not found |
| `database_error` | Database interaction issue | Failed to save booking |
| `payment_error` | Payment processing failure | Credit card declined |
| `network_error` | Network connectivity issues | Failed to connect to server |
| `rate_limit_error` | Too many requests | Too many failed attempts |
| `availability_error` | Booking availability conflict | Dates no longer available |
| `authentication_error` | Authentication failures | Login failed |
| `service_unavailable` | Service temporary unavailable | System maintenance |
| `unknown_error` | Default fallback for unidentified errors | Unexpected error |

## Client-Side Error Handling

### Form Validation

1. Use Zod schemas for consistent validation
2. Perform initial client-side validation before making API calls
3. Display validation errors next to the relevant form fields
4. Provide clear guidance on how to fix validation issues

Example:

```typescript
// Client-side validation
if (!datesSelected || !checkInDate || !checkOutDate) {
  setFormError("Please select valid dates for your booking.");
  toast({
    title: "Missing Information",
    description: "Please select valid dates for your booking.",
    variant: "destructive",
  });
  return;
}
```

### Error Component Usage

Use the `ErrorMessage` component for displaying errors:

```typescript
{formError && (
  <ErrorMessage 
    error={formError}
    className="my-3"
    errorType={lastErrorType}
    onRetry={canRetryError ? handleRetry : undefined}
  />
)}
```

## Server-Side Error Handling

### Server Actions

Server actions should return structured error responses with:

1. An error message (`error`)
2. An error type (`errorType`)
3. A retry flag (`retry`)

Example:

```typescript
if (isNetworkError(error)) {
  return {
    error: "We're having trouble connecting to our servers. Please try again.",
    errorType: 'network_error',
    retry: true
  };
}
```

### Error Response Structure

```typescript
interface ErrorResponse {
  type: string;        // Error category (e.g., 'validation_error')
  message: string;     // User-friendly message
  details?: string;    // Additional details (for logging)
  code?: string;       // Error code
  retry?: boolean;     // Can this action be retried?
}
```

## UI Components

### ErrorMessage Component

The `ErrorMessage` component (`src/components/ui/error-message.tsx`) provides consistent error display across the application:

- Supports different error types with appropriate styling
- Shows icons specific to the error type
- Provides retry functionality when applicable
- Adapts display based on the error context

### Toast Notifications

Use toast notifications for transient errors:

```typescript
toast({
  title: "Payment Error",
  description: errorMessage,
  variant: "destructive",
  duration: 7000, // Longer duration for important errors
});
```

## Retry Logic

For retryable errors, provide users with a "Try Again" option:

1. Server actions should indicate if an error is retryable via the `retry` flag
2. Client components should track this state and provide retry buttons
3. Network errors are generally retryable, while validation errors are not

## Error Logging

All errors should be logged with contextual information:

```typescript
logError('createCheckoutSession', error, { 
  propertyId: input.property?.slug,
  guestEmail: input.guestEmail,
  pendingBookingId: input.pendingBookingId,
});
```

The `logError` function in `src/lib/error-utils.ts` ensures consistent error logging:

1. Includes timestamps
2. Redacts sensitive information
3. Provides context about where the error occurred
4. Adds relevant metadata for debugging

## Best Practices

1. **Be Specific**: Avoid generic error messages like "An error occurred"
2. **Be Actionable**: Tell users what they can do to resolve the issue
3. **Handle Edge Cases**: Plan for edge cases like network issues or service outages
4. **Degrade Gracefully**: Provide fallback UIs when operations fail
5. **Respect Privacy**: Don't expose sensitive information in error messages
6. **Fix Root Causes**: Don't just handle symptoms, address underlying issues
7. **Test Error Paths**: Intentionally test how your application behaves when errors occur

By following these guidelines, we ensure a better user experience even when things go wrong.