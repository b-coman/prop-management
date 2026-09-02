#!/usr/bin/env npx tsx
/**
 * comp-audit — what in the store can be trusted, and what can only be taken on faith.
 *
 * WHY THIS EXISTS. The owner, 2026-09-02, after a contamination was found mid-run:
 *
 *   > *"Are you sure that this problem you encounter now didn't affect the probes already collected?
 *   > Are we sure about that? I want to trust the data, not wonder all the time if there is a
 *   > mistake."*
 *
 * The honest answer at the time was that nothing stored could settle it. Every capture was verified
 * once, in flight, and left behind only a sentence of prose. So the question could only be answered
 * by reasoning about what the code used to do — which is exactly the kind of answer that should not
 * be believed.
 *
 * A check that leaves no evidence is a check you have to take on trust. This reads the evidence back
 * instead, and it is meant to be run BEFORE acting on the board, not only after a scare.
 *
 * It never writes. It only ever reports, and it exits non-zero when something is actually wrong —
 * so it can sit in front of a decision the way `--dry-run` sits in front of a write.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { loadObservations } from '@/services/growth/parityObservations';
import { getCompetitorSet } from '@/services/competitorSetService';
import { hostsParty, verificationAge } from '@/lib/competitive/set';
import { partiesFor, partyForGuests, partyLabel } from '@/lib/parity/party';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const SLUG = arg('property', 'prahova-mountain-chalet')!;

type Finding = { level: 'wrong' | 'superseded' | 'unverifiable'; line: string };

(async () => {
  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(SLUG).get()).data() as { channelPricing?: unknown } | undefined;
  const mix = partiesFor(prop?.channelPricing).parties;
  const set = await getCompetitorSet(SLUG);
  const byId = new Map(set.all.map((l) => [l.listingId, l]));
  const comp = await loadObservations(SLUG, { kind: 'competitor' });
  const self = await loadObservations(SLUG, { kind: 'self' });

  const findings: Finding[] = [];
  const wrong = (line: string) => findings.push({ level: 'wrong', line });
  const superseded = (line: string) => findings.push({ level: 'superseded', line });
  const unverifiable = (line: string) => findings.push({ level: 'unverifiable', line });

  // A bad row that a later reading has already replaced is history, not a live error. The store is
  // append-only on purpose, so the four prices banked before a party bar was discovered will sit in it
  // forever — flagging them at the same severity as something the board is USING would make the exit
  // code meaningless, and an alarm that always fires stops being read.
  const newest = new Map<string, string>();
  for (const o of comp) {
    const k = o.cellId;
    if (!newest.has(k) || o.capturedAt > newest.get(k)!) newest.set(k, o.capturedAt);
  }
  const isCurrent = (o: { cellId: string; capturedAt: string }) => newest.get(o.cellId) === o.capturedAt;

  console.log(`\nCOMP-AUDIT — ${comp.length} competitor observation(s), ${set.all.length} curated listing(s)\n`);

  // ---------------------------------------------------------------- 1. the echo, as evidence
  // A row whose echo was recorded can be re-checked here, years later. A row without one was checked
  // at capture time and we are trusting a sentence. Both are reported; only a DISAGREEMENT is wrong.
  const priced = comp.filter((o) => o.status === 'captured');
  // Echo evidence matters on EVERY row, not only priced ones: an `unavailable` recorded off a page
  // that was showing other dates is just as wrong as a price read off one, and it is the shape the
  // detail probes take. Counting only priced rows hid ten probes that DO carry their echo.
  const withEcho = comp.filter((o) => o.echo);
  const disagree = withEcho.filter((o) => {
    const e = o.echo!;
    return (e.nights != null && e.nights !== o.nights)
      || (e.checkIn != null && e.checkIn !== o.checkIn)
      || (e.checkOut != null && e.checkOut !== o.checkOut)
      || (e.adults != null && o.party && e.adults !== o.party.adults)
      || (e.children != null && o.party && e.children !== o.party.children);
  });
  console.log(`ECHO EVIDENCE`);
  console.log(`  ${withEcho.length} of ${comp.length} rows carry the page's own echo as data ` +
              `(${withEcho.filter((o) => o.status === 'captured').length} of ${priced.length} priced)`);
  for (const o of disagree) {
    wrong(`${o.checkIn}→${o.checkOut} ${o.channel} ${o.subject?.kind === 'competitor' ? o.subject.listingId : 'self'}: ` +
          `stored echo ${JSON.stringify(o.echo)} disagrees with the cell it is filed under`);
  }
  const noEcho = comp.length - withEcho.length;
  if (noEcho) {
    unverifiable(`${noEcho} row(s) predate stored echoes — verified in flight, but not re-checkable here`);
  }

  // ---------------------------------------------------------------- 2. outcomes carry reasons
  // `refused`/`unavailable`/`error` without a reason is a silent skip wearing a verdict's clothes.
  for (const o of comp.filter((x) => x.status !== 'captured' && !x.reason)) {
    wrong(`${o.checkIn}→${o.checkOut} ${o.channel}: status '${o.status}' with no reason`);
  }

  // ---------------------------------------------------------------- 3. prices for parties nobody can host
  // If `hostsParty` says a listing cannot take the party, a captured price for it is either a wrong
  // capacity or a wrong price. Either way it is not a comparable and must not sit in a ladder.
  for (const o of priced) {
    if (o.subject?.kind !== 'competitor') continue;
    const l = byId.get(o.subject.listingId);
    if (!l) { wrong(`${o.checkIn}→${o.checkOut}: priced row for '${o.subject.listingId}', which is not in the set`); continue; }
    const fit = hostsParty(l, partyForGuests(mix, o.guests));
    if (fit.kind === 'out-of-set') {
      const line = `${o.checkIn}→${o.checkOut} ${o.channel} ${l.displayName}: priced at ${o.guestTotal}, ` +
                   `but the set says it cannot host ${partyLabel(partyForGuests(mix, o.guests))} (${fit.reason})`;
      if (isCurrent(o)) wrong(line);
      else superseded(`${line} — superseded by a later reading of the same cell`);
    }
  }

  // ---------------------------------------------------------------- 4. our own price, cross-checked
  // Every search that priced competitors also showed OUR listing. Comparing that against the stored
  // self price is a free check on the whole instrument, and it has caught nothing yet precisely
  // because it was run by hand every time — which is why it belongs here instead.
  const cells = new Set(priced.map((o) => `${o.checkIn}|${o.checkOut}|${o.guests}|${o.channel}`));
  let selfMissing = 0;
  for (const c of cells) {
    const [checkIn, checkOut, guests, channel] = c.split('|');
    const mine = self.find((o) => o.checkIn === checkIn && o.checkOut === checkOut
      && o.guests === Number(guests) && o.channel === channel && o.status === 'captured');
    if (!mine) selfMissing++;
  }
  if (selfMissing) {
    unverifiable(`${selfMissing} of ${cells.size} competitor cell(s) have no captured price of OURS on the same ` +
                 `channel and stay — the board can show the field but cannot place us in it`);
  }

  // ---------------------------------------------------------------- 5. the set ages
  const now = new Date();
  const stale = set.active.filter((l) => { const a = verificationAge(l, now); return a.stale || a.unverified; });
  for (const l of stale) unverifiable(`${l.displayName}: capacity and quality last verified too long ago to be a fact`);

  // ---------------------------------------------------------------- report
  const bad = findings.filter((f) => f.level === 'wrong');
  const old = findings.filter((f) => f.level === 'superseded');
  const soft = findings.filter((f) => f.level === 'unverifiable');

  if (bad.length) {
    console.log(`\nWRONG — ${bad.length}. These are contradictions in the stored data, not gaps:`);
    for (const f of bad) console.log(`  ! ${f.line}`);
  }
  if (old.length) {
    console.log(`\nWRONG BUT SUPERSEDED — ${old.length}. Already replaced by a later reading; the board does ` +
                `not use these, and absorption discounts them:`);
    for (const f of old) console.log(`  ~ ${f.line}`);
  }
  if (soft.length) {
    console.log(`\nCANNOT BE VERIFIED FROM THE STORE — ${soft.length}. Not errors; things you are taking on trust:`);
    for (const f of soft) console.log(`  ? ${f.line}`);
  }
  if (!findings.length) console.log(`\nNothing wrong and nothing unverifiable. Every priced row re-checks against its own echo.`);

  console.log(`\n${bad.length} wrong · ${old.length} superseded · ${soft.length} unverifiable · ` +
              `${comp.length} rows examined\n`);
  if (bad.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
