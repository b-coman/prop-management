#!/usr/bin/env npx tsx
/**
 * Live test for the example-stays reasoner (landing-page engine P2). Runs buildExampleStays against
 * REAL Firestore (availability + priceCalendars + holidays) for a dated window and a broad season, and
 * prints the proposed stays so we can eyeball truth (free? min-stay OK? price sane? occasion real?).
 *
 * Usage:
 *   npx tsx scripts/test-example-stays.ts
 *   npx tsx scripts/test-example-stays.ts --property coltei-apartment-bucharest
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { buildExampleStays, type LandingPeriod } from '@/lib/landing/exampleStays';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const PROPERTY = arg('property', 'prahova-mountain-chalet')!;

const cases: { title: string; period: LandingPeriod; opts?: Parameters<typeof buildExampleStays>[2] }[] = [
  { title: 'WINDOW — heat campaign (23–31 Aug 2026)', period: { kind: 'window', start: '2026-08-23', end: '2026-08-31' } },
  { title: 'SEASON — autumn (Oct→mid-Dec 2026, family occupancy)', period: { kind: 'season', start: '2026-10-01', end: '2026-12-15' }, opts: { guests: 6 } },
  { title: 'SEASON — open-ended from today (150-day horizon)', period: { kind: 'season' } },
];

async function main() {
  console.log(`\nProperty: ${PROPERTY}\n${'='.repeat(72)}`);
  for (const c of cases) {
    console.log(`\n▶ ${c.title}`);
    const stays = await buildExampleStays(PROPERTY, c.period, c.opts);
    if (!stays.length) { console.log('  (no stays proposed)'); continue; }
    for (const s of stays) {
      const occ = s.occasion ? `  [${s.occasion}]` : '';
      const price = s.priceHint != null ? `de la ${s.priceHint.toLocaleString('ro-RO')} RON` : '(no price)';
      const label = typeof s.label === 'string' ? s.label : s.label.ro;
      console.log(`  • ${s.start} → ${s.end}  ${s.nights}n  ${s.guests}p  ${price}${occ}`);
      console.log(`      "${label}"`);
    }
  }
  console.log('');
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
