# Centralized Pricing System

## Overview

The centralized pricing system provides a single source of truth for pricing data throughout the application. It resolves the issue of inconsistent pricing information between different components by centralizing the API calls and pricing state in the `BookingContext`.

## Problem Solved

Previously, the application had two separate systems for pricing calculation:

1. **Client-side calculations** in `price-utils.ts` that computed an estimate of the pricing based on property data
2. **API-based pricing** that fetched accurate prices from the server considering all special dates, rules, and discounts

This dual approach led to several issues:

- Different components could show different prices for the same booking
- Pricing information wasn't consistently updated when parameters changed
- Multiple redundant API calls were made for the same data
- The sidebar and booking summary often displayed different prices

## Implementation

### Core Components

1. **BookingContext.tsx**  
   The `BookingContext` has been enhanced with:
   - A `PricingDetails` interface that standardizes pricing data
   - State variables for pricing data, loading state, and errors
   - Methods for fetching, updating, and resetting pricing data
   - Auto-fetching when dates or guest count changes

2. **AvailabilityContainer.tsx**  
   This component now:
   - Uses the centralized pricing state from `BookingContext`
   - Triggers pricing fetch through the context instead of making its own API calls
   - Passes pricing data and loading state to the `BookingSummary` component

3. **getPricingForDateRange Function**  
   The existing API function in `availabilityService.ts` is now used as the single entry point for all pricing data.

### Data Flow

1. User selects dates and guest count
2. `AvailabilityContainer` checks availability
3. If available, it triggers the `fetchPricing` function from `BookingContext`
4. `BookingContext` calls the API and stores the result
5. All components that depend on pricing data read from the same source
6. When parameters change, the pricing is automatically refreshed

## Benefits

- **Consistency**: All components display the same pricing information
- **Performance**: Eliminates redundant API calls
- **Reliability**: Pricing is always current with the latest parameters
- **UX Improvement**: Loading states are consistently managed
- **Developer Experience**: Simpler component logic with clear data flow
- **Reduced Network Traffic**: Fewer API calls for the same data

## Feature Flag Integration

The centralized pricing system works in conjunction with the `useApiOnlyPricing` feature flag:

- When the flag is enabled, only the API provides pricing information
- When disabled, the system could fall back to client-side calculations if needed
- API responses are still cached to reduce network traffic

## Usage Example

### Reading Pricing Data

```tsx
// In a React component
import { useBooking } from '@/contexts/BookingContext';

const MyComponent = () => {
  const { pricingDetails, isPricingLoading, pricingError } = useBooking();
  
  if (isPricingLoading) {
    return <LoadingIndicator />;
  }
  
  if (pricingError) {
    return <ErrorMessage message={pricingError} />;
  }
  
  if (pricingDetails) {
    return (
      <div>
        <p>Total Price: {pricingDetails.total}</p>
        <p>Currency: {pricingDetails.currency}</p>
      </div>
    );
  }
  
  return <p>No pricing available</p>;
};
```

### Triggering a Pricing Update

```tsx
import { useBooking } from '@/contexts/BookingContext';

const GuestSelector = ({ onGuestCountChange }) => {
  const { setNumberOfGuests, fetchPricing } = useBooking();
  
  const handleGuestChange = (count) => {
    // Update guest count in context
    setNumberOfGuests(count);
    
    // Notify parent component
    if (onGuestCountChange) {
      onGuestCountChange(count);
    }
    
    // Trigger price update
    fetchPricing().catch(error => {
      console.error('Error fetching updated pricing:', error);
    });
  };
  
  // Component render logic
};
```

## Future Enhancements

1. **Offline Support**: Add fallback client-side calculations when API is unavailable
2. **Price Breakdown Caching**: Store detailed price breakdowns for better performance
3. **Additional Context Fields**: Add more fields like taxes, fees, and discounts
4. **Stricter Validation**: Validate pricing data to ensure it's always in the expected format
5. **Analytics Integration**: Track pricing data for analytics and optimization