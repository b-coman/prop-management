# RentalSpot-Builder Pricing System

This document outlines the pricing system architecture for RentalSpot-Builder.

> **Implementation Status**: Core functionality implemented. See [Pricing Implementation Status](./pricing-implementation-status.md) for details on what has been completed and what remains to be implemented.

## Implemented Pricing System Architecture

### Core Components

1. **Flexible Pricing Engine**
   - Dynamic pricing with multiple rule types
   - Seasonal pricing with date ranges and multipliers
   - Date-specific overrides for holidays and special events
   - Weekend pricing adjustments
   - Occupancy-based pricing (extra guest fees)
   - Length-of-stay discounts

2. **Pre-calculated Price Calendars**
   - Daily prices pre-calculated and stored for efficient lookups
   - Performance optimization for booking flow
   - Combined pricing and availability data
   - Support for different occupancy levels

3. **Firestore Data Structure**
   - Enhanced property schema with pricing configuration
   - Collections for seasonal pricing, date overrides, and pricing templates
   - Price calendars for efficient retrieval
   - Straightforward data model supporting complex pricing scenarios

### Data Model

1. **Property Base Pricing**
   - Extends the existing property schema:
     ```json
     {
       "pricePerNight": 180,
       "baseCurrency": "EUR",
       "cleaningFee": 40,
       "baseOccupancy": 4,
       "extraGuestFee": 25,
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
           {"nights": 14, "discountPercentage": 10},
           {"nights": 28, "discountPercentage": 15}
         ],
         "weekendPricing": {
           "enabled": true,
           "weekendDays": ["friday", "saturday"],
           "priceMultiplier": 1.2
         }
       }
     }
     ```

2. **Pricing Templates**
   - Predefined pricing configurations:
     ```json
     {
       "id": "default",
       "name": "Default Pricing Template",
       "defaultPricing": {
         "weekendAdjustment": 1.2,
         "weekendDays": ["friday", "saturday"]
       },
       "seasons": [
         {
           "name": "Winter High Season",
           "seasonType": "high",
           "startMonth": 12,
           "startDay": 15,
           "endMonth": 3,
           "endDay": 15,
           "priceMultiplier": 1.5,
           "minimumStay": 3
         }
       ],
       "suggestedLengthOfStayDiscounts": [
         {
           "nightsThreshold": 7,
           "discountPercentage": 5
         },
         {
           "nightsThreshold": 14,
           "discountPercentage": 10
         }
       ]
     }
     ```

3. **Seasonal Pricing**
   - Property-specific seasonal periods:
     ```json
     {
       "id": "winter-season-2023",
       "propertyId": "prahova-mountain-chalet",
       "name": "Winter Holiday Season 2023",
       "seasonType": "high",
       "startDate": "2023-12-20",
       "endDate": "2024-01-05",
       "priceMultiplier": 1.5,
       "minimumStay": 3,
       "enabled": true
     }
     ```

4. **Date Overrides**
   - Special date pricing:
     ```json
     {
       "id": "christmas-2023",
       "propertyId": "prahova-mountain-chalet",
       "date": "2023-12-25",
       "customPrice": 200.00,
       "reason": "Christmas Day",
       "minimumStay": 3,
       "available": true,
       "flatRate": true
     }
     ```

5. **Price Calendars**
   - Pre-calculated daily prices:
     ```json
     {
       "id": "prahova-mountain-chalet-2024",
       "propertyId": "prahova-mountain-chalet",
       "year": 2024,
       "prices": {
         "2024-01-01": {
           "basePrice": 180,
           "adjustedPrice": 270,
           "minimumStay": 3,
           "available": true,
           "seasonId": "winter-season-2023",
           "isWeekend": false
         }
       }
     }
     ```

### Services and Functions

1. **Price Calendar Generation**
   - `generate-price-calendars.ts` script:
     - Fetches all properties with dynamic pricing
     - Loads pricing templates, seasonal pricing, and date overrides
     - Calculates prices for each day based on all applicable rules
     - Stores pre-calculated prices in Firestore

2. **Pricing Service**
   - `pricingService.ts` provides methods for:
     - `getPriceCalendar`: Retrieve pre-calculated prices
     - `getDailyPrices`: Get prices for a date range
     - `getPriceQuote`: Calculate a complete booking quote
     - `checkAvailability`: Verify date availability and minimum stay

3. **Data Loading**
   - `load-pricing-data.ts` script:
     - Loads pricing data from JSON files
     - Handles timestamp conversion for Firestore
     - Supports development and testing

4. **Schema and Validation**
   - `pricing-schemas.ts`: Defines Zod schemas for all pricing structures
   - `validation-utils.ts`: Provides validation and normalization functions
     - `validatePriceCalendar`: Validates complete price calendar documents
     - `validatePriceCalendarDay`: Validates individual day entries
     - `normalizePriceCalendar`: Converts between different data formats

### Pricing Calculation Logic

1. **Base Price Determination**
   - Start with property's base price per night
   - Apply weekend pricing if applicable

2. **Seasonal Adjustments**
   - Check if date falls within seasonal pricing periods
   - Apply seasonal multiplier to base price

3. **Date Override Handling**
   - Apply any date-specific custom prices
   - Honor flat-rate pricing for special dates

4. **Occupancy Pricing**
   - Apply extra guest fees based on guest count
   - Calculate different prices for various occupancy levels

5. **Length-of-Stay Discounts**
   - Apply percentage discounts for longer stays
   - Based on configured night thresholds

### Integration with Booking Flow

1. **Price Display**
   - Retrieve pre-calculated prices from price calendars
   - Show daily rates in the booking interface
   - Display seasonal and special date information

2. **Booking Calculation**
   - Use the pricing service to calculate complete quotes
   - Apply length-of-stay discounts
   - Generate itemized price breakdowns

3. **Availability Checking**
   - Verify date availability from price calendars
   - Check minimum stay requirements
   - Provide alternative date suggestions

### Development and Usage

During development, you can use the JSON files in the `/firestore` directory to set up pricing data:

1. Edit or create JSON files in the appropriate directories:
   - `/firestore/pricingTemplates/`
   - `/firestore/seasonalPricing/`
   - `/firestore/dateOverrides/`
   - `/firestore/priceCalendars/`

2. Run the `load-pricing-data.ts` script to load the data into Firestore:

```bash
npx ts-node scripts/load-pricing-data.ts
```

3. Run the `generate-price-calendars.ts` script to create price calendars:

```bash
npx ts-node scripts/generate-price-calendars.ts
```

The pricing system is integrated with the booking components through the `pricingService` module, which provides methods for retrieving pricing information and calculating booking totals. Example usage:

```typescript
import { getPriceQuote } from '@/services/pricingService';

// Get a price quote for a booking
const quote = await getPriceQuote(
  'prahova-mountain-chalet',
  new Date('2024-07-15'),
  new Date('2024-07-20'),
  2 // Number of guests
);

// Display the quote information
console.log(`Total price: ${quote.totalBeforeTax} ${quote.currency}`);
```

### Using the Schema System

The pricing system includes a robust schema implementation that ensures type safety and data validation:

```typescript
import { normalizePriceCalendar } from '@/lib/pricing/validation-utils';
import { PriceCalendar } from '@/lib/pricing/pricing-schemas';

// In API routes or server components
async function getPriceCalendarData(propertyId: string, year: number, month: number): Promise<PriceCalendar> {
  const calendarId = `${propertyId}_${year}-${month.toString().padStart(2, '0')}`;
  const doc = await db.collection('priceCalendars').doc(calendarId).get();
  
  if (!doc.exists) {
    throw new Error(`Price calendar not found: ${calendarId}`);
  }
  
  // Normalize and validate data from Firestore
  return normalizePriceCalendar(doc.data());
}

// The returned data is fully typed and validated
const calendar = await getPriceCalendarData('prahova-mountain-chalet', 2024, 6);
const dayPrice = calendar.days["15"]?.adjustedPrice;
const isAvailable = calendar.days["20"]?.available;

// Validation will catch data issues early
try {
  const result = validatePriceCalendar(data);
  // Safe to use result
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle validation errors with detailed information
    console.error("Validation error:", error.errors);
  }
}
```

For more examples, see the `schema-usage-example.ts` file in the `src/lib/pricing` directory.