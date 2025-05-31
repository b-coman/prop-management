/**
 * @fileoverview Feature flag configuration for v1/v2 system toggling
 * @module config/features
 * 
 * @description
 * Centralized feature flag management for controlling which version of
 * components are active. Enables safe, gradual migration from v1 to v2
 * booking system with instant rollback capability via environment variables.
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
 * - Consumers: BookingPage, middleware, all v2 components
 * 
 * @migration-notes
 * - Version: v2.0
 * - Purpose: Enables side-by-side v1/v2 operation
 * - Rollback: Set NEXT_PUBLIC_BOOKING_V2=false
 * 
 * @example
 * ```typescript
 * import { FEATURES, isFeatureEnabled } from '@/config/features';
 * 
 * if (FEATURES.BOOKING_V2) {
 *   return <BookingV2 />;
 * } else {
 *   return <BookingV1 />;
 * }
 * ```
 * 
 * @see {@link ../docs/implementation/booking-system-v2-migration-plan.md}
 * @since v2.0.0
 */

export interface FeatureFlags {
  BOOKING_V2: boolean;
  PRICING_V2: boolean;
  DEBUG_MODE: boolean;
}

/**
 * Feature flag configuration
 * 
 * These flags control which version of components are used throughout
 * the application. They can be overridden via environment variables.
 */
export const FEATURES: FeatureFlags = {
  // Booking System v2 - New simplified state management
  BOOKING_V2: process.env.NEXT_PUBLIC_BOOKING_V2 === 'true',
  
  // Pricing System v2 - Enhanced pricing calculations
  PRICING_V2: process.env.NEXT_PUBLIC_PRICING_V2 === 'true',
  
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