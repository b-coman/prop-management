import { collection, doc, getDoc, getDocs, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatISO, parseISO, differenceInDays, eachDayOfInterval, format } from 'date-fns';

// Type definitions
interface Property {
  id: string;
  slug: string;
  pricePerNight: number;
  baseCurrency: string;
  baseOccupancy: number;
  extraGuestFee: number;
  cleaningFee: number;
  pricing?: {
    pricingTemplateId: string;
    useDynamicPricing: boolean;
    occupancyPricing: {
      enabled: boolean;
      baseOccupancy: number;
      extraGuestFeePerNight: number;
    };
    lengthOfStayDiscounts: Array<{
      nights: number;
      discountPercentage: number;
    }>;
    weekendPricing: {
      enabled: boolean;
      weekendDays: string[];
      priceMultiplier: number;
    };
  };
}

interface DailyPrice {
  basePrice: number;
  adjustedPrice: number;
  minimumStay: number;
  available: boolean;
  seasonId?: string;
  isWeekend: boolean;
  reason?: string;
}

interface PriceCalendar {
  id: string;
  propertyId: string;
  year: number;
  lastUpdated: Timestamp;
  prices: Record<string, DailyPrice>;
}

interface PriceQuote {
  nightlyPrices: Array<{
    date: string;
    basePrice: number;
    adjustedPrice: number;
    isWeekend: boolean;
    seasonId?: string;
    reason?: string;
  }>;
  subtotal: number;
  cleaningFee: number;
  extraGuestsFee: number;
  lengthOfStayDiscount: number;
  totalBeforeTax: number;
  averageNightlyRate: number;
  currency: string;
  minimumStay: number;
}

/**
 * Get a price calendar for a specific property and year
 */
export async function getPriceCalendar(propertyId: string, year: number): Promise<PriceCalendar | null> {
  try {
    const calendarId = `${propertyId}-${year}`;
    const calendarDoc = await getDoc(doc(db, 'priceCalendars', calendarId));
    
    if (calendarDoc.exists()) {
      return calendarDoc.data() as PriceCalendar;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching price calendar:', error);
    return null;
  }
}

/**
 * Get daily prices for a date range
 */
export async function getDailyPrices(
  propertyId: string, 
  startDate: Date, 
  endDate: Date
): Promise<Record<string, DailyPrice>> {
  try {
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    const dailyPrices: Record<string, DailyPrice> = {};
    
    // Get price calendars for all years in the range
    const years = Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => startYear + i
    );
    
    for (const year of years) {
      const calendar = await getPriceCalendar(propertyId, year);
      
      if (calendar) {
        // Merge prices from this calendar
        Object.assign(dailyPrices, calendar.prices);
      }
    }
    
    // Filter to include only dates in the range
    const result: Record<string, DailyPrice> = {};
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    
    for (const date of dateRange) {
      const dateStr = format(date, 'yyyy-MM-dd');
      if (dailyPrices[dateStr]) {
        result[dateStr] = dailyPrices[dateStr];
      } else {
        // If no price found for this date, use the property's default price
        // This would require getting the property data
        // For simplicity, we'll just mark it as unavailable
        result[dateStr] = {
          basePrice: 0,
          adjustedPrice: 0,
          minimumStay: 1,
          available: false,
          isWeekend: false
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error fetching daily prices:', error);
    return {};
  }
}

/**
 * Get property with pricing configuration
 */
export async function getPropertyWithPricing(propertyId: string): Promise<Property | null> {
  try {
    const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
    
    if (propertyDoc.exists()) {
      return propertyDoc.data() as Property;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching property:', error);
    return null;
  }
}

/**
 * Calculate the applicable length-of-stay discount
 */
function calculateLengthOfStayDiscount(
  totalAmount: number,
  nights: number,
  discounts: Array<{ nights: number; discountPercentage: number }> | undefined
): number {
  if (!discounts || discounts.length === 0) {
    return 0;
  }
  
  // Sort discounts by nights threshold in descending order to get the highest applicable discount
  const sortedDiscounts = [...discounts].sort((a, b) => b.nights - a.nights);
  
  // Find the first discount that applies (highest nights threshold less than or equal to booking nights)
  const applicableDiscount = sortedDiscounts.find(discount => nights >= discount.nights);
  
  if (applicableDiscount) {
    return (totalAmount * applicableDiscount.discountPercentage) / 100;
  }
  
  return 0;
}

/**
 * Calculate the extra guests fee
 */
function calculateExtraGuestsFee(
  guests: number,
  baseOccupancy: number,
  extraGuestFeePerNight: number,
  nights: number
): number {
  const extraGuests = Math.max(0, guests - baseOccupancy);
  return extraGuests * extraGuestFeePerNight * nights;
}

/**
 * Get a price quote for a booking
 */
export async function getPriceQuote(
  propertyId: string,
  startDate: Date,
  endDate: Date,
  guests: number
): Promise<PriceQuote | null> {
  try {
    // Get the property data
    const property = await getPropertyWithPricing(propertyId);
    
    if (!property) {
      console.error(`Property not found: ${propertyId}`);
      return null;
    }
    
    // Get daily prices for the date range
    const dailyPrices = await getDailyPrices(propertyId, startDate, endDate);
    
    // Check if all dates are available
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const nightsCount = differenceInDays(endDate, startDate);
    
    if (nightsCount <= 0) {
      console.error('Invalid date range');
      return null;
    }
    
    // Get minimum stay requirement (use the maximum of all daily minimums)
    const minimumStay = Math.max(
      ...Object.values(dailyPrices).map(price => price.minimumStay || 1)
    );
    
    // Check if the booking meets minimum stay requirements
    if (nightsCount < minimumStay) {
      console.error(`Booking does not meet minimum stay requirement of ${minimumStay} nights`);
      return null;
    }
    
    // Calculate the nightly prices and total
    const nightlyPrices = [];
    let subtotal = 0;
    
    for (const date of dateRange) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const price = dailyPrices[dateStr];
      
      if (!price || !price.available) {
        console.error(`Date not available: ${dateStr}`);
        return null;
      }
      
      nightlyPrices.push({
        date: dateStr,
        basePrice: price.basePrice,
        adjustedPrice: price.adjustedPrice,
        isWeekend: price.isWeekend,
        seasonId: price.seasonId,
        reason: price.reason
      });
      
      subtotal += price.adjustedPrice;
    }
    
    // Calculate extra guests fee
    const baseOccupancy = property.pricing?.occupancyPricing?.enabled 
      ? property.pricing.occupancyPricing.baseOccupancy 
      : property.baseOccupancy;
      
    const extraGuestFeePerNight = property.pricing?.occupancyPricing?.enabled 
      ? property.pricing.occupancyPricing.extraGuestFeePerNight 
      : property.extraGuestFee;
      
    const extraGuestsFee = calculateExtraGuestsFee(
      guests,
      baseOccupancy,
      extraGuestFeePerNight,
      nightsCount
    );
    
    // Calculate length-of-stay discount
    const lengthOfStayDiscount = calculateLengthOfStayDiscount(
      subtotal,
      nightsCount,
      property.pricing?.lengthOfStayDiscounts
    );
    
    // Calculate total
    const cleaningFee = property.cleaningFee || 0;
    const totalBeforeTax = subtotal + extraGuestsFee + cleaningFee - lengthOfStayDiscount;
    
    // Calculate average nightly rate
    const averageNightlyRate = subtotal / nightsCount;
    
    return {
      nightlyPrices,
      subtotal,
      cleaningFee,
      extraGuestsFee,
      lengthOfStayDiscount,
      totalBeforeTax,
      averageNightlyRate,
      currency: property.baseCurrency,
      minimumStay
    };
  } catch (error) {
    console.error('Error generating price quote:', error);
    return null;
  }
}

/**
 * Check availability for a date range
 */
export async function checkAvailability(
  propertyId: string,
  startDate: Date,
  endDate: Date,
  guests: number
): Promise<{ available: boolean; minimumStay: number; reason?: string }> {
  try {
    // Get daily prices for the date range
    const dailyPrices = await getDailyPrices(propertyId, startDate, endDate);
    
    // Check if all dates exist and are available
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const nightsCount = differenceInDays(endDate, startDate);
    
    if (nightsCount <= 0) {
      return { 
        available: false, 
        minimumStay: 1,
        reason: 'Invalid date range' 
      };
    }
    
    // Get minimum stay requirement (use the maximum of all daily minimums)
    const minimumStay = Math.max(
      ...Object.values(dailyPrices).map(price => price.minimumStay || 1)
    );
    
    // Check if the booking meets minimum stay requirements
    if (nightsCount < minimumStay) {
      return { 
        available: false, 
        minimumStay,
        reason: `Minimum stay requirement is ${minimumStay} nights` 
      };
    }
    
    // Check if all dates in the range are available
    for (const date of dateRange) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const price = dailyPrices[dateStr];
      
      if (!price || !price.available) {
        return { 
          available: false, 
          minimumStay,
          reason: `Date ${dateStr} is not available` 
        };
      }
    }
    
    // All dates are available and meet minimum stay requirements
    return { available: true, minimumStay };
  } catch (error) {
    console.error('Error checking availability:', error);
    return { 
      available: false, 
      minimumStay: 1,
      reason: 'Error checking availability' 
    };
  }
}

export default {
  getPriceCalendar,
  getDailyPrices,
  getPropertyWithPricing,
  getPriceQuote,
  checkAvailability
};