/**
 * WHY no single nightly rate can track the platforms across stay shapes.
 *
 * A guest-facing total is built from three things: a nightly rate, a charge for extra guests, and a
 * discount for longer stays. The owner sets all three; so do Airbnb and Booking. If his SHAPE differs
 * from theirs, then matching them on one stay necessarily misses on another, and no per-period price
 * can fix it - the error is structural, not a level.
 *
 * This measures their shape from the captured prices themselves:
 *   - same dates, different party size  -> what the platform charges per extra guest per night
 *   - same period, different length     -> how much the platform discounts a longer stay
 * and compares each with what the owner charges.
 *
 * Read-only.
 */
import { loadStays, type Stay } from './parity-structure';
import { lengthOfStayDiscountPct } from '@/lib/pricing/priceProjection';

(async () => {
  const { stays, econ } = await loadStays();

  // ---- 1. the charge for an extra guest ------------------------------------------------------
  console.log('=== WHAT AN EXTRA GUEST COSTS, PER NIGHT ===');
  console.log('same dates, same channel, different party size. Owner charges a flat', econ.extraGuestFee,
              `above ${econ.baseOccupancy} guests.\n`);
  const byDates = new Map<string, Stay[]>();
  for (const s of stays) {
    const k = `${s.checkIn}|${s.checkOut}`;
    if (!byDates.has(k)) byDates.set(k, []);
    byDates.get(k)!.push(s);
  }
  const perGuest: number[] = [];
  for (const [k, group] of [...byDates.entries()].sort()) {
    const sameChannel = new Map<string, Stay[]>();
    for (const s of group) {
      if (!sameChannel.has(s.bestChannel)) sameChannel.set(s.bestChannel, []);
      sameChannel.get(s.bestChannel)!.push(s);
    }
    for (const [ch, ss] of sameChannel) {
      if (ss.length < 2) continue;
      ss.sort((a, b) => a.g - b.g);
      for (let i = 1; i < ss.length; i++) {
        const a = ss[i - 1], b = ss[i];
        const dGuests = b.g - a.g;
        if (!dGuests) continue;
        const perNight = (b.bestPrice - a.bestPrice) / dGuests / a.n;
        perGuest.push(perNight);
        console.log(`  ${k}  ${a.n}n  ${ch.padEnd(12)} ${a.g}p ${Math.round(a.bestPrice)} -> ${b.g}p ${Math.round(b.bestPrice)}   platform charges ${perNight.toFixed(0)}/guest/night   owner ${econ.extraGuestFee}`);
      }
    }
  }
  if (perGuest.length) {
    const sorted = [...perGuest].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    console.log(`\n  -> platform median ${med.toFixed(0)} per extra guest per night; owner charges ${econ.extraGuestFee}.`);
    console.log(`     ratio ${(med / (econ.extraGuestFee || 1)).toFixed(2)}x\n`);
  }

  // ---- 2. the discount for a longer stay -----------------------------------------------------
  console.log('=== HOW MUCH A LONGER STAY IS DISCOUNTED ===');
  console.log('per-night platform rate by stay length, within one period and party size.');
  console.log('Owner ladder:', econ.lengthOfStayDiscounts.filter((d) => d.enabled !== false)
    .map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join('  '), '\n');
  const byPeriodGuests = new Map<string, Stay[]>();
  for (const s of stays) {
    const k = `${s.period}|${s.g}p`;
    if (!byPeriodGuests.has(k)) byPeriodGuests.set(k, []);
    byPeriodGuests.get(k)!.push(s);
  }
  for (const [k, ss] of [...byPeriodGuests.entries()].sort()) {
    const lens = new Set(ss.map((s) => s.n));
    if (lens.size < 2) continue;
    ss.sort((a, b) => a.n - b.n);
    const base = ss[0];
    console.log(`  ${k}`);
    for (const s of ss) {
      const platformPerNight = s.bestPrice / s.n;
      const basePerNight = base.bestPrice / base.n;
      const platformDisc = 1 - platformPerNight / basePerNight;
      const ownerDisc = lengthOfStayDiscountPct(s.n, econ.lengthOfStayDiscounts)
                      - lengthOfStayDiscountPct(base.n, econ.lengthOfStayDiscounts);
      console.log(`    ${s.n}n ${s.bestChannel.padEnd(12)} ${Math.round(s.bestPrice)}  = ${platformPerNight.toFixed(0)}/night   platform ${(platformDisc*100).toFixed(0)}% vs ${base.n}n   owner ${(ownerDisc*100).toFixed(0)}%   ${Math.abs(platformDisc-ownerDisc)>0.06?'<-- MISMATCH':''}`);
    }
    console.log('');
  }
  process.exit(0);
})();
