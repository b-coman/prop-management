/**
 * End-to-end check of the machine, using the SHIPPED functions rather than a parallel model.
 * Reports where every measured stay sits today, and where the recommended rate would put it.
 */
import { loadStays } from './parity-structure';
import { bestRateForBand, spreadAt, BAND, type NightFact } from '@/lib/pricing/priceProjection';

(async () => {
  const { stays, econ, prop } = await loadStays();
  const m = prop.pricingConfig?.weekendAdjustment ?? 1.3;

  const byPeriod = new Map<string, typeof stays>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }

  let tN = 0, tInNow = 0, tDearNow = 0, tIn = 0, tDear = 0, tFloor = 0;
  console.log('period'.padEnd(18), 'stays', ' now: in-band/dearer', '   rate', '  after: in-band/dearer/below-floor');
  for (const [name, ss] of [...byPeriod.entries()].sort()) {
    const flatRate = ss.some((s) => s.nights.every((n: NightFact) => n.flatRate));
    const useWeekendUplift = !flatRate;
    const arr = ss.map((s) => ({ nights: s.nights, guests: s.g, bestPrice: s.bestPrice, floor: s.floor }));
    const nowIn = ss.filter((s) => { const g = (s.directNow - s.bestPrice) / s.bestPrice; return g >= BAND.lo && g <= BAND.hi; }).length;
    const nowDear = ss.filter((s) => s.directNow > s.bestPrice).length;
    const r = bestRateForBand(arr, { flatRate, useWeekendUplift }, { weekendAdjustment: m, econ });
    if (!r) continue;
    const sp = spreadAt(r.rate, arr, { flatRate, useWeekendUplift }, { weekendAdjustment: m, econ });
    console.log(name.padEnd(18), String(ss.length).padStart(5),
      `        ${nowIn}/${nowDear}`.padEnd(20), String(r.rate).padStart(6),
      `            ${sp.inBand}/${sp.dearer}/${sp.belowFloor}`);
    tN += ss.length; tInNow += nowIn; tDearNow += nowDear; tIn += sp.inBand; tDear += sp.dearer; tFloor += sp.belowFloor;
  }
  console.log('\n' + '-'.repeat(78));
  console.log(`TODAY     ${tInNow}/${tN} inside your 1-10% band · ${tDearNow} stays where a platform is CHEAPER than you`);
  console.log(`PROPOSED  ${tIn}/${tN} inside the band · ${tDear} where a platform is cheaper · ${tFloor} under their floor`);
  process.exit(0);
})();
