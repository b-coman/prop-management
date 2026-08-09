/**
 * Example-stays reasoner — landing-page engine P2 (docs/landing-page-engine-design.md §P2). Server-only.
 *
 * Given a campaign period (a dated WINDOW or a broad SEASON), it proposes 1-3 REAL, calendar-valid,
 * priced "example stays" for the landing page's ⭐ section. The design principle of the whole promotion
 * system holds here: guardrail the TRUTH, let framing be soft.
 *   - Every proposed stay's nights are ACTUALLY free — read from the `availability` collection via
 *     `checkAvailabilityWithFlags` (missing month/day = available), the single source of truth.
 *   - Its length meets the per-date MINIMUM STAY (read from `priceCalendars`), so it can be booked as-is.
 *   - Its `priceHint` is the REAL quoted total (`calculateBookingPrice` — occupancy + cleaning fee +
 *     length-of-stay discount), identical to what the booking page will show. No invented numbers.
 *   - A stay borrows an OCCASION reason (long weekend, school break, national-day bridge) only when the
 *     calendar genuinely fits it — occasions + bridge windows come from the SAME shared algorithms the
 *     situation analyst uses (`@/lib/growth/signals`), not a hardcoded list.
 *
 * Labels are deterministic + bilingual for now; an LLM voicing pass in the campaign's tone is a later,
 * optional layer (the design says "deterministic first"). Nothing here sends, spends, or writes — it
 * returns `ExampleStay[]` that P3's generate/editor stores into `landingPages/{slug}.exampleStays`.
 */
import { checkAvailabilityWithFlags } from '@/lib/availability-service';
import { getPropertyWithDb, getPriceCalendarWithDb } from '@/lib/pricing/pricing-with-db';
import { calculateBookingPrice } from '@/lib/pricing/price-calculation';
import { computeFreeRuns, computeOccasions, computeExtendedWindows, getHolidays, type FreeRun } from '@/lib/growth/signals';
import { loggers } from '@/lib/logger';
import type { ExampleStay, Ml } from '@/lib/landing/contracts';

const logger = loggers.campaign;
const DAY = 86400000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseYmd = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(+parseYmd(s) + n * DAY));
const nightsBetween = (a: string, b: string) => Math.round((+parseYmd(b) - +parseYmd(a)) / DAY);
const weekdayOf = (s: string) => parseYmd(s).getUTCDay(); // 0=Sun … 6=Sat
const maxYmd = (...xs: string[]) => xs.reduce((a, b) => (a > b ? a : b));
const minYmd = (...xs: string[]) => xs.reduce((a, b) => (a < b ? a : b));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** diacritic-insensitive contains, so DB names ("Craciunul") and typed copy both match */
const norm = (s: string) => s.normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').toLowerCase();

export interface LandingPeriod { kind: 'window' | 'season'; start?: string | null; end?: string | null }
export interface BuildExampleStaysOptions {
  /** clock (default now); lets a test rewind it. Only future dates are ever proposed. */
  asOf?: Date;
  /** pricing occupancy + booking prefill; default = property base occupancy (a true "from" price). */
  guests?: number;
  /** how many stays to return (default 3). */
  maxStays?: number;
  /** for a SEASON campaign with no explicit end, how far ahead to look (default 150 days). */
  seasonHorizonDays?: number;
}

interface Candidate {
  start: string;                 // checkIn (YYYY-MM-DD)
  nights: number;
  kind: 'occasion' | 'weekend' | 'default';
  occasionName: string | null;   // raw holiday name if occasion-anchored
  score: number;
}

/**
 * Propose calendar-valid, priced example stays for a campaign period. Returns `[]` (never throws) when
 * there is nothing honest to show — no free inventory, no price data, or availability unreadable.
 */
export async function buildExampleStays(
  propertyId: string,
  period: LandingPeriod,
  opts: BuildExampleStaysOptions = {},
): Promise<ExampleStay[]> {
  const asOf = opts.asOf ?? new Date();
  const today = ymd(asOf);
  const maxStays = opts.maxStays ?? 3;

  // 1. Search window. For a dated WINDOW, the campaign's own [start,end] (clamped to not start in the
  //    past). For a broad SEASON, from the later of today/period.start out to period.end or a horizon.
  const searchStart = maxYmd(today, period.start ?? today);
  const searchEnd = period.kind === 'window'
    ? (period.end ?? addDays(searchStart, 30))
    : (period.end ?? addDays(today, opts.seasonHorizonDays ?? 150));
  if (searchStart > searchEnd) return [];

  // 2. Availability across the window (one call). checkOut is EXCLUSIVE, so test through searchEnd by
  //    passing searchEnd+1. unavailableDates lists blocked nights; missing month/day = available.
  let unavailable: Set<string>;
  try {
    const res = await checkAvailabilityWithFlags(propertyId, parseYmd(searchStart), parseYmd(addDays(searchEnd, 1)));
    unavailable = new Set(res.unavailableDates);
  } catch (e) {
    logger.warn('exampleStays: availability unreadable — no stays proposed', { propertyId, error: (e as Error).message });
    return [];
  }

  // 3. Free runs (contiguous free nights) across the window — shared walker (signals.ts).
  const dates: string[] = [];
  for (let s = searchStart; s <= searchEnd; s = addDays(s, 1)) dates.push(s);
  const freeRuns = computeFreeRuns(dates, k => !unavailable.has(k));
  if (!freeRuns.length) return [];

  // 4. Pricing + min-stay data: the property and every price calendar the window spans.
  const property = await getPropertyWithDb(propertyId);
  // getPropertyWithDb returns more fields at runtime (cleaningFee, defaultMinimumStay) than the declared
  // PropertyPricing type carries — widen to read them (the pricing route does the same).
  const px = property as typeof property & { cleaningFee?: number; defaultMinimumStay?: number };
  const baseOccupancy = property.baseOccupancy ?? 2;
  const maxGuests = property.maxGuests ?? 20;
  const extraGuestFee = property.extraGuestFee ?? 0;
  const cleaningFee = px.cleaningFee ?? 0;
  const defaultMinStay = px.defaultMinimumStay ?? 1;
  const guests = clamp(opts.guests ?? baseOccupancy, 1, maxGuests);
  // UTC-safe month enumeration from the ymd window. (Not getMonthsBetweenDates — it does local-time
  // month math that silently DROPS a month across a DST boundary, e.g. Oct→Dec skips December in
  // Europe/Bucharest, which would leave late-year stays priceless.)
  const monthKeys = [...new Set(dates.map(d => d.slice(0, 7)))];
  const calendars = await Promise.all(monthKeys.map(mk => getPriceCalendarWithDb(propertyId, +mk.slice(0, 4), +mk.slice(5, 7))));
  const dayCell = (dateStr: string) => {
    const [y, mo, da] = dateStr.split('-').map(Number);
    const cal = calendars.find(c => c && c.year === y && c.month === mo);
    return cal?.days?.[String(da)] ?? null; // priceCalendars use an UNPADDED day key
  };
  const minStayFor = (dateStr: string) => {
    const cell = dayCell(dateStr);
    return cell && typeof cell.minimumStay === 'number' && cell.minimumStay > 0
      ? cell.minimumStay
      : defaultMinStay;
  };

  // 5. Occasions the free runs can borrow a true reason from (holidays + derived long-weekend/bridge
  //    windows), restricted to ones overlapping the search window. Same source + algorithms as the analyst.
  const holidays = await getHolidays();
  const occasions = computeOccasions(holidays, asOf, 40).filter(o => o.startDate <= searchEnd && o.endDate >= searchStart);
  const windows = computeExtendedWindows(holidays, asOf).filter(w => w.start <= searchEnd && w.end >= searchStart);

  // 6. Candidate generation. Push a candidate only if it fits inside ONE free run and meets the minimum
  //    stay on its own check-in date (grown to the minimum when the run can still host it).
  const candidates: Candidate[] = [];
  const includesWeekendNight = (start: string, nights: number) => {
    for (let i = 0; i < nights; i++) { const w = weekdayOf(addDays(start, i)); if (w === 5 || w === 6) return true; }
    return false;
  };
  const push = (start: string, wantNights: number, kind: Candidate['kind'], occasionName: string | null, base: number) => {
    if (start < today) return;
    const run = freeRuns.find(r => start >= r.start && start <= r.end);
    if (!run) return;
    const capacity = nightsBetween(start, addDays(run.end, 1)); // free nights from `start` to run end
    const minStay = minStayFor(start);
    const nights = clamp(wantNights, minStay, capacity);
    if (nights < minStay || nights < 1) return; // run too short to host even the minimum from here
    const daysOut = nightsBetween(today, start);
    const score = base + (includesWeekendNight(start, nights) ? 15 : 0) - daysOut * 0.05;
    candidates.push({ start, nights, kind, occasionName, score });
  };
  const firstWeekday = (run: FreeRun, weekday: number): string | null => {
    for (let s = maxYmd(run.start, today); s <= run.end; s = addDays(s, 1)) if (weekdayOf(s) === weekday) return s;
    return null;
  };

  for (const run of freeRuns) {
    // (a) long-weekend / bridge windows overlapping this run — the strongest anchor
    for (const w of windows) {
      const s = maxYmd(w.start, run.start, today);
      const e = minYmd(w.end, run.end);
      if (s > e) continue;
      const occ = occasions.find(o => o.startDate <= w.end && o.endDate >= w.start);
      push(s, nightsBetween(s, addDays(e, 1)), 'occasion', occ?.name ?? null, 100);
    }
    // (b) holidays / school breaks overlapping this run (not necessarily a bridge)
    for (const o of occasions) {
      if (o.endDate < run.start || o.startDate > run.end) continue;
      const multiDay = nightsBetween(o.startDate, addDays(o.endDate, 1)) >= 4;
      push(maxYmd(o.startDate, run.start, today), multiDay ? 4 : 3, 'occasion', o.name, 80);
    }
    // (c) a weekend within this run (Fri→Mon, else Sat→Mon)
    const fri = firstWeekday(run, 5);
    if (fri) push(fri, 3, 'weekend', null, 50);
    else { const sat = firstWeekday(run, 6); if (sat) push(sat, 2, 'weekend', null, 45); }
    // (d) default fallback so the section is never empty when inventory exists
    push(maxYmd(run.start, today), 3, 'default', null, 20);
  }

  // 7. Select: dedupe (start,nights) keeping the best score, rank, then pick non-overlapping stays for
  //    variety (a page of three near-identical windows helps no one), chronological on the page.
  const byKey = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${c.start}_${c.nights}`;
    const prev = byKey.get(key);
    if (!prev || c.score > prev.score) byKey.set(key, c);
  }
  const ranked = [...byKey.values()].sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  const picked: Candidate[] = [];
  const overlaps = (a: Candidate, b: Candidate) => a.start < addDays(b.start, b.nights) && b.start < addDays(a.start, a.nights);
  for (const c of ranked) {
    if (picked.length >= maxStays) break;
    if (!picked.some(p => overlaps(p, c))) picked.push(c);
  }
  picked.sort((a, b) => a.start.localeCompare(b.start));

  // 8. Price + label each pick.
  const losDiscounts = property.pricingConfig?.lengthOfStayDiscounts;
  const stays: ExampleStay[] = picked.map((c) => {
    const { label, occasion } = describe(c);
    return {
      start: c.start,
      end: addDays(c.start, c.nights), // checkout
      nights: c.nights,
      label,
      occasion,
      priceHint: priceStay(c.start, c.nights, guests, dayCell, { baseOccupancy, extraGuestFee, cleaningFee }, losDiscounts),
      guests,
    };
  });

  logger.info('exampleStays: proposed', {
    propertyId, periodKind: period.kind, searchStart, searchEnd,
    freeRuns: freeRuns.length, candidates: candidates.length, picked: stays.length,
  });
  return stays;
}

/** Real quoted total for a stay at `guests` occupancy (occupancy price + cleaning fee + LoS discount),
 *  identical to the booking page. Null if any night lacks calendar data (card renders without a price). */
function priceStay(
  start: string, nights: number, guests: number,
  dayCell: (d: string) => { prices?: Record<string, number>; adjustedPrice?: number; minimumStay?: number } | null,
  property: { baseOccupancy: number; extraGuestFee: number; cleaningFee: number },
  losDiscounts?: Parameters<typeof calculateBookingPrice>[2],
): number | null {
  const dailyPrices: Record<string, number> = {};
  for (let i = 0; i < nights; i++) {
    const date = addDays(start, i);
    const cell = dayCell(date);
    if (!cell) return null;
    const perNight = cell.prices?.[String(guests)]
      ?? (cell.adjustedPrice != null
        ? cell.adjustedPrice + Math.max(0, guests - property.baseOccupancy) * (property.extraGuestFee || 0)
        : undefined);
    if (perNight == null) return null;
    dailyPrices[date] = perNight;
  }
  const { total } = calculateBookingPrice(dailyPrices, property.cleaningFee || 0, losDiscounts);
  return Math.round(total);
}

/** Deterministic bilingual label + short occasion tag for a candidate. Known Romanian holidays get a
 *  hand-tuned phrasing (with diacritics); everything else falls back to length/weekend wording. */
function describe(c: Candidate): { label: Ml; occasion: string | null } {
  if (c.kind === 'occasion' && c.occasionName) {
    const n = norm(c.occasionName);
    if (n.includes('ziua nationala') || n.includes('sfantul andrei'))
      return { label: { ro: 'Minivacanța de 1 Decembrie', en: 'The December 1st long weekend' }, occasion: 'Ziua Națională' };
    if (n.includes('vacanta de toamna'))
      return { label: { ro: 'Vacanța de toamnă la munte', en: 'Autumn school break in the mountains' }, occasion: 'Vacanța de toamnă' };
    if (n.includes('vacanta de iarna'))
      return { label: { ro: 'Vacanța de iarnă la munte', en: 'Winter school break in the mountains' }, occasion: 'Vacanța de iarnă' };
    if (n.includes('craciun'))
      return { label: { ro: 'Crăciun la munte', en: 'Christmas in the mountains' }, occasion: 'Crăciun' };
    if (n.includes('anul nou') || n.includes('revelion'))
      return { label: { ro: 'Revelion la munte', en: 'New Year in the mountains' }, occasion: 'Revelion' };
    if (n.includes('adormirea') || n.includes('sfanta maria'))
      return { label: { ro: 'Sfânta Maria la munte', en: 'A holiday weekend in the mountains' }, occasion: 'Sfânta Maria' };
    if (n.includes('boboteaza'))
      return { label: { ro: 'Bobotează la munte', en: 'A holiday weekend in the mountains' }, occasion: 'Bobotează' };
    if (n.includes('unirii'))
      return { label: { ro: '24 Ianuarie la munte', en: 'A holiday weekend in the mountains' }, occasion: '24 Ianuarie' };
    if (n.includes('inceputul cursurilor') || n.includes('vacanta de vara'))
      return { label: { ro: 'Ultimele zile de vară', en: 'The last days of summer' }, occasion: 'Sfârșit de vară' };
    // generic occasion (unknown holiday) — use its own name
    return { label: { ro: `${c.occasionName} la munte`, en: `${c.occasionName} in the mountains` }, occasion: c.occasionName };
  }
  if (c.kind === 'weekend') {
    return c.nights >= 3
      ? { label: { ro: 'Weekend prelungit la munte', en: 'A long weekend in the mountains' }, occasion: null }
      : { label: { ro: 'Weekend la munte', en: 'A weekend in the mountains' }, occasion: null };
  }
  return { label: { ro: `Escapadă de ${c.nights} nopți`, en: `A ${c.nights}-night escape` }, occasion: null };
}
