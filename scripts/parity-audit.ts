#!/usr/bin/env npx tsx
/**
 * parity-audit — is the stored data still true?
 *
 * A capture is a photograph of a price under settings that were live at that moment. Change a
 * discount, a minimum stay, or the direct rate, and some of those photographs stop describing
 * anything real - while still looking like evidence. Today alone: Airbnb's weekly moved, Booking's
 * weekly moved, Booking's 4-day rate was reactivated and then doubled, Booking's minimum stay went
 * to 4 nights in one period, the Airbnb top-rated discount was removed, and the direct rates changed.
 *
 * This reports, per channel, which observations predate a recorded change that would have moved them,
 * so the answer to "should we re-scrape everything?" is a list rather than a feeling.
 *
 * Read-only.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { latestByCell } from '@/services/growth/parityObservations';
import { getChannels } from '@/services/channelService';
import { isSuperseded, captureDay } from '@/lib/parity/supersession';

const SLUG = process.argv[2] ?? 'prahova-mountain-chalet';



(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const channels = await getChannels(SLUG);
  const obs = [...(await latestByCell(SLUG, { kind: 'self' })).values()].filter((o) => o.checkOut >= today);

  const rows: Array<{ ch: string; why: string; cell: string; when: string }> = [];
  let fresh = 0;

  for (const o of obs) {
    const c = channels.byId.get(o.channel);
    const when = captureDay(o.capturedAt);
    const chg = c?.discountsChangedAt;
    const reasons: string[] = [];
    if (isSuperseded(o.capturedAt, o.nights, chg)) {
      reasons.push(`${chg!.note ?? 'discounts changed'} (${chg!.date})`);
    }
    if (!reasons.length) { fresh++; continue; }
    rows.push({ ch: o.channel, why: reasons.join('; '),
      cell: `${o.checkIn}→${o.checkOut} ${o.nights}n ${o.guests}g`, when });
  }

  console.log(`${SLUG} — ${obs.length} forward observations\n`);
  console.log(`  still trustworthy: ${fresh}`);
  console.log(`  superseded by a recorded settings change: ${rows.length}\n`);

  const byCh = new Map<string, typeof rows>();
  for (const r of rows) { if (!byCh.has(r.ch)) byCh.set(r.ch, []); byCh.get(r.ch)!.push(r); }
  for (const [ch, rs] of [...byCh.entries()].sort()) {
    console.log(`  ${ch} — ${rs.length} cell(s)`);
    console.log(`    ${rs[0].why}`);
    for (const r of rs.sort((a, b) => a.cell.localeCompare(b.cell))) {
      console.log(`      ${r.cell.padEnd(34)} captured ${r.when}`);
    }
    console.log('');
  }

  // Oldest reading, whatever the reason - the ordinary staleness the skill's 4-6 week cadence covers.
  const ages = obs.map((o) => captureDay(o.capturedAt)).filter(Boolean).sort();
  if (ages.length) console.log(`  oldest reading of any kind: ${ages[0]}`);
  if (!rows.length) console.log('  Nothing is known to be superseded. A refresh would be cadence, not repair.');
  process.exit(0);
})();
