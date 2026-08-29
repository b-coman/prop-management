#!/usr/bin/env npx tsx
/**
 * parity-extract-batch — turn a file of captured PAGE TEXT into capture rows, using the parser.
 *
 * This is the piece that makes "zero hand-typed numbers" true rather than aspirational. The browser
 * loop accumulates each cell's raw `document.body.innerText` and Blob-downloads the lot; this reads
 * that file, runs `extract()` + `verifyEcho()` over every cell, and writes a rows.json for
 * `parity-capture.ts`. No human reads a price at any point, so no human can misread one — and the
 * refusal rate becomes a measurable property of the parser instead of an anecdote.
 *
 *   npx tsx scripts/parity-extract-batch.ts ~/Downloads/parity-pages.json --out rows.json
 *
 * Input: [{ cellId, channel, checkIn, checkOut, guests, nights, url, text }]
 * Output: rows.json for parity-capture.ts, plus a per-cell disposition report on stdout.
 *
 * Every cell gets an outcome. A page the parser refuses becomes a row with `status: error` and the
 * parser's own reason, so the cell is re-queued rather than quietly dropped.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { extract, verifyEcho, classifyPage, type Channel } from '@/lib/parity/extract';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};

interface Page {
  cellId: string; channel: string; checkIn: string; checkOut: string;
  guests: number; nights: number; url?: string; text: string;
}

const inFile = process.argv[2];
if (!inFile) { console.error('usage: parity-extract-batch.ts <pages.json> [--out rows.json] [--session "…"]'); process.exit(1); }
const OUT = arg('out', 'rows.json')!;
const REFS = arg('refs');   // optional {cellKey: directTotal} for the magnitude guard

const pages: Page[] = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const refs: Record<string, number> = REFS ? JSON.parse(fs.readFileSync(REFS, 'utf8')) : {};

const rows: Record<string, unknown>[] = [];
const tally: Record<string, number> = {};
const bump = (k: string) => { tally[k] = (tally[k] ?? 0) + 1; };

console.log(`\nparsing ${pages.length} captured page(s)\n`);
console.log('cell'.padEnd(46) + 'outcome'.padEnd(16) + 'detail');
console.log('-'.repeat(120));

for (const p of pages) {
  const key = `${p.checkIn}|${p.checkOut}|${p.guests}`;
  const label = `${p.channel} ${p.checkIn}→${p.checkOut} ${p.guests}g`;
  const base = {
    channel: p.channel, checkIn: p.checkIn, checkOut: p.checkOut, guests: p.guests,
    url: p.url, sessionState: arg('session', 'logged in (owner session), RON')!,
  };

  const state = classifyPage(p.text);
  const r = extract(p.channel as Channel, p.text, { year: Number(p.checkIn.slice(0, 4)) });

  if (!r.ok) {
    // A channel declining to sell a window is an ANSWER about that window; a parser that could not
    // read the page is unfinished work. Both are recorded, with different statuses, so the second
    // gets retried and the first does not.
    const isChannelAnswer = state === 'no-availability' || state === 'min-stay' || state === 'not-priced';
    const status = isChannelAnswer ? (state === 'no-availability' ? 'unavailable' : 'refused') : 'error';
    bump(status === 'error' ? 'parser-refused' : `channel:${state}`);
    rows.push({ ...base, status, reason: `[${state}] ${r.reason}`, rawExcerpt: r.excerpt });
    console.log(label.padEnd(46) + status.padEnd(16) + r.reason.slice(0, 60));
    continue;
  }

  const echo = verifyEcho(r.value, { nights: p.nights, guests: p.guests, checkIn: p.checkIn });
  if (!echo.ok) {
    // The page rendered a DIFFERENT window than the one requested. Banking this would file a real
    // price against the wrong dates — undetectable afterwards, so it is a hard failure.
    bump('echo-mismatch');
    rows.push({ ...base, status: 'error', reason: `echo mismatch: ${echo.reason}`, rawExcerpt: r.value.excerpt });
    console.log(label.padEnd(46) + 'ECHO MISMATCH'.padEnd(16) + echo.reason);
    continue;
  }

  bump('captured');
  rows.push({
    ...base,
    guestTotal: r.value.total,
    listTotal: r.value.listTotal,
    promoActive: r.value.promoActive,
    ratePlan: r.value.ratePlan,
    rawExcerpt: r.value.excerpt,
    ...(refs[key] ? { referenceTotal: refs[key] } : {}),
    ...(r.value.currency !== 'RON' ? { rawCurrency: r.value.currency } : {}),
  });
  const depth = r.value.listTotal ? ` (-${((1 - r.value.total / r.value.listTotal) * 100).toFixed(1)}%)` : '';
  console.log(label.padEnd(46) + 'captured'.padEnd(16) +
    `${r.value.total} ${r.value.currency}  list ${r.value.listTotal ?? '—'}${depth}  ${r.value.ratePlan}`);
}

fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));

const n = pages.length;
console.log('\n' + '-'.repeat(120));
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(28)} ${String(v).padStart(3)}   ${((v / n) * 100).toFixed(0)}%`);
}
const parserFail = (tally['parser-refused'] ?? 0) + (tally['echo-mismatch'] ?? 0);
console.log(`\nPARSER REFUSAL RATE: ${parserFail}/${n} (${((parserFail / n) * 100).toFixed(0)}%)` +
  ` — cells the parser could not read, as distinct from windows a channel would not sell.`);
console.log(`wrote ${rows.length} row(s) to ${OUT}`);
