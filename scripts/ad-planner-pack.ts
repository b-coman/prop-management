#!/usr/bin/env npx tsx
/**
 * ad-planner-pack — build + print the deterministic ad-planner fact pack for a window, to prototype
 * and verify the pack (the in-app ad planner calls buildAdPlannerPack with the SAME logic). Read-only,
 * zero spend; the money-scoped ads token is pulled from Secret Manager at runtime, never on argv.
 *
 * Usage:
 *   npx tsx scripts/ad-planner-pack.ts --start 2026-09-06 --end 2026-09-17 --value 6372 [--occasion "..."] [--property ...] [--out pack.json]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.env.META_ADS_TOKENS = execSync(
  'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
  { encoding: 'utf8' }
).trim();

import { buildAdPlannerPack } from '@/lib/growth/adPlannerPack';
import type { AdOpportunity } from '@/lib/growth/contracts';

const arg = (n: string, d?: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

const start = arg('start');
const end = arg('end');
if (!start || !end) {
  console.error('required: --start YYYY-MM-DD --end YYYY-MM-DD [--value RON] [--occasion "..."] [--property slug] [--out file]');
  process.exit(2);
}
const property = arg('property', 'prahova-mountain-chalet')!;
const value = arg('value');
const occasionName = arg('occasion');
const OUT = arg('out');

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
  rationale: 'ad-hoc pack build (CLI)',
};

(async () => {
  const pack = await buildAdPlannerPack(opportunity);
  const json = JSON.stringify(pack, null, 2);
  if (OUT) {
    fs.writeFileSync(OUT, json);
    console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB)`);
  } else {
    console.log(json);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
