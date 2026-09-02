#!/usr/bin/env npx tsx
/**
 * comp-search-airbnb — the Airbnb half of the search instrument.
 *
 * The protocol said for months that Airbnb had no search equivalent and that per-listing probes were
 * the only way. It was never tested; the owner sent a search URL on 2026-09-02 and it turned out to
 * carry a stay TOTAL on every card, a per-card echo in each card's own link, and the room id as a
 * join key. Three curated comparables matched their stored detail probes to the leu.
 *
 * Two modes, because the middle step needs a browser:
 *
 *   npx tsx scripts/comp-search-airbnb.ts --in 2026-10-24 --out 2026-10-28 --party 2a1c
 *       Prints the search URL and the in-page collector. Writes nothing.
 *
 *   npx tsx scripts/comp-search-airbnb.ts --in ... --out ... --party 2a1c --cards cards.json
 *       Verifies every card's echo, matches by room id, emits capture rows for the listings that
 *       were PRESENT, and prints a probe list for the ones that were not.
 *
 * WHY A PROBE LIST rather than `unavailable` rows, which is what the Booking collector writes: a
 * Booking search returns the whole town in one page, so an absence is a finding. Airbnb paginates
 * eighteen at a time over fifteen pages of a much wider radius, so an absence has two causes that
 * look identical from the page. The owner's reading is that it is usually genuine unavailability and
 * the evidence supports him — but "usually" is not "always", and this system has twice recorded a
 * plausible value nobody measured. One detail load per absentee settles it, and the run is still
 * cheaper than probing the whole set: on 24-28 Oct it was 1 search + 3 probes instead of 7 probes.
 *
 * The cards file may hold ONE collection or an ARRAY of them (one per page), merged by room id.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import * as fs from 'fs';
import { getCompetitorSet } from '@/services/competitorSetService';
import {
  parseAirbnbCard, verifyAirbnbBatch, matchAirbnbToSet, roomIdOf, IN_PAGE_AIRBNB_COLLECTOR,
  parserSnippet, type RawAirbnbCard, type AirbnbCard,
} from '@/lib/competitive/airbnbSearch';
import { partiesFor, partyLabel, buildCaptureUrl, type Party } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getChannels } from '@/services/channelService';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = arg('property', 'prahova-mountain-chalet')!;
const IN = arg('in'), OUT = arg('out');
const PARTY = arg('party', '2a1c')!;
const CARDS = arg('cards');
const PLACE = arg('place', 'Comarnic--Prahova')!;
const PLACE_ID = arg('place-id', 'ChIJIflseREFs0ARhjSvKJ9MtNM')!;

function parseParty(s: string): Party {
  const m = s.match(/^(\d+)a(?:(\d+)c)?$/i);
  if (!m) throw new Error(`--party must look like 2a1c, 4a or 4a2c — got "${s}"`);
  return { adults: Number(m[1]), children: m[2] ? Number(m[2]) : 0 };
}

/**
 * Airbnb takes a child COUNT and no ages, unlike Booking. Nothing to trim, but worth stating: the two
 * channels are being asked for the same party in the only terms each accepts, which is why their
 * prices are comparable within a channel and never across one.
 */
const searchUrl = (p: Party, checkIn: string, checkOut: string) =>
  `https://www.airbnb.com/s/${PLACE}/homes?place_id=${PLACE_ID}` +
  `&checkin=${checkIn}&checkout=${checkOut}&adults=${p.adults}` +
  `${p.children ? `&children=${p.children}` : ''}&date_picker_type=calendar`;

(async () => {
  if (!IN || !OUT) { console.error('--in and --out are required (YYYY-MM-DD)'); process.exit(1); }
  const party = parseParty(PARTY);
  const nights = Math.round((Date.parse(OUT) - Date.parse(IN)) / 86_400_000);
  const url = searchUrl(party, IN, OUT);

  if (!CARDS) {
    const db = await getAdminDb();
    const prop = (await db.collection('properties').doc(SLUG).get()).data() as { channelPricing?: unknown } | undefined;
    const mix = partiesFor(prop?.channelPricing).parties;
    const known = mix.some((p) => p.adults === party.adults && p.children === party.children);

    console.log(`\nCOMP-SEARCH-AIRBNB — ${IN} → ${OUT} (${nights}n, ${partyLabel(party)})`);
    if (!known) {
      console.log(`\n!! ${partyLabel(party)} is not in compareParties (${mix.map(partyLabel).join(' · ')}).`);
      console.log(`   Fine for a one-off look; do not build a position on it — our own stored prices`);
      console.log(`   are for the configured shapes, so there would be nothing to compare against.`);
    }
    console.log(`\n1. Open this in Chrome, signed in, and let it settle ~12s:\n\n${url}\n`);
    console.log(`2. Run THIS once per page — before scrolling, then again after each Next. Airbnb`);
    console.log(`   shows 18 per page over ~15 pages; two or three usually hold the set, and whoever`);
    console.log(`   is still missing goes on the probe list rather than being guessed at.`);
    console.log(`   It parses IN THE PAGE and accumulates in sessionStorage: a page of cards is ~16KB`);
    console.log(`   of raw text, the extension blocks bulk egress, and a two-page run carries 608`);
    console.log(`   non-breaking spaces to lose in transcription. The parser below is the COMPILED`);
    console.log(`   SOURCE of parseAirbnbCard, not a copy of it, so it cannot drift from the tests:\n`);
    console.log(`${parserSnippet()}
var __raw = JSON.parse(${IN_PAGE_AIRBNB_COLLECTOR});
var __pages = JSON.parse(sessionStorage.getItem('__ab') || '[]');
__pages.push(__raw.cards.map(parseAirbnbCard));
sessionStorage.setItem('__ab', JSON.stringify(__pages));
JSON.stringify({ pages: __pages.length, onThisPage: __raw.collected,
                 distinct: new Set([].concat.apply([], __pages).map(function(c){ return c.roomId; })).size });`);
    console.log(`\n3. Read it back with sessionStorage.getItem('__ab'), in slices, and CHECK THE HASH`);
    console.log(`   before trusting the reassembly (protocol §10). Save it to cards.json, then:`);
    console.log(`   npx tsx scripts/comp-search-airbnb.ts --in ${IN} --out ${OUT} --party ${PARTY} --cards cards.json\n`);
    return;
  }

  // The file may hold cards ALREADY PARSED in the page (the normal path, step 2 above) or raw ones
  // (the fallback, if the parser could not be injected). Both are accepted: it is the same function
  // either way, so the only difference is where it ran.
  const file = JSON.parse(fs.readFileSync(CARDS, 'utf8'));
  const groups: unknown[][] = Array.isArray(file)
    ? (Array.isArray(file[0]) ? file as unknown[][] : [file as unknown[]])
    : [(file as { cards?: unknown[] }).cards ?? []];

  const byRoom = new Map<string, AirbnbCard>();
  let pageCount = 0;
  for (const group of groups) {
    pageCount++;
    for (const c of group as Array<RawAirbnbCard | AirbnbCard>) {
      const card = 'priceText' in c ? parseAirbnbCard(c as RawAirbnbCard) : (c as AirbnbCard);
      // Paging re-renders the list and the same card can appear twice; the first reading wins.
      if (card.roomId && !byRoom.has(card.roomId)) byRoom.set(card.roomId, card);
    }
  }
  const parsed = [...byRoom.values()];
  if (!parsed.length) { console.error('cards file has no cards'); process.exit(1); }
  const batch = verifyAirbnbBatch(parsed, { checkIn: IN, checkOut: OUT, adults: party.adults, children: party.children });
  if (!batch.ok) {
    console.error(`\nREFUSED: ${batch.problem}`);
    batch.mismatched.forEach((m) => console.error(`  ${m.roomId}: echoes ${JSON.stringify(m.echo)}`));
    console.error(`\nNothing was banked. Re-load the page and collect again.\n`);
    process.exit(1);
  }

  const set = await getCompetitorSet(SLUG);
  const channels = await getChannels(SLUG);
  const ourRoomId = roomIdOf(channels.byId.get('airbnb')?.listingUrl ?? '');
  const airbnbSet = set.active.filter((l) => l.channel === 'airbnb');
  const { curated, toProbe, candidates, ours } = matchAirbnbToSet(batch.cards, airbnbSet, ourRoomId);

  console.log(`\nCOMP-SEARCH-AIRBNB — ${IN} → ${OUT} (${nights}n, ${partyLabel(party)})`);
  console.log(`${pageCount} page(s) · ${batch.cards.length} cards · every one echoes the probe · ` +
              `${curated.length} of ${airbnbSet.length} curated · ${candidates.length} candidates\n`);

  console.log('CURATED (these become observations):');
  [...curated].sort((a, b) => (a.card.price ?? 0) - (b.card.price ?? 0))
    .forEach(({ card, listing }) => console.log(
      `  ${String(card.price).padStart(6)}${card.listPrice ? ` (was ${card.listPrice})` : ''}  ` +
      `${listing.displayName.slice(0, 34).padEnd(36)}` +
      `${card.rating ?? '-'}/${card.reviewCount ?? '-'}`));

  // The free cross-check. Our own card is priced under exactly the conditions the comparables were,
  // so a disagreement with what we stored for ourselves is a fault in one of the two instruments.
  if (ours) console.log(`\nOUR OWN CARD: ${ours.price} — compare against the stored self observation ` +
                        `for this window; they should agree to the leu.`);

  if (toProbe.length) {
    console.log(`\nNOT ON THE PAGES READ — probe these, do not assume. Absence here is usually real`);
    console.log(`(no availability, or a party the listing will not take), but Airbnb also paginates`);
    console.log(`~15 pages deep, so "absent" and "ranked low" look identical from the results:`);
    for (const l of toProbe) {
      console.log(`  ${l.displayName}`);
      console.log(`    ${buildCaptureUrl('airbnb', l.url, { checkIn: IN, checkOut: OUT, party })}`);
    }
  }

  if (candidates.length) {
    console.log(`\nCANDIDATES — in the results a guest sees, not in your set. The page proposes; you dispose:`);
    [...candidates].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)).slice(0, 12)
      .forEach((c) => console.log(
        `  ${String(c.reviewCount ?? '-').padStart(4)}rv ${String(c.rating ?? '-').padStart(4)}  ` +
        `${String(c.price).padStart(6)}  ${c.name.slice(0, 40)}`));
  }

  // Rows for the ONE write path — PRESENT listings only. Nothing is written for an absentee: this is
  // the line the Booking collector can cross and this one cannot.
  const rows = curated.map(({ card, listing }) => ({
    competitorListingId: listing.listingId, channel: 'airbnb',
    checkIn: IN, checkOut: OUT, guests: party.adults + party.children,
    status: 'captured', guestTotal: card.price, listTotal: card.listPrice,
    promoActive: card.listPrice !== null, ratePlan: 'flexible',
    party, url,
    sessionState: `Airbnb SEARCH results, signed in, RON. One page load for the whole page of the ` +
                  `field, so every price here was read under identical conditions. Card echo (from ` +
                  `the card's own link): ${IN}→${OUT}, ${party.adults}a+${party.children}c.`,
    // No `programApplied`: Airbnb has no loyalty programme to apply, and `promoActive` already
    // records that the card showed a struck-through price.
    session: { loggedIn: true, program: null, currency: 'RON' },
  }));

  const dest = CARDS.replace(/\.json$/, '') + '.rows.json';
  fs.writeFileSync(dest, JSON.stringify(rows, null, 2));
  console.log(`\n${rows.length} rows written to ${dest}`);
  console.log(`  npx tsx scripts/parity-capture.ts --rows ${dest} --dry-run`);
  console.log(`  npx tsx scripts/parity-capture.ts --rows ${dest}`);
  if (toProbe.length) {
    console.log(`\nThen probe the ${toProbe.length} above and record what their own pages say — the`);
    console.log(`window is not fully read until they have an outcome with a reason.`);
  }
})();
