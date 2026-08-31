'use server';

/**
 * The year board's data, and the only write path in the pricing admin that changes a guest-facing price.
 *
 * READS assemble one screen: every forward night, the periods that govern them, where each stands
 * against the platforms, what is uncovered, and what to do about it.
 *
 * WRITES go through the period model, never around it. The old admin let the owner edit
 * `seasonalPricing` rows directly, but all 16 live rows carry `provenance.source: 'period-compiler'`
 * and `compileAndWrite` re-emits them with `{merge:true}` — so a multiplier typed into that table, or
 * a season switched off with its toggle, was silently reverted by the next compile. Here the edit
 * lands on the PERIOD, then compiles down, which is the direction the model actually flows.
 *
 * Every write is preview-then-apply. There is no staging environment: a save here changes what a
 * guest is quoted on the live site within one calendar regeneration, so the owner sees the exact
 * nights and the exact prices before anything is written.
 *
 * NOTE: a 'use server' file may only export async functions. Types live in `@/lib/pricing/yearBoard`
 * and `@/lib/pricing/priceProjection`.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods, upsertPeriods, compileAndWrite } from '@/services/periodService';
import { buildPeriodPositions, summarisePosition, type WindowFact } from '@/lib/parity/pricingPosition';
import { DEFAULT_TIER_MULTIPLIERS, TIERS, type TierMultipliers, type PricingPeriod } from '@/lib/pricing/periods';
import {
  isFlatRate, previewPeriodChange, nightlyChargeToday,
  type NightFact, type StayEconomics, type PeriodProposal,
} from '@/lib/pricing/priceProjection';
import { findCoverageGaps, buildRecommendation, eachDate, type BoardPeriod } from '@/lib/pricing/yearBoard';
import { fetchParityView } from './parity-actions';
import { regenerateCalendarsAfterChange } from './server-actions-hybrid';

const logger = loggers.adminPricing;

/** How far forward the board looks. Beyond this the calendar is speculative rather than sellable. */
const HORIZON_MONTHS = 14;

interface BoardContext {
  basePrice: number;
  weekendAdjustment: number;
  tierMultipliers: TierMultipliers;
  econ: StayEconomics;
  currency: string;
  nights: Map<string, NightFact>;
  periods: PricingPeriod[];
  windows: WindowFact[];
  parityOk: boolean;
  parityError: string | null;
  /** How far under the cheapest platform direct should sit, from the channels config. Never guessed. */
  targetDiscountPct: number;
  today: string;
}

async function loadContext(propertyId: string): Promise<BoardContext> {
  const db = await getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  const [propSnap, periodDocs, parity] = await Promise.all([
    db.collection('properties').doc(propertyId).get(),
    getPeriods(propertyId),
    fetchParityView(propertyId),
  ]);
  const prop = (propSnap.data() ?? {}) as Record<string, unknown>;
  const pricingConfig = (prop.pricingConfig ?? {}) as Record<string, unknown>;

  // Every forward month with a calendar, not only the months periods happen to span — the whole point
  // is to SEE the months no period covers.
  const nights = new Map<string, NightFact>();
  const start = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < HORIZON_MONTHS; i++) {
    const ym = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    const [cal, avail] = await Promise.all([
      db.collection('priceCalendars').doc(`${propertyId}_${ym}`).get(),
      db.collection('availability').doc(`${propertyId}_${ym}`).get(),
    ]);
    if (!cal.exists) continue;
    const days = ((cal.data() ?? {}) as { days?: Record<string, Record<string, unknown>> }).days ?? {};
    // No availability doc means no booking has ever written one, i.e. the month is entirely open.
    const availMap = ((avail.data() ?? {}) as { available?: Record<string, boolean> }).available ?? {};
    for (const [dn, d] of Object.entries(days)) {
      const date = `${ym}-${dn.padStart(2, '0')}`;
      if (date < today) continue;
      const prices = (d.prices ?? null) as Record<string, number> | null;
      nights.set(date, {
        date,
        price: (d.adjustedPrice as number | undefined) ?? null,
        pricesByGuests: prices,
        isWeekend: Boolean(d.isWeekend),
        available: availMap[dn] !== false && d.available !== false,
        flatRate: isFlatRate(prices),
        sourceName: (d.seasonName as string | null) ?? (d.reason as string | null) ?? null,
      });
    }
  }

  return {
    basePrice: (prop.pricePerNight as number | undefined) ?? 0,
    weekendAdjustment: (pricingConfig.weekendAdjustment as number | undefined) ?? 1,
    tierMultipliers: (pricingConfig.tierMultipliers as TierMultipliers | undefined) ?? DEFAULT_TIER_MULTIPLIERS,
    econ: {
      baseOccupancy: (prop.baseOccupancy as number | undefined) ?? 1,
      extraGuestFee: (prop.extraGuestFee as number | undefined) ?? 0,
      cleaningFee: (prop.cleaningFee as number | undefined) ?? 0,
      lengthOfStayDiscounts: (pricingConfig.lengthOfStayDiscounts as StayEconomics['lengthOfStayDiscounts'] | undefined) ?? [],
    },
    currency: (prop.baseCurrency as string | undefined) ?? 'RON',
    nights,
    periods: periodDocs.filter((p) => p.status === 'active' && p.endDate >= today),
    windows: parity.ok ? (parity.windows as Array<Record<string, unknown>>).map(toWindowFact) : [],
    parityOk: parity.ok,
    parityError: parity.ok ? null : (parity.error ?? 'unknown'),
    targetDiscountPct: parity.ok
      ? ((parity.meta as { targetDiscountPct?: number } | undefined)?.targetDiscountPct ?? 0.10)
      : 0.10,
    today,
  };
}

function toWindowFact(w: Record<string, unknown>): WindowFact {
  return {
    checkIn: w.checkIn as string, checkOut: w.checkOut as string,
    nights: w.nights as number, guests: w.guests as number,
    verdict: w.verdict as string, gapPct: (w.gapPct as number | null) ?? null,
    direct: (w.direct as number | null) ?? null,
    bestChannel: (w.best as { channel: string } | null)?.channel ?? null,
    bestPrice: (w.best as { effective: number } | null)?.effective ?? null,
    floor: (w.floor as number | null) ?? null,
    targetPrice: (w.targetPrice as number | null) ?? null,
    oldestAgeDays: (w.oldestAgeDays as number) ?? Infinity,
  };
}

/**
 * Does this period actually CONTROL every night of this stay?
 *
 * Windows are matched to periods by check-in date elsewhere, which is fine for reporting but wrong
 * for arithmetic. A 5-night stay checking in on the last day of Late Fall spends four of its nights
 * in 1 Decembrie and Early Winter: repricing Late Fall moves exactly one of them. Solving a target or
 * a floor against such a stay produces a number that cannot be reached by the lever being offered —
 * it was pinning Late Fall's floor at 542 off a stay it barely touches.
 *
 * So anything that computes a PRICE uses full containment. Reporting still shows the straddlers.
 */
function periodControlsStay(
  w: { checkIn: string; checkOut: string },
  p: { startDate: string; endDate: string },
): boolean {
  const lastNight = eachDate(w.checkIn, w.checkOut).slice(0, -1).pop() ?? w.checkIn;
  return w.checkIn >= p.startDate && lastNight <= p.endDate;
}

/** The nights of one stay, check-in inclusive and check-out exclusive, as the booking engine reads them. */
function stayNights(ctx: BoardContext, checkIn: string, checkOut: string): NightFact[] {
  const out: NightFact[] = [];
  for (const d of eachDate(checkIn, checkOut)) {
    if (d === checkOut) break;
    const n = ctx.nights.get(d);
    if (n) out.push(n);
  }
  return out;
}

export async function fetchYearBoard(propertyId: string): Promise<{
  ok: boolean; error?: string; board?: unknown;
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    const ctx = await loadContext(propertyId);
    const allNights = [...ctx.nights.values()].sort((a, b) => a.date.localeCompare(b.date));

    const positions = buildPeriodPositions(
      ctx.periods.map((p) => ({
        id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate,
        tier: p.tier, minStay: p.minStay ?? null, fixedNightPrice: p.fixedNightPrice ?? null,
      })),
      allNights.map((n) => ({ date: n.date, available: n.available, price: n.price, isWeekend: n.isWeekend })),
      ctx.windows,
    );

    const byId = new Map(ctx.periods.map((p) => [p.id, p]));
    const boardPeriods: BoardPeriod[] = positions.map((p) => {
      const doc = byId.get(p.id)!;
      const flatRate = Boolean(doc.flatRate);

      // Every measured window this period actually controls, not only the worst: the recommendation
      // has to respect the floor of ALL of them, or fixing the worst stay prices the rest below what
      // they are worth. Straddling stays are excluded because this lever cannot move most of them.
      const periodWindows = ctx.windows.filter((w) => periodControlsStay(w, p));
      const nightsByWindow = new Map<string, NightFact[]>();
      for (const w of periodWindows) {
        nightsByWindow.set(`${w.checkIn}|${w.checkOut}|${w.guests}`, stayNights(ctx, w.checkIn, w.checkOut));
      }

      return {
        ...p,
        tier: doc.tier,
        fixedNightPrice: doc.fixedNightPrice ?? null,
        flatRate,
        minStay: doc.minStay ?? null,
        recommendation: buildRecommendation(
          { ...p, flatRate },
          periodWindows,
          nightsByWindow,
          { basePrice: ctx.basePrice, weekendAdjustment: ctx.weekendAdjustment,
            tierMultipliers: ctx.tierMultipliers, econ: ctx.econ,
            targetDiscountPct: ctx.targetDiscountPct },
        ),
      };
    });

    const gaps = findCoverageGaps(allNights, ctx.periods, ctx.basePrice);
    const summary = summarisePosition(positions);

    // The uncovered money is reported alongside the covered money, never folded into it and never
    // omitted: the screen this replaces headlined a total that left 203 open nights out of the sum.
    const uncoveredValue = gaps.reduce((s, g) => s + g.value, 0);
    const uncoveredOpenNights = gaps.reduce((s, g) => s + g.openNights, 0);

    // One day cell per forward night, already carrying the verdict of whatever governs it, so the
    // calendar can be coloured without the client re-deriving anything.
    const verdictByDate = new Map<string, { periodId: string; verdict: string; name: string }>();
    for (const p of boardPeriods) {
      for (const d of eachDate(p.startDate, p.endDate)) {
        verdictByDate.set(d, { periodId: p.id, verdict: p.verdict, name: p.name });
      }
    }

    const days = allNights.map((n) => {
      const gov = verdictByDate.get(n.date);
      return {
        date: n.date,
        price: n.price,
        available: n.available,
        isWeekend: n.isWeekend,
        flatRate: n.flatRate,
        periodId: gov?.periodId ?? null,
        periodName: gov?.name ?? null,
        verdict: gov?.verdict ?? 'uncovered',
        sourceName: n.sourceName ?? null,
      };
    });

    return {
      ok: true,
      board: {
        currency: ctx.currency,
        basePrice: ctx.basePrice,
        tierMultipliers: ctx.tierMultipliers,
        tiers: TIERS,
        days,
        periods: boardPeriods,
        gaps,
        summary: {
          ...summary,
          uncoveredValue,
          uncoveredOpenNights,
          openNightsAll: summary.openNights + uncoveredOpenNights,
          totalValueAll: summary.totalValueAtRisk + uncoveredValue,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          parityAvailable: ctx.parityOk,
          parityError: ctx.parityError,
          measuredWindows: ctx.windows.length,
          horizonEnd: allNights.length ? allNights[allNights.length - 1].date : null,
          freshestReadingDays: ctx.windows.length
            ? Math.min(...ctx.windows.map((w) => w.oldestAgeDays).filter((n) => Number.isFinite(n)))
            : null,
        },
      },
    };
  } catch (e) {
    logger.error('failed to build the year board', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message };
  }
}

const proposalSchema = z.object({
  tier: z.enum(['min', 'low', 'base', 'medium', 'high', 'max']),
  // Bounded so a stray keystroke cannot publish a wild nightly rate to a live booking site.
  fixedNightPrice: z.coerce.number().min(1).max(100000).nullable(),
  minStay: z.coerce.number().int().min(1).max(30).nullable(),
  flatRate: z.boolean(),
});

async function buildPreview(ctx: BoardContext, period: PricingPeriod, proposal: PeriodProposal) {
  const periodNights = eachDate(period.startDate, period.endDate)
    .map((d) => ctx.nights.get(d))
    .filter((n): n is NightFact => !!n);

  // Same containment rule: projecting a straddling stay would apply this period's new price to nights
  // governed by a different period and overstate the change.
  const windows = ctx.windows.filter((w) => periodControlsStay(w, period));
  const nightsByWindow = new Map<string, NightFact[]>();
  for (const w of windows) {
    nightsByWindow.set(`${w.checkIn}|${w.checkOut}|${w.guests}`, stayNights(ctx, w.checkIn, w.checkOut));
  }

  const preview = previewPeriodChange(periodNights, windows, nightsByWindow, proposal, {
    basePrice: ctx.basePrice, weekendAdjustment: ctx.weekendAdjustment,
    tierMultipliers: ctx.tierMultipliers, econ: ctx.econ,
  });

  return {
    ...preview,
    periodId: period.id,
    periodName: period.name,
    startDate: period.startDate,
    endDate: period.endDate,
    currency: ctx.currency,
    // The stay totals a guest would actually see, for the windows that drove the recommendation.
    sampleStays: preview.windows.slice(0, 6).map((w) => ({
      checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests,
      from: w.measuredDirect, to: w.projectedDirect,
      bestChannel: w.bestChannel, bestPrice: w.bestPrice,
      currentGapPct: w.currentGapPct, projectedGapPct: w.projectedGapPct,
      verified: w.modelCheck.ok, belowFloor: w.belowFloor, floor: w.floor,
    })),
  };
}

export async function previewPeriodProposal(
  propertyId: string, periodId: string, input: unknown,
): Promise<{ ok: boolean; error?: string; preview?: unknown }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${first.path.join('.')}: ${first.message}` };
  }

  try {
    const ctx = await loadContext(propertyId);
    const period = ctx.periods.find((p) => p.id === periodId);
    if (!period) return { ok: false, error: 'That period no longer exists.' };
    return { ok: true, preview: await buildPreview(ctx, period, parsed.data) };
  } catch (e) {
    logger.error('failed to preview a period proposal', e as Error, { propertyId, periodId });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Write the proposal onto the period, compile it into the collections the engine reads, and rebuild
 * the calendars. This is the one place in the pricing admin that moves a guest-facing price.
 *
 * The order matters and is not interchangeable: the period is the source, the compile projects it
 * onto `seasonalPricing`/`dateOverrides`, and only then do the calendars mean anything. Writing the
 * season first — which is what the old Rules tab did — leaves the period disagreeing with the engine
 * until someone re-runs a script, and the next compile reverts the edit.
 */
export async function applyPeriodProposal(
  propertyId: string, periodId: string, input: unknown,
): Promise<{ ok: boolean; error?: string; applied?: unknown }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `${first.path.join('.')}: ${first.message}` };
  }

  try {
    const ctx = await loadContext(propertyId);
    const period = ctx.periods.find((p) => p.id === periodId);
    if (!period) return { ok: false, error: 'That period no longer exists.' };

    // Recomputed here rather than trusted from the client: the preview the owner approved was built
    // from data that may have moved, and the log should record what was actually done.
    const before = await buildPreview(ctx, period, parsed.data);

    const updated: PricingPeriod = {
      ...period,
      tier: parsed.data.tier,
      fixedNightPrice: parsed.data.fixedNightPrice,
      minStay: parsed.data.minStay,
      flatRate: parsed.data.flatRate,
    };

    await upsertPeriods([updated], 'admin/year-board');
    const compiled = await compileAndWrite(propertyId, {
      tierMultipliers: ctx.tierMultipliers,
      dryRun: false,
    });
    await regenerateCalendarsAfterChange(propertyId);

    logger.info('Period repriced from the year board', {
      propertyId, periodId,
      tier: parsed.data.tier, fixedNightPrice: parsed.data.fixedNightPrice,
      nightsChanged: before.changedNights.length,
      seasonsWritten: compiled.seasonsWritten, overridesWritten: compiled.overridesWritten,
      seasonsDeleted: compiled.seasonsDeleted.length, overridesDeleted: compiled.overridesDeleted.length,
      warnings: compiled.warnings.length,
    });

    revalidatePath('/admin/pricing');
    return {
      ok: true,
      applied: {
        nightsChanged: before.changedNights.length,
        weekday: before.weekday,
        weekend: before.weekend,
        warnings: compiled.warnings.map((w) => w.message),
      },
    };
  } catch (e) {
    logger.error('failed to apply a period proposal', e as Error, { propertyId, periodId });
    return { ok: false, error: (e as Error).message };
  }
}
