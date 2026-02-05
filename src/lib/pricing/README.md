# Pricing Module

This module implements the dynamic pricing system for RentalSpot-Builder. It handles price calculations, price calendar generation, and booking totals.

## Architecture

```
Property Config + Seasons + Overrides + Min Stay Rules
                    |
              calculateDayPrice()          <-- canonical pricing engine
                    |
              Price Calendar (Firestore)   <-- pre-computed cache per month
                    |
              check-pricing API            <-- reads calendar, sums daily prices
                    |
              calculateBookingPrice()      <-- adds cleaning fee, discounts
                    |
              Booking Total
```

**Single pricing engine**: All pricing logic flows through `calculateDayPrice()` in `price-calculation.ts`. The admin calendar generator (`server-actions-hybrid.ts`) calls this function for each day. There is no separate inline pricing logic.

## Pricing Rules (Priority)

Prices compound through these layers:

1. **Base** - `property.pricePerNight`
2. **Weekend** - Multiplies base by `pricingConfig.weekendAdjustment` (configured days)
3. **Season** - Multiplies current price by `priceMultiplier` (compounds with weekend)
4. **Override** - Replaces everything with `customPrice`

Example: Base $100, weekend 1.2x, high season 1.5x = $180 on a weekend in high season.

Minimum stay: highest value wins across season, override, and dedicated min-stay rules.

## Core Files

### `price-calculation.ts` - Canonical Engine

- `calculateDayPrice()` - Computes price for a single date with all rules applied
- `calculateBookingPrice()` - Sums daily prices, adds cleaning fee, applies discounts
- `calculateOccupancyPrices()` - Generates prices for each guest count (base occupancy through max guests)
- `calculateLengthOfStayDiscount()` - Finds and applies length-of-stay discount tier
- Helper functions: `isDateInRange()`, `findMatchingSeason()`, `findDateOverride()`, `findMatchingMinStayRule()`

### `pricing-schemas.ts` - Zod Schemas

Type definitions and validation schemas for all pricing data:
- `PriceCalendarDay` - Single day entry in a price calendar
- `PriceCalendar` - Complete monthly calendar document
- `SeasonalPricing` - Seasonal pricing rule
- `DateOverride` - Date-specific price override
- `PropertyPricing` - Property pricing configuration
- `LengthOfStayDiscount` - Discount tier definition

### `pricing-with-db.ts` - Database Wrappers

Firebase Admin SDK wrappers used by the check-pricing API:
- `getPropertyWithDb()` - Fetches property pricing config
- `getPriceCalendarWithDb()` - Fetches a month's price calendar

### `price-calendar-generator.ts` - Utility

- `getMonthsBetweenDates()` - Returns year/month pairs spanning a date range

## Admin Server Actions

Located in `src/app/admin/pricing/`:

- **`server-actions-hybrid.ts`**
  - `generatePriceCalendar()` - Generates 12 months of price calendars using `calculateDayPrice()`
  - `regenerateCalendarsAfterChange()` - Auto-regenerates calendars after pricing config changes
  - `updateDay()` - Patches a single day in the calendar (creates/updates date override)
  - `fetchPriceCalendars()`, `fetchSeasonalPricing()`, `fetchDateOverrides()`, etc.

- **`actions.ts`** - CRUD for seasons and date overrides. All mutations auto-trigger calendar regeneration.

## Data Model (Firestore)

| Collection | Key Format | Purpose |
|---|---|---|
| `properties` | `{slug}` | Property config including `pricingConfig` |
| `seasonalPricing` | auto-id | Seasonal pricing rules per property |
| `dateOverrides` | auto-id | Date-specific price overrides |
| `minimumStayRules` | auto-id | Minimum stay rules per property |
| `priceCalendars` | `{propertyId}_{YYYY-MM}` | Pre-computed monthly price calendars |
| `availability` | `{propertyId}_{YYYY-MM}` | Availability flags (single source of truth) |
| `bookings` | auto-id | Booking records (checked during calendar generation) |

### PriceCalendarDay Structure

```json
{
  "basePrice": 180,
  "adjustedPrice": 216,
  "available": true,
  "minimumStay": 2,
  "isWeekend": true,
  "priceSource": "weekend",
  "prices": {
    "2": 216,
    "3": 241,
    "4": 266
  },
  "seasonId": null,
  "seasonName": null,
  "overrideId": null,
  "reason": null
}
```

- `basePrice` = raw `property.pricePerNight` (never changes)
- `adjustedPrice` = final price after weekend/season/override
- `prices` = `adjustedPrice` + extra guest fees for each guest count (starting from `baseOccupancy`)

## Calendar Lifecycle

1. **Generation**: Admin clicks "Generate Price Calendars" or calendars auto-regenerate after CRUD
2. **Auto-regeneration**: Triggered by any season/override create, update, delete, or toggle
3. **Manual day edit**: `updateDay()` patches the specific day inline (does NOT regenerate all months)
4. **Expiry alerts**: Admin banner warns when calendars expire within 14 days. Weekly cron sends email alerts to property owner + admin.

## API Endpoints

- `POST /api/check-pricing` - Public API for booking page. Checks availability, reads price calendars, calculates booking total.
- `GET /api/cron/calendar-expiry-check` - Cron endpoint (weekly). Checks all properties for expiring calendars and sends email alerts.
