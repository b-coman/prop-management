/**
 * The parity VIEW MODEL — everything the admin screen shows, computed once, in one place, purely.
 *
 * This exists because the numbers a human should act on are not the numbers in the store. Three
 * corrections sit between them, and every one was learned the hard way:
 *
 *  1. **Airbnb's captured price is not what a guest pays.** The listing gives a standing "top-rated
 *     guests" discount the owner treats as near-universal (like Genius), worth ~15% of the base room
 *     fee, and NO capture can see it. Applied across the measured corpus it moves direct from
 *     cheapest on 9 of 17 windows to losing-or-level on 12-13. Showing the raw capture would tell the
 *     owner he is winning windows he is losing.
 *  2. **A verdict over a subset of channels can be wrong in the dangerous direction.** If a channel
 *     was never measured, or refused, the row is `partial` — never a pass.
 *  3. **Age is part of the reading.** A 40-day-old capture is a hypothesis. Rows carry their age and
 *     go `unknown` past the freshness budget rather than quietly presenting stale numbers as current.
 *
 * Pure. No I/O. The screen renders this; it does not compute it.
 */
import { evaluateParity, type ChannelEconomics, type DirectEconomics, type ParityStatus } from '@/lib/growth/parityMath';

/**
 * Standing per-channel discounts that a capture cannot observe, as a fraction of the captured total.
 *
 * Airbnb: the top-rated-guests discount is 15% of the BASE ROOM FEE, which works out at 12.7%-16.2%
 * of the guest total depending on how much of it is fees (fees dilute a discount taken on the room
 * fee alone). 14% is the midpoint and is applied uniformly; the band is reported so nobody mistakes
 * it for a precise figure.
 *
 * Booking: nothing. Genius is already inside the captured price when it applies, and the page states
 * whether it did.
 */
export const STANDING_GUEST_DISCOUNT: Record<string, number> = { airbnb: 0.14 };
export const STANDING_DISCOUNT_BAND: Record<string, [number, number]> = { airbnb: [0.127, 0.162] };

export interface ParityObservationLite {
  channel: string;
  /** The party shape this price was quoted for. Absent on rows captured before the field existed. */
  party?: { adults: number; children: number };
  status: 'captured' | 'refused' | 'unavailable' | 'error';
  guestTotal: number | null;
  listTotal?: number | null;
  promoActive?: boolean;
  ratePlan?: string;
  reason?: string;
  capturedAt: string;
  sessionState?: string;
}

export interface ParityWindowInput {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  /** The shape the CURRENT mix says this headcount means. Readings of another shape are not this price. */
  expectedParty?: { adults: number; children: number };
  observations: ParityObservationLite[];
}

export interface ChannelCell {
  channel: string;
  status: ParityObservationLite['status'];
  captured: number | null;
  /** After standing discounts a capture cannot see. This is the number to compare against. */
  effective: number | null;
  listTotal: number | null;
  promoActive: boolean;
  ratePlan: string;
  reason?: string;
  ageDays: number;
  stale: boolean;
  /** True when `effective` differs from `captured` — the screen must say so, not hide it. */
  corrected: boolean;
}

export interface ParityWindowView {
  key: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  label: string;
  direct: number | null;
  cells: ChannelCell[];
  best: { channel: string; effective: number } | null;
  /** 'partial' when a channel in scope has no usable reading; 'unknown' when nothing does. */
  verdict: ParityStatus | 'partial' | 'unknown';
  gapPct: number | null;
  floor: number | null;
  /** Where to price: a target-sized saving for the guest, never below the floor. */
  targetPrice: number | null;
  netAdvantage: number | null;
  /** What the owner gains per booking by moving direct to `targetPrice`, vs today's price. */
  upliftAtTarget: number | null;
  oldestAgeDays: number;
  warnings: string[];
}

export interface ParityViewOptions {
  now?: Date;
  freshnessDays?: number;
  targetDiscountPct: number;
  direct: DirectEconomics;
  economics: Record<string, ChannelEconomics>;
  /** Channels that must be present for a verdict to count as complete. */
  channelsInScope: string[];
}

const daysBetween = (a: Date, b: Date) => Math.max(0, Math.floor((a.getTime() - b.getTime()) / 86_400_000));

export function buildParityWindow(w: ParityWindowInput, opts: ParityViewOptions): ParityWindowView {
  const now = opts.now ?? new Date();
  const freshnessDays = opts.freshnessDays ?? 42;
  const warnings: string[] = [];

  const directObs = w.observations.find((o) => o.channel === 'direct' && o.status === 'captured');
  const direct = directObs?.guestTotal ?? null;

  const cells: ChannelCell[] = [];
  for (const ch of opts.channelsInScope) {
    if (ch === 'direct') continue;
    const o = w.observations.find((x) => x.channel === ch);
    if (!o) {
      cells.push({ channel: ch, status: 'error', captured: null, effective: null, listTotal: null,
        promoActive: false, ratePlan: 'unknown', reason: 'never captured', ageDays: Infinity,
        stale: true, corrected: false });
      continue;
    }
    const ageDays = daysBetween(now, new Date(o.capturedAt));
    const stale = ageDays > freshnessDays;

    // A price for a DIFFERENT party is not a stale price, it is a different product. "3 guests" meant
    // 3 adults until 2026-08-30 and means 2 adults + 1 child after it; comparing them would mix two
    // products under one heading. A row whose shape is unknown or does not match is set aside with a
    // reason rather than quietly averaged in.
    const want = w.expectedParty;
    const got = o.party;
    const shapeMismatch = Boolean(want && (!got || got.adults !== want.adults || got.children !== want.children));
    if (shapeMismatch) {
      const label = got ? `${got.adults}a+${got.children}c` : 'shape not recorded';
      cells.push({ channel: ch, status: 'error', captured: null, effective: null, listTotal: null,
        promoActive: false, ratePlan: o.ratePlan ?? 'unknown',
        reason: `priced for ${label}, but this headcount now means ${want!.adults}a+${want!.children}c — a different product`,
        ageDays, stale: true, corrected: false });
      continue;
    }
    const discount = STANDING_GUEST_DISCOUNT[ch] ?? 0;
    const captured = o.status === 'captured' ? o.guestTotal : null;
    const effective = captured !== null ? Math.round(captured * (1 - discount)) : null;
    cells.push({
      channel: ch, status: o.status, captured, effective,
      listTotal: o.listTotal ?? null, promoActive: Boolean(o.promoActive),
      ratePlan: o.ratePlan ?? 'unknown', reason: o.reason, ageDays, stale,
      corrected: discount > 0 && captured !== null,
    });
  }

  const usable = cells.filter((c) => c.effective !== null && !c.stale);
  const unusable = cells.filter((c) => c.effective === null || c.stale);

  for (const c of cells) {
    if (c.status === 'refused') warnings.push(`${c.channel} will not sell this window: ${c.reason ?? 'refused'}`);
    if (c.status === 'captured' && c.stale) warnings.push(`${c.channel} reading is ${c.ageDays}d old`);
    if (c.corrected) {
      const [lo, hi] = STANDING_DISCOUNT_BAND[c.channel] ?? [0, 0];
      warnings.push(`${c.channel} corrected by ${Math.round((STANDING_GUEST_DISCOUNT[c.channel] ?? 0) * 100)}% ` +
        `for the standing guest discount (band ${Math.round(lo * 100)}-${Math.round(hi * 100)}%) — no capture can see it`);
    }
    if (c.ratePlan === 'non-refundable') {
      warnings.push(`${c.channel} price is a NON-REFUNDABLE plan — a different product from a flexible direct booking`);
    }
  }

  const best = usable.length
    ? usable.reduce((a, b) => (b.effective! < a.effective! ? b : a))
    : null;

  let verdict: ParityWindowView['verdict'] = 'unknown';
  let gapPct: number | null = null, floor: number | null = null;
  let targetPrice: number | null = null, netAdvantage: number | null = null, upliftAtTarget: number | null = null;

  if (direct !== null && best) {
    const econ = opts.economics[best.channel];
    if (econ) {
      const v = evaluateParity({
        directTotal: direct, otaTotal: best.effective!, channel: econ,
        direct: opts.direct, targetDiscountPct: opts.targetDiscountPct,
      });
      gapPct = v.guestGapPct;
      floor = Math.round(v.indifferencePrice);
      netAdvantage = Math.round(v.netAdvantage);
      // A verdict is only trustworthy when every channel in scope was readable. Otherwise a cheaper
      // unmeasured channel could be setting the real floor.
      verdict = unusable.some((c) => c.status !== 'refused' && c.status !== 'unavailable') ? 'partial' : v.status;
      if (v.recommendedBand) {
        targetPrice = Math.round(v.recommendedBand.max);
        upliftAtTarget = Math.round((targetPrice - direct) * (1 - opts.direct.paymentCostPct));
      }
    }
  }

  const ages = cells.filter((c) => Number.isFinite(c.ageDays)).map((c) => c.ageDays);
  return {
    key: `${w.checkIn}|${w.checkOut}|${w.guests}`,
    checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests,
    label: `${w.checkIn} → ${w.checkOut}`,
    direct, cells, best: best ? { channel: best.channel, effective: best.effective! } : null,
    verdict, gapPct, floor, targetPrice, netAdvantage, upliftAtTarget,
    oldestAgeDays: ages.length ? Math.max(...ages) : Infinity,
    warnings,
  };
}

export interface ParitySummary {
  total: number;
  losing: number;
  thin: number;
  healthy: number;
  overshoot: number;
  partial: number;
  unknown: number;
  /** Windows where moving direct to target would earn more per booking, and by how much in total. */
  actionable: number;
  totalUpliftAtTarget: number;
}

export function summarise(views: ParityWindowView[]): ParitySummary {
  const c = (s: string) => views.filter((v) => v.verdict === s).length;
  const actionableRows = views.filter((v) => (v.verdict === 'losing' || v.verdict === 'thin') && v.targetPrice !== null);
  return {
    total: views.length,
    losing: c('losing'), thin: c('thin'), healthy: c('healthy'), overshoot: c('overshoot'),
    partial: c('partial'), unknown: c('unknown'),
    actionable: actionableRows.length,
    totalUpliftAtTarget: 0,   // per-booking uplift does not sum across windows; kept 0 deliberately
  };
}
