#!/usr/bin/env npx tsx
/**
 * situation-pack (CLI/backtest wrapper) — builds the deterministic FACT PACK via the IN-APP builder
 * (`src/lib/growth/situationPack.ts`) and writes it to a file or stdout. The pack logic lives in the
 * lib so the in-app analyst service and this CLI produce the SAME pack (arch §7 M2/P1).
 *
 *   - Builds COMPUTE the pack; the analyst READS it (never does arithmetic).
 *   - `--as-of <YYYY-MM-DD>` rewinds the clock for a historical backtest (only stay-date-derived
 *     facts are reconstructable — see the pack's `dataQuality`).
 *
 * Usage:
 *   npx tsx scripts/situation-pack.ts                          # today, prahova
 *   npx tsx scripts/situation-pack.ts --as-of 2025-07-22       # backtest
 *   npx tsx scripts/situation-pack.ts --property coltei-apartment-bucharest
 *   npx tsx scripts/situation-pack.ts --out pack.json
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { execSync } from 'child_process';
import { buildSituationPack } from '@/lib/growth/situationPack';

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};

const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const AS_OF = new Date(`${arg('as-of', new Date().toISOString().slice(0, 10))}T00:00:00Z`);
const OUT = arg('out');

// Dev convenience: the in-app runtime already carries META_ADS_TOKENS; locally, load it from Secret
// Manager if absent so currentSignals populates. Best-effort — a missing token just degrades
// currentSignals to available:false (never breaks the build). In-app this block never runs.
if (!process.env.META_ADS_TOKENS) {
  try {
    process.env.META_ADS_TOKENS = execSync(
      'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    /* no creds in this environment → currentSignals degrades to available:false */
  }
}

async function main() {
  const pack = await buildSituationPack(PROPERTY, AS_OF, { generator: 'scripts/situation-pack.ts' });
  const json = JSON.stringify(pack, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB)`); }
  else console.log(json);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
