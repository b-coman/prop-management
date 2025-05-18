# Pricing Module

This module implements the dynamic pricing system for RentalSpot-Builder. It handles price calculations, price calendar generation, and pricing rule management.

## Core Components

### 1. Price Calculation (`price-calculation.ts`)

The core calculation engine that determines prices based on various rules:

- Base property pricing
- Weekend adjustments
- Seasonal pricing
- Date-specific overrides
- Occupancy-based pricing
- Length-of-stay discounts

```typescript
// Example: Calculate price for a specific date
const dayPrice = calculateDayPrice(
  property,
  new Date('2023-12-31'),
  seasonalPricing,
  dateOverrides,
  minimumStayRules
);

// Example: Calculate a booking total with discounts
const bookingPrice = calculateBookingPrice(
  dailyPrices,
  cleaningFee,
  lengthOfStayDiscounts,
  couponDiscountPercentage
);
```

### 2. Price Calendar Generator (`price-calendar-generator.ts` and `server-actions-hybrid.ts`)

Generates and manages pre-calculated price calendars:

- Creates monthly calendar documents in Firestore
- Stores pre-calculated prices for different occupancy levels
- Includes availability information
- Provides summary statistics

> **Important**: While the core generator logic is defined in `price-calendar-generator.ts`, the actual implementation used in the admin interface is in `src/app/admin/pricing/server-actions-hybrid.ts`. This is the script that handles the generation of price calendars and determines the final structure stored in Firestore.

```typescript
// Example: Generate a price calendar for a month
const calendar = await generatePriceCalendar(
  'property-id',
  2023,
  12
);

// Example: Update calendars for the next 12 months
await updatePriceCalendarsForProperty('property-id', 12);
```

### 3. Price Calendar Updater (`price-calendar-updater.ts`)

Handles event-driven updates to price calendars:

- Updates in response to pricing rule changes
- Updates when bookings are created or canceled
- Efficient partial updates for affected date ranges

```typescript
// Example: Update calendars when property pricing changes
await handlePropertyPricingChange('property-id');

// Example: Update calendars when a booking status changes
await handleBookingStatusChange(
  'property-id',
  new Date('2023-12-24'),
  new Date('2023-12-31')
);
```

## Data Model

The pricing system uses the following data models:

1. **Property Pricing Configuration**
   - Part of the property document
   - Includes base price, weekend settings, and discount tiers

2. **Seasonal Pricing**
   - Separate collection for seasonal price adjustments
   - Includes date ranges, price multipliers, and minimum stay requirements

3. **Date Overrides**
   - Specific date prices that override other rules
   - Can also mark dates as unavailable
   - Support for flat-rate pricing regardless of occupancy

4. **Price Calendar**
   - Pre-calculated prices for each day
   - Includes pricing for different occupancy levels
   - Stores availability and minimum stay requirements
   - Organized by property and month
   - Each day entry contains:
     ```json
     {
       "basePrice": 180,
       "adjustedPrice": 180,
       "available": true,
       "minimumStay": 1,
       "isWeekend": false,
       "priceSource": "base",
       "prices": {
         "4": 180,
         "5": 205,
         "6": 230,
         "7": 255
       },
       "seasonId": null,
       "seasonName": null,
       "overrideId": null,
       "reason": null
     }
     ```

## Schema Implementation

The pricing system includes a fully-typed schema implementation using Zod for validation and type safety:

### Core Schema Files

- **`pricing-schemas.ts`**: Contains all model definitions and validation schemas
- **`validation-utils.ts`**: Provides validation and conversion utilities

### Key Schema Types

```typescript
// PriceCalendar structure (document-level)
export type PriceCalendar = {
  id: string;              // propertyId_YYYY-MM
  propertyId: string;      // Reference to property
  year: number;            // Calendar year
  month: number;           // Calendar month (1-12)
  days: Record<string, PriceCalendarDay>; // Daily price data
  summary: PriceCalendarSummary;  // Statistics and metadata
  generatedAt: string | Date;     // Generation timestamp
};

// PriceCalendarDay structure (each day entry)
export type PriceCalendarDay = {
  basePrice: number;      // Original property price
  adjustedPrice: number;  // Final price after adjustments
  available: boolean;     // If date is available for booking
  minimumStay: number;    // Minimum nights required
  isWeekend: boolean;     // If it's a weekend day
  priceSource: 'base' | 'weekend' | 'season' | 'override';
  prices: Record<string, number>;  // Prices by guest count
  seasonId: string | null;   // Applied season reference
  seasonName: string | null; // Applied season name
  overrideId: string | null; // Applied override reference
  reason: string | null;     // Explanation for special pricing
};
```

### Using the Schema

```typescript
// Validating data from Firestore
import { normalizePriceCalendar } from './validation-utils';

// Normalize and validate in one step
const calendar = normalizePriceCalendar(firestoreData);

// Access fully-typed data safely
const price = calendar.days["15"].adjustedPrice;
const isAvailable = calendar.days["20"]?.available;
```

For more detailed examples, see `schema-usage-example.ts`.

## Usage Examples

### Basic Price Lookup

```typescript
// Get price for a specific date and occupancy
async function getPriceForDate(propertyId: string, date: Date, guests: number) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate().toString();
  
  // Get price calendar for the month
  const calendar = await getPriceCalendar(propertyId, year, month);
  
  if (!calendar || !calendar.days[day]) {
    throw new Error('Price information not available');
  }
  
  const dayPrice = calendar.days[day];
  
  // Check availability
  if (!dayPrice.available) {
    throw new Error('Date is not available');
  }
  
  // Get price for requested occupancy
  if (guests <= baseOccupancy) {
    return dayPrice.baseOccupancyPrice;
  }
  
  const occupancyPrice = dayPrice.prices[guests.toString()];
  if (!occupancyPrice) {
    throw new Error('Price not available for this occupancy');
  }
  
  return occupancyPrice;
}
```

### Checking Availability with Pricing

```typescript
// Check availability for a date range with pricing
async function checkAvailabilityWithPricing(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  guests: number
) {
  // Get property for general info
  const property = await getProperty(propertyId);
  
  // Get date range
  const nights = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  
  // Get all required price calendars
  const months = getMonthsBetweenDates(checkIn, checkOut);
  const calendars = await Promise.all(
    months.map(({ year, month }) => getPriceCalendar(propertyId, year, month))
  );
  
  // Check each date in the range
  const dailyPrices: Record<string, number> = {};
  let allAvailable = true;
  let minimumStay = 1;
  
  // Check each day
  const currentDate = new Date(checkIn);
  for (let night = 0; night < nights; night++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate().toString();
    
    // Find the relevant calendar
    const calendar = calendars.find(c => c?.month === `${year}-${month.toString().padStart(2, '0')}`);
    
    if (!calendar || !calendar.days[day]) {
      // No price information available
      allAvailable = false;
      break;
    }
    
    const dayPrice = calendar.days[day];
    
    // Check availability
    if (!dayPrice.available) {
      allAvailable = false;
      break;
    }
    
    // Record price for this date
    if (guests <= property.baseOccupancy) {
      dailyPrices[dateStr] = dayPrice.baseOccupancyPrice;
    } else {
      const occupancyPrice = dayPrice.prices[guests.toString()];
      if (occupancyPrice) {
        dailyPrices[dateStr] = occupancyPrice;
      } else {
        // Fallback to base price + extra guest fee
        const extraGuests = guests - property.baseOccupancy;
        dailyPrices[dateStr] = dayPrice.baseOccupancyPrice + (extraGuests * property.extraGuestFee);
      }
    }
    
    // Check minimum stay (only for the first night)
    if (night === 0 && dayPrice.minimumStay > minimumStay) {
      minimumStay = dayPrice.minimumStay;
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Check if minimum stay requirement is met
  const meetsMinimumStay = nights >= minimumStay;
  
  // Calculate pricing if available
  if (allAvailable && meetsMinimumStay) {
    // Calculate booking price with any applicable discounts
    const pricingDetails = calculateBookingPrice(
      dailyPrices,
      property.cleaningFee || 0,
      property.pricingConfig?.lengthOfStayDiscounts
    );
    
    return {
      available: true,
      pricing: {
        ...pricingDetails,
        currency: property.baseCurrency
      }
    };
  } else if (!meetsMinimumStay) {
    return {
      available: false,
      reason: 'minimum_stay',
      minimumStay
    };
  } else {
    return {
      available: false,
      reason: 'unavailable_dates'
    };
  }
}
```

## Maintenance and Scheduled Jobs

The pricing system relies on scheduled jobs to maintain price calendars:

1. **Nightly Price Calendar Update**
   - Updates price calendars for all properties
   - Generates calendars for the next 12 months
   - Implemented in `src/scripts/cron/update-price-calendars.ts`

2. **Event Handlers**
   - Listen for changes to pricing rules
   - Update affected calendars when rules change
   - Implemented through Firestore triggers

## Future Enhancements

Potential future enhancements to the pricing system:

1. **Demand-Based Pricing**
   - Adjust prices based on booking patterns
   - Implement automatic price suggestions

2. **Competitive Analysis**
   - Compare prices with similar properties
   - Suggest adjustments based on market rates

3. **Advanced Pricing Rules**
   - First-night pricing
   - Last-minute discounts
   - Early bird specials