#!/usr/bin/env npx tsx
/**
 * Apply the ladder change and the per-period rates as ONE operation.
 *
 * WHY TOGETHER. Removing the 3-night discount raises every 3-night stay by about 11% the instant it
 * lands. Measured on the live board, doing that alone would flip 22 Sep from 1% under Airbnb to 10%
 * OVER, 19 Oct from -3% to +8%, and Christmas from +10% to +22% - it would make him the expensive
 * option on his most common stay shape. The rates that compensate must land in the same write, not in
 * six separate saves a minute apart.
 *
 * So: the ladder and every rate go into one batch, then ONE compile, then ONE calendar regeneration.
 * There is no interval in which the site is priced half-way through the change.
 *
 * Rates are re-solved here from live data rather than hardcoded, so this cannot apply a number that
 * was true three hours ago. --dry-run prints exactly what would move and writes nothing.
 *
 *   npx tsx scripts/apply-band-pricing.ts <slug>            # dry run
 *   npx tsx scripts/apply-band-pricing.ts <slug> --write
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { getPeriods, upsertPeriods, compileAndWrite } from '@/services/periodService';
import { getParityConfig } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { partiesFor, partyForGuests } from '@/lib/parity/party';
import { buildParityWindow } from '@/lib/parity/parityView';
import { bestRateForBand, spreadAt, isFlatRate, type NightFact, type StayEconomics } from '@/lib/pricing/priceProjection';
import { DEFAULT_TIER_MULTIPLIERS } from '@/lib/pricing/periods';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const WRITE = process.argv.includes('--write');
/**
 * Periods to leave alone. Christmas is the default candidate: its rate would be re-solved off ONE
 * window (25-28 Dec) probed at three party sizes, which is thin evidence for a 22% cut on the year's
 * most valuable week. Three readings of the same dates are not three independent measurements.
 */
/**
 * Explicit per-period rates, bypassing the solver: `--rate "Christmas=1051"`.
 *
 * Needed because SKIP is not neutral. Excluding a period from the RATE change does not exclude it
 * from the LADDER change, which is global - so skipping Christmas still took the 11% rise that
 * dropping the 3-night rung causes, with nothing to offset it, and moved it from 10% to 22% dearer
 * than Airbnb on the only stay shape ever measured there. An explicit rate is how a period gets held
 * where it was without pretending the solver chose it.
 */
const RATES = (() => {
  const out: Record<string, number> = {};
  const i = process.argv.indexOf('--rate');
  if (i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    for (const pair of process.argv[i + 1].split(',')) {
      const [k, v] = pair.split('=');
      if (k && v) out[k.trim().toLowerCase()] = Number(v);
    }
  }
  return out;
})();

const SKIP = (() => {
  const i = process.argv.indexOf('--skip');
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1].split(',').map((x) => x.trim().toLowerCase()) : [];
})();
/** The rung neither platform offers, so it is pure giveaway on the owner's most common stay shape. */
const DROP_THRESHOLD = 3;

(async () => {
  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as Record<string, any>;
  const cfg = await getParityConfig(SLUG);
  const mix = partiesFor(prop.channelPricing);
  const weekendAdjustment = prop.pricingConfig?.weekendAdjustment ?? 1;
  const tierMultipliers = prop.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;

  const ladderNow = (prop.pricingConfig?.lengthOfStayDiscounts ?? []) as Array<Record<string, any>>;
  const ladderNext = ladderNow.filter((d) => d.nightsThreshold !== DROP_THRESHOLD);
  const econNext: StayEconomics = {
    baseOccupancy: prop.baseOccupancy, extraGuestFee: prop.extraGuestFee ?? 0,
    cleaningFee: prop.cleaningFee ?? 0, lengthOfStayDiscounts: ladderNext as any,
  };

  // Forward nights, from the calendars the engine actually serves.
  const nights = new Map<string, NightFact>();
  const today = new Date().toISOString().slice(0, 10);
  for (let m = 0; m < 14; m++) {
    const ym = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 + m, 1)).toISOString().slice(0, 7);
    const c = await db.collection('priceCalendars').doc(`${SLUG}_${ym}`).get();
    if (!c.exists) continue;
    for (const [dn, x] of Object.entries<any>((c.data() as any).days ?? {})) {
      const d = `${ym}-${dn.padStart(2, '0')}`;
      nights.set(d, { date: d, price: x.adjustedPrice, pricesByGuests: x.prices,
        isWeekend: !!x.isWeekend, available: true, flatRate: isFlatRate(x.prices) });
    }
  }

  // Measured windows, through the same builder the admin uses.
  const obs = [...(await latestByCell(SLUG)).values()].filter((o) => o.checkOut >= today);
  const byW = new Map<string, any>();
  for (const o of obs) {
    const k = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!byW.has(k)) byW.set(k, { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests,
      expectedParty: partyForGuests(mix.parties, o.guests), observations: [] });
    byW.get(k).observations.push({ channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null,
      listTotal: o.listTotal ?? null, promoActive: o.promoActive, ratePlan: (o as any).ratePlan, reason: o.reason,
      capturedAt: o.capturedAt, sessionState: o.sessionState, party: (o as any).party });
  }
  const inScope = ['direct', ...cfg.channels.map((c) => c.channel)].filter((c) => c !== 'vrbo');
  const wins = [...byW.values()].map((w) => buildParityWindow(w, { freshnessDays: 42,
    targetDiscountPct: cfg.targetDiscountPct, direct: cfg.direct,
    economics: Object.fromEntries(cfg.channels.map((c) => [c.channel, c])), channelsInScope: inScope }));

  const stayNights = (ci: string, co: string) => {
    const out: NightFact[] = []; const d = new Date(ci + 'T00:00:00Z'), e = new Date(co + 'T00:00:00Z');
    while (d < e) { const n = nights.get(d.toISOString().slice(0, 10)); if (n) out.push(n); d.setUTCDate(d.getUTCDate() + 1); }
    return out;
  };

  const periods = (await getPeriods(SLUG)).filter((p) => p.status === 'active' && p.endDate >= today);
  const changes: Array<{ p: any; rate: number; inBand: number; dearer: number; stays: number }> = [];
  const skipped: string[] = [];

  for (const p of periods) {
    if (SKIP.includes(p.name.toLowerCase()) || SKIP.includes(p.slug)) { skipped.push(p.name); continue; }
    const forced = RATES[p.name.toLowerCase()] ?? RATES[p.slug];
    if (forced !== undefined) {
      changes.push({ p, rate: forced, inBand: -1, dearer: -1, stays: 0 });
      continue;
    }
    // Only stays this period fully controls: the lever cannot move nights governed elsewhere.
    const arr = wins.filter((w) => {
      if (!w.best || w.direct == null) return false;
      const ns = stayNights(w.checkIn, w.checkOut);
      if (ns.length !== w.nights) return false;
      return w.checkIn >= p.startDate && ns[ns.length - 1].date <= p.endDate;
    }).map((w) => ({ nights: stayNights(w.checkIn, w.checkOut), guests: w.guests,
                     bestPrice: w.best!.effective, floor: w.floor ?? null }));
    if (!arr.length) continue;
    const flatRate = Boolean(p.flatRate);
    const r = bestRateForBand(arr, { flatRate, useWeekendUplift: !flatRate },
      { weekendAdjustment, econ: econNext });
    if (!r) continue;
    const sp = spreadAt(r.rate, arr, { flatRate, useWeekendUplift: !flatRate }, { weekendAdjustment, econ: econNext });
    changes.push({ p, rate: r.rate, inBand: sp.inBand, dearer: sp.dearer, stays: arr.length });
  }

  console.log(`${SLUG}\n`);
  console.log('1. length-of-stay ladder');
  console.log(`   was: ${ladderNow.map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join('  ')}`);
  console.log(`   now: ${ladderNext.map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join('  ')}`);
  console.log('\n2. period rates (weekday; the weekend uplift still applies on top)');
  for (const c of changes) {
    const cur = c.p.weekdayRate ?? c.p.fixedNightPrice ?? Math.round((prop.pricePerNight ?? 0) * (tierMultipliers[c.p.tier] ?? 1));
    const lever = c.p.flatRate ? 'flat' : 'rate';
    const verdict = c.inBand < 0 ? 'set by hand, solver not used' : `${c.inBand}/${c.stays} in band, ${c.dearer} dearer`;
    console.log(`   ${c.p.name.padEnd(18)} ${String(cur).padStart(5)} -> ${String(c.rate).padStart(5)} (${lever})   ${verdict}`);
  }

  if (skipped.length) console.log(`\n   left unchanged: ${skipped.join(', ')}`);
  if (!WRITE) { console.log('\nDry run. Nothing written. Re-run with --write to apply.'); process.exit(0); }

  // ---- one batch, one compile, one regeneration ----
  await db.collection('properties').doc(SLUG).set(
    { pricingConfig: { ...(prop.pricingConfig ?? {}), lengthOfStayDiscounts: ladderNext },
      updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  await upsertPeriods(changes.map((c) => ({
    ...c.p,
    ...(c.p.flatRate ? { fixedNightPrice: c.rate } : { weekdayRate: c.rate, fixedNightPrice: null }),
  })), 'scripts/apply-band-pricing');

  const compiled = await compileAndWrite(SLUG, { tierMultipliers, basePrice: prop.pricePerNight, dryRun: false });
  console.log(`\n  compiled: ${compiled.seasonsWritten} season(s), ${compiled.overridesWritten} override(s)` +
              `, ${compiled.seasonsDeleted.length + compiled.overridesDeleted.length} removed` +
              `${compiled.warnings.length ? `, ${compiled.warnings.length} warning(s)` : ''}`);
  for (const w of compiled.warnings) console.log(`    ! ${w.message}`);

  const { generatePriceCalendar } = await import('@/app/admin/pricing/server-actions-hybrid');
  const gen = await generatePriceCalendar(SLUG);
  console.log(`  calendars: ${gen.success ? `regenerated ${gen.months ?? ''}` : `FAILED - ${gen.error}`}`);

  loggers.adminPricing.info('Band pricing applied', { property: SLUG,
    ladder: ladderNext.length, periods: changes.length });
  console.log('\nDone. Ladder and rates landed in one write.');
  process.exit(0);
})();
