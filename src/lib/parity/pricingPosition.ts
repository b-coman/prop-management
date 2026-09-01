/**
 * The whole pricing position, rolled up to the unit the owner actually prices in: the PERIOD.
 *
 * The pricing admin grew one tab per Firestore collection — seasons, overrides, discounts, calendars,
 * channels — so every screen was a form over a table and none of them answered a question. Worse, the
 * screens disagreed: the rate sheet compares per-night LIST prices while parity compares guest-facing
 * TOTALS, and on the same page one said "1% dearer" while the other said "36% dearer".
 *
 * The period is what reconciles them. Parity is measured per WINDOW, prices are set per PERIOD, and
 * occupancy is per DATE. Roll all three to the period and there is one row per thing the owner can
 * actually act on, carrying: how full it is, what he charges, where he stands against the channels,
 * and how much money is exposed.
 *
 * Pure. No I/O.
 */
export type PeriodVerdict = 'losing' | 'level' | 'thin' | 'healthy' | 'overshoot' | 'unmeasured';

/**
 * The owner's own tolerance, stated 2026-08-07: *"Airbnb and Booking more or less on the same level;
 * my own channel a bit less. 2-3% here or there won't break anything."* Anything inside this band is
 * `level`, not a failure — reporting +0.5% in red buries the +36% rows that matter.
 */
export const NOISE_BAND = 0.03;

export interface PeriodInput {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tier: string;
  minStay: number | null;
  fixedNightPrice: number | null;
}

export interface DayFact {
  date: string;
  available: boolean;
  price: number | null;
  isWeekend: boolean;
}

export interface WindowFact {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  verdict: string;
  gapPct: number | null;
  direct: number | null;
  bestChannel: string | null;
  bestPrice: number | null;
  floor: number | null;
  targetPrice: number | null;
  oldestAgeDays: number;
  /** How far apart the platforms are on these nights. The owner's own settings, not the market. */
  channelSpreadPct?: number | null;
}

export interface PeriodPosition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  tier: string;
  nights: number;
  /** Nights already sold. */
  booked: number;
  openNights: number;
  occupancyPct: number;
  weekdayPrice: number | null;
  weekendPrice: number | null;
  /** Open nights x their asking price — the money actually exposed in this period. */
  valueAtRisk: number;
  verdict: PeriodVerdict;
  /** The worst measured gap in the period. Positive = direct is DEARER than the cheapest channel. */
  worstGapPct: number | null;
  worstWindow: WindowFact | null;
  measuredWindows: number;
  freshestAgeDays: number | null;
  /**
   * The widest gap between the platforms on any window in this period.
   *
   * When it is large, no single direct rate can close the period: the price to undercut is set by the
   * CHEAPEST platform while the floor is set by the DEAREST, and a wide spread pulls those apart until
   * they cross. It is also the owner's own doing, so it is the actionable half of "this period cannot
   * be solved".
   */
  widestChannelSpreadPct: number | null;
  /** What to do, in one line, or null when nothing is called for. */
  action: string | null;
}

/**
 * A period's `endDate` is INCLUSIVE, because that is what the engine does: `isDateInRange` ends the
 * range at 23:59:59 of `endDate`, and the compiler's `datesInRange` iterates `start <= s <= end`.
 *
 * This read `d < p.endDate` and so dropped the final night of every period out of the night count,
 * the occupancy and the money — and those nights landed in no gap either, because coverage is
 * computed inclusively, so they vanished from the screen entirely.
 */
const inPeriod = (d: string, p: { startDate: string; endDate: string }) => d >= p.startDate && d <= p.endDate;

/** A verdict for a whole period is its WORST measured window — the one a guest will find. */
function rollUpVerdict(windows: WindowFact[]): { verdict: PeriodVerdict; worst: WindowFact | null; gap: number | null } {
  const measured = windows.filter((w) => w.gapPct !== null);
  if (!measured.length) return { verdict: 'unmeasured', worst: null, gap: null };

  // Overshoot is judged separately: it is not "worse" on the guest axis, it is money left on the
  // table, and it must not be hidden by a losing window in the same period.
  const overshoots = measured.filter((w) => w.verdict === 'overshoot');
  const worst = measured.reduce((a, b) => ((b.gapPct ?? -1) > (a.gapPct ?? -1) ? b : a));
  const gap = worst.gapPct!;

  if (gap >= NOISE_BAND) return { verdict: 'losing', worst, gap };
  if (gap > -NOISE_BAND) return { verdict: 'level', worst, gap };
  if (overshoots.length) return { verdict: 'overshoot', worst: overshoots[0], gap: overshoots[0].gapPct };
  if (gap > -0.10) return { verdict: 'thin', worst, gap };
  return { verdict: 'healthy', worst, gap };
}

function describeAction(p: Omit<PeriodPosition, 'action'>): string | null {
  if (p.verdict === 'losing' && p.worstWindow?.targetPrice) {
    const w = p.worstWindow;
    return `A guest pays ${Math.round(w.gapPct! * 100)}% more on your site than on ${w.bestChannel}. ` +
      `To sit under it, a ${w.nights}-night stay would be ${Math.round(w.targetPrice!)} instead of ${Math.round(w.direct!)}.`;
  }
  if (p.verdict === 'overshoot' && p.worstWindow?.floor) {
    return `Below ${Math.round(p.worstWindow.floor)}, which is the point where a direct booking stops being ` +
      `worth more to you than a ${p.worstWindow.bestChannel} one. You are discounting past the benefit.`;
  }
  if (p.verdict === 'unmeasured' && p.openNights > 0) {
    return `${p.openNights} nights open here and nobody has ever compared this period against the platforms.`;
  }
  if (p.verdict === 'level') {
    return 'Your price and the cheapest platform are within 3% of each other, so a guest has no reason to book with you rather than them.';
  }
  return null;
}

export function buildPeriodPositions(
  periods: PeriodInput[],
  days: DayFact[],
  windows: WindowFact[],
): PeriodPosition[] {
  const out: PeriodPosition[] = [];
  for (const p of periods) {
    const pd = days.filter((d) => inPeriod(d.date, p));
    const booked = pd.filter((d) => !d.available).length;
    const open = pd.filter((d) => d.available);
    const wk = pd.filter((d) => !d.isWeekend && d.price !== null).map((d) => d.price!);
    const we = pd.filter((d) => d.isWeekend && d.price !== null).map((d) => d.price!);
    const pw = windows.filter((w) => inPeriod(w.checkIn, p));
    const { verdict, worst, gap } = rollUpVerdict(pw);
    const ages = pw.map((w) => w.oldestAgeDays).filter((n) => Number.isFinite(n));

    const base: Omit<PeriodPosition, 'action'> = {
      id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate, tier: p.tier,
      nights: pd.length, booked, openNights: open.length,
      occupancyPct: pd.length ? Math.round((booked / pd.length) * 100) : 0,
      weekdayPrice: wk.length ? Math.round(wk.reduce((a, b) => a + b, 0) / wk.length) : null,
      weekendPrice: we.length ? Math.round(we.reduce((a, b) => a + b, 0) / we.length) : null,
      valueAtRisk: Math.round(open.reduce((sum, d) => sum + (d.price ?? 0), 0)),
      verdict, worstGapPct: gap, worstWindow: worst,
      measuredWindows: pw.length,
      freshestAgeDays: ages.length ? Math.min(...ages) : null,
      widestChannelSpreadPct: (() => {
        const sp = pw.map((w) => w.channelSpreadPct).filter((v): v is number => v != null);
        return sp.length ? Math.max(...sp) : null;
      })(),
    };
    out.push({ ...base, action: describeAction(base) });
  }
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export interface PositionSummary {
  periods: number;
  losing: number;
  level: number;
  thin: number;
  healthy: number;
  overshoot: number;
  unmeasured: number;
  openNights: number;
  /** Money exposed in periods where a guest currently finds a cheaper channel. */
  valueAtRiskLosing: number;
  /** Money exposed in periods never measured — unknown, not safe. */
  valueAtRiskUnmeasured: number;
  totalValueAtRisk: number;
}

export function summarisePosition(rows: PeriodPosition[]): PositionSummary {
  const n = (v: PeriodVerdict) => rows.filter((r) => r.verdict === v).length;
  const sum = (f: (r: PeriodPosition) => boolean) =>
    rows.filter(f).reduce((s, r) => s + r.valueAtRisk, 0);
  return {
    periods: rows.length,
    losing: n('losing'), level: n('level'), thin: n('thin'),
    healthy: n('healthy'), overshoot: n('overshoot'), unmeasured: n('unmeasured'),
    openNights: rows.reduce((s, r) => s + r.openNights, 0),
    valueAtRiskLosing: sum((r) => r.verdict === 'losing'),
    valueAtRiskUnmeasured: sum((r) => r.verdict === 'unmeasured'),
    totalValueAtRisk: sum(() => true),
  };
}
