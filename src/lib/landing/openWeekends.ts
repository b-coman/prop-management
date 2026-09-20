/**
 * openWeekends — which weekends in a window are actually sellable, asked of the booking engine.
 *
 * WHY THIS IS NOT A CALENDAR. The obvious implementation keeps a list of holidays and school breaks
 * to skip. That list is wrong the day after it is written, and it encodes the owner's pricing
 * decisions in a second place where they can disagree with the first.
 *
 * So this asks instead of knowing. Quote each Friday through `quoteStay` — the same function the
 * booking page and `/api/check-pricing` go through — and keep the ones that come back with a price.
 * Everything the owner has already declared then applies for free:
 *
 *   - a booked weekend refuses with `unavailable_dates`
 *   - a weekend inside a higher-rate block refuses with `minimum_stay`, because he put a 3-night
 *     floor on it (23-31 Oct and 27-30 Nov 2026 are exactly this)
 *   - a night he blocked by hand refuses too, with no special case
 *
 * Which means a page built on this cannot advertise a stay the site will not sell, and it stays
 * correct when he reprices, blocks a night, or moves a minimum stay — with nobody editing the page.
 *
 * Cost: one `quoteStay` per Friday in the window, each a couple of Firestore reads. For a two-month
 * window that is ~9 quotes. Cache at the page level (`revalidate`), not here.
 */
import { quoteStay } from '@/lib/pricing/quote-stay';
import { addDays, format, isBefore, startOfDay } from 'date-fns';

export interface OpenWeekend {
  /** YYYY-MM-DD check-in (a Friday, unless `weekday` says otherwise). */
  start: string;
  /** YYYY-MM-DD check-out. */
  end: string;
  nights: number;
  /** What the engine actually charges this party, cleaning included. */
  total: number;
  currency: string;
}

export interface FindOpenWeekendsOptions {
  propertyId: string;
  from: Date;
  to: Date;
  /** Nights per weekend. 2 = Fri→Sun, the shape people actually book. */
  nights?: number;
  /** Party size the prices are quoted for. Whatever the page says, this must match. */
  guests?: number;
  /** 5 = Friday (date-fns getDay). Exposed so a midweek variant needs no new function. */
  weekday?: number;
  /** Stop after this many, so a long window cannot produce a wall of cards. */
  limit?: number;
}

/**
 * The candidate check-in dates to quote: every `weekday` between `from` and `to`, clamped forward so
 * a date that has already started is never offered.
 *
 * Pure and exported for the tests — "never advertise the past" is exactly the bug that had the
 * toamna-lunga page selling 14-17 September on the 20th, and it is worth a test rather than a
 * comment. `now` is injectable so the expiry is testable without waiting for a calendar.
 */
export function weekendStarts(from: Date, to: Date, weekday = 5, now: Date = new Date()): Date[] {
  const today = startOfDay(now);
  const cursor = startOfDay(isBefore(from, today) ? today : from);
  while (cursor.getDay() !== weekday) cursor.setDate(cursor.getDate() + 1);

  const out: Date[] = [];
  for (let d = new Date(cursor); !isBefore(to, d); d = addDays(d, 7)) out.push(new Date(d));
  return out;
}

/**
 * Sellable weekends in [from, to], soonest first. Never throws for a business refusal; a single
 * quote that errors is skipped rather than failing the page.
 */
export async function findOpenWeekends(opts: FindOpenWeekendsOptions): Promise<OpenWeekend[]> {
  const { propertyId, from, to, nights = 2, guests = 3, weekday = 5, limit = 6 } = opts;

  const found: OpenWeekend[] = [];
  for (const d of weekendStarts(from, to, weekday)) {
    if (found.length >= limit) break;
    const checkIn = new Date(d);
    const checkOut = addDays(checkIn, nights);
    try {
      const q = await quoteStay({ propertyId, checkIn, checkOut, adults: guests, children: 0, hasSplit: false });
      if (!q.available) continue;   // booked, min-stay, or occupancy — all mean "do not advertise it"
      found.push({
        start: format(checkIn, 'yyyy-MM-dd'),
        end: format(checkOut, 'yyyy-MM-dd'),
        nights,
        total: q.pricing.totalPrice,
        currency: q.pricing.currency,
      });
    } catch {
      // One bad quote must not cost the whole page. Drop the card, keep the rest.
    }
  }
  return found;
}
