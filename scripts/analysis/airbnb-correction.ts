/**
 * Is the flat 14% Airbnb correction right?
 *
 * `parityView` deducts a flat 14% of the GUEST TOTAL for the standing top-rated-guests discount,
 * on the stated grounds that 15% of the base room fee works out at 12.7-16.2% of the total. But the
 * base room fee is a different share of the total for every stay: fees and extra-guest charges do not
 * scale with it, and the host's own length-of-stay discount comes off the room fee alone.
 *
 * Each captured list/charged pair lets that be measured rather than assumed. The gap between them is
 * the host's own stay discount, whose PERCENTAGE is known from his settings - so the base room fee it
 * was taken from can be recovered, and with it the true share 15% of that fee represents.
 */
import { latestByCell } from '@/services/growth/parityObservations';
import { STANDING_GUEST_DISCOUNT } from '@/lib/parity/parityView';
import { config } from 'dotenv'; config({ path: '.env.local' });

/** The owner's Airbnb ladder, from his own settings screen. */
const airbnbLos = (n: number) => (n >= 28 ? 0.35 : n >= 7 ? 0.25 : n >= 5 ? 0.15 : n >= 4 ? 0.10 : 0);

(async () => {
  const flat = STANDING_GUEST_DISCOUNT.airbnb ?? 0;
  const obs = [...(await latestByCell('prahova-mountain-chalet')).values()]
    .filter((o) => o.channel === 'airbnb' && o.status === 'captured' && o.guestTotal && o.listTotal
                && o.listTotal > o.guestTotal)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  console.log(`The engine deducts a flat ${(flat * 100).toFixed(0)}% of the guest total.\n`);
  console.log('  stay                    n  g    list  charged   host disc   base room   15% of it   = % of total');
  const shares: number[] = [];
  for (const o of obs) {
    const d = airbnbLos(o.nights);
    if (!d) continue;                       // no stay discount, so the room fee cannot be recovered
    const cut = o.listTotal! - o.guestTotal!;
    const room = cut / d;                   // the discount is taken on the base room fee alone
    const topRated = 0.15 * room * (1 - d); // applied to the already-discounted room fee
    const share = topRated / o.guestTotal!;
    shares.push(share);
    console.log(`  ${o.checkIn}→${o.checkOut}  ${o.nights}  ${o.guests}  ${String(Math.round(o.listTotal!)).padStart(6)}  ${String(Math.round(o.guestTotal!)).padStart(7)}   ${(d*100).toFixed(0).padStart(6)}%   ${String(Math.round(room)).padStart(9)}   ${String(Math.round(topRated)).padStart(9)}   ${(share*100).toFixed(1).padStart(9)}%`);
  }
  if (!shares.length) { console.log('  no usable pairs'); process.exit(0); }
  shares.sort((a, b) => a - b);
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  console.log(`\n  measured range ${(shares[0]*100).toFixed(1)}% to ${(shares[shares.length-1]*100).toFixed(1)}%, mean ${(mean*100).toFixed(1)}%`);
  console.log(`  the engine uses a flat ${(flat*100).toFixed(0)}% for all of them.`);
  console.log('\n  Over-correcting makes Airbnb look CHEAPER than it is, and so makes direct look dearer.');
  process.exit(0);
})();
