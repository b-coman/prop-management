# API-Only Pricing Mode

## Overview

The RentalSpot-Builder application includes a feature flag called `useApiOnlyPricing` that changes how pricing data is calculated and displayed throughout the application. When enabled, the application exclusively uses server-side API pricing and completely bypasses client-side pricing calculations.

## Purpose

This feature was implemented to simplify the pricing system by eliminating potential discrepancies between client-side and server-side calculations. It moves toward a "single source of truth" for all pricing data, making the application more consistent and maintainable.

## Benefits

- **Accuracy**: All pricing reflects the complete rules defined in the pricing calendar, including seasonal rates and special date overrides
- **Consistency**: The same price is shown throughout the booking process with no variation
- **Simplicity**: Single code path for pricing calculation
- **Maintainability**: Easier to update pricing logic when it only needs to be updated in one place

## Tradeoffs

- **Network Dependency**: All pricing information requires API calls
- **Slightly Delayed UI**: Initial price display may take a moment to load from the API
- **Less Responsive Updates**: Changes to dates or guest counts require a new API call

## How to Enable/Disable

To toggle the feature, update the `useApiOnlyPricing` flag in `/src/config/featureFlags.ts`:

```typescript
export const featureFlags = {
  useApiOnlyPricing: true // Set to false to revert to dual-system
};
```

## Technical Implementation

When the feature flag is enabled:

1. **Price Utilities**: The `calculatePrice` function in `price-utils.ts` returns `null` instead of calculating local prices
2. **Availability Service**: API calls bypass cache to ensure fresh pricing data
3. **BookingSummary**: Shows loading states while waiting for API responses
4. **AvailabilityContainer**: Only uses API pricing data
5. **GuestSelector**: Makes direct API calls for updated pricing

## Testing Guidance

When testing this feature, observe:

1. The loading behavior when the page first loads
2. How the UI responds when changing guest count
3. Pricing consistency across different parts of the booking flow
4. Error handling when the API is slow or unavailable

## Considerations for Full Deployment

Before fully committing to this approach (and removing the dual pricing system entirely), consider:

1. Impact on user experience, especially for users on slow connections
2. Fallback strategy when API calls fail or timeout
3. The eventual need to update front-end types to remove client calculation fields

## Reverting the Change

If issues arise, simply set the feature flag to `false`. The application will immediately revert to the dual-system behavior, where both client-side and API-based pricing calculations operate in parallel.