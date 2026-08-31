/**
 * The length-of-stay ladders, now known rather than inferred, and what matching them would do.
 *
 * The owner supplied his real platform settings:
 *   Airbnb   trip-length 4n -10%, 5n -15%; weekly (7n+) -20%; monthly (28n+) -35%
 *   Booking  "4 day stay rate" -5%; "Weekly rate" -30% (flexible); "Monthly rate" -45% (NON-refundable)
 *
 * Why this decides the whole problem: the machine compares against whichever platform is CHEAPEST.
 * If the direct ladder differs from that one, the direct-vs-platform gap changes with stay length on
 * its own, and no single nightly rate can hold every length in the band. If the ladders MATCH, the
 * ratio is constant in length and the rate alone sets the level.
 *
 * Booking's monthly rate is non-refundable, a different product from a flexible direct booking, so it
 * is not matched.
 */
import { loadStays, type Stay } from './parity-structure';
import type { StayEconomics } from '@/lib/pricing/priceProjection';

const BAND_LO = -0.10, BAND_HI = -0.01;
type Ladder = Array<{ nightsThreshold: number; discountPercentage: number }>;
const losOf = (n: number, l: Ladder) => {
  const a = l.filter((d) => n >= d.nightsThreshold).sort((x, y) => y.nightsThreshold - x.nightsThreshold)[0];
  return a ? a.discountPercentage / 100 : 0;
};

const AIRBNB: Ladder  = [{ nightsThreshold: 4, discountPercentage: 10 }, { nightsThreshold: 5, discountPercentage: 15 },
                         { nightsThreshold: 7, discountPercentage: 20 }, { nightsThreshold: 28, discountPercentage: 35 }];
const BOOKING: Ladder = [{ nightsThreshold: 4, discountPercentage: 5 }, { nightsThreshold: 7, discountPercentage: 30 },
                         { nightsThreshold: 28, discountPercentage: 45 }];
/** What the cheapest platform effectively gives at each length. */
const CHEAPEST: Ladder = [{ nightsThreshold: 4, discountPercentage: 10 }, { nightsThreshold: 5, discountPercentage: 15 },
                          { nightsThreshold: 7, discountPercentage: 30 }, { nightsThreshold: 28, discountPercentage: 35 }];

function total(s: Stay, W: number, m: number, econ: StayEconomics, l: Ladder) {
  const wd = s.n - s.weekendNights, we = s.weekendNights;
  const accom = W * (wd + m * we) + s.n * Math.max(0, s.g - econ.baseOccupancy) * econ.extraGuestFee;
  return (accom + econ.cleaningFee) * (1 - losOf(s.n, l));
}
function best(ss: Stay[], m: number, econ: StayEconomics, l: Ladder) {
  let r = { W: 0, inBand: -1, dearer: 99, below: 99 };
  for (let W = 100; W <= 3000; W++) {
    const gaps = ss.map((s) => (total(s, W, m, econ, l) - s.bestPrice) / s.bestPrice);
    const inBand = gaps.filter((g) => g >= BAND_LO && g <= BAND_HI).length;
    const dearer = gaps.filter((g) => g > 0).length;
    const below = gaps.filter((g) => g < BAND_LO).length;
    if (inBand > r.inBand || (inBand === r.inBand && dearer < r.dearer)) r = { W, inBand, dearer, below };
  }
  return r;
}

(async () => {
  const { stays, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;
  const OWNER: Ladder = econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false)
    .map((d) => ({ nightsThreshold: d.nightsThreshold, discountPercentage: d.discountPercentage }));

  console.log('LENGTH-OF-STAY DISCOUNT, BY NIGHTS\n');
  console.log('nights'.padEnd(8), 'Airbnb'.padStart(8), 'Booking'.padStart(9), 'cheapest'.padStart(9),
              'YOU direct'.padStart(11), '   your edge vs cheapest');
  for (const n of [2, 3, 4, 5, 6, 7, 10, 14, 21, 28]) {
    const a = losOf(n, AIRBNB) * 100, b = losOf(n, BOOKING) * 100;
    const c = Math.max(a, b), o = losOf(n, OWNER) * 100;
    const edge = o - c;
    console.log(String(n).padEnd(8), `${a}%`.padStart(8), `${b}%`.padStart(9), `${c}%`.padStart(9),
      `${o}%`.padStart(11), `   ${edge > 0 ? '+' : ''}${edge.toFixed(0)}pp ${Math.abs(edge) >= 5 ? (edge > 0 ? '(you give away more)' : '(they undercut you)') : ''}`);
  }

  const byPeriod = new Map<string, Stay[]>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }
  const N = [...byPeriod.values()].flat().length;

  console.log('\n\nWHAT EACH LADDER BUYS (best weekday rate per period, weekend uplift kept)\n');
  const options: Array<[string, Ladder]> = [
    ['your ladder today', OWNER],
    ['match Airbnb', AIRBNB],
    ['match the cheapest platform', CHEAPEST],
    ['no length discount at all', []],
  ];
  for (const [name, l] of options) {
    let ib = 0, de = 0, be = 0; const rates: string[] = [];
    for (const [pn, ss] of byPeriod) {
      const r = best(ss, m, econ, l);
      ib += r.inBand; de += r.dearer; be += r.below;
      rates.push(`${pn} ${r.W}`);
    }
    console.log(`${name.padEnd(30)} ${String(ib).padStart(2)}/${N} in band · ${de} dearer · ${be} more than 10% under`);
    console.log(`   rates: ${rates.join(' · ')}`);
  }
  process.exit(0);
})();
