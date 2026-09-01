#!/usr/bin/env npx tsx
/**
 * comp-next — which comparables to price on one window, with the URLs already built.
 *
 * **The window must already have OUR price in the store (C5).** A competitor total with nothing to
 * compare it against is a number, not a position, and deriving competitor windows independently is
 * how the two halves drift until neither can be read against the other. So this reads the parity
 * store first and refuses a window we have not quoted ourselves.
 *
 * Membership is decided by `hostsParty`, so a comparable that cannot take the party is dropped
 * BEFORE a page is loaded — that is C4 paying for itself: the moat is measured by not probing.
 *
 *   npx tsx scripts/comp-next.ts --in 2026-10-24 --out 2026-10-28 --guests 3
 *   npx tsx scripts/comp-next.ts --in 2026-10-24 --out 2026-10-28 --guests 3 --channel booking.com --json
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getCompetitorSet } from '@/services/competitorSetService';
import { latestByCell } from '@/services/growth/parityObservations';
import { hostsParty, largestUnit, type PartyFit } from '@/lib/competitive/set';
import { partiesFor, partyForGuests, partyLabel, buildCaptureUrl } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

const SLUG = arg('property', 'prahova-mountain-chalet')!;
const IN = arg('in');
const OUT = arg('out');
const GUESTS = Number(arg('guests', '3'));
const ONLY_CHANNEL = arg('channel');
const AS_JSON = flag('json');

const fitWord = (f: PartyFit) =>
  f.kind === 'single' ? 'competes' : f.kind === 'combination' ? `${f.unitCount} units`
  : f.kind === 'unknown' ? 'capacity unread' : 'too small';

(async () => {
  if (!IN || !OUT) { console.error('--in and --out are required (YYYY-MM-DD)'); process.exit(1); }
  const nights = Math.round((Date.parse(OUT) - Date.parse(IN)) / 86_400_000);

  const self = [...(await latestByCell(SLUG, { kind: 'self' })).values()]
    .filter((o) => o.checkIn === IN && o.checkOut === OUT && o.guests === GUESTS && o.status === 'captured');
  if (!self.length) {
    console.error(
      `No captured price of OUR OWN for ${IN}→${OUT} at ${GUESTS} guests.\n` +
      `  A competitor total with nothing to compare it against is a number, not a position (C5).\n` +
      `  Quote it first:  npx tsx scripts/parity-pack.ts ${SLUG} --from ${IN} --to ${IN}`);
    process.exit(1);
  }

  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as { channelPricing?: unknown } | undefined;
  const party = partyForGuests(partiesFor(prop?.channelPricing).parties, GUESTS);

  const set = await getCompetitorSet(SLUG);
  const rows = set.active
    .filter((l) => !ONLY_CHANNEL || l.channel === ONLY_CHANNEL)
    .map((l) => {
      const fit = hostsParty(l, party);
      return {
        listingId: l.listingId, displayName: l.displayName, channel: l.channel,
        largestUnit: largestUnit(l) || null,
        fit: fit.kind, fitWhy: fitWord(fit),
        // Probe a listing that can host the party, and one whose capacity we have not read — the
        // missing data is itself the reason to look. Never probe one we know is too small.
        probe: fit.kind !== 'out-of-set',
        url: buildCaptureUrl(l.channel, l.url, { checkIn: IN, checkOut: OUT, party }),
      };
    });

  const probes = rows.filter((r) => r.probe && r.url);
  const ourPrice = Object.fromEntries(self.map((o) => [o.channel, Math.round(o.guestTotal!)]));

  if (AS_JSON) {
    console.log(JSON.stringify({
      meta: { propertySlug: SLUG, checkIn: IN, checkOut: OUT, nights, guests: GUESTS,
              party, partyLabel: partyLabel(party), ourPrice },
      probes, skipped: rows.filter((r) => !r.probe),
    }, null, 2));
    return;
  }

  console.log(`\nCOMP-NEXT — ${IN} → ${OUT}  (${nights}n, ${partyLabel(party)})`);
  console.log(`our price: ${Object.entries(ourPrice).map(([c, v]) => `${c} ${v}`).join(' · ')}\n`);
  for (const ch of [...new Set(rows.map((r) => r.channel))].sort()) {
    const inCh = rows.filter((r) => r.channel === ch);
    console.log(`${ch} — ${inCh.filter((r) => r.probe).length} to probe of ${inCh.length}`);
    for (const r of inCh) {
      console.log(`  ${r.probe ? ' ' : '·'} ${r.displayName.slice(0, 30).padEnd(32)}` +
                  `sleeps ${String(r.largestUnit ?? '?').padStart(2)}  ${r.fitWhy}`);
      if (r.probe && r.url) console.log(`      ${r.url}`);
    }
    console.log();
  }
  const skipped = rows.filter((r) => !r.probe);
  if (skipped.length) {
    console.log(`${skipped.length} not probed — they cannot host this party. That is a FINDING, not a`);
    console.log(`gap: it is competition you do not face on this window, measured without a page load.\n`);
  }
  console.log(`Capture with the ota-parity loop, then record through the one write path:`);
  console.log(`  npx tsx scripts/parity-capture.ts --rows rows.json --dry-run`);
  console.log(`Each row needs "competitorListingId" so the cell can never be read as ours.\n`);
})().catch((e) => { console.error(e); process.exit(1); });
