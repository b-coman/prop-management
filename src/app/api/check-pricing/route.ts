import { NextRequest, NextResponse } from 'next/server';
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { getMonthsBetweenDates } from '@/lib/pricing/price-calendar-generator';
import { calculateBookingPrice, LengthOfStayDiscount } from '@/lib/pricing/price-calculation';
import { differenceInDays, format, addDays, parseISO } from 'date-fns';
import { checkAvailabilityWithFlags } from '@/lib/availability-service';
import { loggers } from '@/lib/logger';
import { checkRateLimit, rateLimitHeaders } from '@/lib/rate-limiter';
import { validateParty, type PartyRejection, type OccupancyLimits } from '@/lib/occupancy';

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
/**
 * Developer-facing text for a refused party. The client renders its own localised copy from `reason`
 * and `limits`, so these never reach a guest.
 */
const OCCUPANCY_MESSAGES: Record<PartyRejection, (l: OccupancyLimits) => string> = {
  no_adult: () => 'A booking needs at least one adult',
  too_many_adults: (l) => `This property accommodates at most ${l.maxAdults} adults`,
  too_many_guests: (l) => `This property accommodates at most ${l.maxGuests} guests`,
  malformed: () => 'Guest counts must be whole, non-negative numbers',
};

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
    const { propertyId, checkIn, checkOut, guests, adults, children } = body;
    
    // Validate required parameters. A caller may state the party either way round: a bare `guests`
    // headcount (every caller before this change) or an `adults`/`children` split.
    // Presence, not truthiness: `guests: 0` and `adults: 0` are stated parties, and they are wrong for
    // a reason worth reporting. Falling into "missing parameters" would refuse them correctly and
    // explain them wrongly, leaving the caller nothing to render.
    if (!propertyId || !checkIn || !checkOut || (guests == null && adults == null)) {
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
      guests,
      adults,
      children
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

    // ---- occupancy ----
    // Until now this route priced ANY headcount, including one above `maxGuests`: 8 guests came back
    // with a real total for a house that sleeps 7.
    //
    // The adult cap can only be applied to a party whose composition is actually stated. A bare
    // `guests` count says nothing about who those people are, and treating it as all-adults would
    // refuse a perfectly legal family of six — and would break every existing caller, the parity pack
    // among them, which quotes 4 adults + 2 children as the headcount 6. So: split given, both rules;
    // headcount only, ceiling only.
    const hasSplit = adults != null;
    const partyAdults = hasSplit ? Number(adults) : Number(guests);
    const partyChildren = hasSplit ? Number(children ?? 0) : 0;
    const headcount = partyAdults + partyChildren;

    if (hasSplit && guests != null && Number(guests) !== headcount) {
      // Never pick a winner between two headcounts the caller disagrees with itself about — that is
      // how a party gets priced for one size and charged for another.
      return NextResponse.json(
        {
          error: `guests (${guests}) does not equal adults + children (${headcount})`,
          reason: 'party_mismatch',
        },
        { status: 400 }
      );
    }

    const limits = {
      maxGuests: (property as any).maxGuests,
      maxAdults: hasSplit ? ((property as any).maxAdults ?? null) : null,
    };
    const partyCheck = validateParty({ adults: partyAdults, children: partyChildren }, limits);

    if (!partyCheck.ok) {
      logger.debug('Party refused', { propertyId, adults: partyAdults, children: partyChildren, reason: partyCheck.reason });
      return NextResponse.json(
        {
          available: false,
          error: OCCUPANCY_MESSAGES[partyCheck.reason](limits),
          reason: partyCheck.reason,
          // The caller renders its own copy from these; the message above is for logs and dev.
          limits: { maxGuests: (property as any).maxGuests, maxAdults: (property as any).maxAdults ?? null },
        },
        { status: 400 }
      );
    }
    
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
      
      // Record price for this date using the prices dict (includes base occupancy)
      const occupancyPrice = dayPrice.prices?.[headcount.toString()];
      if (occupancyPrice !== undefined) {
        dailyPrices[dateStr] = occupancyPrice;
      } else {
        // Fallback: calculate from adjustedPrice (not basePrice, which is the raw property price)
        const extraGuests = Math.max(0, headcount - property.baseOccupancy);
        const extraGuestFee = property.extraGuestFee || 0;
        dailyPrices[dateStr] = dayPrice.adjustedPrice + (extraGuests * extraGuestFee);
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
      // Read discounts from pricingConfig (canonical) or legacy pricing path
      const discounts = (property.pricingConfig?.lengthOfStayDiscounts
        || (property as any).pricing?.lengthOfStayDiscounts) as LengthOfStayDiscount[] | undefined;
      const pricingDetails = calculateBookingPrice(
        dailyPrices,
        (property as any).cleaningFee || 0,
        discounts
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
        guests: headcount,
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