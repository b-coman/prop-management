/**
 * parity-capture — record ONE observation into `channelPriceObservations`.
 *
 * The single write path. It exists so captured numbers go from the page into storage through one
 * validated door, instead of being retyped into a throwaway script — which is how a run ends up
 * partial, undated and unverifiable.
 *
 * A non-`captured` status REQUIRES a reason. "Airbnb enforces a 4-night minimum" is an outcome; a
 * blank is not.
 *
 *   npx tsx scripts/parity-capture.ts \
 *     --property prahova-mountain-chalet --channel airbnb \
 *     --in 2026-12-24 --out 2026-12-29 --guests 3 \
 *     --total 4298 --list 5603 --promo \
 *     --url "https://www.airbnb.com/rooms/43265214?..." --session "logged out, RON"
 *
 *   # a channel that cannot quote in RON (VRBO has no Romanian region):
 *   ... --total 1410 --currency USD --fx 4.54 --fx-source "owner-stated 2026-08-07"
 *
 *   # a channel that will not quote:
 *   ... --status refused --reason "min stay 4 nights"
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { cellId, type ObservationStatus } from '@/lib/growth/parityWorklist';
import { recordObservation } from '@/services/growth/parityObservations';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

(async () => {
  const propertyId = arg('property') ?? 'prahova-mountain-chalet';
  const channel = arg('channel');
  const checkIn = arg('in');
  const checkOut = arg('out');
  const guests = Number(arg('guests'));
  const status = (arg('status') ?? 'captured') as ObservationStatus;
  const total = arg('total');
  const list = arg('list');
  const reason = arg('reason') ?? undefined;

  if (!channel || !checkIn || !checkOut || !guests) {
    console.error('required: --channel --in YYYY-MM-DD --out YYYY-MM-DD --guests N');
    process.exit(1);
  }

  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
  const id = cellId(propertyId, checkIn, checkOut, guests, channel);

  try {
    await recordObservation({
      propertyId, cellId: id, checkIn, checkOut, nights, guests, channel, status,
      guestTotal: total !== null ? Number(total) : null,
      listTotal: list !== null ? Number(list) : null,
      rawCurrency: arg('currency') ?? 'RON',
      fxRateToRon: arg('fx') ? Number(arg('fx')) : undefined,
      fxRateSource: arg('fx-source') ?? undefined,
      promoActive: flag('promo'),
      reason,
      source: channel === 'direct' ? 'api' : 'browser',
      url: arg('url') ?? undefined,
      sessionState: arg('session') ?? undefined,
      capturedBy: arg('by') ?? 'ota-parity skill',
    });
    // Echo the CONVERTED figure, not the raw one — printing "1718 RON" for a $1,718 capture is exactly
    // the kind of unit confusion this schema exists to prevent.
    const cur = (arg('currency') ?? 'RON').toUpperCase();
    const fx = arg('fx') ? Number(arg('fx')) : 1;
    const ron = total !== null ? Math.round(Number(total) * (cur === 'RON' ? 1 : fx)) : null;
    console.log(`recorded ${status.padEnd(11)} ${channel.padEnd(12)} ${checkIn}→${checkOut} ${guests}g` +
                (ron !== null ? `  ${ron} RON${cur !== 'RON' ? ` (${total} ${cur} @ ${fx})` : ''}` : '') +
                (reason ? `  (${reason})` : ''));
  } catch (e) {
    console.error(`REFUSED: ${(e as Error).message}`);
    process.exit(1);
  }
})();
