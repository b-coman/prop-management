#!/usr/bin/env npx tsx
/**
 * comp-search — build the search URL for a window, and turn a collected page into rows.
 *
 * Two modes, because the middle step needs a browser:
 *
 *   npx tsx scripts/comp-search.ts --in 2026-10-24 --out 2026-10-28 --party 2a1c
 *       Prints the search URL and the in-page collector to run. Writes nothing.
 *
 *   npx tsx scripts/comp-search.ts --in ... --out ... --party 2a1c --cards cards.json
 *       Takes what the collector returned, verifies every card's echo, matches against the curated
 *       set by slug, and emits capture rows for `parity-capture.ts --rows`.
 *
 * ONE LOAD gives the whole field. See `lib/competitive/searchResults.ts` for why this beats probing
 * listings one at a time, and for the two mechanics that will bite anyone who skips it: the results
 * list is VIRTUALISED (collect before scrolling), and half the cards price without a discount pair.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import * as fs from 'fs';
import { getCompetitorSet } from '@/services/competitorSetService';
import {
  parseSearchCard, verifySearchBatch, matchToSet, IN_PAGE_SEARCH_COLLECTOR,
} from '@/lib/competitive/searchResults';
import { partiesFor, CHILD_AGES, partyLabel, type Party } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = arg('property', 'prahova-mountain-chalet')!;
const IN = arg('in'), OUT = arg('out');
const PARTY = arg('party', '2a1c')!;
const CARDS = arg('cards');
const DEST = arg('dest', 'Comarnic%2C+Prahova%2C+Romania')!;
const DEST_ID = arg('dest-id', '-1156460')!;

/** `2a1c` / `4a` / `4a2c` — the same shapes as compareParties, written for a command line. */
function parseParty(s: string): Party {
  const m = s.match(/^(\d+)a(?:(\d+)c)?$/i);
  if (!m) throw new Error(`--party must look like 2a1c, 4a or 4a2c — got "${s}"`);
  return { adults: Number(m[1]), children: m[2] ? Number(m[2]) : 0 };
}

const searchUrl = (party: Party, checkIn: string, checkOut: string) => {
  const ages = CHILD_AGES.slice(0, party.children).map((a) => `&age=${a}`).join('');
  return `https://www.booking.com/searchresults.en-gb.html?ss=${DEST}&dest_id=${DEST_ID}` +
    `&dest_type=city&checkin=${checkIn}&checkout=${checkOut}` +
    `&group_adults=${party.adults}&no_rooms=1&group_children=${party.children}${ages}` +
    `&selected_currency=RON`;
};

(async () => {
  if (!IN || !OUT) { console.error('--in and --out are required (YYYY-MM-DD)'); process.exit(1); }
  const party = parseParty(PARTY);
  const nights = Math.round((Date.parse(OUT) - Date.parse(IN)) / 86_400_000);
  const url = searchUrl(party, IN, OUT);

  if (!CARDS) {
    // Warn when the requested party is not one the rest of the system prices at — a one-off is fine,
    // but silently drifting from `compareParties` is how two halves stop being comparable.
    const db = await getAdminDb();
    const prop = (await db.collection('properties').doc(SLUG).get()).data() as { channelPricing?: unknown } | undefined;
    const mix = partiesFor(prop?.channelPricing).parties;
    const known = mix.some((p) => p.adults === party.adults && p.children === party.children);

    console.log(`\nCOMP-SEARCH — ${IN} → ${OUT} (${nights}n, ${partyLabel(party)})`);
    if (!known) {
      console.log(`\n!! ${partyLabel(party)} is not in compareParties (${mix.map(partyLabel).join(' · ')}).`);
      console.log(`   Fine for a one-off look; do not build a position on it — our own stored prices`);
      console.log(`   are for the configured shapes, so there would be nothing to compare against.`);
    }
    console.log(`\n1. Open this in Chrome, signed in, and let it settle ~12s:\n\n${url}\n`);
    console.log(`2. Run the collector BEFORE scrolling — the list is virtualised and scrolling`);
    console.log(`   DESTROYS off-screen cards (25 at the top became 6 after scrolling to the bottom):\n`);
    console.log(IN_PAGE_SEARCH_COLLECTOR);
    console.log(`\n3. Save what it returns to cards.json, then:`);
    console.log(`   npx tsx scripts/comp-search.ts --in ${IN} --out ${OUT} --party ${PARTY} --cards cards.json\n`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(CARDS, 'utf8')) as
    { cards: Array<{ slug: string; name: string; text: string; photo?: string | null }> };
  const collected = Array.isArray(raw) ? raw as never : raw.cards;
  if (!collected?.length) { console.error('cards file has no cards'); process.exit(1); }

  const parsed = collected.map((c) => parseSearchCard(c.slug, c.name, c.text));
  const batch = verifySearchBatch(parsed, { nights, adults: party.adults, children: party.children });
  if (!batch.ok) {
    console.error(`\nREFUSED: ${batch.problem}`);
    batch.mismatched.forEach((m) => console.error(`  ${m.slug}: echoes ${JSON.stringify(m.echo)}`));
    console.error(`\nNothing was banked. Re-load the page and collect again.\n`);
    process.exit(1);
  }

  const set = await getCompetitorSet(SLUG);
  const { curated, candidates, absent } = matchToSet(batch.cards, set.all, 'booking.com');

  console.log(`\nCOMP-SEARCH — ${IN} → ${OUT} (${nights}n, ${partyLabel(party)})`);
  console.log(`${batch.cards.length} cards · every one echoes the probe · ${curated.length} curated · ${candidates.length} candidates\n`);

  console.log('CURATED (these become observations):');
  [...curated].sort((a, b) => (a.card.price ?? 0) - (b.card.price ?? 0))
    .forEach(({ card, listing }) => console.log(
      `  ${String(card.price).padStart(6)}${card.listPrice ? ` (was ${card.listPrice})` : ''}  ` +
      `${listing.displayName.slice(0, 32).padEnd(34)}${card.distanceKm ?? '?'}km`));

  if (absent.length) {
    console.log(`\nABSENT from the results — a FINDING, not a gap. The search omits a property that`);
    console.log(`will not take this party (adults-only, a child-age bar) or has no availability:`);
    absent.forEach((l) => console.log(`  ${l.displayName}`));
  }

  if (candidates.length) {
    console.log(`\nCANDIDATES — in the results a guest sees, not in your set. The page proposes; you dispose:`);
    [...candidates].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)).slice(0, 12)
      .forEach((c) => console.log(
        `  ${String(c.reviewCount ?? '-').padStart(4)}rv ${String(c.score ?? '-').padStart(4)}  ` +
        `${String(c.price).padStart(6)}  ${c.name.slice(0, 38)}`));
  }

  // Rows for the ONE write path. Absences are recorded too: a curated listing the search omitted is
  // an outcome with a reason, never a silent blank.
  const rows = [
    ...curated.map(({ card, listing }) => ({
      competitorListingId: listing.listingId, channel: 'booking.com',
      checkIn: IN, checkOut: OUT, guests: party.adults + party.children,
      status: 'captured', guestTotal: card.price, listTotal: card.listPrice,
      promoActive: card.listPrice !== null, ratePlan: 'flexible',
      party, url,
      sessionState: `Booking SEARCH results, signed in, RON. One page load for the whole field, so ` +
                    `every price here was read under identical conditions. Card echo: ${nights}n, ` +
                    `${party.adults}a+${party.children}c.`,
      // `programApplied` is deliberately ABSENT: a search card shows a struck-through price for a
      // Genius discount and for an ordinary promotion alike, and never says which. Unmeasured, not
      // false — `promoActive` records that SOMETHING was discounted, which is what we can see.
      session: { loggedIn: true, program: 'genius', currency: 'RON' },
    })),
    ...absent.map((l) => ({
      competitorListingId: l.listingId, channel: 'booking.com',
      checkIn: IN, checkOut: OUT, guests: party.adults + party.children,
      status: 'unavailable', party, url,
      reason: `not returned by the Booking search for this party — either no availability or the ` +
              `property does not accept this party. The search is the authority on that; its detail ` +
              `page may still print a price (see docs §24.2).`,
      sessionState: 'Booking SEARCH results, signed in, RON — absence from the result set.',
    })),
  ];
  const out = CARDS.replace(/\.json$/, '') + '.rows.json';
  fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`\n${rows.length} rows written to ${out}`);
  console.log(`  npx tsx scripts/parity-capture.ts --rows ${out} --dry-run`);
  console.log(`  npx tsx scripts/parity-capture.ts --rows ${out}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
