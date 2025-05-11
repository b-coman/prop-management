// Re-export everything from the new modular structure
// This provides backward compatibility with existing imports

// Export the main container as the default component
export { AvailabilityCheckContainer as AvailabilityCheck } from './container';

// Re-export all the smaller components
export * from './features';
export * from './forms';
export * from './utilities';
export * from './hooks';

// Also export the existing components for backward compatibility
export { AvailabilityStatus } from './availability-status';
export { BookingOptionsCards } from './booking-options-cards';
export { BookingSummary } from './booking-summary';