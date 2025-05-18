/**
 * This file demonstrates how to use the pricing schemas and validation utilities
 * You can run this with: tsx src/lib/pricing/schema-usage-example.ts
 */

import { 
  PriceCalendarSchema, 
  PriceCalendarDay,
  SeasonalPricingSchema
} from './pricing-schemas';

import {
  validatePriceCalendar,
  validatePriceCalendarDay,
  normalizePriceCalendar
} from './validation-utils';

// Example 1: Validate a day in a price calendar
console.log("Example 1: Validating a price calendar day");
try {
  const dayData: PriceCalendarDay = {
    basePrice: 180,
    adjustedPrice: 180,
    available: true,
    minimumStay: 1,
    isWeekend: false,
    priceSource: 'base',
    prices: {
      "4": 180,
      "5": 205,
      "6": 230,
      "7": 255
    },
    seasonId: null,
    seasonName: null,
    overrideId: null,
    reason: null
  };
  
  // Validate using the schema
  const validDay = validatePriceCalendarDay(dayData);
  console.log("Day validated successfully:", validDay.priceSource);
  
  // Example of an error - negative price
  const invalidDay = { ...dayData, basePrice: -100 };
  validatePriceCalendarDay(invalidDay); // This should throw an error
} catch (error) {
  console.error("Validation error:", error.message);
}

// Example 2: Converting a Firestore data format to our schema format
console.log("\nExample 2: Converting a Firestore data format");
try {
  // Example of data as it might come from Firestore
  const firestoreData = {
    id: "prahova-mountain-chalet_2024-05",
    propertyId: "prahova-mountain-chalet",
    year: 2024,
    month: 5,
    generatedAt: {
      _seconds: 1714583282,
      _nanoseconds: 0
    },
    // Missing the days key, using prices instead (old format)
    prices: {
      "2024-05-01": {
        basePrice: 270,
        adjustedPrice: 270,
        minimumStay: 3,
        available: true,
        seasonId: "summer-season-2024",
        isWeekend: false,
        reason: "Holiday"
      },
      "2024-05-02": {
        basePrice: 270,
        adjustedPrice: 270,
        minimumStay: 3,
        available: true,
        seasonId: "summer-season-2024",
        isWeekend: false
      }
    }
  };
  
  // Normalize and validate
  const normalized = normalizePriceCalendar(firestoreData);
  console.log("Normalized data:", {
    id: normalized.id,
    format: "Valid schema format",
    dayCount: Object.keys(normalized.days).length,
    // Check a single day to verify conversion
    sampleDay: normalized.days["1"]
  });
} catch (error) {
  console.error("Normalization error:", error.message);
}

// Example 3: Creating a new price calendar using the schema
console.log("\nExample 3: Creating a new price calendar");
try {
  const calendarData = {
    id: "new-property_2024-06",
    propertyId: "new-property",
    year: 2024,
    month: 6,
    days: {
      "1": {
        basePrice: 180,
        adjustedPrice: 180,
        available: true,
        minimumStay: 1,
        isWeekend: false,
        priceSource: 'base',
        prices: { "2": 180, "3": 200, "4": 220 },
        seasonId: null,
        seasonName: null,
        overrideId: null,
        reason: null
      },
      "2": {
        basePrice: 180,
        adjustedPrice: 216,
        available: true,
        minimumStay: 1,
        isWeekend: true,
        priceSource: 'weekend',
        prices: { "2": 216, "3": 240, "4": 264 },
        seasonId: null,
        seasonName: null,
        overrideId: null,
        reason: null
      }
    },
    summary: {
      minPrice: 180,
      maxPrice: 216,
      avgPrice: 198,
      unavailableDays: 0,
      modifiedDays: 1,
      hasCustomPrices: false,
      hasSeasonalRates: false
    },
    generatedAt: new Date().toISOString()
  };
  
  // Validate the calendar
  const validCalendar = validatePriceCalendar(calendarData);
  console.log("Calendar validated successfully:", {
    id: validCalendar.id,
    days: Object.keys(validCalendar.days).length
  });
} catch (error) {
  console.error("Validation error:", error.message);
}