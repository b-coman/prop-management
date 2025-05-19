# Pricing System Troubleshooting Guide

This document explains the pricing system architecture and common troubleshooting steps.

## Data Structure

The pricing system relies on a specific Firestore data structure:

### Price Calendars Collection

- **Collection name**: `priceCalendars` (plural)
- **Document ID format**: `{property-slug}_{YYYY-MM}` (e.g., "prahova-mountain-chalet_2025-06")
- **Required fields**:
  - `propertyId`: String matching the property's ID
  - `month`: Number (1-12)
  - `monthStr`: String (e.g., "June 2025")
  - `year`: Number
  - `days`: Object with day numbers as keys

### Day Structure

Each day in the `days` object must have the following structure:

```json
"15": {
  "baseOccupancyPrice": 180,
  "prices": {
    "5": 205,
    "6": 230,
    "7": 255
  },
  "available": true,
  "minimumStay": 1,
  "priceSource": "base"
}
```

The `prices` field contains pre-calculated prices for different occupancy levels (numbers of guests). The key is the number of guests as a string, and the value is the price for that number of guests.

Required fields:
- `baseOccupancyPrice`: The price for the base occupancy
- `prices`: Object with guest count to price mapping
- `available`: Boolean indicating if the date is available for booking
- `minimumStay`: Minimum number of nights required for bookings starting on this date
- `priceSource`: Source of the pricing ("base", "weekend", "season", or "override")

## Common Issues

### "Price information not available" Error

This error usually indicates one of the following issues:

1. **Missing calendar documents** for the requested date range
2. **Incorrect document ID format** in Firestore
3. **Wrong data structure** inside the calendar documents

### Debugging Steps

1. **Verify calendar existence**:
   ```typescript
   const monthStr = month.toString().padStart(2, '0');
   const calendarId = `${propertyId}_${year}-${monthStr}`;
   const doc = await db.collection('priceCalendars').doc(calendarId).get();
   ```

2. **Check calendar structure**:
   ```typescript
   // Calendar should have days object with day numbers as keys
   if (!calendar.days || typeof calendar.days !== 'object') {
     console.error('Calendar missing days object');
   }
   ```

3. **Verify day structure**:
   ```typescript
   const day = currentDate.getDate().toString();
   const dayData = calendar.days[day];
   
   // Day should have baseOccupancyPrice and prices for different occupancy levels
   if (!dayData || !dayData.baseOccupancyPrice || !dayData.prices) {
     console.error(`Invalid day data for day ${day}`);
   }
   ```

## Testing Calendars Locally

Use this script to test if price calendars exist with the correct structure:

```typescript
import admin from 'firebase-admin';

const propertyId = 'prahova-mountain-chalet';
const year = 2025;
const month = 6;
const monthStr = month.toString().padStart(2, '0');
const calendarId = `${propertyId}_${year}-${monthStr}`;

const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
if (calendarDoc.exists) {
  const data = calendarDoc.data();
  console.log(`Month: ${data.month}`);
  console.log(`Year: ${data.year}`);
  console.log(`Days: ${Object.keys(data.days || {}).length}`);
}
```

## Generating and Fixing Calendars

### Generating Missing Calendars

If calendars are missing, you can generate them using the script:

```bash
npm run generate-price-calendars
```

Or for a specific property and date range:

```bash
npm run generate-price-calendars -- --property=prahova-mountain-chalet --start=2025-01 --end=2025-12
```

### Fixing Calendar Structure

If the calendar documents exist but have the wrong structure, you can run:

```bash
npx tsx scripts/fix-price-calendar-structure.ts
```

This will scan all calendars and fix structural issues:
- Adding `baseOccupancyPrice` field where it's missing
- Ensuring the expected data structure
- Standardizing the price format

### Generating Sample Calendars

For testing, you can generate sample calendars with:

```bash
npx tsx scripts/generate-missing-price-calendars.ts
```

This generates calendar documents with reasonable defaults for a specified property.

## Monitoring

We've implemented a monitoring script that checks for pricing system issues. You can run it with:

```bash
npx tsx scripts/monitor-price-calendars.ts
```

This script checks for:
1. **Missing price calendars** for the next 12 months
2. **Data structure validation** for all calendars
3. **Required fields** in day data objects

The monitor will alert you about:
- Missing calendar documents
- Invalid structure (missing required fields)
- Missing prices object

### Other Monitoring Recommendations

For production environments, also implement monitoring for:
1. **API error rates** for pricing-related endpoints
2. **API response times** for pricing lookups
3. **Regular automated runs** of the monitoring script

## Production API Testing

To test the pricing API in production:

```bash
curl -X POST https://your-production-url.com/api/check-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prahova-mountain-chalet",
    "checkIn": "2025-06-15",
    "checkOut": "2025-06-18",
    "guests": 5
  }'
```

The response should include availability and pricing information if the calendars are correctly structured.