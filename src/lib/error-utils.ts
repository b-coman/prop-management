// src/lib/error-utils.ts

/**
 * Error utility functions for consistent error handling throughout the application
 */

/**
 * Standard error types used in the application
 */
export const ErrorTypes = {
  VALIDATION: 'validation_error',
  PERMISSION: 'permission_error',
  NOT_FOUND: 'not_found',
  DATABASE: 'database_error',
  PAYMENT: 'payment_error',
  NETWORK: 'network_error',
  RATE_LIMIT: 'rate_limit_error',
  AVAILABILITY: 'availability_error',
  AUTHENTICATION: 'authentication_error',
  UNKNOWN: 'unknown_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
};

/**
 * Interface for standardized API error responses
 */
export interface ErrorResponse {
  type: string;
  message: string;
  details?: string | Record<string, any>;
  code?: string;
  retry?: boolean;
}

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(
  type: string,
  message: string,
  details?: string | Record<string, any>,
  code?: string,
  retry = false
): ErrorResponse {
  return {
    type,
    message,
    details,
    code,
    retry,
  };
}

/**
 * Extracts an error message from different error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unknown error occurred';
}

/**
 * Determines if an error is network-related
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('network') ||
      error.message.includes('internet') ||
      error.message.includes('connection') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('fetch failed')
    );
  }
  const errorString = String(error).toLowerCase();
  return (
    errorString.includes('network') ||
    errorString.includes('internet') ||
    errorString.includes('connection') ||
    errorString.includes('econnrefused') ||
    errorString.includes('etimedout') ||
    errorString.includes('fetch failed')
  );
}

/**
 * Determines if an error is related to permissions
 */
export function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('permission') ||
      error.message.includes('PERMISSION_DENIED') ||
      error.message.includes('unauthorized') ||
      error.message.includes('not allowed')
    );
  }
  const errorString = String(error).toLowerCase();
  return (
    errorString.includes('permission') ||
    errorString.includes('permission_denied') ||
    errorString.includes('unauthorized') ||
    errorString.includes('not allowed')
  );
}

/**
 * Determines if an error is related to validation
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('validation') ||
      error.message.includes('invalid') ||
      error.message.includes('required field')
    );
  }
  const errorString = String(error).toLowerCase();
  return (
    errorString.includes('validation') ||
    errorString.includes('invalid') ||
    errorString.includes('required field')
  );
}

/**
 * Get a user-friendly error message for any error
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const baseMessage = getErrorMessage(error);
  
  // Check for specific types of errors and provide friendly messages
  if (isNetworkError(error)) {
    return "There seems to be a network issue. Please check your internet connection and try again.";
  }
  
  if (isPermissionError(error)) {
    return "You don't have permission to perform this action. Please log in or contact support.";
  }
  
  if (isValidationError(error)) {
    return "Some of the information provided is invalid. Please check your inputs and try again.";
  }
  
  // Handle certain Firebase error messages
  if (baseMessage.includes('Firebase') || baseMessage.includes('firestore')) {
    return "We're experiencing a temporary issue with our database. Please try again in a moment.";
  }
  
  // Handle Stripe-specific errors
  if (baseMessage.includes('Stripe') || baseMessage.includes('stripe')) {
    if (baseMessage.includes('card was declined') || baseMessage.includes('payment_method')) {
      return "Your payment could not be processed. Please check your payment details and try again.";
    }
    return "There was an issue with the payment system. Please try again or use a different payment method.";
  }
  
  // Default to a generic message if we can't provide anything more specific
  return "Something went wrong. Please try again or contact support if the problem persists.";
}

/**
 * Determines if an error is likely to be resolved by retrying
 */
export function isRetryableError(error: unknown): boolean {
  const errorString = typeof error === 'string' ? error : String(error);
  
  return (
    isNetworkError(error) ||
    errorString.includes('timeout') ||
    errorString.includes('temporarily') ||
    errorString.includes('temporary') ||
    errorString.includes('retry') ||
    errorString.includes('try again') ||
    errorString.includes('unavailable') ||
    errorString.includes('deadlineExceeded') ||
    errorString.includes('server error') ||
    errorString.includes('500') ||
    errorString.includes('503')
  );
}

/**
 * Create a standardized server action error response
 */
export function createActionErrorResponse<T extends object>(
  error: unknown,
  errorType: string = ErrorTypes.UNKNOWN
): T & { error: string; errorType: string; errorDetails?: Record<string, any> } {
  const message = getUserFriendlyErrorMessage(error);
  const details = error instanceof Error ? { stack: error.stack } : undefined;
  
  return {
    error: message,
    errorType,
    errorDetails: details,
  } as T & { error: string; errorType: string; errorDetails?: Record<string, any> };
}

/**
 * Create an error-tracked version of a function that automatically handles errors
 * by wrapping them in a consistent structure
 */
export function withErrorHandling<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
  onError?: (error: unknown) => void
): (...args: A) => Promise<T | { error: string; errorType: string; errorDetails?: Record<string, any> }> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (onError) {
        onError(error);
      }
      
      // Determine error type
      let errorType = ErrorTypes.UNKNOWN;
      if (isNetworkError(error)) {
        errorType = ErrorTypes.NETWORK;
      } else if (isPermissionError(error)) {
        errorType = ErrorTypes.PERMISSION;
      } else if (isValidationError(error)) {
        errorType = ErrorTypes.VALIDATION;
      }
      
      return createActionErrorResponse<Record<string, never>>(error, errorType);
    }
  };
}

/**
 * Function to sanitize error objects for logging (removing sensitive information)
 */
export function sanitizeErrorForLogging(error: unknown): unknown {
  if (error instanceof Error) {
    // Create a new error to avoid modifying the original
    const sanitizedError = new Error(error.message);
    sanitizedError.stack = error.stack;
    
    // Remove any sensitive information potentially found in the error
    const sensitivePatterns = [
      /password/i, 
      /secret/i, 
      /token/i, 
      /key/i, 
      /auth/i, 
      /credit.*card/i, 
      /card.*number/i,
      /cvv/i,
      /cvc/i,
      /email/i
    ];
    
    let errorStr = JSON.stringify(error, (key, value) => {
      if (typeof value === 'string' && sensitivePatterns.some(pattern => pattern.test(key))) {
        return '[REDACTED]';
      }
      return value;
    });
    
    try {
      return JSON.parse(errorStr);
    } catch {
      return sanitizedError;
    }
  }
  
  return error;
}

/**
 * Log errors in a standard format
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, any>
): void {
  const sanitizedError = sanitizeErrorForLogging(error);
  const errorMessage = getErrorMessage(sanitizedError);
  
  const logData = {
    timestamp: new Date().toISOString(),
    context,
    message: errorMessage,
    error: sanitizedError instanceof Error ? {
      name: sanitizedError.name,
      message: sanitizedError.message,
      stack: sanitizedError.stack,
    } : sanitizedError,
    ...additionalInfo,
  };
  
  console.error(`❌ [${context}]`, JSON.stringify(logData));
}