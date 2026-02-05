import { CurrencyCode } from '@/types';
import { loggers } from '@/lib/logger';

// Import types from schemas
import {
  PriceSource,
  DayOfWeek,
  SeasonType,
  PropertyPricing,
  SeasonalPricing,
  DateOverride,
  LengthOfStayDiscount,
  PriceCalendarDay
} from './pricing-schemas';

// Re-export types that are used by other modules
export type { 
  LengthOfStayDiscount, 
  SeasonType, 
  PropertyPricing, 
  SeasonalPricing, 
  DateOverride, 
  PriceCalendarDay 
};

// Predefined multipliers by season type
export const SEASON_MULTIPLIERS: Record<SeasonType, number> = {
  'minimum': 0.7,
  'low': 0.85,
  'standard': 1.0,
  'medium': 1.2,
  'high': 1.5
};

// Define a MinimumStayRule interface (not included in schemas.ts)
export interface MinimumStayRule {
  id: string;
  propertyId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  minimumStay: number;
  enabled: boolean;
}

// Define PricingConfig interface (used internally)
export interface PricingConfig {
  weekendAdjustment: number;
  weekendDays: DayOfWeek[];
  lengthOfStayDiscounts?: LengthOfStayDiscount[];
}

/**
 * Checks if a date falls within a date range
 */
export function isDateInRange(date: Date, startDateStr: string, endDateStr: string): boolean {
  const startDate = new Date(startDateStr);
  // Note: For end date, we consider the entire day (up to midnight)
  const endDate = new Date(endDateStr);
  endDate.setHours(23, 59, 59, 999);
  
  return date >= startDate && date <= endDate;
}

/**
 * Finds a matching season for a specific date
 */
export function findMatchingSeason(
  date: Date, 
  seasons: SeasonalPricing[]
): SeasonalPricing | null {
  // Filter for enabled seasons that include this date
  const matchingSeasons = seasons
    .filter(season => season.enabled && isDateInRange(date, season.startDate, season.endDate))
    // If multiple seasons match, use the one with highest price multiplier
    .sort((a, b) => b.priceMultiplier - a.priceMultiplier);
  
  return matchingSeasons.length > 0 ? matchingSeasons[0] : null;
}

/**
 * Finds a date override for a specific date
 */
export function findDateOverride(
  date: Date, 
  overrides: DateOverride[]
): DateOverride | null {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return overrides.find(override => override.date === dateStr) || null;
}

/**
 * Finds a matching minimum stay rule for a specific date
 */
export function findMatchingMinStayRule(
  date: Date, 
  rules: MinimumStayRule[]
): MinimumStayRule | null {
  // Filter for enabled rules that include this date
  const matchingRules = rules
    .filter(rule => rule.enabled && isDateInRange(date, rule.startDate, rule.endDate))
    // If multiple rules match, use the one with highest minimum stay
    .sort((a, b) => b.minimumStay - a.minimumStay);
  
  return matchingRules.length > 0 ? matchingRules[0] : null;
}

/**
 * Calculate prices for different occupancy levels.
 * Includes base occupancy so the prices dict has entries for all valid guest counts.
 */
export function calculateOccupancyPrices(
  adjustedPrice: number,
  baseOccupancy: number,
  extraGuestFee: number,
  maxGuests: number,
  flatRate: boolean
): Record<string, number> {
  const result: Record<string, number> = {};

  for (let guests = baseOccupancy; guests <= maxGuests; guests++) {
    if (flatRate) {
      result[guests.toString()] = adjustedPrice;
    } else {
      const extraGuests = Math.max(0, guests - baseOccupancy);
      result[guests.toString()] = adjustedPrice + (extraGuests * extraGuestFee);
    }
  }

  return result;
}

/**
 * Calculates the price for a specific date based on all pricing rules.
 *
 * Priority (compounding):
 *   1. Override → replaces price entirely
 *   2. Season → multiplies base (compounds with weekend if both apply)
 *   3. Weekend → multiplies base
 *   4. Base → property.pricePerNight
 *
 * basePrice = raw property.pricePerNight (never mutated)
 * adjustedPrice = final price after all rules
 */
export function calculateDayPrice(
  property: PropertyPricing,
  date: Date,
  seasonalPricing: SeasonalPricing[],
  dateOverrides: DateOverride[],
  minimumStayRules: MinimumStayRule[]
): PriceCalendarDay {
  const basePrice = property.pricePerNight;
  let adjustedPrice = basePrice;
  let priceSource: PriceSource = 'base';
  let minimumStay = 1;
  let isAvailable = true;
  let seasonId: string | null = null;
  let seasonName: string | null = null;
  let overrideId: string | null = null;
  let reason: string | null = null;

  const maxGuests = property.maxGuests || 10;

  // 1. Check if it's a weekend (based on configured weekendDays)
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as DayOfWeek;
  const isWeekend = property.pricingConfig?.weekendDays.includes(dayOfWeek) || false;

  if (isWeekend && property.pricingConfig?.weekendAdjustment) {
    adjustedPrice *= property.pricingConfig.weekendAdjustment;
    priceSource = 'weekend';
  }

  // 2. Apply seasonal pricing (compounds with weekend)
  const matchingSeason = findMatchingSeason(date, seasonalPricing);
  if (matchingSeason) {
    adjustedPrice *= matchingSeason.priceMultiplier;
    priceSource = 'season';
    seasonId = matchingSeason.id;
    seasonName = matchingSeason.name;

    if (matchingSeason.minimumStay) {
      minimumStay = matchingSeason.minimumStay;
    }
  }

  // 3. Apply date override (highest priority — replaces everything)
  const dateOverride = findDateOverride(date, dateOverrides);
  if (dateOverride) {
    adjustedPrice = dateOverride.customPrice;
    priceSource = 'override';
    overrideId = dateOverride.id;
    reason = dateOverride.reason || null;
    // Clear season info since override takes full control
    seasonId = null;
    seasonName = null;

    if (dateOverride.minimumStay) {
      minimumStay = dateOverride.minimumStay;
    }

    isAvailable = dateOverride.available;
  }

  // 4. Apply minimum stay rules (highest value wins)
  const matchingMinStayRule = findMatchingMinStayRule(date, minimumStayRules);
  if (matchingMinStayRule) {
    minimumStay = Math.max(minimumStay, matchingMinStayRule.minimumStay);
  }

  // 5. Calculate prices for different occupancy levels
  const extraGuestFee = property.extraGuestFee || 0;
  const occupancyPrices = calculateOccupancyPrices(
    adjustedPrice,
    property.baseOccupancy,
    extraGuestFee,
    maxGuests,
    dateOverride?.flatRate || false
  );

  // 6. Round adjustedPrice to 2 decimal places to avoid floating point drift
  adjustedPrice = Math.round(adjustedPrice * 100) / 100;

  return {
    basePrice,
    adjustedPrice,
    available: isAvailable,
    minimumStay,
    isWeekend,
    priceSource,
    prices: occupancyPrices,
    seasonId,
    seasonName,
    overrideId,
    reason
  };
}

/**
 * Calculates a length-of-stay discount amount if applicable
 */
export function calculateLengthOfStayDiscount(
  subtotal: number,
  numberOfNights: number,
  discounts?: LengthOfStayDiscount[]
): { 
  appliedDiscount: LengthOfStayDiscount | null;
  discountAmount: number; 
} {
  if (!discounts || discounts.length === 0) {
    return { appliedDiscount: null, discountAmount: 0 };
  }
  
  // Find applicable discounts
  const applicableDiscounts = discounts
    .filter(discount => discount.enabled && numberOfNights >= discount.nightsThreshold)
    // Sort by discount percentage (highest first)
    .sort((a, b) => b.discountPercentage - a.discountPercentage);
  
  if (applicableDiscounts.length === 0) {
    return { appliedDiscount: null, discountAmount: 0 };
  }
  
  // Apply the highest discount
  const appliedDiscount = applicableDiscounts[0];
  const discountAmount = subtotal * (appliedDiscount.discountPercentage / 100);
  
  return { appliedDiscount, discountAmount };
}

/**
 * Calculates the total price for a booking
 */
export function calculateBookingPrice(
  dailyPrices: Record<string, number>,
  cleaningFee: number,
  lengthOfStayDiscounts?: LengthOfStayDiscount[],
  couponDiscountPercentage?: number
) {
  loggers.pricing.debug('calculateBookingPrice received dailyPrices', {
    daysCount: Object.keys(dailyPrices).length,
    cleaningFee,
    hasDiscounts: !!lengthOfStayDiscounts
  });
  
  // Calculate accommodation total
  const numberOfNights = Object.keys(dailyPrices).length;
  const accommodationTotal = Object.values(dailyPrices).reduce((sum, price) => sum + price, 0);
  
  loggers.pricing.debug('Calculated accommodationTotal', { accommodationTotal });
  
  // Add cleaning fee
  const subtotal = accommodationTotal + cleaningFee;
  
  // Apply length-of-stay discount
  const { appliedDiscount, discountAmount } = calculateLengthOfStayDiscount(
    subtotal,
    numberOfNights,
    lengthOfStayDiscounts
  );
  
  // Apply coupon discount (if any)
  let couponDiscountAmount = 0;
  if (couponDiscountPercentage && couponDiscountPercentage > 0) {
    couponDiscountAmount = subtotal * (couponDiscountPercentage / 100);
  }
  
  // Calculate final total (cap discounts at subtotal to prevent negative totals)
  const totalDiscountAmount = Math.min(discountAmount + couponDiscountAmount, subtotal);
  const total = Math.max(0, subtotal - totalDiscountAmount);
  
  // IMPORTANT: Return both 'total' and 'totalPrice' for backward compatibility
  // This ensures code that expects either name will work
  // The long-term solution is to standardize on 'totalPrice' across the codebase
  return {
    numberOfNights,
    accommodationTotal,
    cleaningFee,
    subtotal,
    lengthOfStayDiscount: appliedDiscount 
      ? {
          appliedTier: appliedDiscount.nightsThreshold,
          discountPercentage: appliedDiscount.discountPercentage,
          discountAmount
        }
      : null,
    couponDiscount: couponDiscountPercentage
      ? {
          discountPercentage: couponDiscountPercentage,
          discountAmount: couponDiscountAmount
        }
      : null,
    totalDiscountAmount,
    total,
    // Add totalPrice as alias of total for consistent naming
    totalPrice: total
  };
}