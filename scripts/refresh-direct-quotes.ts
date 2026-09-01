#!/usr/bin/env npx tsx
/**
 * Re-quote DIRECT for every window that already has an OTA measurement.
 *
 * WHY THIS EXISTS. Changing a direct price makes every stored direct quote stale, and the parity
 * board judges each window by comparing a stored direct total against a stored OTA total. So the
 * instant a rate is applied, the board reports the OLD position and keeps reporting it until someone
 * re-quotes - which reads as "the change did nothing".
 *
 * `parity-pack` refreshes direct only for the windows on ITS probe list, which is derived and rotates.
 * After tonight's repricing that left 25 of 65 forward windows still holding pre-change quotes. This
 * refreshes exactly the windows that have an OTA price to compare against, which is the set the board
 * actually reads.
 *
 * The quote comes from the engine's own /api/check-pricing, the same path `parity-pack` uses, so the
 * two cannot disagree about what direct costs. Observations are append-only: this adds a newer
 * reading rather than editing one.
 *
 *   npx tsx scripts/refresh-direct-quotes.ts <slug>           # dry run
 *   npx tsx scripts/refresh-direct-quotes.ts <slug> --write
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { latestByCell, recordObservation } from '@/services/growth/parityObservations';
import { cellId } from '@/lib/growth/parityWorklist';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const WRITE = process.argv.includes('--write');
const BASE = process.env.PARITY_BASE_URL ?? 'http://localhost:9002';

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const all = [...(await latestByCell(SLUG, { kind: 'self' })).values()].filter((o) => o.checkOut >= today);

  // Only windows with a real OTA reading: a direct quote alone tells the board nothing.
  const windows = new Map<string, { checkIn: string; checkOut: string; nights: number; guests: number }>();
  for (const o of all) {
    if (o.channel === 'direct' || o.status !== 'captured') continue;
    windows.set(`${o.checkIn}|${o.checkOut}|${o.guests}`,
      { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights, guests: o.guests });
  }

  const stamp = new Date().toISOString();
  let changed = 0, same = 0, failed = 0;
  console.log(`${windows.size} window(s) with an OTA price to compare against\n`);

  for (const w of [...windows.values()].sort((a, b) => a.checkIn.localeCompare(b.checkIn))) {
    const prev = all.find((o) => o.channel === 'direct' && o.checkIn === w.checkIn
      && o.checkOut === w.checkOut && o.guests === w.guests)?.guestTotal ?? null;
    let total: number | null = null; let err = '';
    try {
      const r = await fetch(`${BASE}/api/check-pricing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: SLUG, checkIn: w.checkIn, checkOut: w.checkOut, guests: w.guests }),
      });
      const j: any = await r.json();
      const p = j?.pricing ?? j;
      const t = p?.total ?? p?.totalPrice;
      if (typeof t === 'number') total = Math.round(t);
      else err = String(p?.error ?? j?.reason ?? 'no quote');
    } catch (e) { err = (e as Error).message; }

    // Every branch below has already SPENT a request, so the dwell must happen on all of them.
    await new Promise((r) => setTimeout(r, 1100));
    if (total === null) { failed++; console.log(`  ${w.checkIn}→${w.checkOut} ${w.guests}g   no quote: ${err}`); continue; }
    if (prev !== null && Math.abs(prev - total) < 1) { same++; continue; }
    changed++;
    console.log(`  ${w.checkIn}→${w.checkOut} ${w.guests}g   ${String(prev ?? '-').padStart(6)} -> ${String(total).padStart(6)}`);

    if (WRITE) {
      await recordObservation({
        propertyId: SLUG, cellId: cellId(SLUG, w.checkIn, w.checkOut, w.guests, 'direct'),
        checkIn: w.checkIn, checkOut: w.checkOut, nights: w.nights, guests: w.guests,
        channel: 'direct', status: 'captured', guestTotal: total,
        source: 'api', url: `${BASE}/api/check-pricing`, capturedBy: 'refresh-direct-quotes',
        capturedAt: stamp, sessionState: 'direct engine quote (/api/check-pricing), RON',
      });
    }
  }

  console.log(`\n  ${changed} moved · ${same} unchanged · ${failed} no quote`);
  if (!WRITE) console.log('\nDry run. Re-run with --write to record.');
  process.exit(0);
})();
