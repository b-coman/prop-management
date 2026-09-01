#!/usr/bin/env npx tsx
/**
 * pricing-position — the same roll-up the admin Position tab shows, in the terminal.
 *
 * Shares `buildPeriodPositions` with the screen, so the two cannot drift and disagree. Only the data
 * loading is duplicated, because the screen's loader goes through a server action that requires a
 * request scope for the auth check and therefore cannot be called from a script.
 *
 *   npx tsx scripts/pricing-position.ts [slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods } from '@/services/periodService';
import { getParityConfig , getStandingDiscounts } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { partiesFor, partyForGuests } from '@/lib/parity/party';
import { buildParityWindow } from '@/lib/parity/parityView';
import { buildPeriodPositions, summarisePosition } from '@/lib/parity/pricingPosition';
import type { DayFact, WindowFact } from '@/lib/parity/pricingPosition';

const SLUG = process.argv[2] ?? 'prahova-mountain-chalet';
const n = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const cfg = await getParityConfig(SLUG);
    // The mix decides what a headcount MEANS. A stored row measured under a different mix is a
    // different product, and parityView sets it aside rather than averaging it in.
    const propDoc = await (await getAdminDb()).collection('properties').doc(SLUG).get();
    const mix = partiesFor((propDoc.data() as { channelPricing?: unknown } | undefined)?.channelPricing);
  const obs = [...(await latestByCell(SLUG)).values()];

  const byWindow = new Map<string, { checkIn: string; checkOut: string; nights: number; guests: number;
    expectedParty: { adults: number; children: number }; observations: unknown[] }>();
  for (const o of obs) {
    if (o.checkOut < today) continue;
    const k = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!byWindow.has(k)) byWindow.set(k, { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights,
      guests: o.guests, expectedParty: partyForGuests(mix.parties, o.guests), observations: [] });
    byWindow.get(k)!.observations.push({
      channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null, listTotal: o.listTotal ?? null,
      promoActive: o.promoActive, ratePlan: (o as { ratePlan?: string }).ratePlan, reason: o.reason, capturedAt: o.capturedAt,
      party: (o as { party?: { adults: number; children: number } }).party,
    });
  }
  const inScope = ['direct', ...cfg.channels.map((c) => c.channel)].filter((c) => c !== 'vrbo');
  const standingDiscounts = await getStandingDiscounts(SLUG);
  const economics = Object.fromEntries(cfg.channels.map((c) => [c.channel, c]));
  const views = [...byWindow.values()].map((w) =>
    buildParityWindow(w as never, { freshnessDays: 42, targetDiscountPct: cfg.targetDiscountPct,
      direct: cfg.direct, economics, channelsInScope: inScope, standingDiscounts }));

  const periods = (await getPeriods(SLUG)).filter((p) => p.status === 'active' && p.endDate > today)
    .map((p) => ({ id: p.id, name: p.name, startDate: p.startDate, endDate: p.endDate, tier: p.tier, minStay: p.minStay ?? null, fixedNightPrice: p.fixedNightPrice ?? null }));

  const months = new Set<string>();
  for (const p of periods) {
    const d = new Date(`${p.startDate}T00:00:00Z`), e = new Date(`${p.endDate}T00:00:00Z`);
    while (d <= e) { months.add(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  }
  const db = await getAdminDb();
  const days: DayFact[] = [];
  for (const ym of months) {
    const [c, a] = await Promise.all([
      db.collection('priceCalendars').doc(`${SLUG}_${ym}`).get(),
      db.collection('availability').doc(`${SLUG}_${ym}`).get(),
    ]);
    const cd = (c.data() as { days?: Record<string, { adjustedPrice?: number; isWeekend?: boolean }> } | undefined)?.days ?? {};
    const am = (a.data() as { available?: Record<string, boolean> } | undefined)?.available ?? {};
    for (const [k, v] of Object.entries(cd)) {
      const date = `${ym}-${String(k).padStart(2, '0')}`;
      if (date < today) continue;
      days.push({ date, available: am[k] !== false, price: v.adjustedPrice ?? null, isWeekend: Boolean(v.isWeekend) });
    }
  }

  const windows: WindowFact[] = views.map((w) => ({
    checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests, verdict: w.verdict,
    gapPct: w.gapPct, direct: w.direct, bestChannel: w.best?.channel ?? null, bestPrice: w.best?.effective ?? null,
    floor: w.floor, targetPrice: w.targetPrice, oldestAgeDays: w.oldestAgeDays,
  }));

  const rows = buildPeriodPositions(periods, days, windows);
  const s = summarisePosition(rows);
  const LABEL: Record<string, string> = { losing: 'you cost more', level: 'same price', thin: 'barely cheaper',
    healthy: 'you are cheaper', overshoot: 'you are too low', unmeasured: 'NOT CHECKED' };

  console.log(`\n${SLUG} — ${s.openNights} nights unsold, ${n(s.totalValueAtRisk)} lei`);
  console.log(`  ${n(s.valueAtRiskLosing)} lei in ${s.losing} period(s) where a platform is cheaper than you`);
  console.log(`  ${n(s.valueAtRiskUnmeasured)} lei in ${s.unmeasured} period(s) never checked\n`);
  console.log('period                 dates              occ  open    unsold   if a guest compares      oldest');
  console.log('-'.repeat(100));
  for (const r of rows) {
    console.log(
      `${r.name.slice(0, 21).padEnd(22)}${r.startDate.slice(5)}→${r.endDate.slice(5)}  ${String(r.occupancyPct).padStart(3)}% ${String(r.openNights).padStart(5)} ${n(r.valueAtRisk).padStart(9)}   ` +
      `${(LABEL[r.verdict] ?? r.verdict).padEnd(17)}${r.worstGapPct !== null ? ((r.worstGapPct > 0 ? '+' : '') + (r.worstGapPct * 100).toFixed(1) + '%').padStart(7) : '      -'}` +
      `${r.freshestAgeDays !== null ? `  ${r.freshestAgeDays}d` : '   -'}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
