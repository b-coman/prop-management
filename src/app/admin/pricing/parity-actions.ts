'use server';

/**
 * Reading the parity picture for the admin screen.
 *
 * READ-ONLY. Nothing here changes a price, on the site or on any channel — the system has no write
 * access to the OTAs, and the direct price is changed through the periods/compiler path, deliberately
 * not from a dashboard that is showing you comparisons.
 *
 * NOTE: a 'use server' file may only export async functions. Types live in `@/lib/parity/parityView`.
 */
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { getParityConfig } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { buildParityWindow, summarise } from '@/lib/parity/parityView';
import { buildPeriodPositions, summarisePosition } from '@/lib/parity/pricingPosition';
import type { DayFact, WindowFact, PeriodInput } from '@/lib/parity/pricingPosition';
import { getPeriods } from '@/services/periodService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { ParityWindowInput, ParityObservationLite } from '@/lib/parity/parityView';

const logger = loggers.parity;

export async function fetchParityView(propertyId: string, opts?: { includeVrbo?: boolean }): Promise<{
  ok: boolean;
  error?: string;
  windows?: unknown[];
  summary?: unknown;
  meta?: unknown;
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    // getParityConfig THROWS when a channel has no stated economics — it never guesses a commission,
    // because a parity verdict computed against a guessed rate looks authoritative and is wrong in a
    // direction the reader cannot see.
    const cfg = await getParityConfig(propertyId);
    const observed = [...(await latestByCell(propertyId)).values()];

    const today = new Date().toISOString().slice(0, 10);
    const byWindow = new Map<string, ParityWindowInput>();
    for (const o of observed) {
      // A stay already past cannot be re-captured and cannot be sold. It is history, not a decision.
      if (o.checkOut < today) continue;
      const key = `${o.checkIn}|${o.checkOut}|${o.guests}`;
      if (!byWindow.has(key)) {
        byWindow.set(key, { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests, observations: [] });
      }
      const lite: ParityObservationLite = {
        channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null,
        listTotal: o.listTotal ?? null, promoActive: o.promoActive, ratePlan: (o as { ratePlan?: string }).ratePlan,
        reason: o.reason, capturedAt: o.capturedAt, sessionState: o.sessionState,
      };
      byWindow.get(key)!.observations.push(lite);
    }

    const inScope = ['direct', ...cfg.channels.map((c) => c.channel)]
      .filter((c) => (opts?.includeVrbo ? true : c !== 'vrbo'));
    const economics = Object.fromEntries(cfg.channels.map((c) => [c.channel, c]));

    const windows = [...byWindow.values()]
      .map((w) => buildParityWindow(w, {
        freshnessDays: 42,
        targetDiscountPct: cfg.targetDiscountPct,
        direct: cfg.direct,
        economics,
        channelsInScope: inScope,
      }))
      .sort((a, b) => {
        // Worst first, and within a verdict, soonest first — the thing you can still act on.
        const rank: Record<string, number> = { losing: 0, overshoot: 1, thin: 2, partial: 3, healthy: 4, unknown: 5 };
        return (rank[a.verdict] ?? 9) - (rank[b.verdict] ?? 9) || a.checkIn.localeCompare(b.checkIn);
      });

    return {
      ok: true,
      windows,
      summary: summarise(windows),
      meta: {
        propertyId,
        generatedAt: new Date().toISOString(),
        targetDiscountPct: cfg.targetDiscountPct,
        channelsInScope: inScope,
        excluded: opts?.includeVrbo ? [] : ['vrbo'],
        observationCount: observed.length,
      },
    };
  } catch (e) {
    logger.error('failed to build the parity view', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message };
  }
}


/**
 * The position roll-up: every forward period with how full it is, what it costs, where it stands
 * against the channels, and how much money is exposed. One row per thing the owner can act on.
 *
 * Reads calendars and availability directly rather than through the public check-pricing API, which
 * is rate limited to 60/min and would be swamped by a whole-horizon sweep.
 */
export async function fetchPricingPosition(propertyId: string): Promise<{
  ok: boolean; error?: string; rows?: unknown[]; summary?: unknown; meta?: unknown;
}> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: 'Not authorised for this property.' };
    throw e;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const [periodDocs, parity] = await Promise.all([
      getPeriods(propertyId),
      fetchParityView(propertyId),
    ]);

    const periods: PeriodInput[] = periodDocs
      .filter((p) => p.status === 'active' && p.endDate > today)
      .map((p) => ({ id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate,
        tier: p.tier, minStay: p.minStay ?? null, fixedNightPrice: p.fixedNightPrice ?? null }));

    // Months the periods actually span — no point reading a year of calendars for a 4-night period.
    const months = new Set<string>();
    for (const p of periods) {
      const d = new Date(`${p.startDate}T00:00:00Z`);
      const end = new Date(`${p.endDate}T00:00:00Z`);
      while (d <= end) { months.add(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
    }

    const db = await getAdminDb();
    const days: DayFact[] = [];
    for (const ym of months) {
      const [cal, avail] = await Promise.all([
        db.collection('priceCalendars').doc(`${propertyId}_${ym}`).get(),
        db.collection('availability').doc(`${propertyId}_${ym}`).get(),
      ]);
      const calDays = (cal.data() as { days?: Record<string, { adjustedPrice?: number; isWeekend?: boolean }> } | undefined)?.days ?? {};
      // No availability doc means no booking has ever written one for that month, i.e. the month is
      // entirely open — confirmed-empty inventory, not missing data.
      const availMap = (avail.data() as { available?: Record<string, boolean> } | undefined)?.available ?? {};
      for (const [dayNum, d] of Object.entries(calDays)) {
        const date = `${ym}-${String(dayNum).padStart(2, '0')}`;
        if (date < today) continue;
        days.push({ date, available: availMap[dayNum] !== false,
          price: d.adjustedPrice ?? null, isWeekend: Boolean(d.isWeekend) });
      }
    }

    const windows: WindowFact[] = parity.ok
      ? (parity.windows as Array<Record<string, unknown>>).map((w) => ({
          checkIn: w.checkIn as string, checkOut: w.checkOut as string,
          nights: w.nights as number, guests: w.guests as number,
          verdict: w.verdict as string, gapPct: (w.gapPct as number | null) ?? null,
          direct: (w.direct as number | null) ?? null,
          bestChannel: (w.best as { channel: string } | null)?.channel ?? null,
          bestPrice: (w.best as { effective: number } | null)?.effective ?? null,
          floor: (w.floor as number | null) ?? null,
          targetPrice: (w.targetPrice as number | null) ?? null,
          oldestAgeDays: (w.oldestAgeDays as number) ?? Infinity,
        }))
      : [];

    const rows = buildPeriodPositions(periods, days, windows);
    return {
      ok: true, rows, summary: summarisePosition(rows),
      meta: { propertyId, generatedAt: new Date().toISOString(),
        parityAvailable: parity.ok, parityError: parity.ok ? null : parity.error,
        measuredWindows: windows.length },
    };
  } catch (e) {
    logger.error('failed to build the pricing position', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message };
  }
}
