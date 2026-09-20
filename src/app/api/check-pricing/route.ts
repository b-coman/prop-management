import { NextRequest, NextResponse } from 'next/server';
import { quoteStay } from '@/lib/pricing/quote-stay';
import { parseISO } from 'date-fns';
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
    
    // ---- occupancy ----
    // A caller may state the party either way round: a bare `guests` headcount (every caller before
    // the split existed) or an `adults`/`children` split. The adult cap can only be applied to a
    // stated split — treating a headcount as all-adults would refuse a legal family of six.
    const hasSplit = adults != null;
    const partyAdults = hasSplit ? Number(adults) : Number(guests);
    const partyChildren = hasSplit ? Number(children ?? 0) : 0;
    const headcount = partyAdults + partyChildren;

    if (hasSplit && guests != null && Number(guests) !== headcount) {
      // Never pick a winner between two headcounts the caller disagrees with itself about — that is
      // how a party gets priced for one size and charged for another.
      return NextResponse.json(
        { error: `guests (${guests}) does not equal adults + children (${headcount})`, reason: 'party_mismatch' },
        { status: 400 }
      );
    }

    // Every rule now lives in `quoteStay` (availability, per-night rates, minimum stay, occupancy,
    // length-of-stay discounts) so this route and the landing pages cannot disagree about what is
    // sellable. This function's remaining job is HTTP: parse, translate, set a status code.
    const quote = await quoteStay({
      propertyId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      adults: partyAdults,
      children: partyChildren,
      hasSplit,
    });

    if (quote.available) {
      logger.debug('Final pricing response', {
        guests: headcount,
        total: quote.pricing.total,
        nights: quote.pricing.numberOfNights,
      });
      return NextResponse.json({ available: true, pricing: quote.pricing });
    }

    switch (quote.reason) {
      case 'unavailable_dates':
        logger.debug('Unavailable dates found', { unavailableDates: quote.unavailableDates, checkIn, checkOut });
        return NextResponse.json({ available: false, reason: 'unavailable_dates', unavailableDates: quote.unavailableDates });

      case 'minimum_stay':
        return NextResponse.json({
          available: false,
          reason: 'minimum_stay',
          minimumStay: quote.minimumStay,
          requiredNights: quote.minimumStay,
        });

      case 'no_pricing':
        return NextResponse.json({ error: quote.detail }, { status: 404 });

      default: {
        // An occupancy refusal. The client renders its own localised copy from `reason` + `limits`.
        logger.debug('Party refused', { propertyId, adults: partyAdults, children: partyChildren, reason: quote.reason });
        return NextResponse.json(
          {
            available: false,
            error: OCCUPANCY_MESSAGES[quote.reason](quote.limits),
            reason: quote.reason,
            limits: quote.limits,
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    logger.error('Error checking pricing', error as Error);
    return NextResponse.json(
      { error: 'Failed to check pricing' },
      { status: 500 }
    );
  }
}