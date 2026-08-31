#!/usr/bin/env npx tsx
/**
 * parity-next — the capture work-list, with the URLs already built.
 *
 * `parity-pack.ts` prints WHICH cells are owed; it does not print HOW to go and get them. So the
 * agent driving the browser has been assembling ~100 URLs by hand from a listing id, a date pair and
 * a guest count. Every one of those is a chance to mistype a parameter, and a mistyped parameter does
 * not fail — it returns a real price for the wrong window, which is the one error this system cannot
 * detect after the fact.
 *
 * This emits the outstanding cells with a fully-qualified URL each, newest-priority first, as text or
 * JSON. It writes nothing.
 *
 *   npx tsx scripts/parity-next.ts                       # text, all outstanding
 *   npx tsx scripts/parity-next.ts --json --limit 20     # for a driving loop
 *   npx tsx scripts/parity-next.ts --channel airbnb
 *
 * MIN-STAY ESCALATION. When a channel refuses a window because its minimum stay is longer than ours,
 * recording the refusal and moving on silently loses the window: the remaining channels get compared
 * at a length one of them will not sell, which is not a comparison at all. It happened on the autumn
 * school break — Airbnb refused 3 nights, so the owner's emptiest month was measured on Booking alone,
 * and the 4-night truth (direct 13% DEARER than Airbnb) stayed invisible.
 *
 * So a min-stay refusal now generates an ESCALATED probe at a length the refusing channel will quote,
 * emitted for EVERY channel including direct, as a new cell. Length must move on all channels at once
 * or the numbers are not comparable.
 *
 * VRBO is excluded by default (owner decision, 2026-08-29: 1-2 bookings ever, and it was the cheapest
 * channel in 1 of 20 measured windows — and that once only because Airbnb refused the dates). Pass
 * `--include-vrbo` to put it back. The reversal condition is in docs/pricing-parity-engine.md §5.4.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getParityConfig } from '@/services/channelService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { partiesFor, partySize, partyLabel, partyForGuests, buildCaptureUrl, type Party } from '@/lib/parity/party';
import { latestByCell } from '@/services/growth/parityObservations';
import { buildWorklist, computeCoverage, outstandingCells, type ProbeInput } from '@/lib/growth/parityWorklist';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const AS_JSON = flag('json');
const LIMIT = Number(arg('limit', '0')) || 0;
const ONLY_CHANNEL = arg('channel');
const INCLUDE_VRBO = flag('include-vrbo');
const FRESH_DAYS = Number(arg('fresh-days', '42'));

/**
 * The URL templates. These are the ONLY place a probe becomes a web address, which is the point:
 * one definition, tested by use, instead of a hundred hand-built strings.
 */
(async () => {
  const { channels, listingUrls } = await getParityConfig(SLUG);
  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as
    { channelPricing?: { compareParties?: Party[]; compareOccupancies?: number[] } } | undefined;
  const mix = partiesFor(prop?.channelPricing);
  const observed = [...(await latestByCell(SLUG)).values()];
  if (!observed.length) {
    console.error(`No observations for ${SLUG}. Run parity-pack.ts first — it seeds the direct cells.`);
    process.exit(1);
  }

  // Same reconstruction the report uses, and the same past-window exclusion: a stay that has already
  // happened cannot be re-captured, so it is history rather than outstanding work.
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Map<string, ProbeInput>();
  for (const o of observed) {
    if (o.checkOut < today) continue;
    const key = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!seen.has(key)) {
      seen.set(key, {
        label: `${o.checkIn} → ${o.checkOut}`, checkIn: o.checkIn, checkOut: o.checkOut,
        nights: o.nights, guests: o.guests, priority: 'normal',
      });
    }
  }
  const probes = [...seen.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  let names = channels.map((c) => c.channel);
  if (!INCLUDE_VRBO) names = names.filter((c) => c !== 'vrbo');
  if (ONLY_CHANNEL) names = names.filter((c) => c === ONLY_CHANNEL);

  const worklist = buildWorklist(SLUG, probes, names);
  const coverage = computeCoverage(worklist, observed, { freshnessDays: FRESH_DAYS });
  let todo = outstandingCells(worklist, observed, { freshnessDays: FRESH_DAYS })
    .filter((c) => c.channel !== 'direct');   // direct is quoted by parity-pack, not by a browser

  // ---- min-stay escalation ------------------------------------------------------------------
  // A refusal naming a minimum longer than the probe is not a finished cell: it is a request to
  // re-probe the window at a length that channel will sell, on every channel at once.
  // Each channel words the refusal differently and a phrasing this misses is a window silently
  // dropped from the run: Airbnb says "Minimum stay is 4 nights", Booking says "You need to stay 3+
  // nights to book your selected dates". Neither matched the original two alternatives.
  const MIN_RE = /(\d+)\s*-?\s*night\s*minimum|min(?:imum)?\.?\s*(?:stay\s+)?(?:is\s+|of\s+)?(\d+)\s*nights?|need to stay\s+(\d+)\+?\s*nights?/i;
  const escalations: Array<{ from: string; nights: number; checkIn: string; guests: number; why: string }> = [];
  for (const o of observed) {
    if (o.status !== 'refused' || !o.reason) continue;
    const m = o.reason.match(MIN_RE);
    if (!m) continue;
    const needed = Number(m[1] ?? m[2] ?? m[3]);
    const current = o.nights;
    if (!needed || needed <= current) continue;
    const newOut = new Date(Date.parse(o.checkIn) + needed * 86_400_000).toISOString().slice(0, 10);
    // Only escalate if the longer window is not already covered.
    const covered = observed.some((x) => x.checkIn === o.checkIn && x.checkOut === newOut && x.guests === o.guests);
    if (covered) continue;
    escalations.push({ from: `${o.checkIn}→${o.checkOut}`, nights: needed, checkIn: o.checkIn, guests: o.guests,
      why: `${o.channel} requires ${needed} nights` });
  }

  const rows = todo.map((c) => {
    const probe = probes.find((p) => p.checkIn === c.checkIn && p.checkOut === c.checkOut && p.guests === c.guests)!;
    return {
      cellId: c.cellId, channel: c.channel, checkIn: c.checkIn, checkOut: c.checkOut,
      nights: probe.nights, guests: c.guests, priority: c.priority,
      // The stored cell knows only a headcount, so recover the shape from the configured mix.
      url: buildCaptureUrl(c.channel, listingUrls[c.channel], {
        checkIn: c.checkIn, checkOut: c.checkOut, party: partyForGuests(mix.parties, c.guests),
      }),
    };
  }).filter((r) => {
    if (!r.url && !AS_JSON) console.error(`! no listing URL configured for ${r.channel} — skipping ${r.cellId}`);
    return r.url !== null;
  });

  const limited = LIMIT ? rows.slice(0, LIMIT) : rows;

  if (AS_JSON) {
    console.log(JSON.stringify({
      propertyId: SLUG, generatedAt: new Date().toISOString(),
      coverage: { captured: coverage.captured, missing: coverage.missing, complete: coverage.complete },
      excludedChannels: INCLUDE_VRBO ? [] : ['vrbo'],
      cells: limited,
    }, null, 2));
    return;
  }

  console.log(`\nOUTSTANDING CAPTURES — ${SLUG}`);
  console.log(`party mix: ${mix.parties.map(partyLabel).join(' · ')}   (${mix.source})`);
  if (mix.warning) console.log(`  !! ${mix.warning}`);
  console.log(`${rows.length} cell(s) owed${LIMIT ? `, showing ${limited.length}` : ''}` +
              `${INCLUDE_VRBO ? '' : '   (vrbo excluded — pass --include-vrbo)'}`);
  console.log(`coverage: ${coverage.captured} captured · ${coverage.missing} missing · ` +
              `${coverage.complete ? 'COMPLETE' : 'INCOMPLETE'}\n`);
  for (const r of limited) {
    console.log(`${r.channel.padEnd(12)} ${r.checkIn}→${r.checkOut}  ${String(r.nights).padStart(2)}n ${r.guests}g${r.priority === 'high' ? '  *' : ''}`);
    console.log(`   ${r.url}`);
  }
  if (escalations.length) {
    console.log(`\n!! MIN-STAY ESCALATIONS — ${escalations.length} window(s) a channel refused at the probed length.`);
    console.log('   Re-probe each at the longer length ON EVERY CHANNEL INCLUDING DIRECT, or the');
    console.log('   comparison is made at a length one channel will not sell:');
    for (const e of escalations) {
      const out = new Date(Date.parse(e.checkIn) + e.nights * 86_400_000).toISOString().slice(0, 10);
      console.log(`   ${e.from}  ->  ${e.checkIn}→${out} (${e.nights}n, ${e.guests}g)   [${e.why}]`);
      for (const ch of names.filter((c) => c !== 'direct')) {
        console.log(`      ${ch.padEnd(12)} ${buildCaptureUrl(ch, listingUrls[ch], {
          checkIn: e.checkIn, checkOut: out, party: partyForGuests(mix.parties, e.guests),
        })}`);
      }
    }
  }
  if (!rows.length && !escalations.length) console.log('Nothing owed. Coverage is complete for the channels in scope.');
  else console.log(`\nCapture each in the owner's logged-in Chrome, then record with parity-capture.ts.`);
})().catch((e) => { console.error(e); process.exit(1); });
