#!/usr/bin/env npx tsx
/**
 * validate-plan — CLI wrapper around src/lib/growth/validatePlan.ts (the pure planner-stage gate).
 * Runs the same check the in-app orchestration will, on a planner pack + the planner's selection.
 *
 * Usage:
 *   npx tsx scripts/validate-plan.ts --pack /tmp/plan-autumn.json --ids '["id1","id2"]' [--discount 10] [--no-act]
 *
 * Exit code 0 = valid, 1 = rejected — so it can gate a pipeline.
 */
import * as fs from 'fs';
import { validatePlan } from '../src/lib/growth/validatePlan';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const packFile = arg('pack');
const idsRaw = arg('ids', '[]')!;
const discount = arg('discount');
const act = !process.argv.includes('--no-act');

if (!packFile) { console.error('required: --pack <planner-pack.json> --ids \'["..."]\''); process.exit(2); }

const pack = JSON.parse(fs.readFileSync(packFile, 'utf8'));
let ids: string[];
try { ids = JSON.parse(idsRaw); } catch { console.error('--ids must be a JSON array'); process.exit(2); }

// Adapt CLI args into a minimal CampaignBrief shape (the real pipeline passes a full brief file).
const res = validatePlan(pack, {
  act,
  audience: ids.map((guestId) => ({ guestId, angle: '' })),
  offer: { discountPct: discount != null ? Number(discount) : null, description: '' },
});

console.log(`plan validation — ${res.ok ? 'PASS ✅' : 'REJECT ❌'}`);
console.log(`  selected ${res.stats.selected} · eligible ${res.stats.eligible} · cap ${res.stats.runCap}`);
res.errors.forEach((e) => console.log(`  ✖ ${e}`));
res.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
process.exit(res.ok ? 0 : 1);
