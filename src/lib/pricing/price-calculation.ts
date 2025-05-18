import { CurrencyCode } from '@/types';

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
 * Calculate prices for different occupancy levels
 */
export function calculateOccupancyPrices(
  basePrice: number,
  baseOccupancy: number,
  extraGuestFee: number,
  maxGuests: number,
  flatRate: boolean
): Record<string, number> {
  const result: Record<string, number> = {};
  
  // Start from baseOccupancy + 1 and go up to maxGuests
  for (let guests = baseOccupancy + 1; guests <= maxGuests; guests++) {
    if (flatRate) {
      // Same price for all occupancy levels
      result[guests.toString()] = basePrice;
    } else {
      // Apply extra guest fee
      const extraGuests = guests - baseOccupancy;
      result[guests.toString()] = basePrice + (extraGuests * extraGuestFee);
    }
  }
  
  return result;
}

/**
 * Calculates the price for a specific date based on all pricing rules
 */
export function calculateDayPrice(
  property: PropertyPricing,
  date: Date,
  seasonalPricing: SeasonalPricing[],
  dateOverrides: DateOverride[],
  minimumStayRules: MinimumStayRule[]
): PriceCalendarDay {
  // 1. Start with base price
  let basePrice = property.pricePerNight;
  let priceSource: PriceSource = 'base';
  let sourceDetails = null;
  let minimumStay = 1;
  let isAvailable = true;

  // Default to property.maxGuests or use 10 as a reasonable default
  const maxGuests = property.maxGuests || 10;
  
  // 2. Check if it's a weekend
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() as DayOfWeek;
  const isWeekend = property.pricingConfig?.weekendDays.includes(dayOfWeek) || false;
  
  if (isWeekend && property.pricingConfig?.weekendAdjustment) {
    basePrice *= property.pricingConfig.weekendAdjustment;
    priceSource = 'weekend';
  }
  
  // 3. Apply seasonal pricing (if applicable)
  const matchingSeason = findMatchingSeason(date, seasonalPricing);
  if (matchingSeason) {
    basePrice *= matchingSeason.priceMultiplier;
    priceSource = 'season';
    sourceDetails = {
      name: matchingSeason.name,
      id: matchingSeason.id
    };
    
    if (matchingSeason.minimumStay) {
      minimumStay = matchingSeason.minimumStay;
    }
  }
  
  // 4. Apply date override (if exists - highest priority)
  const dateOverride = findDateOverride(date, dateOverrides);
  if (dateOverride) {
    basePrice = dateOverride.customPrice;
    priceSource = 'override';
    sourceDetails = {
      reason: dateOverride.reason,
      id: dateOverride.id
    };
    
    if (dateOverride.minimumStay) {
      minimumStay = dateOverride.minimumStay;
    }
    
    // Date overrides can also set availability
    isAvailable = dateOverride.available;
  }
  
  // 5. Apply minimum stay rules
  const matchingMinStayRule = findMatchingMinStayRule(date, minimumStayRules);
  if (matchingMinStayRule) {
    minimumStay = matchingMinStayRule.minimumStay;
  }
  
  // 6. Calculate prices for different occupancy levels
  const extraGuestFee = property.extraGuestFee || 0;
  const occupancyPrices = calculateOccupancyPrices(
    basePrice, 
    property.baseOccupancy, 
    extraGuestFee,
    maxGuests,
    dateOverride?.flatRate || false
  );
  
  // 7. Return the final price calendar day
  return {
    baseOccupancyPrice: basePrice,
    prices: occupancyPrices,
    available: isAvailable,
    minimumStay,
    priceSource,
    sourceDetails
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
  // Calculate accommodation total
  const numberOfNights = Object.keys(dailyPrices).length;
  const accommodationTotal = Object.values(dailyPrices).reduce((sum, price) => sum + price, 0);
  
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
  
  // Calculate final total
  const totalDiscountAmount = discountAmount + couponDiscountAmount;
  const total = subtotal - totalDiscountAmount;
  
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
    total
  };
}