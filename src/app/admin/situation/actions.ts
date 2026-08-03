'use server';
/**
 * Situation admin actions (Move 2 · P3). `runAnalysisAction` runs the IN-APP analyst and PERSISTS the
 * Situation Report + routed opportunities; `fetchLatestSituationAction` reads the newest run for the
 * read-only console. Read-only phase — no edit/challenge/approve yet (P4/P5). Super-admin gated;
 * Admin SDK writes only.
 *
 * NB: a 'use server' file may ONLY export async functions (never types/objects) — the doc shapes live
 * in the console component, matched structurally.
 */
import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { runSituationAnalysis } from '@/services/growth/situationAnalyst';
import type { SituationReport, AnalystOpportunity } from '@/lib/growth/contracts';

const logger = loggers.campaign;

async function requireActor(): Promise<string> {
  const user = await requireSuperAdmin();
  return user.email || user.uid;
}

/** Run the in-app analyst for a property and persist the report + opportunities. Super-admin gated. */
export async function runAnalysisAction(propertyId: string): Promise<
  | { ok: true; runId: string; opportunities: number; warnings: number }
  | { ok: false; error: string }
> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }

  try {
    const res = await runSituationAnalysis(propertyId);
    if (!res.ok || !res.report) {
      logger.warn('runAnalysisAction: analysis failed', { propertyId, errors: res.errors });
      return { ok: false, error: res.errors.join('; ') || 'analysis-failed' };
    }

    const db = await getAdminDb();
    const asOf = res.pack.meta.asOf;

    const reportRef = db.collection('situationReports').doc();
    const runId = reportRef.id;
    await reportRef.set({
      propertyId,
      asOf,
      status: 'open',
      report: res.report,
      warnings: res.warnings ?? [],
      createdBy: actor,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Each opportunity is its own doc (per-item status for P4/P5). Optionals default to null —
    // the Admin SDK rejects `undefined` on write.
    const batch = db.batch();
    res.opportunities.forEach((o) => {
      const ref = db.collection('opportunities').doc();
      batch.set(ref, {
        runId,
        propertyId,
        status: 'pending',
        action: o.action,
        window: o.window ?? null,
        occasion: o.occasion ?? null,
        valueAtRisk: o.valueAtRisk ?? null,
        audience: o.audience ?? null,
        rationale: o.rationale,
        rejected: o.rejected ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    logger.info('runAnalysisAction: persisted', { actor, propertyId, runId, opps: res.opportunities.length, warnings: res.warnings.length });
    revalidatePath('/admin/situation');
    return { ok: true, runId, opportunities: res.opportunities.length, warnings: res.warnings.length };
  } catch (e) {
    logger.error('runAnalysisAction failed', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Fetch the newest report + its opportunities for the read-only console. Null if none/auth failure. */
export async function fetchLatestSituationAction(propertyId: string): Promise<{
  report: { id: string; propertyId: string; asOf: string; createdAt?: string; createdBy?: string; status: string; report: SituationReport; warnings?: string[] };
  opportunities: Array<AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string; createdAt?: string }>;
} | null> {
  try {
    await requireSuperAdmin();
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }

  try {
    const db = await getAdminDb();
    const snap = await db
      .collection('situationReports')
      .where('propertyId', '==', propertyId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return null;

    const doc = snap.docs[0];
    const report = convertTimestampsToISOStrings({ id: doc.id, ...doc.data() }) as {
      id: string; propertyId: string; asOf: string; createdAt?: string; createdBy?: string; status: string; report: SituationReport; warnings?: string[];
    };

    const oppSnap = await db.collection('opportunities').where('runId', '==', doc.id).get();
    const opportunities = oppSnap.docs
      .map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string; createdAt?: string })
      .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

    return { report, opportunities };
  } catch (e) {
    logger.error('fetchLatestSituationAction failed', e as Error, { propertyId });
    return null;
  }
}
