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
 *
 *   # a COMPETITOR's price on the same window — the cell id carries the listing so it can never be
 *   # read as ours (C2: it is context for a decision, never an input to one):
 *   ... --competitor vila-luna
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { cellId, type ObservationStatus, type ObservationSubject } from '@/lib/growth/parityWorklist';
import { recordObservation } from '@/services/growth/parityObservations';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

interface BatchRow {
  channel: string;
  /**
   * WHOSE price this row is. Omit for the owner's own listings. A competitor row carries its
   * `listingId`, which goes into the cell id so it can never occupy a self cell's key — see
   * `cellId`. The store re-checks the two agree, so a mismatch here is refused rather than filed.
   */
  competitorListingId?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status?: ObservationStatus;
  guestTotal?: number | null;
  listTotal?: number | null;
  promoActive?: boolean;
  reason?: string;
  url?: string;
  sessionState?: string;
  session?: import('@/services/growth/parityObservations').CaptureSession;
  party?: { adults: number; children: number };
  ratePlan?: import('@/services/growth/parityObservations').RatePlan;
  rawExcerpt?: string;
  referenceTotal?: number;
  rawCurrency?: string;
  fxRateToRon?: number;
  fxRateSource?: string;
}

/**
 * Write a batch. Every row is attempted; failures are collected and reported at the end rather than
 * throwing, so a run that captured 40 pages banks 39 of them when one row is malformed.
 */
async function runBatch(propertyId: string, file: string, capturedBy: string, dryRun: boolean): Promise<void> {
  const raw = await import('fs').then((fs) => fs.promises.readFile(file, 'utf8'));
  const rows: BatchRow[] = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('--rows file must contain a JSON array');

  // One stamp for the batch, so every row from one browser pass sorts together and staleness is
  // measured from when the run happened rather than from when each write landed.
  const capturedAt = new Date().toISOString();
  let ok = 0;
  const failures: string[] = [];

  for (const r of rows) {
    const nights = Math.round((Date.parse(r.checkOut) - Date.parse(r.checkIn)) / 86_400_000);
    const subject: ObservationSubject = r.competitorListingId
      ? { kind: 'competitor', listingId: r.competitorListingId }
      : { kind: 'self' };
    const id = cellId(propertyId, r.checkIn, r.checkOut, r.guests, r.channel, subject);
    try {
      await recordObservation({
        dryRun, subject,
        propertyId, cellId: id, checkIn: r.checkIn, checkOut: r.checkOut, nights, guests: r.guests,
        channel: r.channel, status: r.status ?? 'captured',
        guestTotal: r.guestTotal ?? null, listTotal: r.listTotal ?? null,
        promoActive: r.promoActive, reason: r.reason, source: 'browser', url: r.url,
        sessionState: r.sessionState, session: r.session, ratePlan: r.ratePlan, party: r.party,
        rawExcerpt: r.rawExcerpt, referenceTotal: r.referenceTotal,
        rawCurrency: r.rawCurrency, fxRateToRon: r.fxRateToRon, fxRateSource: r.fxRateSource,
        capturedBy, capturedAt,
      });
      ok++;
    } catch (e) {
      failures.push(`${r.channel} ${r.checkIn}→${r.checkOut} ${r.guests}g: ${(e as Error).message}`);
    }
  }

  console.log(`recorded ${ok}/${rows.length} row(s) at ${capturedAt}`);
  if (failures.length) {
    console.log(`\n${failures.length} row(s) REFUSED — these cells stay outstanding and will be re-queued:`);
    for (const f of failures) console.log(`  ${f}`);
    process.exitCode = 1;   // non-zero so a driving loop notices, but the good rows are already saved
  }
}

(async () => {
  const propertyId = arg('property') ?? 'prahova-mountain-chalet';

  const rowsFile = arg('rows');
  if (rowsFile) {
    const dryRun = flag('dry-run');
    if (dryRun) console.log('DRY RUN — validating rows, writing nothing.\n');
    await runBatch(propertyId, rowsFile, arg('by') ?? 'ota-parity capture loop', dryRun);
    return;
  }

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
  const competitorListingId = arg('competitor');
  const subject: ObservationSubject = competitorListingId
    ? { kind: 'competitor', listingId: competitorListingId }
    : { kind: 'self' };
  const id = cellId(propertyId, checkIn, checkOut, guests, channel, subject);

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
