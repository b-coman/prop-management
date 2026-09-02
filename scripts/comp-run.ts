#!/usr/bin/env npx tsx
/**
 * comp-run — a whole Booking batch in two commands and one browser session.
 *
 * WHY THIS EXISTS. The owner's question, 2026-09-02: *"Next time when I run the batch would I be in
 * the same problems like now? I want to get to a point when acquiring fresh data is a matter of 10
 * min, not hours."* Fair. A four-window run cost roughly forty steps, and almost none of them were
 * thinking:
 *
 *   navigate → paste parser → chunk the payload out → reassemble it → hash-check it → write a file →
 *   comp-search --cards → combine the row files → dry-run → capture → hand-write a read-back check
 *
 * Nine of those eleven are the same every time, and one of them — the read-back — was retyped from
 * memory on every run, which is exactly the check that must never be optional.
 *
 * WHAT IS LEFT. Two commands and one browser pass:
 *
 *   1. `comp-run.ts --plan --windows 2026-11-27:2026-12-02,... --parties 2a1c,4a2c`
 *      Prints every URL and ONE snippet to paste per page. The snippet parses in the page with the
 *      compiled parser and accumulates into `sessionStorage.__run` under a `in|out|party` key, so a
 *      navigation cannot lose what came before and the whole batch reads out ONCE at the end.
 *
 *   2. `comp-run.ts --blob blob.json`
 *      Per window and party: verify every card's echo, match to the set, build rows through the
 *      SHARED builder, dry-run, write, and READ BACK every row against its source. One report.
 *
 * The browser step stays manual because the extension blocks bulk egress and there is no API. That is
 * the floor; everything above it is now one command.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import * as fs from 'fs';
import { getCompetitorSet } from '@/services/competitorSetService';
import { latestByCell, recordCaptureRow } from '@/services/growth/parityObservations';
import {
  parseSearchCard, verifySearchBatch, matchToSet, parserSnippet, IN_PAGE_SEARCH_COLLECTOR,
  type SearchCard,
} from '@/lib/competitive/searchResults';
import { bookingRows } from '@/lib/competitive/captureRows';
import { partyLabel, CHILD_AGES, type Party } from '@/lib/parity/party';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = (n: string) => process.argv.includes(`--${n}`);
const SLUG = arg('property', 'prahova-mountain-chalet')!;
const DEST = arg('dest', 'Comarnic%2C+Prahova%2C+Romania')!;
const DEST_ID = arg('dest-id', '-1156460')!;

function parseParty(s: string): Party {
  const m = s.trim().match(/^(\d+)a(?:(\d+)c)?$/i);
  if (!m) throw new Error(`party must look like 2a1c, 4a or 4a2c — got "${s}"`);
  return { adults: Number(m[1]), children: m[2] ? Number(m[2]) : 0 };
}

const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const searchUrl = (p: Party, checkIn: string, checkOut: string) => {
  const ages = CHILD_AGES.slice(0, p.children).map((a) => `&age=${a}`).join('');
  return `https://www.booking.com/searchresults.en-gb.html?ss=${DEST}&dest_id=${DEST_ID}` +
    `&dest_type=city&checkin=${checkIn}&checkout=${checkOut}` +
    `&group_adults=${p.adults}&no_rooms=1&group_children=${p.children}${ages}` +
    `&selected_currency=RON`;
};

const keyOf = (checkIn: string, checkOut: string, party: Party) =>
  `${checkIn}|${checkOut}|${partyLabel(party).replace('+', '')}`;

(async () => {
  const windows = (arg('windows') ?? '').split(',').filter(Boolean)
    .map((w) => { const [i, o] = w.split(':'); return { checkIn: i, checkOut: o }; });
  const parties = (arg('parties') ?? '2a1c').split(',').filter(Boolean).map(parseParty);

  // ---------------------------------------------------------------- plan
  if (has('plan') || !arg('blob')) {
    if (!windows.length) { console.error('--windows 2026-11-27:2026-12-02,2026-12-25:2026-12-28  (and optionally --parties 2a1c,4a2c)'); process.exit(1); }
    const jobs = windows.flatMap((w) => parties.map((p) => ({ ...w, party: p })));

    console.log(`\nCOMP-RUN — ${jobs.length} page load(s): ${windows.length} window(s) × ${parties.length} part(y/ies)\n`);
    console.log(`Chrome, signed in. Load each URL, let it settle ~10s, then paste the SNIPPET once.`);
    console.log(`Nothing is lost between navigations — the snippet accumulates in sessionStorage.\n`);
    jobs.forEach((j, n) => console.log(
      `${String(n + 1).padStart(2)}. ${j.checkIn} → ${j.checkOut}  ${partyLabel(j.party)}\n    ${searchUrl(j.party, j.checkIn, j.checkOut)}`));

    console.log(`\n--- SNIPPET (same every page; it reads the dates and party off the page URL) ---\n`);
    console.log(`${parserSnippet()}
var __q = new URL(location.href).searchParams;
var __party = __q.get('group_adults') + 'a' + (Number(__q.get('group_children')) || 0) + 'c';
var __key = __q.get('checkin') + '|' + __q.get('checkout') + '|' + __party.replace('0c','');
var __raw = JSON.parse(${IN_PAGE_SEARCH_COLLECTOR});
var __run = JSON.parse(sessionStorage.getItem('__run') || '{}');
__run[__key] = __raw.cards.map(function(c){ return parseSearchCard(c.slug, c.name, c.text); });
sessionStorage.setItem('__run', JSON.stringify(__run));
JSON.stringify({ key: __key, cards: __run[__key].length,
  echo: __run[__key].every(function(p){ return p.echo.adults === Number(__q.get('group_adults')); }),
  done: Object.keys(__run).length });`);

    console.log(`\n--- THEN, ONCE, read it out (slice it, and CHECK THE HASH — protocol §10) ---\n`);
    console.log(`sessionStorage.getItem('__run')`);
    console.log(`\nSave it to blob.json and run:\n  npx tsx scripts/comp-run.ts --blob blob.json\n`);
    return;
  }

  // ---------------------------------------------------------------- capture
  const blob = JSON.parse(fs.readFileSync(arg('blob')!, 'utf8')) as Record<string, SearchCard[]>;
  const set = await getCompetitorSet(SLUG);
  const dry = has('dry-run');

  console.log(`\nCOMP-RUN — ${Object.keys(blob).length} window/party group(s)${dry ? '  [DRY RUN]' : ''}\n`);
  let written = 0, refused = 0;
  const wrote: Array<{ checkIn: string; checkOut: string; guests: number; id: string; status: string; total: number | null }> = [];

  for (const [key, cards] of Object.entries(blob)) {
    const [checkIn, checkOut, partyStr] = key.split('|');
    const party = parseParty(partyStr);
    const nights = nightsBetween(checkIn, checkOut);
    const label = `${checkIn} → ${checkOut}  ${partyLabel(party)}`;

    const parsed = cards.map((c) => 'echo' in c ? c
      : parseSearchCard((c as never as { slug: string }).slug, (c as never as { name: string }).name, (c as never as { text: string }).text));
    const batch = verifySearchBatch(parsed, { nights, adults: party.adults, children: party.children });
    if (!batch.ok) {
      refused++;
      console.log(`  REFUSED  ${label} — ${batch.problem}`);
      batch.mismatched.forEach((m) => console.log(`             ${m.slug}: echoes ${JSON.stringify(m.echo)}`));
      continue;
    }

    const { curated, absent, candidates } = matchToSet(batch.cards, set.all, 'booking.com');
    const rows = bookingRows({ curated, absent, checkIn, checkOut, nights, party, url: searchUrl(party, checkIn, checkOut) });

    console.log(`  ${label}  ${curated.length} quoted · ${absent.length} nothing left · ${candidates.length} candidates`);
    // A dry run goes through the SAME conversion, writing nothing. The first version skipped it, so a
    // dry run passed and the real run refused every row on a field-name mismatch — a rehearsal that
    // does not rehearse the risky step is worse than none, because it buys false confidence.
    for (const r of rows) {
      await recordCaptureRow(SLUG, r, { dryRun: dry, capturedBy: 'comp-run' });
      if (!dry) wrote.push({ checkIn, checkOut, guests: r.guests, id: r.competitorListingId,
                             status: r.status, total: r.guestTotal ?? null });
    }
    written += rows.length;
  }

  if (dry) { console.log(`\n${written} row(s) would be written. Nothing was.\n`); return; }

  // ------------------------------------------------- read back, always
  // Not optional and not hand-written: a write that reports success proves nothing, and both data-loss
  // bugs in this system were found only by reading the fields back (protocol §9). Making it part of
  // the command is the only way it survives a hurried run.
  const latest = await latestByCell(SLUG, { kind: 'competitor' });
  let bad = 0;
  for (const w of wrote) {
    const o = [...latest.values()].find((x) => x.checkIn === w.checkIn && x.checkOut === w.checkOut
      && x.guests === w.guests && x.channel === 'booking.com'
      && x.subject?.kind === 'competitor' && x.subject.listingId === w.id);
    if (!o) { bad++; console.log(`  MISSING   ${w.checkIn} ${w.id}`); continue; }
    if (o.status !== w.status || (o.guestTotal ?? null) !== w.total) {
      bad++;
      console.log(`  MISMATCH  ${w.checkIn} ${w.id}: stored ${o.status}/${o.guestTotal} vs source ${w.status}/${w.total}`);
    }
  }
  console.log(`\n${written} row(s) written${refused ? `, ${refused} page(s) refused` : ''}.`);
  console.log(bad ? `READ-BACK FAILURES: ${bad} — do not trust this run.\n`
                  : `All ${wrote.length} read back and matched their source.\n`);
  if (bad) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
