#!/usr/bin/env npx tsx
/**
 * test-copywriter — smoke-test the IN-APP copywriter (src/services/growth/copywriter.ts) end to end:
 * build the pack → call Claude → validate → repair. Needs ANTHROPIC_API_KEY in .env.local.
 *
 * Usage:
 *   npx tsx scripts/test-copywriter.ts --campaign <campaignId>     # reconstruct framing from a landed campaign
 *   npx tsx scripts/test-copywriter.ts --brief /tmp/brief.json     # or from a brief file
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { generateDrafts } from '../src/services/growth/copywriter';
import { getCampaign, campaignToBrief } from '../src/services/campaignService';
import type { CampaignBrief } from '../src/lib/growth/contracts';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not in .env.local — add it to smoke-test locally'); process.exit(2); }

  let brief: CampaignBrief;
  const campaignId = arg('campaign');
  const briefFile = arg('brief');
  if (campaignId) {
    const c = await getCampaign(campaignId);
    if (!c) { console.error(`campaign ${campaignId} not found`); process.exit(1); }
    brief = campaignToBrief(c);
    console.log(`reconstructed brief from campaign ${campaignId}: ${brief.audience.length} guests · offer ${JSON.stringify(brief.offer)}`);
  } else if (briefFile) {
    brief = JSON.parse(fs.readFileSync(briefFile, 'utf8'));
  } else {
    console.error('required: --campaign <id> OR --brief <file>'); process.exit(2);
  }

  const t0 = Date.now();
  const res = await generateDrafts(brief);
  console.log(`\n=== generateDrafts → ok:${res.ok} · attempts:${res.attempts} · ${res.drafts.length} drafts · ${Date.now() - t0}ms ===`);
  if (res.errors.length) console.log('errors:', res.errors);
  if (res.warnings.length) console.log('warnings:', res.warnings);
  res.drafts.forEach((d) => {
    console.log(`\n--- ${d.guestId} [${d.language}] facts:${JSON.stringify(d.factsUsed)} ---`);
    console.log(d.body);
  });
  process.exit(res.ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
