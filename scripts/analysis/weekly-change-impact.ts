/**
 * What moving Weekly to 25% on both platforms does, and which captures it invalidates.
 *
 * The rate plans are a known multiplier on each platform's standard rate, so a change to them moves
 * every captured 7-night-or-longer price by a knowable factor:
 *   Airbnb  was -20%, now -25%  ->  0.75/0.80 = x0.9375  (cheaper)
 *   Booking was -30%, now -25%  ->  0.75/0.70 = x1.0714  (dearer)
 * Shorter stays are untouched.
 *
 * The rescaled figures are ESTIMATES and are labelled as such. They are good enough to decide whether
 * the ladder recommendation changes; they are not good enough to price on, so the affected windows are
 * listed for re-capture.
 */
import { loadStays } from './parity-structure';

const ADJUST: Record<string, number> = { airbnb: 0.75 / 0.80, 'booking.com': 0.75 / 0.70 };

(async () => {
  const { stays } = await loadStays();
  const affected = stays.filter((s) => s.n >= 7);
  console.log(`${affected.length} of ${stays.length} measured stays are 7 nights or longer, so their`);
  console.log('captured platform price was taken under the OLD weekly rates and is now stale.\n');
  if (!affected.length) { console.log('None. Nothing to re-capture.'); process.exit(0); }

  console.log('stay'.padEnd(28), 'g n', 'channel'.padEnd(13), 'captured', ' now (est)', '  gap then', ' gap now (est)');
  for (const s of affected.sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
    const f = ADJUST[s.bestChannel] ?? 1;
    const now = s.bestPrice * f;
    const gapThen = (s.directNow - s.bestPrice) / s.bestPrice;
    const gapNow = (s.directNow - now) / now;
    console.log(
      `${s.checkIn}→${s.checkOut}`.padEnd(28), `${s.g} ${s.n}`, s.bestChannel.padEnd(13),
      String(Math.round(s.bestPrice)).padStart(8), String(Math.round(now)).padStart(10),
      `${(gapThen * 100).toFixed(1)}%`.padStart(11), `${(gapNow * 100).toFixed(1)}%`.padStart(14));
  }
  console.log('\nNOTE: on a 7-night stay the CHEAPEST platform may now be a different one, because');
  console.log('Booking rose and Airbnb fell. Only a fresh capture settles that.');
  process.exit(0);
})();
