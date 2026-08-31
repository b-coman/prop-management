/**
 * How much of the year can actually be held inside the parity band, and with which levers.
 *
 * The band the owner asked for: direct sits between 1% and 10% under the cheapest platform on every
 * stay a guest might price. This sweeps the levers he really controls and reports what each buys:
 *
 *   A. today                          - current prices
 *   B. best flat price per period     - what the shipped recommendation does
 *   C. best weekday rate per period, weekend kept at his 1.3x  <- the missing lever
 *   D. C, plus a length-of-stay ladder tuned to match the platforms'
 *
 * Read-only. Proposes; changes nothing.
 */
import { loadStays, type Stay } from './parity-structure';
import type { StayEconomics } from '@/lib/pricing/priceProjection';

const BAND_LO = -0.10, BAND_HI = -0.01;

type Ladder = Array<{ nightsThreshold: number; discountPercentage: number }>;
const losOf = (n: number, ladder: Ladder) => {
  const a = ladder.filter((d) => n >= d.nightsThreshold).sort((x, y) => y.nightsThreshold - x.nightsThreshold)[0];
  return a ? a.discountPercentage / 100 : 0;
};

/** Guest-facing total for a stay at weekday rate W with weekend multiplier m. */
function total(s: Stay, W: number, m: number, econ: StayEconomics, ladder: Ladder): number {
  const wd = s.n - s.weekendNights, we = s.weekendNights;
  const accom = W * (wd + m * we) + s.n * Math.max(0, s.g - econ.baseOccupancy) * econ.extraGuestFee;
  return (accom + econ.cleaningFee) * (1 - losOf(s.n, ladder));
}
const gapOf = (s: Stay, W: number, m: number, e: StayEconomics, l: Ladder) =>
  (total(s, W, m, e, l) - s.bestPrice) / s.bestPrice;

/** Sweep the weekday rate and keep the one putting the most stays in band; ties break on fewest dearer. */
function bestRate(ss: Stay[], m: number, econ: StayEconomics, ladder: Ladder) {
  let best = { W: 0, inBand: -1, dearer: 99, below: 99, gaps: [] as number[] };
  for (let W = 100; W <= 3000; W += 1) {
    const gaps = ss.map((s) => gapOf(s, W, m, econ, ladder));
    const inBand = gaps.filter((g) => g >= BAND_LO && g <= BAND_HI).length;
    const dearer = gaps.filter((g) => g > 0).length;
    const below = gaps.filter((g) => g < BAND_LO).length;
    if (inBand > best.inBand || (inBand === best.inBand && dearer < best.dearer)) {
      best = { W, inBand, dearer, below, gaps };
    }
  }
  return best;
}

(async () => {
  const { stays, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;
  const owner: Ladder = econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false)
    .map((d) => ({ nightsThreshold: d.nightsThreshold, discountPercentage: d.discountPercentage }));

  const byPeriod = new Map<string, Stay[]>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }

  const scenarios: Array<{ name: string; m: number; ladder: Ladder }> = [
    { name: 'B. flat price per period', m: 1.0, ladder: owner },
    { name: 'C. weekday rate, weekend 1.3x', m, ladder: owner },
    { name: 'D. C + platform-matched ladder', m, ladder: [
      { nightsThreshold: 3, discountPercentage: 6 },
      { nightsThreshold: 4, discountPercentage: 12 },
      { nightsThreshold: 7, discountPercentage: 20 },
      { nightsThreshold: 14, discountPercentage: 25 },
    ] },
  ];

  // ---- A. today ----
  let n = 0, inBand = 0, dearer = 0, below = 0;
  for (const ss of byPeriod.values()) for (const s of ss) {
    const g = (s.directNow - s.bestPrice) / s.bestPrice;
    n++; if (g >= BAND_LO && g <= BAND_HI) inBand++; else if (g > 0) dearer++; else below++;
  }
  console.log(`A. today                          ${inBand}/${n} in band   ${dearer} dearer than a platform   ${below} more than 10% under`);

  for (const sc of scenarios) {
    let tot = 0, ib = 0, de = 0, be = 0;
    const detail: string[] = [];
    for (const [name, ss] of byPeriod) {
      const r = bestRate(ss, sc.m, econ, sc.ladder);
      tot += ss.length; ib += r.inBand; de += r.dearer; be += r.below;
      detail.push(`     ${name.padEnd(20)} rate ${String(r.W).padStart(5)}  ${r.inBand}/${ss.length} in band  ${r.dearer} dearer  ${r.below} too cheap`);
    }
    console.log(`${sc.name.padEnd(34)}${ib}/${tot} in band   ${de} dearer than a platform   ${be} more than 10% under`);
    detail.forEach((d) => console.log(d));
  }

  // ---- search for the ladder that maximises in-band coverage ----
  console.log('\n=== searching the length-of-stay ladder ===');
  let bestL: { ladder: Ladder; ib: number; de: number } | null = null;
  for (const d3 of [0, 3, 5, 6, 8, 10]) for (const d4 of [d3, d3+2, d3+4, d3+6, d3+9]) for (const d7 of [d4, d4+3, d4+6, d4+9, d4+12]) {
    const ladder: Ladder = [
      { nightsThreshold: 3, discountPercentage: d3 },
      { nightsThreshold: 4, discountPercentage: d4 },
      { nightsThreshold: 7, discountPercentage: d7 },
      { nightsThreshold: 14, discountPercentage: Math.min(35, d7 + 5) },
    ];
    let ib = 0, de = 0;
    for (const ss of byPeriod.values()) { const r = bestRate(ss, m, econ, ladder); ib += r.inBand; de += r.dearer; }
    if (!bestL || ib > bestL.ib || (ib === bestL.ib && de < bestL.de)) bestL = { ladder, ib, de };
  }
  console.log('best ladder found:', bestL!.ladder.map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join('  '));
  console.log(`  -> ${bestL!.ib}/${[...byPeriod.values()].flat().length} in band, ${bestL!.de} dearer`);
  console.log('owner ladder today:', owner.map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join('  '));
  process.exit(0);
})();
