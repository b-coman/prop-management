#!/usr/bin/env npx tsx
/**
 * comp-report - where we sit on one window, rendered FROM THE STORE.
 *
 * Never hand-assembled. Every figure traces to a `channelPriceObservations` row with a URL, a
 * timestamp and a session; a comparable that did not quote appears with its reason rather than being
 * quietly dropped, and one that cannot host the party appears as a finding rather than as a gap.
 *
 *   npx tsx scripts/comp-report.ts --in 2026-10-24 --out 2026-10-28 --guests 3
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { latestByCell, loadObservations } from '@/services/growth/parityObservations';
import { getCompetitorSet } from '@/services/competitorSetService';
import { hostsParty, largestUnit, unitCount } from '@/lib/competitive/set';
import { buildPosition, type CompetitorQuote } from '@/lib/competitive/position';
import { readAbsorption, summariseField, type SellReading, type SellState } from '@/lib/competitive/absorption';
import { partiesFor, partyForGuests, partyLabel } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = arg('property', 'prahova-mountain-chalet')!;
const IN = arg('in')!, OUT = arg('out')!;
const GUESTS = Number(arg('guests', '3'));
const money = (n: number) => Math.round(n).toLocaleString('en-US');

(async () => {
  if (!IN || !OUT) { console.error('--in and --out are required'); process.exit(1); }
  const nights = Math.round((Date.parse(OUT) - Date.parse(IN)) / 86_400_000);
  const now = new Date();

  // Sequential, not Promise.all: three concurrent first calls to getAdminDb() race the Admin SDK's
  // initializeApp and each loser logs a scary "default Firebase app already exists" at ERROR level.
  // The SDK recovers, so it is noise rather than a fault - but noise at ERROR is how a real error
  // gets missed. Warm the connection once, then fan out.
  const db = await getAdminDb();
  const selfAll = await latestByCell(SLUG, { kind: 'self' });
  const compAll = await latestByCell(SLUG, { kind: 'competitor' });
  // The FULL history, not just the newest per cell: absorption is a comparison between readings, so
  // it is the one part of this report that the append-only store exists for.
  const compHistory = await loadObservations(SLUG, { kind: 'competitor' });
  const set = await getCompetitorSet(SLUG);
  const propDoc = await db.collection('properties').doc(SLUG).get();
  const prop = propDoc.data() as { channelPricing?: unknown; rating?: number; reviewCount?: number } | undefined;
  const party = partyForGuests(partiesFor(prop?.channelPricing).parties, GUESTS);

  const match = (o: { checkIn: string; checkOut: string; guests: number }) =>
    o.checkIn === IN && o.checkOut === OUT && o.guests === GUESTS;
  const ours = [...selfAll.values()].filter(match);
  const theirs = [...compAll.values()].filter(match);
  const byId = new Map(set.all.map((l) => [l.listingId, l]));

  const direct = ours.find((o) => o.channel === 'direct');
  const ourDirect = direct?.status === 'captured' ? direct.guestTotal : null;

  console.log(`\nMARKET POSITION - ${IN} → ${OUT}  (${nights}n, ${partyLabel(party)})`);
  console.log('='.repeat(78));

  for (const channel of ['airbnb', 'booking.com']) {
    const field = set.active.filter((l) => l.channel === channel);
    if (!field.length) continue;

    const quotes: CompetitorQuote[] = [];
    const outOfSet: Array<{ listingId: string; displayName: string; fit: ReturnType<typeof hostsParty> }> = [];
    const unread: Array<{ listingId: string; displayName: string }> = [];
    for (const l of field) {
      const fit = hostsParty(l, party);
      if (fit.kind === 'out-of-set') { outOfSet.push({ listingId: l.listingId, displayName: l.displayName, fit }); continue; }
      // A cell we never captured is neither a quote nor a refusal. It used to be dropped here, on the
      // theory that "of how many asked" covered it - it does not: that printed 4 of 7 for a field of
      // fifteen. It is carried through as UNREAD and named.
      const o = theirs.find((x) => x.channel === channel && x.subject?.kind === 'competitor'
        && x.subject.listingId === l.listingId);
      if (!o) { unread.push({ listingId: l.listingId, displayName: l.displayName }); continue; }
      quotes.push({
        listingId: l.listingId, displayName: l.displayName, status: o.status,
        guestTotal: o.guestTotal, listTotal: o.listTotal, promoActive: o.promoActive,
        reason: o.reason, capturedAt: o.capturedAt,
        programApplied: o.session?.programApplied,
        rating: l.rating, reviewCount: l.reviewCount, largestUnit: largestUnit(l) || null,
      });
    }

    const mine = ours.find((o) => o.channel === channel);
    const pos = buildPosition({
      checkIn: IN, checkOut: OUT, nights, guests: GUESTS, partyLabel: partyLabel(party), channel,
      ourChannelPrice: mine?.status === 'captured' ? mine.guestTotal : null,
      ourDirectPrice: ourDirect,
      ourRating: prop?.rating ?? null, ourReviewCount: prop?.reviewCount ?? null,
      ourProgramApplied: mine?.session?.programApplied
        // Older self-captures predate the structured session; fall back to the prose, which for this
        // property states Genius explicitly when it applied.
        ?? /genius[^.]{0,30}applied|Genius \d+% applied/i.test(mine?.sessionState ?? ''),
      quotes, outOfSet, unread, now,
    });

    console.log(`\n${channel.toUpperCase()}`);
    console.log(`  sample   ${pos.sample.quoted} of ${pos.sample.asked} quoted` +
      (pos.sample.unread ? `, ${pos.sample.unread} of ${pos.sample.field} never read` : '') +
      (pos.sample.oldestAgeDays !== null ? ` · oldest ${pos.sample.oldestAgeDays}d` : '') +
      ` · confidence ${pos.confidence}`);
    if (pos.band) {
      console.log(`  the set  ${money(pos.band.min)} - ${money(pos.band.max)}   median ${money(pos.band.median)}`);
    }
    if (pos.rank) {
      console.log(`  you      ${money(pos.ourChannelPrice!)}  ->  ${pos.rank.position} of ${pos.rank.of} on ${channel}`);
    } else if (pos.ourChannelPrice !== null) {
      console.log(`  you      ${money(pos.ourChannelPrice)}  (no rank - too few comparables quoted)`);
    }
    if (pos.ourDirectPrice !== null) {
      console.log(`  direct   ${money(pos.ourDirectPrice)}  (reference - no guest browsing ${channel} sees this)`);
    }

    console.log('\n  cheapest first:');
    for (const r of pos.ladder) {
      const q = r.rating != null ? `${r.rating}${r.reviewCount != null ? `/${r.reviewCount}` : ''}` : '';
      console.log(`    ${r.isUs ? '>>' : '  '} ${money(r.total).padStart(6)}  ${r.name.slice(0, 34).padEnd(36)}` +
                  `${r.promo ? 'promo ' : '      '}${q}`);
    }
    for (const s of pos.silent) console.log(`       ${'-'.padStart(6)}  ${s.name.slice(0, 34).padEnd(36)}${s.status}: ${s.reason.slice(0, 40)}`);
    for (const o of pos.outOfSet) console.log(`       ${'·'.padStart(6)}  ${o.name.slice(0, 34).padEnd(36)}out of set`);
    for (const u of pos.unread) console.log(`       ${'?'.padStart(6)}  ${u.name.slice(0, 34).padEnd(36)}never read for this window`);

    for (const f of pos.flags) console.log(`\n  ! ${f}`);
    for (const n of pos.notes) console.log(`\n  · ${n}`);
  }

  // ---- absorption: who stopped being on sale between readings ----
  const asSellState = (s: string): SellState =>
    s === 'captured' ? 'priced' : s === 'unavailable' ? 'not-sellable' : s === 'refused' ? 'refused' : 'error';
  const rows = set.active
    .filter((l) => l.channel === 'booking.com' || l.channel === 'airbnb')
    .map((l) => {
      const readings: SellReading[] = compHistory
        .filter((o) => match(o) && o.subject?.kind === 'competitor' && o.subject.listingId === l.listingId)
        .map((o) => ({ at: o.capturedAt, state: asSellState(o.status), price: o.guestTotal ?? null, reason: o.reason }));
      return { listingId: l.listingId, displayName: l.displayName,
               absorption: readAbsorption({ readings, multiUnit: unitCount(l) > 1, now }) };
    })
    .filter((r) => r.absorption.readings > 0);

  console.log(`\nABSORPTION - is this window selling at all?`);
  const withTwo = rows.filter((r) => r.absorption.readings >= 2);
  if (!withTwo.length) {
    console.log(`  Not yet. ${rows.length} listing(s) have one reading each, so nothing can be compared.`);
    console.log(`  Absorption needs a SECOND reading of this window, separated in time - it is the only`);
    console.log(`  output no amount of building substitutes for.`);
  } else {
    const f = summariseField(rows);
    console.log(`  ${f.summary}`);
    for (const w of f.wentOffSale) {
      const name = rows.find((r) => r.listingId === w.listingId)!.displayName;
      console.log(`    ${name} - last priced ${Math.round(w.lastPrice ?? 0)} on ${w.between[0].slice(0, 10)}, gone by ${w.between[1].slice(0, 10)}`);
    }
    for (const p of f.parksSoldOut) {
      const name = rows.find((r) => r.listingId === p.listingId)!.displayName;
      console.log(`    ${name} - EVERY unit gone between ${p.between[0].slice(0, 10)} and ${p.between[1].slice(0, 10)} (a park; reported apart)`);
    }
    if (f.tooEarly) console.log(`    ${f.tooEarly} listing(s) still on one reading - their clock has not started.`);
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log('Competitor prices are CONTEXT for a decision, never an input to one (C2). Nothing here');
  console.log('feeds a rate; no solver reads this collection.\n');
})().catch((e) => { console.error(e); process.exit(1); });
