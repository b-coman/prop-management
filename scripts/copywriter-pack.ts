#!/usr/bin/env npx tsx
/**
 * copywriter-pack — CLI wrapper that writes the deterministic copywriter FACT PACK for a brief.
 *
 * The pack-building logic lives in src/lib/growth/copywriterPack.ts (shared with the in-app
 * copywriter, src/services/growth/copywriter.ts) so the operator prototype and production reason
 * from IDENTICAL facts. This script just loads the brief, calls buildCopywriterPack, and writes it.
 *
 * Usage:
 *   npx tsx scripts/copywriter-pack.ts --brief /tmp/brief-autumn.json --out /tmp/cw-autumn.json [--as-of YYYY-MM-DD]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { buildCopywriterPack } from '../src/lib/growth/copywriterPack';
import type { CampaignBrief } from '../src/lib/growth/contracts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const briefFile = arg('brief'); const OUT = arg('out');
const asOfArg = arg('as-of');
if (!briefFile) { console.error('required: --brief <CampaignBrief.json>'); process.exit(1); }

async function main() {
  const brief = JSON.parse(fs.readFileSync(briefFile!, 'utf8')) as CampaignBrief;
  const asOf = asOfArg ? new Date(`${asOfArg}T00:00:00Z`) : undefined;
  const pack = await buildCopywriterPack(brief, { asOf });

  const json = JSON.stringify(pack, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB) · ${pack.guests.length} guests · ${pack.voiceProfile.exemplars.length} voice exemplars`); }
  else console.log(json);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
