# Using Dynamic Pricing in RentalSpot-Builder

This guide explains how to use the dynamic pricing system in your booking components and how to manage pricing data using JSON files.

## Overview

RentalSpot-Builder includes a flexible pricing system that supports:

- Seasonal rates (summer, winter, holidays)
- Date-specific overrides (special events, holidays)
- Weekend pricing adjustments
- Occupancy-based pricing (extra guest fees)
- Length-of-stay discounts

The system uses pre-calculated price calendars for efficient lookups, making it fast and reliable for booking operations.

## Getting Started

### 1. Setting Up Pricing Rules

Pricing rules are stored in JSON files in the `/firestore` directory. To create or modify pricing rules:

#### Property Configuration

Update the property JSON file to include pricing configuration:

```json
{
  "pricing": {
    "pricingTemplateId": "default",
    "useDynamicPricing": true,
    "occupancyPricing": {
      "enabled": true,
      "baseOccupancy": 4,
      "extraGuestFeePerNight": 25
    },
    "lengthOfStayDiscounts": [
      {"nights": 7, "discountPercentage": 5},
      {"nights": 14, "discountPercentage": 10}
    ],
    "weekendPricing": {
      "enabled": true,
      "weekendDays": ["friday", "saturday"],
      "priceMultiplier": 1.2
    }
  }
}
```

#### Seasonal Pricing

Create seasonal pricing rules in `/firestore/seasonalPricing/`:

```json
{
  "id": "summer-season-2024",
  "propertyId": "your-property-id",
  "name": "Summer Season 2024",
  "seasonType": "high",
  "startDate": "2024-06-01",
  "endDate": "2024-08-31",
  "priceMultiplier": 1.3,
  "minimumStay": 2,
  "enabled": true
}
```

#### Date Overrides

Create date-specific overrides in `/firestore/dateOverrides/`:

```json
{
  "id": "new-years-eve-2024",
  "propertyId": "your-property-id",
  "date": "2024-12-31",
  "customPrice": 300.00,
  "reason": "New Year's Eve",
  "minimumStay": 3,
  "available": true,
  "flatRate": true
}
```

### 2. Loading Data and Generating Price Calendars

After creating or updating pricing rules, run these commands:

```bash
# Load pricing data to Firestore
npm run load-pricing-data

# Generate price calendars
npm run generate-price-calendars
```

This will:
1. Load all JSON files from the `/firestore` directory to Firestore
2. Calculate prices for each day based on the rules
3. Store pre-calculated prices in the `priceCalendars` collection
4. Save a copy of the price calendar as a JSON file

## Using the Pricing Service in Components

### Checking Availability and Pricing

```typescript
import { getPriceQuote, checkAvailability } from '@/services/pricingService';

// In your booking component:
async function checkAvailabilityAndPrice() {
  const propertyId = 'your-property-id';
  const startDate = new Date('2024-07-15');
  const endDate = new Date('2024-07-20');
  const guestCount = 2;

  // Check if dates are available
  const availabilityResult = await checkAvailability(
    propertyId,
    startDate,
    endDate,
    guestCount
  );

  if (availabilityResult.available) {
    // Get price quote for the booking
    const priceQuote = await getPriceQuote(
      propertyId,
      startDate,
      endDate,
      guestCount
    );

    // Display pricing information
    displayPricing(priceQuote);
  } else {
    // Show unavailability message
    showUnavailableMessage(availabilityResult.reason);
  }
}
```

### Displaying Daily Prices

```typescript
import { getDailyPrices } from '@/services/pricingService';

// Get daily prices for a date range
async function showDailyPrices() {
  const propertyId = 'your-property-id';
  const startDate = new Date('2024-07-01');
  const endDate = new Date('2024-07-31');

  const dailyPrices = await getDailyPrices(
    propertyId,
    startDate,
    endDate
  );

  // Display daily prices in a calendar
  renderPriceCalendar(dailyPrices);
}
```

### Working with Price Quotes

```typescript
import { getPriceQuote } from '@/services/pricingService';

// Display a booking summary with pricing
async function displayBookingSummary() {
  const propertyId = 'your-property-id';
  const startDate = new Date('2024-07-15');
  const endDate = new Date('2024-07-20');
  const guestCount = 6;

  const quote = await getPriceQuote(
    propertyId,
    startDate,
    endDate,
    guestCount
  );

  // The quote object includes detailed pricing:
  /*
  {
    nightlyPrices: [
      { date: '2024-07-15', basePrice: 180, adjustedPrice: 234, isWeekend: false },
      { date: '2024-07-16', basePrice: 180, adjustedPrice: 234, isWeekend: false },
      ...
    ],
    subtotal: 1170,
    cleaningFee: 40,
    extraGuestsFee: 100, // 2 extra guests × 5 nights × 10 EUR
    lengthOfStayDiscount: 0,
    totalBeforeTax: 1310,
    averageNightlyRate: 234,
    currency: 'EUR',
    minimumStay: 2
  }
  */

  // Use the quote to display a summary
  return (
    <div>
      <h3>Booking Summary</h3>
      <p>Dates: {formatDateRange(startDate, endDate)}</p>
      <p>Guests: {guestCount}</p>
      <p>Nightly Rate: {formatCurrency(quote.averageNightlyRate, quote.currency)}</p>
      <p>Accommodation: {formatCurrency(quote.subtotal, quote.currency)}</p>
      {quote.extraGuestsFee > 0 && (
        <p>Extra Guest Fee: {formatCurrency(quote.extraGuestsFee, quote.currency)}</p>
      )}
      <p>Cleaning Fee: {formatCurrency(quote.cleaningFee, quote.currency)}</p>
      {quote.lengthOfStayDiscount > 0 && (
        <p>Discount: -{formatCurrency(quote.lengthOfStayDiscount, quote.currency)}</p>
      )}
      <p><strong>Total: {formatCurrency(quote.totalBeforeTax, quote.currency)}</strong></p>
    </div>
  );
}
```

## Price Calculation Logic

The pricing system applies rules in the following order:

1. **Base Price**: Start with the property's base price per night
2. **Seasonal Pricing**: Apply any seasonal pricing multipliers
3. **Weekend Adjustment**: Apply weekend pricing if enabled and applicable
4. **Date Override**: Apply any date-specific overrides (highest priority)
5. **Occupancy Pricing**: Calculate extra guest fees based on guest count
6. **Length-of-Stay Discount**: Apply discounts for longer stays

For minimum stay requirements, the system checks all dates in the booking window:
- Each day in the date range is checked for its minimum stay requirement
- The highest minimum stay requirement is applied to the entire booking
- If any day requires a longer stay than the booking length, the booking is rejected
- This ensures that all date-specific constraints are properly respected

## Testing the New Pricing API

You can test the property-based pricing API directly from the browser console with this code:

```javascript
// Test pricing API (copy/paste into browser console when on a property page)
async function testPricing() {
  const propertySlug = document.location.pathname.split('/').filter(Boolean)[1];
  console.log(`Testing pricing for property: ${propertySlug}`);
  
  // Create test dates (2 nights, current date + 30 days)
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 30);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2);
  
  console.log(`Dates: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  try {
    // Import the pricing service directly
    const { getPricingForDateRange } = await import('/services/availabilityService.js');
    
    // Call the pricing API
    const result = await getPricingForDateRange(propertySlug, startDate, endDate, 2);
    
    console.log('Pricing result:', result);
    
    if (result?.pricing) {
      console.log(`Total price: ${result.pricing.totalPrice} ${result.pricing.currency}`);
      console.log('Daily rates:', result.pricing.dailyRates);
    }
  } catch (error) {
    console.error('Error testing pricing:', error);
  }
}

// Run the test
testPricing();
```

## Understanding the Price Calendar System

The pricing system uses pre-calculated price calendars with the following characteristics:

1. **Calendar Structure**:
   - Calendar documents use the format `propertyId_YYYY-MM` (e.g., "prahova-mountain-chalet_2024-05")
   - Each calendar contains data for one month
   - Prices are stored in a `days` object with day numbers as keys (1-31)

2. **Day Data Format**:
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
     "overrideId": null            // Reference to applied override
   }
   ```

3. **Date Range Handling**:
   - Check-in date is **inclusive** (first night of stay)
   - Check-out date is **exclusive** (day guest leaves, not a night of stay)
   - Example: Booking from May 21 to May 29 means:
     - Nights stayed: May 21, 22, 23, 24, 25, 26, 27, 28 (8 nights total)
     - Check-out day: May 29 (morning departure, not counted as a night)
   - Total nights calculation: `differenceInDays(checkOutDate, checkInDate)`
   - This follows standard hotel/vacation rental industry convention
   - All pricing and availability checks follow this pattern

4. **Occupancy-Based Pricing**:
   - The `prices` object contains different prices for various guest counts
   - If a guest count doesn't have an exact match, the system finds the closest bracket
   - Fallbacks to `adjustedPrice` if no guest-specific price is found

5. **Minimum Stay Logic**:
   - Every day in the booking window is checked for minimum stay requirements
   - The highest requirement is used for validation
   - Ensures stricter requirements in the middle of a stay are not circumvented

The pricing service accesses these pre-calculated values rather than computing prices on-the-fly, providing better performance and consistency.

## Troubleshooting

### Common Issues

1. **Prices not updating**: Run the `generate-price-calendars` script after making changes to pricing rules
2. **Firebase authentication errors**: Ensure your service account path is correctly set in `.env.local`
3. **Missing pricing information**: Check that the property has `useDynamicPricing` set to `true`
4. **API returns 500 error**: Check Firestore security rules and Edge Runtime compatibility

### Debugging Tools

1. **Browser Console API Test**:
   Use the code snippet above to test pricing from the browser console

2. **Price Calendar Check**:
   Verify that price calendars exist for your properties:
   ```javascript
   // Check for price calendar in browser console
   (async () => {
     // Import Firebase
     const { db } = await import('/lib/firebase.js');
     const { doc, getDoc } = await import('firebase/firestore');
     
     // Get property slug from URL
     const propertySlug = document.location.pathname.split('/').filter(Boolean)[1];
     
     // Get current month in YYYY-MM format
     const now = new Date();
     const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
     
     // Try to get price calendar with correct format: propertyId_YYYY-MM
     const calendarRef = doc(db, 'priceCalendars', `${propertySlug}_${yearMonth}`);
     const calendarSnap = await getDoc(calendarRef);
     
     if (calendarSnap.exists()) {
       const data = calendarSnap.data();
       console.log(`Price calendar found for ${yearMonth}:`, data);
       
       // Check days data
       if (data.days) {
         console.log(`Calendar contains ${Object.keys(data.days).length} days`);
         
         // Show the current day as an example
         const today = String(now.getDate());
         if (data.days[today]) {
           console.log(`Price for today (day ${today}):`, data.days[today]);
         }
       }
     } else {
       console.log(`Price calendar not found for ${propertySlug}_${yearMonth}`);
       console.log('Run generate-price-calendars script to create missing calendars');
     }
   })();
   ```

3. **Price Calendar Generation**:
   Run the generation script to create or update price calendars:
   ```bash
   npm run generate-price-calendars
   ```

## Further Development

The pricing system is designed to be extended with additional features:

1. **Admin Interface**: Add a UI for managing pricing rules
2. **Demand-Based Pricing**: Implement dynamic adjustments based on demand
3. **Early Bird/Last Minute Discounts**: Add time-based discounts
4. **Promotion Codes**: Implement special promotional pricing

See the [Pricing Implementation Status](../implementation/pricing-implementation-status.md) document for current development progress and next steps.