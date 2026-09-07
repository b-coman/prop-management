#!/usr/bin/env npx tsx
/**
 * pricing-position — the same roll-up the admin Position tab shows, in the terminal.
 *
 * Shares BOTH the roll-up (`buildPeriodPositions`) and the data loading
 * (`loadPeriodPositions`) with the admin Position tab and the season pack, so all
 * three read the same numbers and cannot drift into disagreeing.
 *
 *   npx tsx scripts/pricing-position.ts [slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { loadPeriodPositions } from '@/services/growth/parityPositions';

const SLUG = process.argv[2] ?? 'prahova-mountain-chalet';
const n = (v: number) => Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const LABEL: Record<string, string> = {
  losing: 'you cost more',
  level: 'same price',
  thin: 'barely cheaper',
  healthy: 'you are cheaper',
  overshoot: 'you are too low',
  unmeasured: 'NOT CHECKED',
};

(async () => {
  const { rows, summary: s } = await loadPeriodPositions(SLUG);

  console.log(`\n${SLUG} — ${s.openNights} nights unsold, ${n(s.totalValueAtRisk)} lei`);
  console.log(`  ${n(s.valueAtRiskLosing)} lei in ${s.losing} period(s) where a platform is cheaper than you`);
  console.log(`  ${n(s.valueAtRiskUnmeasured)} lei in ${s.unmeasured} period(s) never checked\n`);
  console.log('period                 dates              occ  open    unsold   if a guest compares      oldest');
  console.log('-'.repeat(100));
  for (const r of rows) {
    console.log(
      `${r.name.slice(0, 21).padEnd(22)}${r.startDate.slice(5)}→${r.endDate.slice(5)}  ${String(r.occupancyPct).padStart(3)}% ${String(r.openNights).padStart(5)} ${n(r.valueAtRisk).padStart(9)}   ` +
      `${(LABEL[r.verdict] ?? r.verdict).padEnd(17)}${r.worstGapPct !== null ? ((r.worstGapPct > 0 ? '+' : '') + (r.worstGapPct * 100).toFixed(1) + '%').padStart(7) : '      -'}` +
      `${r.freshestAgeDays !== null ? `  ${r.freshestAgeDays}d` : '   -'}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
