/**
 * parityPositions — load the per-period parity board, server-side.
 *
 * `buildPeriodPositions` is pure and shared by the admin Position tab and
 * `scripts/pricing-position.ts`. The DATA LOADING was not shared: the screen goes
 * through a server action that needs a request scope for its auth check, so the
 * script had to duplicate it. The season pack would have made that a third copy,
 * and three copies of a loader is the drift this repo keeps warning about — so
 * it lives here once, and the script now calls it.
 *
 * Server-only (Admin SDK). Read-only.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods } from '@/services/periodService';
import { getParityConfig, getStandingDiscounts, getSettingsChanges } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { partiesFor, partyForGuests } from '@/lib/parity/party';
import { buildParityWindow } from '@/lib/parity/parityView';
import { buildPeriodPositions, summarisePosition } from '@/lib/parity/pricingPosition';
import type { DayFact, PeriodPosition, PositionSummary, WindowFact } from '@/lib/parity/pricingPosition';

/** How stale an observation may be before `parityView` sets it aside. */
const FRESHNESS_DAYS = 42;

export interface PeriodPositionsResult {
  rows: PeriodPosition[];
  summary: PositionSummary;
  asOf: string;
}

/**
 * Build the position board for a property as of `asOf` (default today).
 *
 * Never throws: a property with no parity observations yields periods whose
 * verdict is `unmeasured`, which is the honest answer and is exactly what the
 * season allocator needs in order to say "never checked" rather than "fine".
 */
export async function loadPeriodPositions(
  propertyId: string,
  asOf?: string
): Promise<PeriodPositionsResult> {
  const today = asOf ?? new Date().toISOString().slice(0, 10);
  const cfg = await getParityConfig(propertyId);
  const db = await getAdminDb();

  // The party mix decides what a headcount MEANS. A row measured under a
  // different mix is a different product, and parityView sets it aside rather
  // than averaging it in.
  const propDoc = await db.collection('properties').doc(propertyId).get();
  const mix = partiesFor((propDoc.data() as { channelPricing?: unknown } | undefined)?.channelPricing);

  const obs = [...(await latestByCell(propertyId, { kind: 'self' })).values()];
  const byWindow = new Map<
    string,
    {
      checkIn: string; checkOut: string; nights: number; guests: number;
      expectedParty: { adults: number; children: number }; observations: unknown[];
    }
  >();
  for (const o of obs) {
    if (o.checkOut < today) continue;
    const k = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!byWindow.has(k)) {
      byWindow.set(k, {
        checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests,
        expectedParty: partyForGuests(mix.parties, o.guests), observations: [],
      });
    }
    byWindow.get(k)!.observations.push({
      channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null,
      listTotal: o.listTotal ?? null, promoActive: o.promoActive,
      ratePlan: (o as { ratePlan?: string }).ratePlan, reason: o.reason, capturedAt: o.capturedAt,
      party: (o as { party?: { adults: number; children: number } }).party,
    });
  }

  const inScope = ['direct', ...cfg.channels.map((c) => c.channel)].filter((c) => c !== 'vrbo');
  const standingDiscounts = await getStandingDiscounts(propertyId);
  const settingsChanges = await getSettingsChanges(propertyId);
  const economics = Object.fromEntries(cfg.channels.map((c) => [c.channel, c]));
  const views = [...byWindow.values()].map((w) =>
    buildParityWindow(w as never, {
      freshnessDays: FRESHNESS_DAYS, settingsChanges, targetDiscountPct: cfg.targetDiscountPct,
      direct: cfg.direct, economics, channelsInScope: inScope, standingDiscounts,
    })
  );

  const periods = (await getPeriods(propertyId))
    .filter((p) => p.status === 'active' && p.endDate > today)
    .map((p) => ({
      id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate, tier: p.tier,
      minStay: p.minStay ?? null, fixedNightPrice: p.fixedNightPrice ?? null,
    }));

  const months = new Set<string>();
  for (const p of periods) {
    const d = new Date(`${p.startDate}T00:00:00Z`);
    const e = new Date(`${p.endDate}T00:00:00Z`);
    while (d <= e) {
      months.add(d.toISOString().slice(0, 7));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }

  const days: DayFact[] = [];
  for (const ym of months) {
    const [c, a] = await Promise.all([
      db.collection('priceCalendars').doc(`${propertyId}_${ym}`).get(),
      db.collection('availability').doc(`${propertyId}_${ym}`).get(),
    ]);
    const cd =
      (c.data() as { days?: Record<string, { adjustedPrice?: number; isWeekend?: boolean }> } | undefined)?.days ?? {};
    const am = (a.data() as { available?: Record<string, boolean> } | undefined)?.available ?? {};
    for (const [k, v] of Object.entries(cd)) {
      const date = `${ym}-${String(k).padStart(2, '0')}`;
      if (date < today) continue;
      days.push({ date, available: am[k] !== false, price: v.adjustedPrice ?? null, isWeekend: Boolean(v.isWeekend) });
    }
  }

  const windows: WindowFact[] = views.map((w) => ({
    checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests, verdict: w.verdict,
    gapPct: w.gapPct, direct: w.direct, bestChannel: w.best?.channel ?? null,
    bestPrice: w.best?.effective ?? null, floor: w.floor, targetPrice: w.targetPrice,
    oldestAgeDays: w.oldestAgeDays,
  }));

  const rows = buildPeriodPositions(periods, days, windows);
  return { rows, summary: summarisePosition(rows), asOf: today };
}

/**
 * A date -> {period, verdict} lookup for the season pack.
 *
 * A date no active period covers returns null, and the caller must treat that as
 * `unmeasured` rather than as safe. "Never checked" is a finding.
 */
export function periodVerdictLookup(rows: PeriodPosition[]) {
  return (ymd: string): { id: string; name: string; verdict: PeriodPosition['verdict'] } | null => {
    const p = rows.find((r) => ymd >= r.startDate && ymd <= r.endDate);
    return p ? { id: p.id, name: p.name, verdict: p.verdict } : null;
  };
}
