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