/**
 * Feature flags configuration
 * 
 * This file contains feature flags that can be toggled to enable/disable
 * specific features or behaviors in the application.
 * 
 * IMPORTANT: These flags are part of the code and require a redeployment
 * to change in production. They are intended for transitional features
 * or A/B testing, not for runtime configuration.
 */

export const featureFlags = {
  /**
   * When enabled, the application will use only API-based pricing calculations
   * and bypass any client-side price calculations.
   * 
   * Benefits:
   * - Single source of truth for pricing
   * - More accurate pricing that respects all special dates and rules
   * - Consistent pricing display across all components
   * - Eliminates pricing discrepancies between client and server
   * - Simplifies codebase by removing dual pricing systems
   * 
   * Tradeoffs:
   * - Requires API calls for all pricing information
   * - Slightly delayed initial price display
   * - Network dependency for pricing display
   * - Less responsive for small UI updates (e.g., changing guest count)
   * 
   * Implementation Details:
   * - When enabled, client-side calculations in price-utils.ts return null
   * - API calls bypass cache to ensure fresh pricing data
   * - Loading states are displayed while waiting for API responses
   * - All components fall back to API pricing data exclusively
   * - Affects GuestSelector, AvailabilityContainer, and BookingSummary components
   */
  useApiOnlyPricing: false
};

/**
 * Get the value of a feature flag with optional default
 * @param flagName - Name of the flag to retrieve
 * @param defaultValue - Default value if flag is not defined
 * @returns The flag value or default
 */
export function getFeatureFlag(flagName: keyof typeof featureFlags, defaultValue = false): boolean {
  return typeof featureFlags[flagName] !== 'undefined' 
    ? featureFlags[flagName] 
    : defaultValue;
}