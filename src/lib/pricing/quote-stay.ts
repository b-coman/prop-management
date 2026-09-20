/**
 * quote-stay — the ONE place that answers "can this party book these dates, and for how much".
 *
 * WHY IT EXISTS. This logic used to live only inside `POST /api/check-pricing`, so anything that
 * was not an HTTP client could not reach it. The landing pages therefore stored a `priceHint`
 * SNAPSHOT taken when the page was generated, and nothing invalidated it when a rate changed: on
 * 2026-09-20 the live toamna-lunga page was still advertising 1.415 lei for a stay whose check-in
 * had passed six days earlier, and 1.547 for one the engine quotes at 1.658.
 *
 * The obvious fix — have the page POST to our own API — is worse than it looks. It costs an HTTP
 * round trip to ourselves, it meets the public 60/min rate limiter (which counts the SERVER's IP, so
 * every visitor shares one bucket), and it still leaves two copies of the rules if anyone ever
 * "simplifies" the page by reading the calendar directly.
 *
 * So the rules live here and the route became a thin translator. A caller cannot skip the
 * minimum-stay check or the occupancy check by accident, because there is no path that reaches the
 * price without passing them. That matters more than it sounds: a landing page that disagrees with
 * the booking page about what is sellable is exactly the failure this project spent a day removing.
 *
 * Plain server module — no `'use server'`, no HTTP, no Next types. Import it from a route, a server
 * component, or a script.
 */
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { getMonthsBetweenDates } from '@/lib/pricing/price-calendar-generator';
import { calculateBookingPrice, LengthOfStayDiscount } from '@/lib/pricing/price-calculation';
import { checkAvailabilityWithFlags } from '@/lib/availability-service';
import { validateParty, type PartyRejection, type OccupancyLimits } from '@/lib/occupancy';
import { differenceInDays, format } from 'date-fns';

export interface QuoteStayInput {
  propertyId: string;
  checkIn: Date;
  checkOut: Date;
  /** Adults in the party. A caller holding only a headcount passes it here with `children: 0`. */
  adults: number;
  children: number;
  /**
   * True when the caller actually stated an adults/children SPLIT, false when it only had a
   * headcount. The adult cap can only be applied to a stated split — treating a bare headcount as
   * all-adults would refuse a perfectly legal family of six.
   */
  hasSplit: boolean;
}

export interface QuotePricing {
  numberOfNights: number;
  accommodationTotal: number;
  cleaningFee: number;
  subtotal: number;
  total: number;
  totalPrice: number;
  dailyRates: Record<string, number>;
  currency: string;
  lengthOfStayDiscount?: unknown;
  [k: string]: unknown;
}

export type QuoteStayResult =
  | { available: true; pricing: QuotePricing }
  | { available: false; reason: 'unavailable_dates'; unavailableDates: string[] }
  | { available: false; reason: 'minimum_stay'; minimumStay: number }
  | { available: false; reason: PartyRejection; limits: OccupancyLimits }
  | { available: false; reason: 'no_pricing'; detail: string };

/**
 * Quote one stay. Never throws for a business refusal — a refusal is a RESULT, with a reason the
 * caller can render. Genuine faults (a dead Firestore) still throw, because those are not answers.
 */
export async function quoteStay(input: QuoteStayInput): Promise<QuoteStayResult> {
  const { propertyId, checkIn, checkOut, adults, children, hasSplit } = input;
  const headcount = adults + children;

  const property = await getPropertyWithDb(propertyId);

  // PRE-EXISTING LOOSENESS, preserved deliberately: a property with no `maxGuests` gets no ceiling,
  // because `validateParty` compares `headcount > limits.maxGuests` and `n > undefined` is always
  // false. The route hid this behind `as any`. Extracting the logic is not the moment to start
  // refusing parties that book fine today, so the cast stays and the gap is written down instead.
  const limits: OccupancyLimits = {
    maxGuests: (property as unknown as { maxGuests?: number }).maxGuests as number,
    maxAdults: hasSplit ? ((property as unknown as { maxAdults?: number }).maxAdults ?? null) : null,
  };
  const partyCheck = validateParty({ adults, children }, limits);
  if (!partyCheck.ok) return { available: false, reason: partyCheck.reason, limits };

  const nights = differenceInDays(checkOut, checkIn);

  // Availability BEFORE pricing: a sold night has no price worth computing.
  const availability = await checkAvailabilityWithFlags(propertyId, checkIn, checkOut);
  if (!availability.isAvailable) {
    return { available: false, reason: 'unavailable_dates', unavailableDates: availability.unavailableDates };
  }

  const months = getMonthsBetweenDates(checkIn, checkOut);
  const calendars = await Promise.all(months.map(({ year, month }) => getPriceCalendarWithDb(propertyId, year, month)));
  if (calendars.some((c) => c === null)) {
    return { available: false, reason: 'no_pricing', detail: 'Price information not available for the selected dates' };
  }

  const dailyPrices: Record<string, number> = {};
  let minimumStay = (property as unknown as { defaultMinimumStay?: number }).defaultMinimumStay || 1;

  const cursor = new Date(checkIn);
  for (let night = 0; night < nights; night++) {
    const dateStr = format(cursor, 'yyyy-MM-dd');
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const day = cursor.getDate().toString();

    const calendar = calendars.find((c) => c?.year === year && c?.month === month);
    if (!calendar || !calendar.days[day]) {
      return { available: false, reason: 'no_pricing', detail: `Price information not available for ${dateStr}` };
    }

    const dayPrice = calendar.days[day];
    // The `prices` dict already carries the per-occupancy rate; the fallback derives it the same way
    // the calendar generator would, from adjustedPrice (NOT basePrice, which is the raw property rate).
    const occupancyPrice = dayPrice.prices?.[headcount.toString()];
    if (occupancyPrice !== undefined) {
      dailyPrices[dateStr] = occupancyPrice;
    } else {
      const extraGuests = Math.max(0, headcount - property.baseOccupancy);
      dailyPrices[dateStr] = dayPrice.adjustedPrice + extraGuests * (property.extraGuestFee || 0);
    }

    // The strictest night in the range wins — a 3-night floor on the Friday binds the whole stay.
    if (dayPrice.minimumStay && dayPrice.minimumStay > minimumStay) minimumStay = dayPrice.minimumStay;

    cursor.setDate(cursor.getDate() + 1);
  }

  if (nights < minimumStay) return { available: false, reason: 'minimum_stay', minimumStay };

  const discounts = (property.pricingConfig?.lengthOfStayDiscounts
    || (property as unknown as { pricing?: { lengthOfStayDiscounts?: LengthOfStayDiscount[] } }).pricing?.lengthOfStayDiscounts) as
    | LengthOfStayDiscount[]
    | undefined;

  const pricingDetails = calculateBookingPrice(
    dailyPrices,
    (property as unknown as { cleaningFee?: number }).cleaningFee || 0,
    discounts
  );

  return {
    available: true,
    pricing: { ...pricingDetails, dailyRates: dailyPrices, currency: property.baseCurrency } as QuotePricing,
  };
}
