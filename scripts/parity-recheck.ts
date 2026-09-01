#!/usr/bin/env npx tsx
/**
 * parity-recheck — build capture URLs for specific windows that a CHANNEL CHANGE has invalidated.
 *
 * `parity-next` emits cells that were never captured. This emits cells that WERE captured and are now
 * wrong: a price read under a rate plan the platform no longer offers is not evidence, however recent
 * it looks. Moving Weekly to 25% on both platforms made every 7-night-or-longer capture stale in a
 * known direction (Airbnb ~6% cheaper, Booking ~7% dearer), so those cells have to be re-read.
 *
 * URLs come from `buildCaptureUrl`, never from string assembly here: a mistyped parameter does not
 * fail, it returns a real price for the wrong window, and nothing downstream can detect that.
 *
 * Writes nothing.
 *
 *   npx tsx scripts/parity-recheck.ts <slug> --min-nights 7 --json
 *   npx tsx scripts/parity-recheck.ts <slug> --window 2026-09-22:2026-09-29
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getChannels } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { partiesFor, partyForGuests, partyLabel, buildCaptureUrl } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { isSuperseded } from '@/lib/parity/supersession';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const MIN_NIGHTS = Number(arg('min-nights', '7'));
const ONLY = arg('window');
/** A whole date range, for when a CHANNEL SETTING changed for a period rather than a single stay. */
const FROM = arg('from'); const TO = arg('to');
const AS_JSON = process.argv.includes('--json');

(async () => {
  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as Record<string, unknown>;
  const mix = partiesFor(prop?.channelPricing);
  const channels = await getChannels(SLUG);
  const today = new Date().toISOString().slice(0, 10);

  const obs = [...(await latestByCell(SLUG, { kind: 'self' })).values()]
    .filter((o) => o.checkOut >= today && o.channel !== 'direct' && o.nights >= MIN_NIGHTS)
    .filter((o) => !ONLY || `${o.checkIn}:${o.checkOut}` === ONLY)
    .filter((o) => (!FROM || o.checkIn >= FROM) && (!TO || o.checkIn <= TO))
    .filter((o) => o.channel !== 'vrbo');

  // One row per (window, party, channel) that a recorded discount change has invalidated.
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const o of obs) {
    const ch = channels.byId.get(o.channel);
    const changed = ch?.discountsChangedAt;
    // This used to emit every long-enough cell regardless of WHEN it was read, so a cell captured
    // after the change - the re-read that had already been done - came back on the list as still
    // owed. Length alone is half the rule; the other half is the capture date.
    if (!isSuperseded(o.capturedAt, o.nights, changed)) continue;
    const key = `${o.checkIn}|${o.checkOut}|${o.guests}|${o.channel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const party = partyForGuests(mix.parties, o.guests);
    if (!party) continue;
    const url = buildCaptureUrl(o.channel, ch?.listingUrl, { checkIn: o.checkIn, checkOut: o.checkOut, party });
    rows.push({
      channel: o.channel, checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights,
      guests: o.guests, party: partyLabel(party), url,
      previousTotal: o.guestTotal ?? null,
      staleBecause: changed ? `${changed.note ?? 'discounts changed'} on ${changed.date}` : 'unknown',
    });
  }
  rows.sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)) || String(a.channel).localeCompare(String(b.channel)));

  if (AS_JSON) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  console.log(`${rows.length} cell(s) to re-read on ${SLUG} (stays of ${MIN_NIGHTS}+ nights)\n`);
  for (const r of rows) {
    console.log(`${r.channel}  ${r.checkIn} → ${r.checkOut}  ${r.nights}n  ${r.party}  (was ${r.previousTotal})`);
    console.log(`  ${r.staleBecause}`);
    console.log(`  ${r.url}\n`);
  }
  process.exit(0);
})();
