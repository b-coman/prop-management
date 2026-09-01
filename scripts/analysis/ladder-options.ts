/**
 * Named ladder choices, evaluated through the SHIPPED solver.
 *
 * An earlier version of this script reimplemented the pricing maths, and promptly disagreed with the
 * product: it proposed 705 a night for Christmas where the real solver says 1024, because it applied
 * a weekend uplift to a whole-house flat-rate period. Two models of one thing always drift, which is
 * the exact failure this whole project exists to remove - so this now calls `bestRateForBand` and
 * `spreadAt`, and a ladder is tested by swapping it into the economics the solver already reads.
 *
 * Captures of 7-night-or-longer stays predate the 2026-09-01 weekly change (Airbnb -20% -> -25%,
 * Booking -30% -> -25%) and are restated by the known plan ratio. Estimates, and flagged as such.
 */
import { loadStays, type Stay } from './parity-structure';
import { getChannels } from '@/services/channelService';
import { discountAt } from '@/lib/pricing/ladderCompare';
import { bestRateForBand, spreadAt, type StayEconomics, type NightFact } from '@/lib/pricing/priceProjection';

const WEEKLY_RESCALE: Record<string, number> = { airbnb: 0.75 / 0.80, 'booking.com': 0.75 / 0.70 };
type Ladder = StayEconomics['lengthOfStayDiscounts'];

(async () => {
  const { stays: raw, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;
  const stays = raw.map((s) => s.n >= 7
    ? { ...s, bestPrice: s.bestPrice * (WEEKLY_RESCALE[s.bestChannel] ?? 1) } : s);

  const channels = await getChannels('prahova-mountain-chalet');
  const platform = [...channels.byId.values()]
    .filter((c) => c.channelId !== 'direct' && c.active && c.lengthOfStayDiscounts?.length);
  const cheapestAt = (n: number) => Math.max(0, ...platform
    .map((c) => { const r = discountAt(n, c.lengthOfStayDiscounts); return r && !r.nonRefundable ? r.discountPercentage : 0; }));

  const owner = econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false);
  const matched: Ladder = [4, 5, 7, 28]
    .map((n) => ({ nightsThreshold: n, discountPercentage: cheapestAt(n) }))
    .filter((r) => r.discountPercentage > 0);

  const byPeriod = new Map<string, Stay[]>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }
  const N = [...byPeriod.values()].flat().length;

  /** Whole-house holiday nights are genuinely flat, so they keep the flat lever the product uses. */
  const solveAll = (ladder: Ladder) => {
    const e: StayEconomics = { ...econ, lengthOfStayDiscounts: ladder };
    const rows: Array<{ period: string; rate: number; inBand: number; dearer: number; below: number }> = [];
    for (const [name, ss] of byPeriod) {
      const flatRate = ss.some((s) => s.nights.every((n: NightFact) => n.flatRate));
      const arr = ss.map((s) => ({ nights: s.nights, guests: s.g, bestPrice: s.bestPrice, floor: s.floor }));
      const r = bestRateForBand(arr, { flatRate, useWeekendUplift: !flatRate }, { weekendAdjustment: m, econ: e });
      if (!r) continue;
      const sp = spreadAt(r.rate, arr, { flatRate, useWeekendUplift: !flatRate }, { weekendAdjustment: m, econ: e });
      rows.push({ period: name, rate: r.rate, inBand: sp.inBand, dearer: sp.dearer,
                  below: sp.gaps.filter((g) => g < -0.10).length });
    }
    return rows;
  };

  const options: Array<[string, Ladder]> = [
    ['yours today (3n10 4n15 5n15 7n25 14n30)', owner],
    ['drop the 3-night discount', owner.filter((d) => d.nightsThreshold !== 3)],
    ['drop 3n, and 14n down to 25', [...owner.filter((d) => d.nightsThreshold !== 3 && d.nightsThreshold !== 14),
                                     { nightsThreshold: 14, discountPercentage: 25 }]],
    [`match the platforms (${matched.map((d) => `${d.nightsThreshold}n${d.discountPercentage}`).join(' ')})`, matched],
  ];

  console.log(`Band 1-10% under the cheapest platform · ${N} measured stays · via the shipped solver\n`);
  console.log('option'.padEnd(42), 'in band', 'platform cheaper', 'over 10% under');
  const solved = new Map<string, ReturnType<typeof solveAll>>();
  for (const [name, l] of options) {
    const rows = solveAll(l);
    solved.set(name, rows);
    const ib = rows.reduce((a, r) => a + r.inBand, 0);
    const de = rows.reduce((a, r) => a + r.dearer, 0);
    const be = rows.reduce((a, r) => a + r.below, 0);
    console.log(name.padEnd(42), `${ib}/${N}`.padStart(7), String(de).padStart(16), String(be).padStart(15));
  }

  const pick = 'drop the 3-night discount';
  console.log(`\nRATES under "${pick}":`);
  for (const r of solved.get(pick)!) {
    console.log(`  ${r.period.padEnd(18)} weekday ${String(r.rate).padStart(5)}   ${r.inBand} in band · ${r.dearer} dearer · ${r.below} over 10% under`);
  }
  console.log('\nRead the rates off the admin screen, not from here: it re-solves from the live ladder');
  console.log('the moment the discount changes, and it is the thing that actually writes the price.');
  process.exit(0);
})();
