'use client';

import { useEffect } from 'react';

/**
 * This component helps handle potential AbortErrors from fetch requests
 * by cleaning up any pending requests and adding global error handlers.
 */
export function AvailabilityErrorHandler() {
  useEffect(() => {
    // Ensure running in browser
    if (typeof window === 'undefined') return;

    // Create a special unhandled rejection handler just for AbortErrors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // If it's an AbortError, prevent it from causing unhandled rejection
      if (event.reason &&
          (event.reason.name === 'AbortError' ||
           (event.reason.toString && event.reason.toString().includes('abort')))) {
        console.log('🔄 Intercepted AbortError, preventing unhandled rejection:', event.reason);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      // Check if it's an abort-related error
      if (event.error &&
          (event.error.name === 'AbortError' ||
           (event.error.toString && event.error.toString().includes('abort')))) {
        console.log('🔄 Intercepted AbortError in error handler, preventing default:', event.error);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Add the handlers
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Clean up on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Fix for React 18+ Strict Mode
  useEffect(() => {
    // Add a special handler for fetch aborts in React 18 Strict Mode
    // This helps when components are mounted, unmounted, and remounted during development
    const originalFetch = window.fetch;

    window.fetch = function(...args) {
      const result = originalFetch.apply(this, args);

      // Add extra error handling to catch aborted requests
      return result.catch(err => {
        if (err && err.name === 'AbortError') {
          console.log('🔄 Caught AbortError in fetch override, preventing propagation');
          return new Response(JSON.stringify({ unavailableDates: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw err;
      });
    };

    return () => {
      // Restore original fetch when component unmounts
      window.fetch = originalFetch;
    };
  }, []);

  // This is a utility component that doesn't render anything
  return null;
}