/**
 * Does the owner's weekend uplift match the platforms'?
 *
 * The P* spread inside Fall (383 to 551 a night) lines up with WEEKEND CONTENT, not party size:
 * the stays wanting the highest rate are the ones containing Friday and Saturday. If the platforms
 * price weekends differently from the owner's 1.3x, then a FLAT nightly price - which is what a
 * hand-set period price compiles to - cannot track them, and the spread is baked in.
 *
 * This estimates the platforms' own weekend multiplier by least squares over every measured stay:
 * find the (weekdayRate_period, weekendMultiplier) that best reproduces the captured platform totals.
 */
import { loadStays } from './parity-structure';
import { lengthOfStayDiscountPct } from '@/lib/pricing/priceProjection';

(async () => {
  const { stays, econ, prop } = await loadStays();
  const ownerWeekendMult = prop.pricingConfig?.weekendAdjustment ?? 1;
  console.log(`owner weekend multiplier: ${ownerWeekendMult}\n`);

  // Strip the platform total back to an implied "base-occupancy accommodation" figure, removing the
  // parts we already know match: the per-guest charge (77 ~ owner's 75) and the stay-length discount.
  const byPeriod = new Map<string, typeof stays>();
  for (const s of stays) {
    if (s.period.startsWith('(no period')) continue;
    if (!byPeriod.has(s.period)) byPeriod.set(s.period, []);
    byPeriod.get(s.period)!.push(s);
  }

  console.log('For each candidate weekend multiplier, how tightly can ONE weekday rate per period');
  console.log('reproduce every measured platform price? Lower spread = the shape matches.\n');
  console.log('weekendMult'.padEnd(12), 'total spread of implied weekday rate, summed over periods');

  const results: Array<{ m: number; total: number; per: Record<string, number> }> = [];
  for (let m = 1.0; m <= 1.65; m += 0.02) {
    let total = 0; const per: Record<string, number> = {};
    for (const [name, ss] of byPeriod) {
      if (ss.length < 2) continue;
      const implied = ss.map((s) => {
        const wd = s.n - s.weekendNights, we = s.weekendNights;
        const guestPart = s.n * Math.max(0, s.g - econ.baseOccupancy) * 77;
        const d = lengthOfStayDiscountPct(s.n, econ.lengthOfStayDiscounts);
        // platformTotal ~ (W*(wd + m*we) + guestPart + cleaning) * (1-d)  -> solve W
        return ((s.bestPrice / (1 - d)) - guestPart - econ.cleaningFee) / (wd + m * we);
      });
      const spread = Math.max(...implied) - Math.min(...implied);
      per[name] = spread; total += spread;
    }
    results.push({ m, total, per });
  }
  results.sort((a, b) => a.total - b.total);
  for (const r of results.slice(0, 6)) console.log(r.m.toFixed(2).padEnd(12), Math.round(r.total));
  console.log('...');
  for (const r of results.slice(-3)) console.log(r.m.toFixed(2).padEnd(12), Math.round(r.total));

  const best = results[0];
  console.log(`\nBEST FIT: the platforms behave as if their weekend multiplier is ~${best.m.toFixed(2)}`);
  console.log(`The owner uses ${ownerWeekendMult}.\n`);
  console.log('per-period spread of the implied weekday rate at the best fit vs at the owner\'s 1.3:');
  const at13 = results.find((r) => Math.abs(r.m - ownerWeekendMult) < 0.011)!;
  const flat = results.find((r) => Math.abs(r.m - 1.0) < 0.011)!;
  console.log('  period'.padEnd(24), `m=${best.m.toFixed(2)}`.padStart(9), `m=${ownerWeekendMult}`.padStart(9), 'm=1.00 (flat)'.padStart(14));
  for (const name of Object.keys(best.per)) {
    console.log('  ' + name.padEnd(22), Math.round(best.per[name]).toString().padStart(9),
      Math.round(at13.per[name]).toString().padStart(9), Math.round(flat.per[name]).toString().padStart(14));
  }
  process.exit(0);
})();
