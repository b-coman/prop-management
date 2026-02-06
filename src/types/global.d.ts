// Global declarations for TypeScript

declare global {
  interface Window {
    // Add utility for tracking pending AbortController instances
    _pendingAvailabilityRequests?: AbortController[];
    // GTM dataLayer
    dataLayer?: Record<string, unknown>[];
    // Google tag function
    gtag?: (...args: unknown[]) => void;
  }
}

// Make TypeScript recognize this file as a module
export {};