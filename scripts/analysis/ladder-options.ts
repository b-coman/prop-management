/**
 * A handful of NAMED ladder choices, evaluated side by side, rather than whatever a search settles on.
 *
 * The search is optimising over 32 stays of which only 3 are a week or longer, and those three are
 * rescaled estimates after the 2026-09-01 weekly change. That is far too thin a basis on which to set
 * a standing rule for every long stay, and the search's pick (7n -20%) would leave direct 5 points
 * SHALLOWER than both platforms, so they would undercut every week-long booking by construction.
 *
 * The structural argument beats a 3-point fit: match the platforms' shape, and the nightly rate alone
 * then controls how far under them direct sits, at every stay length.
 */
import { loadStays, type Stay } from './parity-structure';
import { getChannels } from '@/services/channelService';
import { discountAt } from '@/lib/pricing/ladderCompare';
import type { StayEconomics } from '@/lib/pricing/priceProjection';

const LO = -0.10, HI = -0.01;
const WEEKLY_RESCALE: Record<string, number> = { airbnb: 0.75 / 0.80, 'booking.com': 0.75 / 0.70 };
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
  for (let W = 150; W <= 2500; W++) {
    const g = ss.map((s) => (total(s, W, m, e, l) - s.bestPrice) / s.bestPrice);
    const inBand = g.filter((x) => x >= LO && x <= HI).length;
    const dearer = g.filter((x) => x > 0).length;
    const below = g.filter((x) => x < LO).length;
    if (inBand > r.inBand || (inBand === r.inBand && dearer < r.dearer)) r = { W, inBand, dearer, below };
  }
  return r;
}

(async () => {
  const { stays: raw, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;
  const stays = raw.map((s) => s.n >= 7 ? { ...s, bestPrice: s.bestPrice * (WEEKLY_RESCALE[s.bestChannel] ?? 1) } : s);
  const channels = await getChannels('prahova-mountain-chalet');
  const platform = [...channels.byId.values()].filter((c) => c.channelId !== 'direct' && c.active && c.lengthOfStayDiscounts?.length);
  const cheapestAt = (n: number) => Math.max(0, ...platform
    .map((c) => { const r = discountAt(n, c.lengthOfStayDiscounts); return r && !r.nonRefundable ? r.discountPercentage : 0; }));

  const owner: Ladder = econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false)
    .map((d) => ({ nightsThreshold: d.nightsThreshold, discountPercentage: d.discountPercentage }));
  /** Exactly the shape the cheapest comparable platform uses. */
  const matched: Ladder = [4, 5, 7, 28].map((n) => ({ nightsThreshold: n, discountPercentage: cheapestAt(n) }))
    .filter((r) => r.discountPercentage > 0);

  const options: Array<[string, Ladder]> = [
    ['yours today                 3n10 4n15 5n15 7n25 14n30', owner],
    ['drop 3n only                     4n15 5n15 7n25 14n30', owner.filter((d) => d.nightsThreshold !== 3)],
    ['match the platforms         ' + matched.map((d) => `${d.nightsThreshold}n${d.discountPercentage}`).join(' '), matched],
    ['drop 3n + 14n               4n15 5n15 7n25', [
      { nightsThreshold: 4, discountPercentage: 15 }, { nightsThreshold: 5, discountPercentage: 15 },
      { nightsThreshold: 7, discountPercentage: 25 }, { nightsThreshold: 28, discountPercentage: 35 }]],
    ['search pick                 4n15 5n15 7n20', [
      { nightsThreshold: 4, discountPercentage: 15 }, { nightsThreshold: 5, discountPercentage: 15 },
      { nightsThreshold: 7, discountPercentage: 20 }, { nightsThreshold: 28, discountPercentage: 35 }]],
  ];

  const byPeriod = new Map<string, Stay[]>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }
  const N = [...byPeriod.values()].flat().length;

  console.log(`Band 1-10% under the cheapest platform · ${N} measured stays\n`);
  console.log('option'.padEnd(56), 'in band', 'platform cheaper', 'over 10% under');
  for (const [name, l] of options) {
    let ib = 0, de = 0, be = 0;
    for (const ss of byPeriod.values()) { const r = scorePeriod(ss, m, econ, l); ib += r.inBand; de += r.dearer; be += r.below; }
    console.log(name.padEnd(56), `${ib}/${N}`.padStart(7), String(de).padStart(16), String(be).padStart(15));
  }

  console.log('\nRATES under "drop 3n only" (keeps your shape aligned with the platforms at 7n):');
  const dropped = owner.filter((d) => d.nightsThreshold !== 3);
  for (const [pn, ss] of byPeriod) {
    const r = scorePeriod(ss, m, econ, dropped);
    console.log(`  ${pn.padEnd(18)} weekday ${String(r.W).padStart(5)}   ${r.inBand}/${ss.length} in band · ${r.dearer} dearer · ${r.below} over 10% under`);
  }
  process.exit(0);
})();
