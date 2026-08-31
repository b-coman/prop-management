/**
 * Which direct length-of-stay ladder holds the most stays in the band, given the owner's real
 * platform settings. Searches the rungs rather than guessing, and reports the trade-off honestly:
 * a stay where a platform is cheaper loses the booking; a stay far under the band gives away margin.
 */
import { loadStays, type Stay } from './parity-structure';
import { getChannels } from '@/services/channelService';
import { discountAt } from '@/lib/pricing/ladderCompare';
import type { StayEconomics } from '@/lib/pricing/priceProjection';

/**
 * Captures of 7-night-or-longer stays predate the 2026-09-01 weekly change (Airbnb -20% -> -25%,
 * Booking -30% -> -25%). The rate plan is a known multiplier on the standard rate, so those prices
 * are rescaled by the ratio rather than dropped. Estimates, flagged as such; only a fresh capture
 * settles which platform is now cheapest on a week-long stay.
 */
const WEEKLY_RESCALE: Record<string, number> = { airbnb: 0.75 / 0.80, 'booking.com': 0.75 / 0.70 };

const LO = -0.10, HI = -0.01;
type Ladder = Array<{ nightsThreshold: number; discountPercentage: number }>;
const losOf = (n: number, l: Ladder) => {
  const a = l.filter((d) => n >= d.nightsThreshold).sort((x, y) => y.nightsThreshold - x.nightsThreshold)[0];
  return a ? a.discountPercentage / 100 : 0;
};
function total(s: Stay, W: number, m: number, e: StayEconomics, l: Ladder) {
  const wd = s.n - s.weekendNights, we = s.weekendNights;
  return (W * (wd + m * we) + s.n * Math.max(0, s.g - e.baseOccupancy) * e.extraGuestFee + e.cleaningFee) * (1 - losOf(s.n, l));
}
function scorePeriod(ss: Stay[], m: number, e: StayEconomics, l: Ladder) {
  let r = { W: 0, inBand: -1, dearer: 99, below: 99 };
  for (let W = 150; W <= 2500; W += 1) {
    const gaps = ss.map((s) => (total(s, W, m, e, l) - s.bestPrice) / s.bestPrice);
    const inBand = gaps.filter((g) => g >= LO && g <= HI).length;
    const dearer = gaps.filter((g) => g > 0).length;
    const below = gaps.filter((g) => g < LO).length;
    if (inBand > r.inBand || (inBand === r.inBand && dearer < r.dearer)) r = { W, inBand, dearer, below };
  }
  return r;
}

(async () => {
  const { stays: raw, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;

  const stays = raw.map((s) => s.n >= 7
    ? { ...s, bestPrice: s.bestPrice * (WEEKLY_RESCALE[s.bestChannel] ?? 1) }
    : s);
  const restated = raw.filter((s) => s.n >= 7).length;

  // The platforms' own ladders, read from the channels collection rather than hardcoded here.
  const channels = await getChannels('prahova-mountain-chalet');
  const platform = [...channels.byId.values()]
    .filter((c) => c.channelId !== 'direct' && c.active && c.lengthOfStayDiscounts?.length);
  console.log('platform ladders, as recorded:');
  for (const c of platform) {
    console.log(`  ${c.displayName.padEnd(13)}`, (c.lengthOfStayDiscounts ?? [])
      .map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%${d.nonRefundable ? '(NR)' : ''}`).join('  '));
  }
  const cheapestAt = (n: number) => Math.max(0, ...platform
    .map((c) => { const r = discountAt(n, c.lengthOfStayDiscounts); return r && !r.nonRefundable ? r.discountPercentage : 0; }));
  console.log('\ncheapest comparable platform discount by length:');
  console.log('  ' + [2,3,4,5,6,7,10,14,28].map((n) => `${n}n:${cheapestAt(n)}%`).join('  '));
  console.log(`\n${restated} stay(s) of 7+ nights restated for the new weekly rates (estimates).\n`);
  const byPeriod = new Map<string, Stay[]>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }
  const N = [...byPeriod.values()].flat().length;
  const evaluate = (l: Ladder) => {
    let ib = 0, de = 0, be = 0;
    for (const ss of byPeriod.values()) { const r = scorePeriod(ss, m, econ, l); ib += r.inBand; de += r.dearer; be += r.below; }
    return { ib, de, be, outOfBand: N - ib };
  };

  const results: Array<{ label: string; l: Ladder; ib: number; de: number; be: number }> = [];
  for (const d3 of [0, 5, 10]) for (const d4 of [5, 10, 15]) for (const d5 of [d4, 15, 20]) for (const d7 of [20, 25, 30]) {
    if (d4 < d3 || d5 < d4 || d7 < d5) continue;
    const l: Ladder = [
      ...(d3 ? [{ nightsThreshold: 3, discountPercentage: d3 }] : []),
      { nightsThreshold: 4, discountPercentage: d4 },
      { nightsThreshold: 5, discountPercentage: d5 },
      { nightsThreshold: 7, discountPercentage: d7 },
      { nightsThreshold: 28, discountPercentage: 35 },
    ];
    const r = evaluate(l);
    results.push({ label: `3n ${d3}% · 4n ${d4}% · 5n ${d5}% · 7n ${d7}%`, l, ...r });
  }
  results.sort((a, b) => (b.ib - a.ib) || (a.de - b.de));

  const owner: Ladder = econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false)
    .map((d) => ({ nightsThreshold: d.nightsThreshold, discountPercentage: d.discountPercentage }));
  const o = evaluate(owner);

  console.log(`${N} measured stays across ${byPeriod.size} periods. Band = 1% to 10% under the cheapest platform.\n`);
  console.log('ladder'.padEnd(38), 'in band', 'platform cheaper', 'more than 10% under');
  console.log('YOURS TODAY (3n10 4n15 7n25 14n30)'.padEnd(38), String(o.ib).padStart(7), String(o.de).padStart(16), String(o.be).padStart(19));
  console.log('-'.repeat(84));
  for (const r of results.slice(0, 8)) {
    console.log(r.label.padEnd(38), String(r.ib).padStart(7), String(r.de).padStart(16), String(r.be).padStart(19));
  }
  const top = results[0];
  console.log('\nBEST:', top.label);
  console.log('  per-period rates it implies:');
  for (const [pn, ss] of byPeriod) {
    const r = scorePeriod(ss, m, econ, top.l);
    console.log(`    ${pn.padEnd(18)} weekday ${String(r.W).padStart(5)}   ${r.inBand}/${ss.length} in band, ${r.dearer} dearer`);
  }
  process.exit(0);
})();
