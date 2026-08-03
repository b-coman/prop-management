/**
 * Mirror runAnalysisAction (minus auth) to validate the P3 persist→fetch path + seed the first real
 * Situation Report so /admin/situation isn't empty on first open. Writes to the real collections.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const secret = (n: string) => execSync(`gcloud secrets versions access latest --secret=${n} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
if (!process.env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');
if (!process.env.META_ADS_TOKENS) process.env.META_ADS_TOKENS = secret('META_ADS_TOKENS');
import { runSituationAnalysis } from '@/services/growth/situationAnalyst';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';

const P = 'prahova-mountain-chalet';
(async () => {
  const res = await runSituationAnalysis(P);
  if (!res.ok || !res.report) { console.error('analysis failed:', res.errors); process.exit(1); }
  const db = await getAdminDb();
  const ref = db.collection('situationReports').doc();
  const runId = ref.id;
  await ref.set({ propertyId: P, asOf: res.pack.meta.asOf, status: 'open', report: res.report, warnings: res.warnings ?? [], createdBy: 'seed-script', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const batch = db.batch();
  res.opportunities.forEach(o => batch.set(db.collection('opportunities').doc(), { runId, propertyId: P, status: 'pending', action: o.action, window: o.window ?? null, occasion: o.occasion ?? null, valueAtRisk: o.valueAtRisk ?? null, audience: o.audience ?? null, rationale: o.rationale, rejected: o.rejected ?? null, createdAt: FieldValue.serverTimestamp() }));
  await batch.commit();
  console.log(`persisted report ${runId}: ${res.report.flags.length} flags, ${res.opportunities.length} opportunities, ${res.warnings.length} warnings`);

  // read back via the SAME query fetchLatestSituationAction uses (validates the index)
  const snap = await db.collection('situationReports').where('propertyId','==',P).orderBy('createdAt','desc').limit(1).get();
  const doc = snap.docs[0];
  const opps = await db.collection('opportunities').where('runId','==',doc.id).get();
  console.log(`read-back OK: latest report ${doc.id} · headline="${(doc.data().report.headline||'').slice(0,70)}..." · ${opps.size} opportunities`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
