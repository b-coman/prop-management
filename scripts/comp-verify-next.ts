#!/usr/bin/env npx tsx
/**
 * comp-verify-next - the verification work-list, with both probe URLs already built.
 *
 * Verification confirms what a curated comparable IS: its capacity, its units, its rating, its photo.
 * It is a JUDGEMENT task run rarely on a handful of listings, so it READS the page rather than
 * pattern-matching a number out of it - the opposite of price capture, and for a reason:
 * getting identity wrong is silent, and a wrong capacity makes `hostsParty` report a moat that does
 * not exist.
 *
 * TWO URLS PER LISTING, NOT ONE. Booking's `Sleeps:` and `Recommended for` lines echo the search
 * occupancy back at you - the same Vila Luna unit reads "4 adults, 2 children" or "8 adults"
 * depending only on the URL, while its real capacity is 11. So every listing is read at two different
 * occupancies and only the fields that DID NOT MOVE are kept (`reconcile`). It is the echo check from
 * price capture, run in reverse: there a value that fails to move signals a stale render; here a value
 * that moves signals a field that is not a fact.
 *
 *   npx tsx scripts/comp-verify-next.ts                      # everything unverified or stale
 *   npx tsx scripts/comp-verify-next.ts --all --json
 *   npx tsx scripts/comp-verify-next.ts --only vila-luna
 *   npx tsx scripts/comp-verify-next.ts --channel booking.com --from 2026-10-19 --to 2026-10-22
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getCompetitorSet } from '@/services/competitorSetService';
import { verificationAge, largestUnit } from '@/lib/competitive/set';
import { inPageVerifyRunner, type VerifyChannel } from '@/lib/competitive/verify';
import { buildCaptureUrl } from '@/lib/parity/party';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet'
  : (process.argv[2] ?? 'prahova-mountain-chalet');
const AS_JSON = flag('json');
const ALL = flag('all');
const ONLY = arg('only');
const CHANNEL = arg('channel');

/**
 * The two occupancies. Both default to values EVERY comparable can host, because a search a listing
 * cannot serve returns "no availability" and the check cannot run at all - and the smallest largest-
 * unit in this set is 2 (Casutele de la Poienita's double rooms). Raising these silently skips the
 * listings that most need checking.
 */
const OCC = (arg('occ', '1,2') as string).split(',').map(Number).filter((n) => n > 0);

/** Booking needs dates to render its unit table. A midweek window is likeliest to be bookable. */
const defaultWindow = () => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + 42);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);   // next Monday
  const out = new Date(d); out.setUTCDate(out.getUTCDate() + 3);  // Mon -> Thu
  return [d.toISOString().slice(0, 10), out.toISOString().slice(0, 10)] as const;
};
const [FROM, TO] = [arg('from') ?? defaultWindow()[0], arg('to') ?? defaultWindow()[1]];

(async () => {
  if (OCC.length !== 2 || OCC[0] === OCC[1]) {
    console.error(`--occ needs TWO DIFFERENT values (got ${OCC.join(',')}). The self-check is the ` +
                  `whole point: identical searches prove nothing and must not look like they did.`);
    process.exit(1);
  }

  const set = await getCompetitorSet(SLUG);
  const now = new Date();
  const owed = set.active
    .filter((l) => !CHANNEL || l.channel === CHANNEL)
    .filter((l) => !ONLY || l.listingId === ONLY)
    .filter((l) => ALL || verificationAge(l, now).stale);

  const work = owed.map((l) => {
    const probes = OCC.map((adults) => {
      const url = buildCaptureUrl(l.channel, l.url, {
        checkIn: FROM, checkOut: TO, party: { adults, children: 0 },
      });
      return {
        occupancy: adults,
        url,
        script: url ? inPageVerifyRunner(l.channel as VerifyChannel, l.listingId, adults) : null,
      };
    });
    const age = verificationAge(l, now);
    return {
      listingId: l.listingId,
      displayName: l.displayName,
      channel: l.channel,
      knownLargestUnit: largestUnit(l) || null,
      verifiedAt: l.verifiedAt,
      ageDays: age.ageDays,
      why: age.unverified ? 'never verified' : `${age.ageDays}d old`,
      probes,
      unbuildable: probes.some((p) => !p.url),
    };
  });

  if (AS_JSON) {
    console.log(JSON.stringify({
      meta: { propertySlug: SLUG, window: { from: FROM, to: TO }, occupancies: OCC, generatedAt: now.toISOString() },
      work,
    }, null, 2));
    return;
  }

  console.log(`\nCOMP-VERIFY - ${SLUG}`);
  console.log(`window ${FROM} → ${TO}   ·   occupancies ${OCC.join(' and ')} (two reads per listing)`);
  console.log(`${work.length} listing(s) owed verification of ${set.active.length} active\n`);
  if (!work.length) {
    console.log('Nothing outstanding. Use --all to re-verify everything anyway.');
    return;
  }
  for (const w of work) {
    console.log(`${w.displayName.slice(0, 38).padEnd(40)}${w.channel.padEnd(13)}${w.why}` +
                (w.knownLargestUnit ? `   (recorded: sleeps ${w.knownLargestUnit})` : '   (capacity unread)'));
    for (const p of w.probes) console.log(`    ${String(p.occupancy).padStart(2)} adults  ${p.url ?? 'NO URL - listing url unusable'}`);
  }
  console.log(`\nDrive these in Chrome (javascript_tool only - get_page_text and screenshots time out`);
  console.log(`on these pages). Run each probe's \`script\` in the page after it settles, collect the`);
  console.log(`JSON each returns, then record the batch:`);
  console.log(`\n    npx tsx scripts/comp-verify-record.ts --rows rows.json --dry-run`);
  console.log(`    npx tsx scripts/comp-verify-record.ts --rows rows.json\n`);
  console.log(`Use --json to get the runnable scripts alongside the URLs.`);
})().catch((e) => { console.error(e); process.exit(1); });
