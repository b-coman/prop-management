#!/usr/bin/env npx tsx
/**
 * warmup-pack — CLI wrapper: emits the CampaignBrief for a no-ask "share" warm-up campaign.
 * Audience logic lives in src/lib/growth/warmupAudience.ts (shared with the in-app cron).
 *
 *   npx tsx scripts/warmup-pack.ts --segment keepintouch --property prahova-mountain-chalet --out /tmp/warm.json
 *   npx tsx scripts/warmup-pack.ts --segment coldreintro --out /tmp/cold.json [--cap 15] [--as-of YYYY-MM-DD]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { buildWarmupBrief, type WarmupSegment } from '../src/lib/growth/warmupAudience';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

async function main() {
  const segment = (arg('segment', 'keepintouch') as WarmupSegment);
  const propertyId = arg('property', 'prahova-mountain-chalet');
  const capArg = arg('cap'); const asOfArg = arg('as-of'); const OUT = arg('out');
  const { brief, eligibleCount } = await buildWarmupBrief(segment, {
    propertyId,
    asOf: asOfArg ? new Date(`${asOfArg}T00:00:00Z`) : undefined,
    cap: capArg ? Number(capArg) : undefined,
  });
  const json = JSON.stringify(brief, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} · segment=${segment} · ${brief.audience.length}/${eligibleCount} eligible`); }
  else console.log(json);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
