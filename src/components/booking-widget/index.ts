/**
 * Booking Widget - Standalone booking widget for hero sections
 *
 * @description Extracted from V1 booking system during architecture cleanup.
 *              Provides a simple date picker that redirects to V2 booking page.
 * @created 2026-02-04
 * @module components/booking-widget
 */

export { BookingWidget } from './BookingWidget';
export type { BookingWidgetProps } from './BookingWidget';

// Backward compatibility alias - used by hero-section.tsx
export { BookingWidget as BookingContainer } from './BookingWidget';

export { InitialBookingForm } from './InitialBookingForm';
