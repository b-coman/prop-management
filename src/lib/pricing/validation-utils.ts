import { z } from 'zod';
import {
  PriceCalendarSchema,
  PriceCalendarDaySchema,
  PriceCalendar,
  PriceCalendarDay,
  DateOverrideSchema,
  SeasonalPricingSchema
} from './pricing-schemas';

/**
 * Validates a price calendar object against the schema
 * @param data The price calendar data to validate
 * @returns A validated PriceCalendar object or throws an error
 */
export function validatePriceCalendar(data: unknown): PriceCalendar {
  try {
    return PriceCalendarSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format the error message for better readability
      const formattedErrors = error.errors.map(err => {
        return `${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      
      console.error(`Price calendar validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

/**
 * Validates a single day entry in a price calendar
 * @param data The day data to validate
 * @returns A validated PriceCalendarDay object or throws an error
 */
export function validatePriceCalendarDay(data: unknown): PriceCalendarDay {
  try {
    return PriceCalendarDaySchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map(err => {
        return `${err.path.join('.')}: ${err.message}`;
      }).join('\n');
      
      console.error(`Price calendar day validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

/**
 * Validates a date override object
 * @param data The date override data to validate
 * @returns A validated DateOverride object or throws an error
 */
export function validateDateOverride(data: unknown) {
  return DateOverrideSchema.parse(data);
}

/**
 * Validates a seasonal pricing object
 * @param data The seasonal pricing data to validate
 * @returns A validated SeasonalPricing object or throws an error
 */
export function validateSeasonalPricing(data: unknown) {
  return SeasonalPricingSchema.parse(data);
}

/**
 * Converts a price calendar stored in Firestore to the schema-compliant format
 * This utility helps when migrating data or ensuring compatibility
 * 
 * @param data The raw price calendar data from Firestore
 * @returns A validated PriceCalendar object
 */
export function normalizePriceCalendar(data: any): PriceCalendar {
  // Handle timestamps
  const generatedAt = data.generatedAt?._seconds 
    ? new Date(data.generatedAt._seconds * 1000).toISOString()
    : data.generatedAt;
  
  // Convert days/prices structure if needed (handle yearly format)
  let days = data.days || {};
  
  // If the data uses the old "prices" format with date strings as keys, convert it
  if (!data.days && data.prices) {
    days = {};
    Object.entries(data.prices).forEach(([dateStr, dayData]: [string, any]) => {
      // Extract the day number from the date string (e.g., "2024-01-01" -> "1")
      const day = dateStr.split('-')[2].replace(/^0+/, '');
      days[day] = dayData;
    });
  }
  
  // Create a data object conforming to our schema
  const normalizedData = {
    ...data,
    days,
    generatedAt,
    // Ensure these required fields exist
    summary: data.summary || {
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      unavailableDays: 0,
      modifiedDays: 0,
      hasCustomPrices: false,
      hasSeasonalRates: false
    }
  };
  
  // Validate the normalized data
  return validatePriceCalendar(normalizedData);
}