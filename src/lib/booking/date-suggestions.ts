/**
 * Alternative-date suggestions for the booking funnel.
 *
 * WHY THIS EXISTS: the homepage picker deliberately lets a guest choose ANY dates — booked nights are
 * not greyed out. That is the product decision: let people say what they actually want, then meet them
 * with a real alternative instead of a silent dead end. This module is the "meet them" half, so the
 * quality of that moment lives in ONE pure, testable place.
 *
 * What it improves on the previous inline version:
 *  - searches BOTH directions (the old one only ever looked forward, so a free window sitting just
 *    before the requested dates was invisible — the single most likely near-miss);
 *  - offers a SHORTER stay inside the guest's own dates when the front of their window is free
 *    ("keep your dates, stay 3 nights") rather than moving them somewhere else;
 *  - for a minimum-stay shortfall, offers both extending the checkout AND pulling the check-in
 *    earlier, so the nights they actually asked for stay inside the stay;
 *  - ranks by how far each option sits from what they asked for, nearest first.
 *
 * Pure functions: no clock, no fetch, no React. `today` is injected so results are deterministic.
 */

/** Why a suggestion is being offered — the UI turns this into a short human label. */
export type SuggestionReason =
  | 'extend-to-minimum'
  | 'shift-earlier-to-minimum'
  | 'earlier-window'
  | 'later-window'
  | 'shorter-stay';

export interface DateSuggestion {
  checkIn: Date;
  checkOut: Date;
  nights: number;
  reason: SuggestionReason;
  /** Absolute day distance from the requested check-in — the ranking key (0 = same start date). */
  distanceDays: number;
}

export interface BuildSuggestionsInput {
  checkIn: Date;
  checkOut: Date;
  /** Individually unavailable NIGHTS (a checkout day is not itself occupied). */
  unavailableDates: Date[];
  minStay: number;
  /** Today, for refusing to propose the past. Defaults to the real clock at call time. */
  today?: Date;
  maxSuggestions?: number;
  /** How far either side of the requested dates to look. */
  horizonDays?: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * A "keep your dates, stay fewer nights" offer must retain at least this share of the requested trip.
 * Half is the judgement call: 3-of-5 nights is still the same weekend away; 1-of-5 is a different trip
 * wearing the same start date.
 */
const SHORTER_STAY_MIN_RATIO = 0.5;

/** Midnight-local copy, so all arithmetic below is whole days regardless of the incoming time. */
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = atMidnight(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((atMidnight(to).getTime() - atMidnight(from).getTime()) / MS_PER_DAY);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/**
 * True when every NIGHT in [start, end) is free. The checkout day is excluded on purpose: a guest
 * checking out on the 5th does not occupy the night of the 5th, so a stay may end where the next
 * booking begins.
 */
export function isRangeAvailable(start: Date, end: Date, unavailableDates: Date[]): boolean {
  if (daysBetween(start, end) <= 0) return false;
  for (let cursor = atMidnight(start); cursor < atMidnight(end); cursor = addDays(cursor, 1)) {
    if (unavailableDates.some((blocked) => sameDay(blocked, cursor))) return false;
  }
  return true;
}

/** The longest stay from `start` that is free, capped at `maxNights` (0 when the first night is taken). */
function longestAvailableRun(start: Date, maxNights: number, unavailableDates: Date[]): number {
  let nights = 0;
  while (nights < maxNights && isRangeAvailable(start, addDays(start, nights + 1), unavailableDates)) {
    nights += 1;
  }
  return nights;
}

/**
 * Build ranked alternatives for a requested range that could not be booked — because nights inside it
 * are taken, or because it is shorter than the minimum stay, or both. Returns `[]` when nothing
 * genuinely fits (an empty list is a valid, honest answer; the caller should not invent one).
 */
export function buildDateSuggestions({
  checkIn,
  checkOut,
  unavailableDates,
  minStay,
  today = new Date(),
  maxSuggestions = 3,
  horizonDays = 90,
}: BuildSuggestionsInput): DateSuggestion[] {
  const requestedIn = atMidnight(checkIn);
  const requestedOut = atMidnight(checkOut);
  const floor = atMidnight(today);
  const requestedNights = daysBetween(requestedIn, requestedOut);
  if (requestedNights <= 0) return [];

  const effectiveMinStay = Math.max(1, minStay);
  const targetNights = Math.max(requestedNights, effectiveMinStay);
  const found: DateSuggestion[] = [];

  const push = (start: Date, nights: number, reason: SuggestionReason) => {
    if (nights < effectiveMinStay) return;
    const end = addDays(start, nights);
    if (start < floor) return; // never propose the past
    if (sameDay(start, requestedIn) && sameDay(end, requestedOut)) return; // that's what they asked for
    if (!isRangeAvailable(start, end, unavailableDates)) return;
    if (found.some((s) => sameDay(s.checkIn, start) && sameDay(s.checkOut, end))) return;
    found.push({
      checkIn: start,
      checkOut: end,
      nights,
      reason,
      distanceDays: Math.abs(daysBetween(requestedIn, start)),
    });
  };

  // 1. Minimum-stay shortfall: keep them where they wanted to be, in both directions.
  if (requestedNights < effectiveMinStay) {
    push(requestedIn, effectiveMinStay, 'extend-to-minimum');
    // Pulling check-in earlier keeps the nights they actually asked for inside the stay.
    push(addDays(requestedOut, -effectiveMinStay), effectiveMinStay, 'shift-earlier-to-minimum');
  }

  // 2. Keep their dates, shorten the stay — only when the FRONT of their window is free AND the stay
  //    still retains a meaningful share of what they asked for. Offering 1 night to someone who wanted
  //    5 technically "fits", but it is not the same trip, and because it keeps their start date it
  //    would otherwise rank ABOVE two genuine 5-night windows. Below the threshold, staying quiet and
  //    proposing real alternatives is the better answer.
  if (requestedNights > effectiveMinStay) {
    const run = longestAvailableRun(requestedIn, requestedNights - 1, unavailableDates);
    if (run >= Math.max(effectiveMinStay, Math.ceil(requestedNights * SHORTER_STAY_MIN_RATIO))) {
      push(requestedIn, run, 'shorter-stay');
    }
  }

  // 3. Nearest whole window either side, expanding outward so the closest is found first. We stop each
  //    direction as soon as it yields one hit: three consecutive earlier start dates (the 11th, 10th,
  //    9th…) are not three choices, they are one choice repeated. One nearest-earlier plus one
  //    nearest-later gives the guest a real decision.
  let haveEarlier = false;
  let haveLater = false;
  for (let offset = 1; offset <= horizonDays && !(haveEarlier && haveLater); offset++) {
    if (!haveEarlier) {
      const before = found.length;
      push(addDays(requestedIn, -offset), targetNights, 'earlier-window');
      haveEarlier = found.length > before;
    }
    if (!haveLater) {
      const before = found.length;
      push(addDays(requestedIn, offset), targetNights, 'later-window');
      haveLater = found.length > before;
    }
  }

  // Nearest first; on a tie prefer the option that keeps their own check-in date.
  const keepsTheirStart = (s: DateSuggestion) => (sameDay(s.checkIn, requestedIn) ? 0 : 1);
  return found
    .sort((a, b) => a.distanceDays - b.distanceDays || keepsTheirStart(a) - keepsTheirStart(b))
    .slice(0, maxSuggestions);
}
