/**
 * Free periods widget for the property website: which stays to propose, and which get a badge.
 *
 * Pure, so it can be tested without a calendar. The server half (`openStaysServer.ts`) asks the
 * booking engine for free weekends and occasion stays and reads recent booking-page searches; this
 * file only decides what to show from those answers.
 *
 * Why it exists (GA4, 1 Sep - 19 Oct 2026): about 330 people looked at the gallery and 10 went on to
 * the booking page. Proposed dates do get used where they already exist: on the Ceaun landing page
 * as often as the main button, on the dateless booking page by 1 visitor in 10. And a third of all
 * booking-page visits ended on dates that were booked or too short, which a list of bookable dates
 * avoids by construction.
 */
import type { Ml } from '@/lib/landing/contracts';

export type AutoBadgeKind = 'lastFree' | 'highDemand' | 'bestPrice';
export type BadgeKind = AutoBadgeKind | 'pinned';

/** One bookable stay, as the booking engine quoted it. */
export interface CandidateStay {
  start: string; // YYYY-MM-DD check-in
  end: string; // YYYY-MM-DD check-out
  nights: number;
  /** Total for the property's base occupancy, cleaning included. What the booking page shows first. */
  price: number | null;
  /** The occasion ("Minivacanța de 1 Decembrie"), or null for a plain weekend. */
  label: Ml | null;
  kind: 'weekend' | 'occasion';
}

export interface OpenStayRow extends CandidateStay {
  badge: { kind: BadgeKind; text: Ml } | null;
}

/** A booking-page search with dates, summed over the counting window. */
export interface StaySearch {
  start: string;
  end: string;
  count: number;
}

/** The block's settings, from the property's page overrides. Everything is optional. */
export interface OpenStaysConfig {
  /** Rows to show. Default 4. */
  maxRows?: number;
  /** How far ahead to look, in days. Default 75. */
  horizonDays?: number;
  /** Override a badge's wording, or `false` to switch that badge off. `{month}` is filled in. */
  badges?: Partial<Record<AutoBadgeKind, Ml | false>>;
  /** The owner's own badges, by check-in date. They win over the automatic ones. */
  pinned?: { start: string; text: Ml }[];
  /** Searches overlapping a stay in the last 14 days before it counts as "high demand". Default 3. */
  minSearches?: number;
}

export const DEFAULT_BADGE_TEXT: Record<AutoBadgeKind, { en: string; ro: string }> = {
  lastFree: { en: 'Last free weekend in {month}', ro: 'Ultimul weekend liber din {month}' },
  highDemand: { en: 'High demand', ro: 'Cerere mare' },
  bestPrice: { en: 'Best price', ro: 'Cel mai bun preț' },
};

/** More than two badges in four rows and none of them stands out any more. */
const MAX_BADGES = 2;
/** "Best price" only when the gap is big enough to notice. Weekends usually cost the same. */
const BEST_PRICE_GAP = 0.15;

const MONTHS: Record<'en' | 'ro', string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ro: ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'],
};

const DAY = 86400000;
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => ymd(new Date(+parse(s) + n * DAY));

/** Stays share at least one night. */
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  a.start < b.end && b.start < a.end;

/**
 * The rows to show, soonest first.
 *
 * Occasion stays (1 Decembrie, a school break) win over a plain weekend they overlap: showing
 * "20-22 Nov" and "20-23 Nov" next to each other only makes the reader compare two near-identical
 * lines. Rows never overlap each other.
 */
export function mergeStays(weekends: CandidateStay[], occasions: CandidateStay[], maxRows = 4): CandidateStay[] {
  const picked: CandidateStay[] = [];
  for (const o of [...occasions].sort((a, b) => a.start.localeCompare(b.start))) {
    if (!picked.some((p) => overlaps(p, o))) picked.push(o);
  }
  for (const w of weekends) {
    if (!picked.some((p) => overlaps(p, w))) picked.push(w);
  }
  return picked.sort((a, b) => a.start.localeCompare(b.start)).slice(0, Math.max(0, maxRows));
}

/** Sum of searches whose dates share a night with this stay. */
export function searchScore(stay: { start: string; end: string }, searches: StaySearch[]): number {
  return searches.reduce((n, s) => (overlaps(stay, s) ? n + s.count : n), 0);
}

/**
 * Saturday nights (YYYY-MM-DD of the Saturday) a stay includes. A stay "is a weekend" in a month
 * when it holds that month's Saturday night: Fri-Sun does, and so does a Sat-Wed holiday stay.
 */
function saturdayNights(stay: { start: string; end: string }): string[] {
  const out: string[] = [];
  for (let d = stay.start; d < stay.end; d = addDays(d, 1)) if (parse(d).getUTCDay() === 6) out.push(d);
  return out;
}

/**
 * The months in which exactly one weekend is still free, mapped to that weekend's Saturday.
 *
 * Only months whose every Saturday falls inside the window the engine was asked about count:
 * a month the search only half covered may have free weekends nobody looked at.
 */
export function lastFreeWeekendByMonth(
  freeStays: { start: string; end: string }[],
  window: { from: string; to: string },
): Map<string, string> {
  const freeSaturdays = new Set(freeStays.flatMap(saturdayNights));
  const result = new Map<string, string>();
  const months = new Set([...freeSaturdays].map((s) => s.slice(0, 7)));
  for (const month of months) {
    // Every Saturday of this month must be inside [from, to).
    const first = parse(`${month}-01`);
    const saturdays: string[] = [];
    for (let d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d = new Date(+d + DAY)) {
      if (d.getUTCDay() === 6) saturdays.push(ymd(d));
    }
    const future = saturdays.filter((s) => s >= window.from);
    if (future.length === 0 || future[future.length - 1] >= window.to) continue;
    const free = future.filter((s) => freeSaturdays.has(s));
    // One free weekend among several is scarce. One free weekend among one is not news.
    if (free.length === 1 && future.length > 1) result.set(month, free[0]);
  }
  return result;
}

const fillMonth = (text: Ml, month: string): Ml => {
  const m = Number(month.slice(5, 7)) - 1;
  if (typeof text === 'string') return text.replace('{month}', MONTHS.ro[m]);
  const out: Record<string, string> = {};
  for (const [lang, s] of Object.entries(text)) out[lang] = s.replace('{month}', (MONTHS as Record<string, string[]>)[lang]?.[m] ?? MONTHS.en[m]);
  return out as Ml;
};

const perNight = (s: CandidateStay) => (s.price != null && s.nights > 0 ? s.price / s.nights : null);

/**
 * Attach badges. At most two per block, at most one per row, each kind at most once.
 *
 * Order: the owner's pinned badges, then "last free weekend in <month>" (the calendar says so),
 * then "high demand" (the stay most searched on the booking page lately), then "best price" (only
 * when one stay is at least 15% cheaper per night than the next cheapest).
 */
export function pickBadges(
  rows: CandidateStay[],
  ctx: { searches: StaySearch[]; lastFree: Map<string, string> },
  config: OpenStaysConfig = {},
): OpenStayRow[] {
  const out: OpenStayRow[] = rows.map((r) => ({ ...r, badge: null }));
  let used = 0;
  const textFor = (kind: AutoBadgeKind): Ml | null => {
    const configured = config.badges?.[kind];
    if (configured === false) return null;
    return configured ?? DEFAULT_BADGE_TEXT[kind];
  };

  for (const pin of config.pinned ?? []) {
    const row = out.find((r) => r.start === pin.start && !r.badge);
    if (row && used < MAX_BADGES) { row.badge = { kind: 'pinned', text: pin.text }; used++; }
  }

  const lastFreeText = textFor('lastFree');
  if (lastFreeText && used < MAX_BADGES) {
    const row = out.find((r) => !r.badge && saturdayNights(r).some((sat) => ctx.lastFree.get(sat.slice(0, 7)) === sat));
    if (row) {
      const sat = saturdayNights(row).find((s) => ctx.lastFree.get(s.slice(0, 7)) === s)!;
      row.badge = { kind: 'lastFree', text: fillMonth(lastFreeText, sat.slice(0, 7)) };
      used++;
    }
  }

  const demandText = textFor('highDemand');
  if (demandText && used < MAX_BADGES) {
    const min = config.minSearches ?? 3;
    let best: OpenStayRow | null = null;
    let bestScore = 0;
    for (const r of out) {
      if (r.badge) continue;
      const score = searchScore(r, ctx.searches);
      if (score >= min && score > bestScore) { best = r; bestScore = score; }
    }
    if (best) { best.badge = { kind: 'highDemand', text: demandText }; used++; }
  }

  const priceText = textFor('bestPrice');
  if (priceText && used < MAX_BADGES) {
    const priced = out.filter((r) => perNight(r) != null).sort((a, b) => perNight(a)! - perNight(b)!);
    if (priced.length >= 2 && !priced[0].badge && perNight(priced[0])! <= perNight(priced[1])! * (1 - BEST_PRICE_GAP)) {
      priced[0].badge = { kind: 'bestPrice', text: priceText };
      used++;
    }
  }

  return out;
}
