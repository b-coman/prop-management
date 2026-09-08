/**
 * When a holiday becomes a small vacation, and which nights it actually sells.
 *
 * A public holiday is a date. The stay it produces is not: it starts the evening people leave the
 * city and ends the day they drive home, and those two are set by where the holiday falls in the
 * week, not by the holiday itself.
 *
 * The owner put it plainly on 2026-09-01, about 1 Decembrie: *"people can leave the city on friday
 * 27, then have few days a small vacation and checkout and return home on Dec 1st"*, and added the
 * case that generalises it: *"even if in-between is an working day, like for example thursday a
 * holiday, then friday working day, then saturday and sunday, people usually take friday as a day
 * off"*.
 *
 * Two separate effects, and the system had neither. `bridge-day` was a declared holiday type with
 * zero rows ever seeded, and the only approximation was a "walk back to the nearest Friday" buried
 * inside parity-pack, which is invisible to the pricing periods it disagrees with. That disagreement
 * had a cost: the 1 Decembrie period started on the Saturday, so the Friday night people actually
 * travel on was priced as ordinary Late Fall.
 *
 *  1. **The bridge (`punte`).** A single working day sandwiched between days off is taken off. Thu
 *     holiday + Fri work + Sat/Sun becomes a four-day run. Only ONE day is bridged: nobody burns two
 *     days of leave to join a weekend to a Tuesday.
 *
 *  2. **The departure evening.** People work the last day and drive up afterwards, so the night
 *     BEFORE the run is sold even though that day is not a day off. This is the night the run itself
 *     can never explain, and the one that was being mispriced.
 *
 * Pure. No I/O. Holidays come from the seeded `holidays` collection, never derived — see
 * scripts/seed-holidays.ts for why that is not negotiable.
 */

/** A day the country is off work, from the seeded calendar. */
export interface OfficialDay {
  date: string;          // YYYY-MM-DD
  name: string;
}

export interface TravelWindow {
  /** First night sold. Usually the departure evening, so typically a working day. */
  checkIn: string;
  /** Departure day. Exclusive, as everywhere else in the system. */
  checkOut: string;
  nights: number;
  /** The contiguous run of days off this window was built around. */
  daysOff: { from: string; to: string };
  /** Working days people take off to join the holiday to the weekend. */
  bridged: string[];
  /** True when the first night is a working evening people travel on. */
  departureEvening: boolean;
  /** Plain-language account of why this window is what it is. */
  why: string;
  /**
   * The holiday this window was computed FOR, as asked.
   *
   * Needed because a bridged stretch is shared. Once 28-31 Dec are seeded as
   * `bridge-day`, asking about Craciun and asking about Anul Nou both return the
   * same 24 Dec -> 3 Jan window, which is true (nobody works between them) and
   * useless on its own: a caller holding two identical windows cannot tell which
   * product it is looking at. The anchor says which question was asked.
   */
  anchor: { startDate: string; endDate: string };
  /**
   * Every official day inside the window, in date order — so a caller can see that
   * this stretch contains BOTH Craciun and Anul Nou, and slice it into products
   * accordingly. Slicing is a PERIOD decision; this is the evidence for it.
   */
  spans: OfficialDay[];
}

const DAY = 86_400_000;
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const shift = (s: string, n: number) => iso(new Date(d(s).getTime() + n * DAY));
/** Saturday or Sunday. */
const isWeekend = (s: string) => { const w = d(s).getUTCDay(); return w === 0 || w === 6; };

/**
 * The real travel window around one holiday.
 *
 * `officialDays` must contain every public holiday near `holidayStart`, not only this one — a run is
 * built out of all of them, which is the whole point on 30 Nov + 1 Dec, or on Christmas.
 */
export function travelWindow(
  holidayStart: string,
  holidayEnd: string,
  officialDays: OfficialDay[],
): TravelWindow {
  const holiday = new Set(officialDays.map((h) => h.date));
  const off = (s: string) => holiday.has(s) || isWeekend(s);

  // A single working day between two days off is taken off. Applied once, and only to gaps of one:
  // people bridge a day, they do not bridge a week.
  const bridged: string[] = [];
  const isOff = (s: string): boolean => {
    if (off(s)) return true;
    if (off(shift(s, -1)) && off(shift(s, 1))) { if (!bridged.includes(s)) bridged.push(s); return true; }
    return false;
  };

  // Grow outwards from the holiday itself to the full run of days off around it.
  let from = holidayStart;
  while (isOff(shift(from, -1))) from = shift(from, -1);
  let to = holidayEnd;
  while (isOff(shift(to, 1))) to = shift(to, 1);

  // The departure evening: the night before the run, when people finish work and drive up. Only
  // worth selling when the run is long enough to be a break — nobody drives to the mountains on
  // Friday night for a single day off.
  const runNights = Math.round((d(to).getTime() - d(from).getTime()) / DAY) + 1;
  const departureEvening = runNights >= 2 && !off(shift(from, -1));
  const checkIn = departureEvening ? shift(from, -1) : from;

  // People drive home ON the last day off rather than sleeping through it, so the last night sold is
  // the night before it.
  const checkOut = to;
  const nights = Math.round((d(checkOut).getTime() - d(checkIn).getTime()) / DAY);

  const parts: string[] = [];
  parts.push(`days off ${from} to ${to}`);
  if (bridged.length) parts.push(`${bridged.join(', ')} bridged (a working day between two days off)`);
  if (departureEvening) parts.push(`${checkIn} sold as the departure evening`);
  parts.push(`home on ${checkOut}`);

  const spans = officialDays
    .filter((o) => o.date >= checkIn && o.date <= checkOut)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const distinct = [...new Set(spans.map((o) => o.name))];
  if (distinct.length > 1) parts.push(`spans ${distinct.join(' + ')}`);

  return { checkIn, checkOut, nights, daysOff: { from, to }, bridged, departureEvening,
           why: parts.join('; '), anchor: { startDate: holidayStart, endDate: holidayEnd }, spans };
}

/**
 * Which period prices each night of a holiday stay, and whether any of them is an ordinary one.
 *
 * "Is the window covered" turned out to be the wrong question. Every night of 1 Decembrie 2026 was
 * covered — the Friday by Late Fall, the rest by the holiday period — and that IS the defect: one
 * stay, billed partly at the holiday rate and partly at the ordinary November rate, because the
 * period boundary sits inside the window instead of around it.
 *
 * A holiday stay being priced by more than one period is not itself wrong. New Year's Eve is a
 * dearer night than the two after it and the owner prices them separately on purpose. What is wrong
 * is a night of the stay falling to a BACKGROUND period — a general season that runs for weeks and
 * knows nothing about this holiday. Length is what separates the two: a period several times longer
 * than the window it is pricing is a season, not an occasion.
 */
export interface PeriodRef {
  startDate: string;
  endDate: string;
  name: string;
  minStay?: number | null;
}

export interface WindowPricing {
  /** One entry per night of the stay, in order. */
  nights: Array<{ date: string; period: string | null; ordinary: boolean }>;
  /** Nights priced by a general season rather than by an occasion. */
  ordinaryNights: string[];
  /** Nights no period prices at all. */
  unpricedNights: string[];
  aligned: boolean;
  note: string;
}

const spanDays = (p: PeriodRef) =>
  Math.round((d(p.endDate).getTime() - d(p.startDate).getTime()) / DAY) + 1;

/**
 * A period long enough to be a season rather than an occasion. Three times the stay it is pricing,
 * and at least a fortnight — so a 4-night holiday period stays an occasion while a 26-day Late Fall
 * does not.
 */
const isBackground = (p: PeriodRef, windowNights: number) =>
  spanDays(p) >= Math.max(14, windowNights * 3);

export function comparePeriodToWindow(periods: PeriodRef[], w: TravelWindow): WindowPricing {
  const nights: WindowPricing['nights'] = [];
  for (let s = w.checkIn; s < w.checkOut; s = shift(s, 1)) {
    // The SHORTEST period covering the night wins. Periods can overlap, and when they do the more
    // specific one is the one that means something - the same way an override beats a season in the
    // engine. Taking the first match instead made the answer depend on array order.
    const p = periods.filter((x) => s >= x.startDate && s <= x.endDate)
      .sort((a, b) => spanDays(a) - spanDays(b))[0] ?? null;
    nights.push({ date: s, period: p?.name ?? null, ordinary: p ? isBackground(p, w.nights) : false });
  }
  const ordinaryNights = nights.filter((n) => n.ordinary).map((n) => n.date);
  const unpricedNights = nights.filter((n) => !n.period).map((n) => n.date);
  const aligned = !ordinaryNights.length && !unpricedNights.length;

  const bits: string[] = [];
  if (unpricedNights.length) bits.push(`${unpricedNights.join(', ')} has no period at all`);
  if (ordinaryNights.length) {
    const by = nights.filter((n) => n.ordinary).map((n) => `${n.date} (${n.period})`).join(', ');
    bits.push(`${by} priced as an ordinary season, not as this holiday`);
  }
  return {
    nights, ordinaryNights, unpricedNights, aligned,
    note: aligned ? 'Every night of the stay is priced as this holiday.' : bits.join('; ') + '.',
  };
}

/** A run of days off this long or longer is a long weekend, and carries a three-night minimum. */
const LONG_WEEKEND_DAYS = 3;

/** Inclusive length of the window's run of days off. 0 when the window carries no run. */
function daysOffRun(w: TravelWindow): number {
  const off = w.daysOff;
  if (!off?.from || !off?.to) return 0;
  return Math.round((d(off.to).getTime() - d(off.from).getTime()) / DAY) + 1;
}

/**
 * The minimum stay this window should carry.
 *
 * The owner's rule, stated 2026-09-07: *"for national day, or any other official holiday, the min
 * stay should be 3 if there is a long weekend"* — and, separately, that summer stays at 2. So the
 * minimum is set by the **run of days off**, not by the length of the window:
 *
 *   - a run of 3+ days off (a long weekend) -> **3**
 *   - anything shorter, an ordinary weekend included -> **2**
 *
 * The earlier formula was `max(2, min(3, nights - 1))`, derived from window length. It returned
 * **2** for exactly the case he named: a Friday or Monday holiday makes a 3-day run, which sells a
 * 3-night window, and `nights - 1` gave 2. It also flipped with the calendar rather than with the
 * holiday — Ziua Unirii is a Saturday in 2026 (a 2-day run) and a Sunday in 2027 (still 2), while a
 * Monday would make it 3. Reading the run says which of those it is.
 *
 * Capped at `w.nights`, since a window cannot require more nights than it sells.
 */
export function suggestedMinStay(w: TravelWindow): number {
  const want = daysOffRun(w) >= LONG_WEEKEND_DAYS ? 3 : 2;
  return Math.max(2, Math.min(want, w.nights || want));
}
