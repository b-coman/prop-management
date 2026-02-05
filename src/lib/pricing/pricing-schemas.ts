import { z } from 'zod';
import { CurrencyCode } from '@/types';

// Type definitions for price sources
export type PriceSource = 'base' | 'weekend' | 'season' | 'override';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type SeasonType = 'minimum' | 'low' | 'standard' | 'medium' | 'high';

/**
 * Schema for a single day entry in the admin interface price calendar 
 * (format stored in Firestore)
 */
export const PriceCalendarDaySchema = z.object({
  // Base price from property configuration
  basePrice: z.number().nonnegative(),
  
  // Price after all adjustments (weekend, seasonal, override)
  adjustedPrice: z.number().nonnegative(),
  
  // Whether this date is available for booking
  available: z.boolean(),
  
  // Minimum number of nights required for a booking starting on this date
  minimumStay: z.number().int().positive(),
  
  // Is this a weekend day (for weekend pricing)
  isWeekend: z.boolean(),
  
  // Which pricing rule was applied (highest priority)
  priceSource: z.enum(['base', 'weekend', 'season', 'override']),
  
  // Prices for different occupancy levels
  prices: z.record(z.string(), z.number().nonnegative()),
  
  // ID of the season if seasonal pricing was applied
  seasonId: z.string().nullable(),
  
  // Name of the season if seasonal pricing was applied
  seasonName: z.string().nullable(),
  
  // ID of the override if a date override was applied
  overrideId: z.string().nullable(),
  
  // Reason for special pricing or availability (often used with overrides)
  reason: z.string().nullable()
});

export type PriceCalendarDay = z.infer<typeof PriceCalendarDaySchema>;

/**
 * Schema for summary statistics of a price calendar
 */
export const PriceCalendarSummarySchema = z.object({
  // Minimum price across all available days
  minPrice: z.number().nonnegative(),
  
  // Maximum price across all available days
  maxPrice: z.number().nonnegative(),
  
  // Average price across all available days
  avgPrice: z.number().nonnegative(),
  
  // Number of unavailable days in this calendar
  unavailableDays: z.number().int().nonnegative(),
  
  // Number of days with modified pricing (not base price)
  modifiedDays: z.number().int().nonnegative(),
  
  // Whether this calendar has any custom price overrides
  hasCustomPrices: z.boolean(),
  
  // Whether this calendar has any seasonal pricing applied
  hasSeasonalRates: z.boolean()
});

export type PriceCalendarSummary = z.infer<typeof PriceCalendarSummarySchema>;

/**
 * Schema for a complete price calendar document
 */
export const PriceCalendarSchema = z.object({
  // Unique ID (format: {propertyId}_{YYYY-MM})
  id: z.string(),
  
  // Reference to property
  propertyId: z.string(),
  
  // Calendar year
  year: z.number().int().positive(),
  
  // Calendar month (1-12)
  month: z.number().int().min(1).max(12),
  
  // Month in human-readable format (e.g., "January 2024")
  monthStr: z.string().optional(),
  
  // Daily price data (keys are day numbers as strings)
  days: z.record(z.string(), PriceCalendarDaySchema),
  
  // Summary statistics
  summary: PriceCalendarSummarySchema,
  
  // When this calendar was generated/updated
  generatedAt: z.string().or(z.date())
});

export type PriceCalendar = z.infer<typeof PriceCalendarSchema>;

/**
 * Schema for a seasonal pricing rule
 */
export const SeasonalPricingSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  name: z.string(),
  seasonType: z.enum(['minimum', 'low', 'standard', 'medium', 'high']),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(), // YYYY-MM-DD
  priceMultiplier: z.number().positive(),
  minimumStay: z.number().int().positive().optional(),
  enabled: z.boolean()
});

export type SeasonalPricing = z.infer<typeof SeasonalPricingSchema>;

/**
 * Schema for a date override
 */
export const DateOverrideSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  date: z.string(), // YYYY-MM-DD
  customPrice: z.number().nonnegative(),
  reason: z.string().optional(),
  minimumStay: z.number().int().positive().optional(),
  available: z.boolean(),
  flatRate: z.boolean()
});

export type DateOverride = z.infer<typeof DateOverrideSchema>;

/**
 * Schema for length-of-stay discount
 */
export const LengthOfStayDiscountSchema = z.object({
  nightsThreshold: z.number().int().positive(),
  discountPercentage: z.number().min(0).max(100),
  enabled: z.boolean()
});

export type LengthOfStayDiscount = z.infer<typeof LengthOfStayDiscountSchema>;

/**
 * Schema for property pricing configuration
 */
export const PropertyPricingSchema = z.object({
  id: z.string(),
  pricePerNight: z.number().nonnegative(),
  baseCurrency: z.enum(['USD', 'EUR', 'GBP', 'RON']).or(z.custom<CurrencyCode>()),
  baseOccupancy: z.number().int().positive(),
  extraGuestFee: z.number().nonnegative().optional(),
  maxGuests: z.number().int().positive().optional(),
  pricingConfig: z.object({
    weekendAdjustment: z.number().positive(),
    weekendDays: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])),
    lengthOfStayDiscounts: z.array(LengthOfStayDiscountSchema).optional()
  }).optional()
});

export type PropertyPricing = z.infer<typeof PropertyPricingSchema>;