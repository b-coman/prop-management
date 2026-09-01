/**
 * What each platform charges for an extra guest, against what the owner charges.
 *
 * The three stays where a platform undercuts him are all SIX-guest bookings against Booking.com, in
 * three different periods. That is a party-size pattern, not a seasonal one, so the lever is the
 * extra-guest fee rather than any nightly rate.
 *
 * Measured from pairs of captures on the SAME dates and channel at different party sizes: the price
 * difference over the extra heads and nights is what that channel charges for them.
 */
import { loadStays } from './parity-structure';
import { config } from 'dotenv'; config({ path: '.env.local' });

(async () => {
  const { stays, econ } = await loadStays();
  console.log(`The owner charges ${econ.extraGuestFee} per guest per night above ${econ.baseOccupancy}.\n`);

  const byKey = new Map<string, typeof stays>();
  for (const s of stays) {
    const k = `${s.checkIn}|${s.checkOut}|${s.bestChannel}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(s);
  }

  const per: Record<string, number[]> = {};
  console.log('  dates                    n  channel        party -> party      platform charges');
  for (const [k, group] of [...byKey.entries()].sort()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.g - b.g);
    for (let i = 1; i < group.length; i++) {
      const a = group[i - 1], b = group[i];
      if (b.g === a.g) continue;
      const perNight = (b.bestPrice - a.bestPrice) / (b.g - a.g) / a.n;
      (per[a.bestChannel] ??= []).push(perNight);
      console.log(`  ${a.checkIn}→${a.checkOut.slice(5)}  ${a.n}  ${a.bestChannel.padEnd(12)} ${a.g}p -> ${b.g}p   ${perNight.toFixed(0).padStart(14)} /guest/night`);
    }
  }
  console.log('');
  for (const [ch, xs] of Object.entries(per)) {
    const sorted = [...xs].sort((x, y) => x - y);
    const med = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${ch.padEnd(13)} median ${med.toFixed(0).padStart(4)} per extra guest per night  (owner: ${econ.extraGuestFee})`);
  }

  // What the three dearer stays need.
  console.log('\n  The stays where a platform undercuts him, and the fee that would fix each:');
  for (const s of stays.filter((x) => x.directNow > x.bestPrice && x.g > econ.baseOccupancy)) {
    const extras = (s.g - econ.baseOccupancy) * s.n;
    // Drop the total to 5% under the platform by cutting the per-guest fee alone.
    const need = s.bestPrice * 0.95;
    const losMult = s.directNow / (s.directNow); // totals already include the discount
    const cutNeeded = (s.directNow - need) / extras;
    const newFee = econ.extraGuestFee - cutNeeded / 0.85; // the fee is discounted with everything else
    console.log(`    ${s.checkIn}→${s.checkOut.slice(5)} ${s.n}n ${s.g}p vs ${s.bestChannel}: you ${Math.round(s.directNow)}, them ${Math.round(s.bestPrice)}` +
                `  ->  fee would need to be about ${Math.max(0, Math.round(newFee))}`);
  }
  process.exit(0);
})();
