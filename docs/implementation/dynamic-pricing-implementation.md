# Dynamic Pricing Implementation Plan

This document outlines the implementation strategy for extending the RentalSpot-Builder system to support dynamic pricing using the existing `pricingModifiers` structure.

## Overview

The current system includes a `pricingModifiers` field in the `Availability` interface, but this isn't being utilized in price calculations. This implementation plan details how to fully integrate dynamic pricing throughout the application.

## Goals

1. Enable property managers to set different prices for specific dates
2. Support seasonal pricing (high season, low season)
3. Apply pricing modifiers in real-time during availability checks
4. Display dynamic prices accurately in the calendar and booking summary
5. Preserve all pricing information in the final booking record

## Implementation Steps

### 1. Extend Availability Service

**File**: `src/services/availabilityService.ts`

- Enhance the `checkAvailability` function to include pricing modifiers in the response
- Modify the data structure to return both availability and applicable price modifiers
- Add validation to ensure pricing modifiers are within acceptable ranges (e.g., 0.5 to 3.0)

```typescript
// Sample enhanced response structure
interface AvailabilityResponse {
  available: boolean;
  dates: {
    [date: string]: {
      available: boolean;
      priceModifier?: number; // Multiplier for base price
      minimumStay?: number;   // Minimum nights if starting on this date
    }
  };
  // Other fields...
}
```

### 2. Update Price Calculation Logic

**File**: `src/lib/price-utils.ts`

- Modify the `calculatePrice` function to accept date-specific pricing modifiers
- Implement day-by-day price calculation when modifiers exist
- Ensure backward compatibility when no modifiers are provided

```typescript
export function calculatePrice(
  pricePerNight: number,
  numberOfNights: number,
  cleaningFee: number,
  numberOfGuests: number,
  baseOccupancy: number,
  extraGuestFeePerNight: number,
  baseCurrency: CurrencyCode,
  discountPercentage: number = 0,
  // New parameter
  dailyPriceModifiers?: Record<string, number>
): PriceCalculationResult {
  // If no modifiers or only one night, use simple calculation
  if (!dailyPriceModifiers || numberOfNights <= 1) {
    // Existing calculation logic...
  }
  
  // With modifiers, calculate day by day
  let basePrice = 0;
  for (const [dateStr, modifier] of Object.entries(dailyPriceModifiers)) {
    basePrice += pricePerNight * modifier;
  }
  
  // Continue with rest of calculation...
}
```

### 3. Integrate with Booking Context

**File**: `src/contexts/BookingContext.tsx`

- Add state for storing date-specific pricing modifiers
- Ensure price calculations use these modifiers when available
- Update the context API to expose modifier-related functionality

```typescript
// Add to BookingContext state
const [pricingModifiers, setPricingModifiers] = useState<Record<string, number>>({});

// Add to provided context value
{
  // Existing context values...
  pricingModifiers,
  setPricingModifiers,
}
```

### 4. Update Availability Checker Component

**File**: `src/components/booking/sections/availability/AvailabilityCalendar.tsx`

- Modify to fetch and store pricing modifiers when checking availability
- Pass modifier information to the date picker component
- Update UI to indicate dates with modified pricing

```typescript
// When fetching availability
const checkAvailability = async () => {
  const result = await fetchAvailability(propertyId, startDate, endDate);
  setAvailableDates(result.availableDates);
  
  // Store price modifiers
  if (result.pricingModifiers) {
    setPricingModifiers(result.pricingModifiers);
  }
};
```

### 5. Enhance Date Picker UI

**File**: `src/components/booking/date-range-picker.tsx`

- Update the date picker to display price indicators
- Add visual cues for dates with different prices
- Show the actual price for a date on hover or selection

```typescript
// Example of price display in day cell
const renderDayContents = (day: Date) => {
  const dateStr = formatDate(day, 'yyyy-MM-dd');
  const modifier = pricingModifiers[dateStr];
  const isModified = modifier && modifier !== 1;
  
  return (
    <div className={`day-cell ${isModified ? 'price-modified' : ''}`}>
      {day.getDate()}
      {isModified && (
        <div className="price-indicator">
          {modifier > 1 ? '↑' : '↓'}
        </div>
      )}
    </div>
  );
};
```

### 6. Update Booking Summary Component

**File**: `src/components/booking/sections/common/BookingSummary.tsx`

- Modify to display a breakdown of varying nightly rates
- Calculate and show the average nightly rate
- Display "Variable rate" indicator when prices differ across the stay

```typescript
// Inside BookingSummary component
const hasVariableRates = Object.keys(pricingModifiers).length > 0;

// Display variable rates in the UI
{hasVariableRates ? (
  <div className="flex justify-between">
    <span>Base price (variable rates)</span>
    <span>${actualBasePrice}</span>
  </div>
) : (
  <div className="flex justify-between">
    <span>Base price ({numberOfNights} nights)</span>
    <span>${actualBasePrice}</span>
  </div>
)}
```

### 7. Update Booking Service

**File**: `src/services/bookingService.ts`

- Modify booking creation to store pricing modifiers used
- Ensure price calculations are consistent between UI and backend
- Add validation for dynamic pricing data

```typescript
// Enhanced booking creation
export async function createBooking(bookingData) {
  // Validate that the pricing matches expected calculation
  const calculatedPrice = calculatePrice(
    property.pricePerNight,
    nights,
    property.cleaningFee,
    guests,
    property.baseOccupancy,
    property.extraGuestFee,
    property.baseCurrency,
    discountPercentage,
    bookingData.pricingModifiers
  );
  
  // Continue with booking creation...
}
```

### 8. Update Firestore Data Model

**File**: Update for `Availability` and `Booking` collections:

- Ensure Firestore security rules allow reading and writing pricing modifiers
- Update any validation logic for the new fields
- Consider adding indexes if needed for querying with modifiers

### 9. Testing Strategy

1. **Unit Tests**:
   - Test price calculation with various modifier combinations
   - Test edge cases (e.g., all nights modified, some nights modified)
   - Test currency conversions with modified prices

2. **Integration Tests**:
   - Test full booking flow with dynamic pricing
   - Test availability checking with pricing modifiers
   - Test date picker UI with price indicators

3. **UI Tests**:
   - Verify price display in calendar
   - Check booking summary with variable rates
   - Test mobile UI with price indicators

## Migration Plan

1. Deploy database schema changes without UI changes
2. Implement backend calculation changes with fallbacks to current logic
3. Gradually roll out UI changes to support dynamic pricing
4. Enable admin UI for setting dynamic pricing

## Acceptance Criteria

- Property owners can set different prices for specific dates
- Customers see accurate dynamic prices during the booking process
- Price calculations correctly apply modifiers for each night
- Booking records store the pricing modifiers used
- The system fails gracefully when modifiers are not available

## Estimation

- Backend implementation: 2-3 days
- Frontend integration: 2-3 days
- Testing and refinement: 1-2 days
- Total: 5-8 days of development time