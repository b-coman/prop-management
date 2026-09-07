#!/usr/bin/env npx tsx
/**
 * season-pack — the deterministic fact pack for the season-ad-planner skill.
 *
 * Facts here, judgement in the skill. The pack already contains a complete,
 * usable plan (`baseline`) before any reasoning happens; the skill's job is to
 * improve it by exclusion, emphasis and angle, never to rebuild it.
 *
 *   npx tsx scripts/season-pack.ts --start 2026-10-11 --end 2027-04-29 --out /tmp/season.json
 *   npx tsx scripts/season-pack.ts --start … --end … --label "Winter 2026-27" --as-of 2026-09-07
 *
 * Reads only. Never spends, never writes.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// The Meta token lives in Secret Manager. Missing it degrades the ledger and the
// account block to `available:false` — it must not fail the whole pack, the same
// way situation-pack tolerates a missing credential.
if (!process.env.META_ADS_TOKENS) {
  try {
    process.env.META_ADS_TOKENS = execSync(
      'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch {
    console.error('⚠ META_ADS_TOKENS unavailable — ledger and account blocks will be marked unavailable');
  }
}

import { buildSeasonPack } from '@/lib/growth/seasonPack';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

async function main() {
  const start = arg('start');
  const end = arg('end');
  if (!start || !end) {
    console.error('required: --start <YYYY-MM-DD> --end <YYYY-MM-DD> [--property slug] [--label "..."] [--as-of YYYY-MM-DD] [--out file.json]');
    process.exit(2);
  }
  const propertyId = arg('property', 'prahova-mountain-chalet')!;
  const asOfArg = arg('as-of');
  const pack = await buildSeasonPack({
    propertyId,
    start,
    end,
    label: arg('label'),
    asOf: asOfArg ? new Date(`${asOfArg}T00:00:00Z`) : undefined,
  });

  const json = JSON.stringify(pack, null, 2);
  const out = arg('out');
  if (out) {
    fs.writeFileSync(out, json);
    const funded = pack.baseline.slots.filter((s) => s.funded).length;
    console.error(
      `wrote ${out} (${Math.round(json.length / 1024)} KB) — ` +
        `${pack.candidates.length} candidates, ${funded} funded, ${pack.baseline.excluded.length} excluded, ` +
        `${(pack.ledger.remainingMinor / 100).toFixed(0)} RON remaining`
    );
    if (pack.warnings.length) pack.warnings.forEach((w) => console.error(`  ⚠ ${w}`));
  } else {
    console.log(json);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
