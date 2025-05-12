// Re-export everything from the new modular structure
// This provides backward compatibility with existing imports

// Export the main containers
export { AvailabilityContainer } from './container';
// Do not export as AvailabilityCheck since we're exporting the original below
export { AvailabilityCheckContainer } from './container';
export { BookingContainer } from './container';
export { RefactoredAvailabilityCheck } from './container';

// Export the date picker components and hooks
export { CustomDateRangePicker } from './CustomDateRangePicker';
export { useCustomDatePicker } from './hooks/useCustomDatePicker';
export { SimpleDateSelector } from './sections/availability/SimpleDateSelector';
export { SimpleAvailabilityChecker } from './sections/availability/SimpleAvailabilityChecker';
export { EnhancedAvailabilityChecker } from './sections/availability/EnhancedAvailabilityChecker';
export { ErrorBoundary } from './ErrorBoundary';

// Re-export all the components by category
export * from './sections/availability';
export * from './sections/common';
export * from './sections/forms';
export * from './hooks';
export * from './services';

// Also export the existing components for backward compatibility
export { AvailabilityCalendar } from './availability-calendar';
// Only export the original AvailabilityCheck implementation to avoid conflicts
export { AvailabilityCheck } from './availability-check';
export { AvailabilityStatus } from './availability-status';
export { BookNowCard } from './book-now-card';
export { BookingOptionsCards } from './booking-options-cards';
export { BookingSummary } from './booking-summary';
export { ContactCard } from './contact-card';
export { DateRangePicker } from './date-range-picker';
export { GuestPicker } from './guest-picker';
export { HoldCard } from './hold-card';
export { InitialBookingForm } from './initial-booking-form';
export { GuestInfoForm } from './guest-info-form';