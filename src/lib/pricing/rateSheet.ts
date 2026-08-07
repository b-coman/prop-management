/**
 * The rate sheet — periods × channels — and the push state machine that tracks getting it typed in.
 *
 * This is the replacement for the owner's spreadsheet, and it must be honest about one hard limit:
 * **the system cannot push prices to the OTAs.** There is no write API in play here. A human opens
 * three dashboards and types. So the sheet's `done?` checkbox becomes a state machine, and the UI's
 * job is to make typing errorless and verification automatic — not to pretend an integration exists.
 *
 * The sheet's own `done?` column already worked this way: the Booking price is wrapped in
 * `if(done? = true, …, "")`, so it is not merely a tracking tick — it gates whether the price is shown
 * at all. That is a workflow state, and it maps to `ChannelPush.status`.
 *
 * PURE. All gross-up maths comes from `parityMath`; nothing is recomputed here.
 */
import {
  channelNightly, grossUpFactor, type ChannelEconomics, type DirectEconomics, type Rounding,
} from '@/lib/growth/parityMath';
import { compilePeriods, datesInRange, type PricingPeriod, type TierMultipliers } from './periods';

export interface RateSheetChannelInput {
  channelId: string;
  economics: ChannelEconomics;
  extraAdjustmentPct?: number;
  rounding?: Rounding | null;
  cleaningFee?: number;
  currency: string;
  /** Units of the channel's currency per 1 unit of the base currency (VRBO: RON per USD). */
  fxRateToChannelCurrency?: number;
  fxAsOf?: string;
}

export interface RateSheetRow {
  periodId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  nights: number;
  channelId: string;
  /** The direct price this row is derived FROM — the anchor for every other channel. */
  directNightly: number;
  nightly: number;
  currency: string;
  cleaningFee: number | null;
  minStay: number | null;
  grossUpFactor: number;
  extraAdjustmentPct: number;
  /** Set when the row could not be computed, instead of emitting a fabricated price. */
  problem?: string;
}

export interface RateSheet {
  propertyId: string;
  /** Monotonic; a sheet is immutable once written. */
  version: number;
  basePrice: number;
  computedAt: string;
  rows: RateSheetRow[];
  warnings: string[];
}

export interface BuildRateSheetInput {
  propertyId: string;
  version: number;
  computedAt: string;
  periods: PricingPeriod[];
  tierMultipliers: TierMultipliers;
  /** `property.pricePerNight` — what every tier multiplies. */
  basePrice: number;
  direct: DirectEconomics;
  channels: RateSheetChannelInput[];
  defaultMinimumStay?: number;
  /** Only periods overlapping this window are included. */
  from?: string;
  to?: string;
}

/**
 * Build the sheet.
 *
 * The direct nightly price is taken from the COMPILED period, not recomputed — so the sheet and the
 * booking engine can never disagree about what direct costs. Weekend uplift is deliberately excluded:
 * the owner's sheet has separate weekday and weekend columns and the engine applies the weekend
 * multiplier per night, so a single per-period number here is the WEEKDAY rate. Mixing the two is how
 * a sheet ends up quietly pricing every night as a weekend.
 */
export function buildRateSheet(input: BuildRateSheetInput): RateSheet {
  const {
    propertyId, version, computedAt, periods, tierMultipliers, basePrice,
    direct, channels, defaultMinimumStay = 1, from, to,
  } = input;

  const warnings: string[] = [];
  const compiled = compilePeriods(periods, { tierMultipliers, defaultMinimumStay, compiledAt: computedAt });
  compiled.warnings.forEach((w) => warnings.push(`[${w.kind}] ${w.message}`));

  const periodById = new Map(periods.map((p) => [p.id, p]));
  const rows: RateSheetRow[] = [];

  /** One entry per compiled block, carrying the direct nightly price the engine will actually quote. */
  const blocks: Array<{ periodId: string; name: string; start: string; end: string; nightly: number; minStay: number | null }> = [];

  for (const s of compiled.seasons) {
    blocks.push({
      periodId: s.provenance.periodId ?? s.id,
      name: s.name,
      start: s.startDate,
      end: s.endDate,
      nightly: basePrice * s.priceMultiplier,
      minStay: s.minimumStay ?? null,
    });
  }
  // Fixed-price periods compile to one override per night; collapse them back to their period so the
  // sheet shows the four decisions rather than eleven rows.
  const fixedByPeriod = new Map<string, { dates: string[]; price: number; minStay: number | null }>();
  for (const o of compiled.overrides) {
    const pid = o.provenance.periodId ?? o.id;
    const e = fixedByPeriod.get(pid) ?? { dates: [], price: o.customPrice, minStay: o.minimumStay ?? null };
    e.dates.push(o.date);
    fixedByPeriod.set(pid, e);
  }
  for (const [pid, e] of fixedByPeriod) {
    const p = periodById.get(pid);
    e.dates.sort();
    blocks.push({
      periodId: pid,
      name: p?.name ?? pid,
      start: e.dates[0],
      end: e.dates[e.dates.length - 1],
      nightly: e.price,
      minStay: e.minStay,
    });
  }

  const inWindow = (b: { start: string; end: string }) =>
    (!from || b.end >= from) && (!to || b.start <= to);

  for (const b of blocks.filter(inWindow).sort((a, z) => a.start.localeCompare(z.start))) {
    const nights = datesInRange(b.start, b.end).length;

    rows.push({
      periodId: b.periodId, periodName: b.name, startDate: b.start, endDate: b.end, nights,
      channelId: 'direct',
      directNightly: round2(b.nightly),
      nightly: round2(b.nightly),
      currency: 'RON',
      cleaningFee: null,
      minStay: b.minStay,
      grossUpFactor: 1,
      extraAdjustmentPct: 0,
    });

    for (const ch of channels) {
      const extra = ch.extraAdjustmentPct ?? 0;
      const needsFx = ch.currency !== 'RON';
      if (needsFx && !ch.fxRateToChannelCurrency) {
        rows.push({
          periodId: b.periodId, periodName: b.name, startDate: b.start, endDate: b.end, nights,
          channelId: ch.channelId, directNightly: round2(b.nightly), nightly: 0,
          currency: ch.currency, cleaningFee: ch.cleaningFee ?? null, minStay: b.minStay,
          grossUpFactor: grossUpFactor(ch.economics, direct, extra), extraAdjustmentPct: extra,
          problem: `Lists in ${ch.currency} but no FX rate is recorded. Set channels/${ch.channelId}.fx — never auto-fetched, because a rate that moves on its own changes prices nobody decided to change.`,
        });
        continue;
      }
      rows.push({
        periodId: b.periodId, periodName: b.name, startDate: b.start, endDate: b.end, nights,
        channelId: ch.channelId,
        directNightly: round2(b.nightly),
        nightly: channelNightly(b.nightly, ch.economics, direct, {
          extraAdjustmentPct: extra,
          rounding: ch.rounding,
          fxRateToChannelCurrency: needsFx ? ch.fxRateToChannelCurrency : undefined,
        }),
        currency: ch.currency,
        cleaningFee: ch.cleaningFee ?? null,
        minStay: b.minStay,
        grossUpFactor: Number(grossUpFactor(ch.economics, direct, extra).toFixed(6)),
        extraAdjustmentPct: extra,
      });
    }
  }

  return { propertyId, version, basePrice, computedAt, rows, warnings };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- push tracking -------------------------------------------------------------------------------

export type PushStatus = 'pending' | 'applied' | 'verified' | 'drifted';

export interface ChannelPush {
  id: string;
  propertyId: string;
  channelId: string;
  periodId: string;
  rateSheetVersion: number;
  target: { nightly: number; currency: string; minStay: number | null; cleaningFee: number | null };
  status: PushStatus;
  appliedAt?: string;
  /** ONLY a human sets `applied`. The system cannot know a dashboard was edited. */
  appliedBy?: string;
  /** ONLY an ota-parity capture sets `verified`. */
  verificationObservationId?: string;
  verifiedAt?: string;
  note?: string;
}

export function pushId(propertyId: string, channelId: string, periodId: string): string {
  return `${propertyId}__${channelId}__${periodId}`;
}

/**
 * Diff a new rate sheet against what is already applied.
 *
 * A cell is `pending` when the number to type differs from the number last confirmed as typed. A cell
 * whose target is unchanged keeps its existing status — re-issuing a sheet must not silently reset
 * verified work back to pending, or the owner is asked to retype prices that are already correct.
 */
export function diffAgainstApplied(
  sheet: RateSheet,
  existing: ChannelPush[],
  opts: { tolerance?: number } = {},
): ChannelPush[] {
  const tolerance = opts.tolerance ?? 0.001;
  const byId = new Map(existing.map((p) => [p.id, p]));
  const out: ChannelPush[] = [];

  for (const row of sheet.rows) {
    if (row.channelId === 'direct') continue;   // direct is set by the engine, not typed anywhere
    if (row.problem) continue;                   // never ask someone to type a price we could not compute

    const id = pushId(sheet.propertyId, row.channelId, row.periodId);
    const prev = byId.get(id);
    const target = {
      nightly: row.nightly, currency: row.currency, minStay: row.minStay, cleaningFee: row.cleaningFee,
    };

    const unchanged = prev
      && Math.abs(prev.target.nightly - target.nightly) < tolerance
      && prev.target.currency === target.currency
      && prev.target.minStay === target.minStay
      && prev.target.cleaningFee === target.cleaningFee;

    out.push({
      id,
      propertyId: sheet.propertyId,
      channelId: row.channelId,
      periodId: row.periodId,
      rateSheetVersion: sheet.version,
      target,
      status: unchanged ? prev!.status : 'pending',
      ...(unchanged && prev?.appliedAt ? { appliedAt: prev.appliedAt, appliedBy: prev.appliedBy } : {}),
      ...(unchanged && prev?.verificationObservationId
        ? { verificationObservationId: prev.verificationObservationId, verifiedAt: prev.verifiedAt }
        : {}),
    });
  }
  return out;
}

/**
 * Judge an applied push against a real observation from the parity system.
 *
 * `drifted` is the valuable state and the reason this loop exists: it catches a channel promotion, a
 * typo, or a push someone believed they made. Without it, "applied" is just a claim.
 */
export function verifyPush(
  push: ChannelPush,
  observed: { nightlyEquivalent: number; observationId: string; capturedAt: string },
  opts: { tolerancePct?: number } = {},
): { status: PushStatus; note: string } {
  const tolerancePct = opts.tolerancePct ?? 0.03;   // under 3% is noise, not a discrepancy
  if (push.target.nightly <= 0) return { status: push.status, note: 'No target to verify against.' };

  const deltaPct = observed.nightlyEquivalent / push.target.nightly - 1;
  if (Math.abs(deltaPct) <= tolerancePct) {
    return {
      status: 'verified',
      note: `Observed ${observed.nightlyEquivalent.toFixed(0)} vs target ${push.target.nightly.toFixed(0)} (${(deltaPct * 100).toFixed(1)}%) — within tolerance.`,
    };
  }
  return {
    status: 'drifted',
    note:
      `Observed ${observed.nightlyEquivalent.toFixed(0)} vs target ${push.target.nightly.toFixed(0)} ` +
      `(${deltaPct > 0 ? '+' : ''}${(deltaPct * 100).toFixed(1)}%). A channel promotion, a typo, or a push that never happened.`,
  };
}
