import { NextRequest, NextResponse } from 'next/server';
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { getMonthsBetweenDates } from '@/lib/pricing/price-calendar-generator';
import { calculateBookingPrice, LengthOfStayDiscount } from '@/lib/pricing/price-calculation';
import { differenceInDays, format, addDays, parseISO } from 'date-fns';
import { checkAvailabilityWithFlags } from '@/lib/availability-service';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limiter';

const logger = loggers.pricing;

// Rate limit: 60 requests per minute per IP
const RATE_LIMIT_CONFIG = { maxRequests: 60, windowSeconds: 60, keyPrefix: 'check-pricing' };

/**
 * API endpoint to check availability and pricing for a specific date range
 * 
 * Example request:
 * 
 * ```
 * POST /api/check-pricing
 * {
 *   "propertyId": "prahova-mountain-chalet",
 *   "checkIn": "2023-12-24",
 *   "checkOut": "2023-12-31",
 *   "guests": 4
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request, RATE_LIMIT_CONFIG);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    // Parse request body
    const body = await request.json();
    const { propertyId, checkIn, checkOut, guests } = body;
    
    // Validate required parameters
    if (!propertyId || !checkIn || !checkOut || !guests) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Parse dates
    const checkInDate = parseISO(checkIn);
    const checkOutDate = parseISO(checkOut);
    
    logger.debug('Request received', {
      propertyId,
      checkIn,
      checkOut,
      guests
    });
    
    // Validate past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
    
    if (checkInDate < today) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      );
    }
    
    // Validate date range
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }
    
    // Get property details
    const property = await getPropertyWithDb(propertyId);
    
    logger.debug('Property details', {
      propertyId,
      baseOccupancy: property.baseOccupancy,
      extraGuestFee: property.extraGuestFee,
      pricePerNight: property.pricePerNight
    });
    
    // Get number of nights
    const nights = differenceInDays(checkOutDate, checkInDate);
    
    // Check availability first using the availability service
    const availabilityResult = await checkAvailabilityWithFlags(propertyId, checkInDate, checkOutDate);
    logger.debug('Availability result', {
      isAvailable: availabilityResult.isAvailable,
      source: availabilityResult.source,
      unavailableDatesCount: availabilityResult.unavailableDates.length
    });
    
    // If dates are not available, return early
    if (!availabilityResult.isAvailable) {
      logger.debug('Unavailable dates found', {
        unavailableDates: availabilityResult.unavailableDates,
        checkIn,
        checkOut
      });

      return NextResponse.json({
        available: false,
        reason: 'unavailable_dates',
        unavailableDates: availabilityResult.unavailableDates
      });
    }
    
    // Get all required price calendars for pricing
    const months = getMonthsBetweenDates(checkInDate, checkOutDate);
    const calendars = await Promise.all(
      months.map(async ({ year, month }) => {
        const calendar = await getPriceCalendarWithDb(propertyId, year, month);
        return calendar;
      })
    );
    
    // Check if any calendars are missing
    if (calendars.some(calendar => calendar === null)) {
      return NextResponse.json(
        { error: 'Price information not available for the selected dates' },
        { status: 404 }
      );
    }
    
    // Now we only need to calculate pricing (availability already checked)
    const dailyPrices: Record<string, number> = {};
    let minimumStay = (property as any).defaultMinimumStay || 1;
    
    // Calculate pricing for each day (availability already checked)
    const currentDate = new Date(checkInDate);
    logger.debug('Calculating pricing', { nights, startDate: format(checkInDate, 'yyyy-MM-dd') });
    
    for (let night = 0; night < nights; night++) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const day = currentDate.getDate().toString();
      
      
      // Find the relevant calendar
      const calendar = calendars.find(c => c?.year === year && c?.month === month);
      
      if (!calendar || !calendar.days[day]) {
        // No price information available - this shouldn't happen as we checked calendars exist
        return NextResponse.json(
          { error: `Price information not available for ${dateStr}` },
          { status: 404 }
        );
      }
      
      const dayPrice = calendar.days[day];
      
      // Record price for this date
      if (guests <= property.baseOccupancy) {
        dailyPrices[dateStr] = dayPrice.basePrice;
      } else {
        const occupancyPrice = dayPrice.prices?.[guests.toString()];
        if (occupancyPrice) {
          dailyPrices[dateStr] = occupancyPrice;
        } else {
          // Fallback to base price + extra guest fee
          const extraGuests = guests - property.baseOccupancy;
          const extraGuestFee = property.extraGuestFee || 0;
          dailyPrices[dateStr] = dayPrice.basePrice + (extraGuests * extraGuestFee);
        }
      }
      
      // Check minimum stay for all nights - use the highest value found
      if (dayPrice.minimumStay && dayPrice.minimumStay > minimumStay) {
        minimumStay = dayPrice.minimumStay;
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Check if minimum stay requirement is met
    const meetsMinimumStay = nights >= minimumStay;
    
    // Calculate pricing (availability already confirmed)
    if (meetsMinimumStay) {
      // Calculate booking price with any applicable discounts
      const pricingDetails = calculateBookingPrice(
        dailyPrices,
        (property as any).cleaningFee || 0,
        property.pricingConfig?.lengthOfStayDiscounts as LengthOfStayDiscount[]
      );
      
      // Log the complete pricing response for debugging
      const finalResponse = {
        available: true,
        pricing: {
          ...pricingDetails,
          dailyRates: dailyPrices,
          currency: property.baseCurrency
        }
      };
      
      logger.debug('Final pricing response', {
        guests,
        total: finalResponse.pricing.total,
        nights: finalResponse.pricing.numberOfNights
      });

      return NextResponse.json(finalResponse);
    } else {
      // Only reason we'd get here is minimum stay not met
      return NextResponse.json({
        available: false,
        reason: 'minimum_stay',
        minimumStay,
        requiredNights: minimumStay
      });
    }
  } catch (error) {
    logger.error('Error checking pricing', error as Error);
    return NextResponse.json(
      { error: 'Failed to check pricing' },
      { status: 500 }
    );
  }
}