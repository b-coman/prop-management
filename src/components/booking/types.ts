import { Property } from '@/types';

/**
 * Props interface for the AvailabilityCheck component
 * This maintains the original interface for backwards compatibility
 */
export interface AvailabilityCheckProps {
  property: Property;
  initialCheckIn?: string;
  initialCheckOut?: string;
}

/**
 * Explicit status type for booking flow
 * Replaces confusing boolean logic with clear states
 */
export type BookingFlowStatus = 
  | 'initial'           // Just loaded, no dates selected
  | 'dates_selected'    // User selected dates but hasn't checked
  | 'checking'          // Currently checking availability/pricing
  | 'available'         // Dates are available
  | 'unavailable'       // Dates are NOT available
  | 'error';            // Error occurred during check