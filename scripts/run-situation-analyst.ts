#!/usr/bin/env npx tsx
/**
 * run-situation-analyst — exercise the IN-APP analyst service (situationAnalyst.runSituationAnalysis)
 * on live data and print its typed output, so we can compare the in-app brain's reasoning against the
 * situation-analyst skill before wiring it to anything (Move 2 · P2 test). Nothing is persisted or sent.
 *
 *   npx tsx scripts/run-situation-analyst.ts
 *   npx tsx scripts/run-situation-analyst.ts --steer "September is fine, do not flag it"
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const secret = (n: string) => execSync(`gcloud secrets versions access latest --secret=${n} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');
if (!process.env.META_ADS_TOKENS) process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');

import { runSituationAnalysis } from '@/services/growth/situationAnalyst';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const steer = arg('steer');

(async () => {
  const res = await runSituationAnalysis(PROPERTY, { steer });
  console.log(`\n=== ok:${res.ok} · attempts:${res.attempts} · flags:${res.report?.flags?.length ?? 0} · opps:${res.opportunities.length} ===`);
  if (res.errors.length) console.log('ERRORS:\n  -', res.errors.join('\n  - '));
  if (res.warnings.length) console.log('WARNINGS (soft grounding):\n  -', res.warnings.join('\n  - '));

  const r = res.report;
  if (r) {
    console.log('\nHEADLINE\n  ' + r.headline);
    console.log('\nFLAGS');
    r.flags.forEach(f => console.log(`  [${f.severity}] ${f.what}\n      → ${f.evidence.path} = ${f.evidence.value}  (${f.whoActs})`));
    console.log('\nNORMAL'); r.normal.forEach(n => console.log('  - ' + n));
    console.log('\nQUESTIONS'); r.questions.forEach(q => console.log('  - ' + q));
    console.log(`\nCONFIDENCE  sure:${r.confidence.sure.length} · thin:${r.confidence.thin.length} · guessing:${r.confidence.guessing.length}`);
    r.confidence.thin.forEach(t => console.log('  thin: ' + t));
    if (r.packGaps?.length) { console.log('\nPACK GAPS'); r.packGaps.forEach(g => console.log('  - ' + g)); }
  }
  console.log('\nOPPORTUNITIES');
  res.opportunities.forEach((o, i) => {
    const w = o.window ? ` · ${o.window.start}→${o.window.end} (${o.window.nights}n)` : '';
    const v = o.valueAtRisk ? ` · ~${o.valueAtRisk} RON` : '';
    console.log(`  [${i}] ${o.action.toUpperCase()}${w}${v}`);
    if (o.audience) console.log(`       audience: ${o.audience}`);
    console.log(`       why: ${o.rationale}`);
    if (o.rejected) console.log(`       rejected: ${o.rejected}`);
  });
  process.exit(res.ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
