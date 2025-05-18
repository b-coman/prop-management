# Dynamic Pricing Implementation Status

## Current Status

As of May 2025, the dynamic pricing system has been implemented and integrated with the booking flow. The system now retrieves pricing information from pre-calculated price calendars stored in Firestore, replacing the previous client-side calculation logic.

## Implementation Details

### Components Updated

1. **AvailabilityContainer.tsx**
   - Primary component that manages booking flow
   - Added dynamic pricing fetching via the pricing API
   - Displays dynamic pricing data in BookingSummary component
   - Disables booking options until pricing data is available
   - Added diagnostics to verify correct API loading

2. **availabilityService.ts**
   - Added `getPricingForDateRange` function to fetch pricing from API
   - Added diagnostic functions for troubleshooting
   - Maintained backward compatibility with old availability checking
   - Added proper error handling and timeout management

3. **BookingSummary.tsx**
   - Updated to display dynamic pricing information
   - Shows detailed breakdown of pricing including daily rates
   - Supports both legacy and dynamic pricing models
   - Handles dynamicPricing property for data from price calendar

4. **check-pricing-availability API Route**
   - New API endpoint for retrieving both pricing and availability
   - Uses client-side Firebase SDK to ensure Edge Runtime compatibility
   - Fetches price information from priceCalendar collection
   - Handles compatibility with Edge Runtime environment

### Architecture

The booking flow now follows this sequence:
1. User selects dates and guest count
2. Component fetches both availability and pricing data
3. If dates are available and pricing data is valid, booking options are displayed
4. Pricing is displayed using the dynamic model from price calendar
5. Booking can only proceed with valid pricing data

### File Organization

Several components have duplicates due to past refactoring efforts:
- `/components/booking/booking-summary.tsx` - Current implementation
- `/components/booking/sections/common/BookingSummary.tsx` - Deprecated version
- `/components/booking/container/AvailabilityContainer.tsx` - Current implementation
- `/components/booking/container/AvailabilityCheckContainer.tsx` - Alternative implementation

Files marked as "DEPRECATED" should be moved to `/src/archive/` in future cleanup.

## Implementation Challenges

### Edge Runtime Compatibility

The Firebase Admin SDK has limited compatibility with Edge Runtime. To address this:
- Used client-side Firebase SDK instead of Admin SDK in API routes
- Ensured all data access happens through the client SDK
- This approach provides full Edge Runtime compatibility

### Date Range Handling

The system follows standard hotel/vacation rental industry date range conventions:
- Check-in date is **inclusive** (the first night of the stay)
- Check-out date is **exclusive** (the day the guest leaves, not a night of stay)

For example, a booking from May 21 to May 29:
- Nights stayed: May 21, 22, 23, 24, 25, 26, 27, 28 (8 nights total)
- Check-out day: May 29 (morning departure, not counted as a night)
- Total nights calculation: `differenceInDays(checkOutDate, checkInDate)`

This convention is consistently applied across:
- Pricing calculations
- Availability checking
- Minimum stay validation
- Display of booking information to users

### Firestore Security Rules

Firestore security rules presented a challenge:
- Client SDK cannot directly access the `priceCalendar` collection due to security rules
- The existing `check-availability` API endpoint is working with the old collection

The solution we implemented:
1. Used the existing `check-availability` API endpoint to get availability data
2. Implemented a pricing system that reads from pre-calculated price calendars with:
   - Monthly calendar structure using `propertyId_YYYY-MM` format
   - Support for occupancy-based pricing via the `prices` object
   - Proper minimum stay validation checking all dates in the booking window
   - Fallback to property-based pricing when calendars aren't found

This approach provides a fully functional pricing system based on pre-calculated price calendars, while working within the security constraints of the Firestore rules.

### Pre-calculated Price Calendars

The system relies on pre-calculated price calendars stored in Firestore:
- Price calendars are stored with document IDs in the format `{propertyId}_{YYYY-MM}`
- Each calendar contains a `days` object with day numbers as keys (1-31)
- Each day entry contains:
  ```json
  {
    "basePrice": 180,             // Original property price
    "adjustedPrice": 180,         // Final price after all adjustments
    "available": true,            // If date is available for booking
    "minimumStay": 1,             // Minimum nights required
    "isWeekend": false,           // If it's a weekend day
    "priceSource": "base",        // Source of pricing rule applied
    "prices": {                   // Prices for different guest counts
      "4": 180,
      "5": 205,
      "6": 230
    },
    "seasonId": null,             // Reference to applied season
    "seasonName": null,           // Name of applied season
    "overrideId": null,           // Reference to applied override
    "reason": null                // Explanation for special pricing
  }
  ```
- This structure provides efficient lookups and supports different occupancy levels
- The schema is validated and normalized using Zod schemas in `pricing-schemas.ts`

### Length of Stay Discounts

The system also supports length of stay discounts configured at the property level. These discounts are applied to the subtotal based on the configured thresholds, for example:
- 5% discount for stays of 7+ nights
- 10% discount for stays of 14+ nights
- 15% discount for stays of 30+ nights

## Next Steps

1. **Testing and Validation**
   - Verify that pricing data matches expectations for different dates/guest counts
   - Test error handling for unavailable dates or pricing service issues
   - Ensure proper currency conversion works

2. **Performance Optimization**
   - Add caching for pricing data to reduce database reads
   - Consider pre-generating more pricing combinations for common scenarios

3. **Cleanup**
   - Archive deprecated components
   - Standardize on a single component hierarchy
   - Remove any remaining fallback pricing calculations

4. **Security Rule Updates**
   - Consider updating Firestore security rules to allow proper client access to priceCalendar collection
   - Document security model for pricing data access

## Troubleshooting

If issues occur with the pricing system:
1. Check browser console for debug messages from availabilityService
   - Look for entries with `[availabilityService]` prefix which contain diagnostic information
   - The `testPricingApi()` function can be called from the console to verify API availability
   - Request IDs in logs help track specific API calls through the system

2. Verify the API endpoint is being called with correct parameters
   - The API endpoint at `/api/check-pricing-availability` should receive POST requests
   - Required parameters are: propertyId, checkIn, checkOut, guests
   - Check Network tab in browser dev tools to inspect request/response

3. Check if appropriate debug markers are present
   - Look for "[LOAD CHECK] ✅" debug markers that confirm correct module loading
   - Look for "[DEBUG] 🏆 AvailabilityContainer" version indicators

4. Review error handling
   - The system includes timeout handling that aborts requests after 15 seconds
   - Error messages are displayed to users with retry options
   - Errors are logged with detailed context information

## Conclusion

The dynamic pricing system is now functional and ready for testing. It improves reliability by reading from pre-calculated price calendars with fallback to property-based pricing when needed. The system properly handles occupancy-based pricing, minimum stay requirements (checking all dates in the booking window), and offers detailed diagnostics. The implementation is fully compatible with Edge Runtime and respects Firestore security rules while providing a consistent user experience.