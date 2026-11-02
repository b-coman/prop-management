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
 *  - ranks by how far each option sits from what they asked for, nearest first;
 *  - when the guest asked for a weekend and it is taken, offers other free weekends first.
 *
 * Pure functions: no clock, no fetch, no React. `today` is injected so results are deterministic.
 */

/** Why a suggestion is being offered — the UI turns this into a short human label. */
export type SuggestionReason =
  | 'extend-to-minimum'
  | 'shift-earlier-to-minimum'
  | 'earlier-window'
  | 'later-window'
  | 'shorter-stay'
  | 'weekend';

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
  /**
   * Nights whose own minimum stay is stricter than `minStay`, keyed YYYY-MM-DD. The strictest night
   * inside a stay binds the whole stay, as in quoteStay, so a weekend proposed inside a 3-night
   * holiday period grows to 3 nights instead of failing on the next tap.
   */
  minStayByNight?: Record<string, number>;
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

/**
 * Someone whose weekend is taken sees up to this many other free weekends before anything else
 * (owner, 2026-11-02). In the week before, Fri-Sun visitors were offered Mon-Wed "just after", took it
 * twice, and booked neither time.
 */
const WEEKEND_OPTIONS = 3;
/** A longer ask is a holiday rather than a weekend away, and keeps the nearest-window search. */
const WEEKEND_MAX_NIGHTS = 4;

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

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Friday and Saturday nights in a stay. A stay with at least one is a weekend away. */
function weekendNights(start: Date, nights: number): number {
  let count = 0;
  for (let i = 0; i < nights; i++) {
    const day = addDays(start, i).getDay();
    if (day === 5 || day === 6) count++;
  }
  return count;
}

const hasWeekendNight = (start: Date, nights: number) => weekendNights(start, nights) > 0;

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
  minStayByNight,
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

  /** The minimum this stay must meet: the strictest of its own nights. */
  const minStayOf = (start: Date, nights: number) => {
    let need = effectiveMinStay;
    for (let i = 0; i < nights; i++) need = Math.max(need, minStayByNight?.[ymd(addDays(start, i))] ?? 0);
    return need;
  };
  /** Grow a stay until it meets that minimum. Growing can take in a stricter night, so repeat. */
  const fitNights = (start: Date, nights: number) => {
    let n = nights;
    for (let i = 0; i < 5 && minStayOf(start, n) > n; i++) n = minStayOf(start, n);
    return n;
  };

  const push = (start: Date, nights: number, reason: SuggestionReason) => {
    if (nights < minStayOf(start, nights)) return;
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
  const neededNights = minStayOf(requestedIn, requestedNights);
  if (requestedNights < neededNights) {
    push(requestedIn, neededNights, 'extend-to-minimum');
    // Pulling check-in earlier keeps the nights they actually asked for inside the stay.
    push(addDays(requestedOut, -neededNights), neededNights, 'shift-earlier-to-minimum');
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

  // 3. A weekend that is taken: the nearest free weekends, same days of the week and same length,
  //    whole weeks away. Run before the window search so a date both would find keeps this reason.
  const weekendAsk =
    requestedNights <= WEEKEND_MAX_NIGHTS &&
    hasWeekendNight(requestedIn, requestedNights) &&
    !isRangeAvailable(requestedIn, requestedOut, unavailableDates);
  if (weekendAsk) {
    // A one-night ask below the minimum grows toward the weekend: Saturday alone becomes Fri-Sun
    // rather than Sat-Mon, Friday alone becomes Fri-Sun rather than Thu-Sat.
    let shapeStart = requestedIn;
    if (requestedNights < targetNights) {
      const earlier = addDays(requestedOut, -targetNights);
      if (weekendNights(earlier, targetNights) > weekendNights(requestedIn, targetNights)) shapeStart = earlier;
    }
    let weekends = 0;
    for (let week = 1; week * 7 <= horizonDays && weekends < WEEKEND_OPTIONS; week++) {
      for (const direction of [-1, 1]) {
        if (weekends >= WEEKEND_OPTIONS) break;
        const start = addDays(shapeStart, direction * week * 7);
        const before = found.length;
        push(start, fitNights(start, targetNights), 'weekend');
        if (found.length > before) weekends++;
      }
    }
  }

  // 4. Nearest whole window either side, expanding outward so the closest is found first. We stop each
  //    direction as soon as it yields one hit: three consecutive earlier start dates (the 11th, 10th,
  //    9th…) are not three choices, they are one choice repeated. One nearest-earlier plus one
  //    nearest-later gives the guest a real decision.
  let haveEarlier = false;
  let haveLater = false;
  for (let offset = 1; offset <= horizonDays && !(haveEarlier && haveLater); offset++) {
    if (!haveEarlier) {
      const before = found.length;
      const start = addDays(requestedIn, -offset);
      push(start, fitNights(start, targetNights), 'earlier-window');
      haveEarlier = found.length > before;
    }
    if (!haveLater) {
      const before = found.length;
      const start = addDays(requestedIn, offset);
      push(start, fitNights(start, targetNights), 'later-window');
      haveLater = found.length > before;
    }
  }

  // Nearest first; on a tie prefer the option that keeps their own check-in date.
  const keepsTheirStart = (s: DateSuggestion) => (sameDay(s.checkIn, requestedIn) ? 0 : 1);
  const nearestFirst = (a: DateSuggestion, b: DateSuggestion) =>
    a.distanceDays - b.distanceDays || keepsTheirStart(a) - keepsTheirStart(b);

  if (!weekendAsk) return found.sort(nearestFirst).slice(0, maxSuggestions);

  // Weekend ask: weekends lead, in date order, so the first free weekend is the first option. Their
  // own dates made shorter still count when a Friday or Saturday night is left in them.
  const isWeekend = (s: DateSuggestion) =>
    s.reason === 'weekend' || (s.reason === 'shorter-stay' && hasWeekendNight(s.checkIn, s.nights));
  const weekendOptions = found
    .filter(isWeekend)
    .sort(nearestFirst)
    .slice(0, WEEKEND_OPTIONS)
    .sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  const rest = found.filter((s) => !weekendOptions.includes(s)).sort(nearestFirst);
  return [...weekendOptions, ...rest].slice(0, maxSuggestions);
}
