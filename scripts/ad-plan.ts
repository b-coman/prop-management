#!/usr/bin/env npx tsx
/**
 * ad-plan — run the in-app ad planner (generateAdPlan) against a real window and print the resulting
 * AdBrief + validation. Prototyping/verification only; it PLANS, it never creates or activates
 * anything on Meta. Tokens (ANTHROPIC_API_KEY + META_ADS_TOKENS) are pulled from Secret Manager.
 *
 * Usage:
 *   npx tsx scripts/ad-plan.ts --start 2026-09-06 --end 2026-09-17 --value 6372 [--occasion "..."] [--property slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const secret = (name: string) =>
  execSync(`gcloud secrets versions access latest --secret=${name} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');
process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');

import { generateAdPlan } from '@/services/growth/adPlanner';
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
  rationale: 'ad-hoc plan (CLI)',
};

const ron = (minor: number) => `${(minor / 100).toFixed(2)} RON`;

(async () => {
  const t0 = Date.now();
  const res = await generateAdPlan(opportunity);
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n=== ad plan for ${property} ${start}→${end} (${nights}n, ${daysOut}d out) — ${res.ok ? 'VALID' : 'REJECTED'} in ${res.attempts} attempt(s), ${secs}s ===\n`);
  const b = res.brief;
  if (b) {
    console.log(`act: ${b.act}`);
    console.log(`objective: ${b.objective}`);
    console.log(`cities: ${b.targeting.cities.map((c) => `${c.name}(${c.key}) r${c.radius}km`).join(', ') || '(none)'}`);
    console.log(`daily budget: ${ron(b.dailyBudgetMinor)}  ·  end: ${b.endTime}`);
    console.log(`\ncreativeBrief:\n  ${b.creativeBrief}`);
    console.log(`\nrationale:\n  ${b.rationale}`);
  }
  if (res.warnings.length) console.log(`\n⚠ warnings: ${res.warnings.join(' · ')}`);
  if (!res.ok) console.log(`\n✖ errors: ${res.errors.join(' · ')}`);
  process.exit(res.ok ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
