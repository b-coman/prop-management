#!/usr/bin/env npx tsx
/**
 * ad-creative — run the FULL ad intelligence chain for a window and print it: build the pack once →
 * ad planner (AdBrief) → ad copywriter (copy + photos). Prototyping/verification only; it PLANS and
 * WRITES, it never creates or activates anything on Meta. Tokens from Secret Manager.
 *
 * Usage:
 *   npx tsx scripts/ad-creative.ts --start 2026-09-06 --end 2026-09-17 --value 6372 [--occasion "..."] [--property slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const secret = (name: string) =>
  execSync(`gcloud secrets versions access latest --secret=${name} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');
process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');

import { buildAdPlannerPack } from '@/lib/growth/adPlannerPack';
import { generateAdPlan } from '@/services/growth/adPlanner';
import { generateAdCreative } from '@/services/growth/adCopywriter';
import type { AdOpportunity } from '@/lib/growth/contracts';

const arg = (n: string, d?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

const start = arg('start');
const end = arg('end');
if (!start || !end) {
  console.error('required: --start YYYY-MM-DD --end YYYY-MM-DD [--value RON] [--occasion "..."] [--property slug]');
  process.exit(2);
}
const property = arg('property', 'prahova-mountain-chalet')!;
const value = arg('value');
const occasionName = arg('occasion');
const framing = { goal: arg('goal'), audience: arg('audience') };

const nights = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
const daysOut = Math.max(0, Math.round((Date.parse(start) - Date.now()) / 86400000));

const opportunity: AdOpportunity = {
  id: `adhoc-${start}-${end}`,
  propertyId: property,
  source: 'gap',
  window: { start, end, nights },
  daysOut,
  occasion: occasionName ? { name: occasionName, type: 'ad-hoc', startDate: start, endDate: end } : null,
  valueAtRisk: value ? Number(value) : null,
  instrument: 'ads',
  rationale: 'ad-hoc creative (CLI)',
};

const ron = (minor: number) => `${(minor / 100).toFixed(2)} RON`;
const short = (p: string) => p.split('/').pop();

(async () => {
  const t0 = Date.now();
  if (framing.goal || framing.audience) console.log(`framing → goal: ${framing.goal ?? '(none)'} · audience: ${framing.audience ?? '(none)'}`);
  const pack = await buildAdPlannerPack(opportunity, { framing });
  const plan = await generateAdPlan(opportunity, { pack });
  console.log(`\n=== PLAN — ${plan.ok ? 'VALID' : 'REJECTED'} (${plan.attempts} attempt(s)) ===`);
  const b = plan.brief;
  if (!plan.ok || !b || !b.act) {
    console.log(b ? `act:${b.act} · ${b.rationale}` : `errors: ${plan.errors.join(' · ')}`);
    process.exit(plan.ok ? 0 : 1);
  }
  console.log(`cities: ${b.targeting.cities.map((c) => `${c.name} r${c.radius}km`).join(', ')}`);
  console.log(`budget: ${ron(b.dailyBudgetMinor)}/day · end ${b.endTime.slice(0, 10)}`);

  const creative = await generateAdCreative(b, pack.assets, { framing });
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n=== CREATIVE — ${creative.ok ? 'VALID' : 'REJECTED'} (${creative.attempts} attempt(s), ${secs}s total) ===`);
  const c = creative.creative;
  if (c) {
    c.copy.forEach((v, i) => {
      console.log(`\n[${i + 1}] (${v.cta})${v.headline ? `  «${v.headline}»` : ''}`);
      console.log(`    ${v.primary}`);
    });
    console.log(`\nphotos (${c.assetPaths.length}): ${c.assetPaths.map(short).join(', ')}`);
    if (c.notes) console.log(`notes: ${c.notes}`);
    if (c.assetGaps?.length) {
      console.log(`\nMISSING SHOTS (${c.assetGaps.length}):`);
      c.assetGaps.forEach((g) => console.log(`  - [${g.transform}] ${g.need}\n    nearest: ${short(g.nearestAssetPath)} — ${g.whyInsufficient}`));
    }
  }
  if (creative.warnings.length) console.log(`\n⚠ ${creative.warnings.join(' · ')}`);
  if (!creative.ok) console.log(`\n✖ ${creative.errors.join(' · ')}`);
  process.exit(creative.ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
