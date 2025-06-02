/**
 * @fileoverview Feature flag configuration
 * @module config/features
 * 
 * @description
 * Centralized feature flag management for controlling application features.
 * V2 booking system is now the standard implementation.
 * 
 * @architecture
 * Location: Global configuration layer
 * Layer: Infrastructure
 * Pattern: Feature Toggle pattern
 * 
 * @dependencies
 * - Internal: None (base configuration)
 * - External: Next.js environment variables
 * 
 * @relationships
 * - Provides: Feature flags to all components
 * - Consumers: BookingPage, middleware, all components
 * 
 * @migration-notes
 * - Version: v2.3
 * - Status: V2 booking system is now standard (always enabled)
 * - V1 system remains as fallback but is no longer actively used
 * 
 * @example
 * ```typescript
 * import { FEATURES, isFeatureEnabled } from '@/config/features';
 * 
 * if (FEATURES.DEBUG_MODE) {
 *   console.log('Debug info');
 * }
 * ```
 * 
 * @see {@link ../docs/implementation/booking-system-v2-migration-plan.md}
 * @since v2.0.0
 * @updated v2.3.0 - V2 system is now standard
 */

export interface FeatureFlags {
  BOOKING_V2: boolean;
  DEBUG_MODE: boolean;
}

/**
 * Feature flag configuration
 * 
 * These flags control application features and debugging capabilities.
 */
export const FEATURES: FeatureFlags = {
  // Booking System v2 - Now the standard implementation (always enabled)
  BOOKING_V2: true,
  
  // Debug mode for development
  DEBUG_MODE: process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true'
};

/**
 * Helper function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return FEATURES[feature];
}

/**
 * Helper function to get feature flag status for debugging
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...FEATURES };
}

/**
 * Development helper to log feature flag status
 */
if (FEATURES.DEBUG_MODE) {
  console.log('[Features] Current feature flags:', FEATURES);
}