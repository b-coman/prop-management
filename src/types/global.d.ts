// Global declarations for TypeScript

interface Window {
  // Add utility for tracking pending AbortController instances
  _pendingAvailabilityRequests?: AbortController[];
}

// Make TypeScript recognize this file as a module
export {};