# Pricing Structure Compatibility

This document outlines a common issue with the pricing API related to data structure mismatches and provides a resolution for it.

## Problem

When changing the guest count in the booking interface, the pricing doesn't update correctly. This happens because the pricing API endpoint (`/api/check-pricing`) expects a different data structure than what is stored in Firestore.

### Symptoms

1. Changing guest count does not update the price
2. Browser console may show 500 Internal Server Error for API calls
3. Extra guest fees are not being applied correctly
4. The issue may appear in production but not in development (or vice versa)

## Diagnosis

The root issue is a mismatch between data structures:

1. The API endpoint in `check-pricing/route.ts` expects price calendars to have a `days` object with day numbers as keys
2. The actual data in Firestore uses a `prices` object with date strings as keys (e.g., "2025-01-01")

### Using the Diagnosis Script

To confirm this issue in your environment:

```bash
# Run the diagnosis script
./scripts/run-calendar-diagnosis.sh prahova-mountain-chalet 2025 05
```

This will analyze your price calendar structure and output a detailed report.

## Resolution

### Short-term Fix: Update API to Support Both Structures

Modify `/api/check-pricing/route.ts` to handle both data structures by:

```typescript
// Find the relevant calendar
const calendar = calendars.find(c => c?.year === year && c?.month === month);

// Add compatibility with both structures
if (!calendar) {
  // No calendar available
  allAvailable = false;
  unavailableDates.push(dateStr);
} else {
  let dayPrice;
  
  // Check for new structure (days object with day numbers as keys)
  if (calendar.days && calendar.days[day]) {
    dayPrice = calendar.days[day];
  } 
  // Check for old structure (prices object with date strings as keys)
  else if (calendar.prices && calendar.prices[dateStr]) {
    dayPrice = adaptPriceFormat(calendar.prices[dateStr]);
  } else {
    // No price information available in either format
    allAvailable = false;
    unavailableDates.push(dateStr);
    continue; // Skip to next iteration
  }
  
  // Process the day price as usual...
}

// Helper function to adapt the old price format to the expected format
function adaptPriceFormat(priceData) {
  return {
    baseOccupancyPrice: priceData.adjustedPrice || priceData.basePrice,
    prices: {},  // We'll need to calculate this if needed
    available: priceData.available !== false, // Default to true if not specified
    minimumStay: priceData.minimumStay || 1,
    priceSource: priceData.seasonId ? 'season' : (priceData.isWeekend ? 'weekend' : 'base')
  };
}
```

### Long-term Fix: Data Migration

Create a migration script to convert existing price calendars from the `prices` structure to the expected `days` structure:

1. Create a migration script (`scripts/fix-price-calendar-structure.ts`)
2. Run the script to update all calendars
3. Update the calendar generator to use the correct structure for new calendars

### Testing

After implementing the fix:

1. Test with various guest counts using the test script:
   ```bash
   ./scripts/test-production-pricing-endpoint.sh
   ```

2. Verify extra guest fees are applied when:
   - Guest count is below baseOccupancy (should use base price)
   - Guest count exceeds baseOccupancy (should add extraGuestFee per additional guest)

## Prevention

To prevent similar issues in the future:

1. Add schema validation to all Firestore database operations
2. Create and maintain comprehensive data structure documentation
3. Implement a test suite that verifies pricing calculation with different guest counts
4. Add runtime type checking for critical data structures

## Related Documents

- [Pricing Troubleshooting Guide](/docs/PRICING_TROUBLESHOOTING.md)
- [Firestore Pricing Structure](/docs/implementation/firestore-pricing-structure.md)
- [Booking Availability Check Redesign](/docs/implementation/booking-availability-check-redesign.md)

## Reference Implementation

For a complete implementation of the fix, refer to:
- `/scripts/diagnose-production-calendar-structure.ts` - Diagnosis script
- `/scripts/fix-price-calendar-structure.ts` - Migration script