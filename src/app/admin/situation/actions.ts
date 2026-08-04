'use server';
/**
 * Situation admin actions (Move 2 · P3 + P4). Run/persist the analyst, and the human loop over its
 * output — challenge/re-run with a steer, edit a proposal, dismiss/snooze/restore. NO arm hand-off yet
 * (approve → a real draft is P5); nothing here sends or spends. Super-admin gated; Admin SDK writes.
 *
 * NB: a 'use server' file may ONLY export async functions (never types/objects) — doc shapes live in
 * the console component, matched structurally; the persist helper below is non-exported (allowed).
 */
import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { runSituationAnalysis, type RunSituationAnalysisResult } from '@/services/growth/situationAnalyst';
import type { SituationReport, AnalystOpportunity, RecommendedAction } from '@/lib/growth/contracts';
import { generateAdProposalAction } from '@/app/admin/ads/actions';
import { generatePagePostAction } from '@/app/admin/page-posts/actions';

const logger = loggers.campaign;

async function requireActor(): Promise<string> {
  const user = await requireSuperAdmin();
  return user.email || user.uid;
}

/** Persist a completed analysis (report + its opportunities). Non-exported helper. Returns the runId. */
async function persistAnalysis(
  propertyId: string,
  actor: string,
  res: RunSituationAnalysisResult,
  extra?: { steer?: string; supersedesRunId?: string },
): Promise<string> {
  const db = await getAdminDb();
  const reportRef = db.collection('situationReports').doc();
  const runId = reportRef.id;
  await reportRef.set({
    propertyId,
    asOf: res.pack.meta.asOf,
    status: 'open',
    report: res.report,
    warnings: res.warnings ?? [],
    steer: extra?.steer ?? null,
    supersedesRunId: extra?.supersedesRunId ?? null,
    createdBy: actor,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const batch = db.batch();
  (res.opportunities ?? []).forEach((o) => {
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
      edited: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return runId;
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
    const runId = await persistAnalysis(propertyId, actor, res);
    logger.info('runAnalysisAction: persisted', { actor, propertyId, runId, opps: res.opportunities.length });
    revalidatePath('/admin/situation');
    return { ok: true, runId, opportunities: res.opportunities.length, warnings: res.warnings.length };
  } catch (e) {
    logger.error('runAnalysisAction failed', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Re-run the analyst with the owner's CHALLENGE note (the steer), supersede the current run (P4). */
export async function reRunWithSteerAction(propertyId: string, steer: string): Promise<
  | { ok: true; runId: string; opportunities: number }
  | { ok: false; error: string }
> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  const note = steer?.trim();
  if (!note) return { ok: false, error: 'empty-steer' };
  try {
    const db = await getAdminDb();
    // The run being challenged (to record supersession + retire it from the "latest" view).
    const prev = await db.collection('situationReports').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(1).get();
    const supersedesRunId = prev.empty ? undefined : prev.docs[0].id;

    const res = await runSituationAnalysis(propertyId, { steer: note });
    if (!res.ok || !res.report) {
      logger.warn('reRunWithSteerAction: analysis failed', { propertyId, errors: res.errors });
      return { ok: false, error: res.errors.join('; ') || 'analysis-failed' };
    }
    const runId = await persistAnalysis(propertyId, actor, res, { steer: note, supersedesRunId });
    if (supersedesRunId) {
      await db.collection('situationReports').doc(supersedesRunId).update({ status: 'superseded', updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    }
    logger.info('reRunWithSteerAction: persisted', { actor, propertyId, runId, supersedesRunId });
    revalidatePath('/admin/situation');
    return { ok: true, runId, opportunities: res.opportunities.length };
  } catch (e) {
    logger.error('reRunWithSteerAction failed', e as Error, { propertyId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Edit an opportunity before it is acted on (owner override). Only the provided fields change. */
export async function editOpportunityAction(
  oppId: string,
  patch: {
    action?: RecommendedAction;
    window?: { start: string; end: string; nights: number } | null;
    occasion?: string | null;
    audience?: string | null;
    valueAtRisk?: number | null;
    rationale?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  try {
    const db = await getAdminDb();
    const update: Record<string, unknown> = { edited: true, editedBy: actor, editedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    if (patch.action !== undefined) update.action = patch.action;
    if (patch.window !== undefined) update.window = patch.window;
    if (patch.occasion !== undefined) update.occasion = patch.occasion;
    if (patch.audience !== undefined) update.audience = patch.audience;
    if (patch.valueAtRisk !== undefined) update.valueAtRisk = patch.valueAtRisk;
    if (patch.rationale !== undefined) update.rationale = patch.rationale;
    await db.collection('opportunities').doc(oppId).update(update);
    logger.info('editOpportunityAction', { actor, oppId, fields: Object.keys(patch) });
    revalidatePath('/admin/situation');
    return { ok: true };
  } catch (e) {
    logger.error('editOpportunityAction failed', e as Error, { oppId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Dismiss an opportunity with a reason (a calibration signal). */
export async function dismissOpportunityAction(oppId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  try {
    const db = await getAdminDb();
    await db.collection('opportunities').doc(oppId).update({
      status: 'dismissed',
      dismissReason: reason?.trim() || null,
      disposedBy: actor,
      disposedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    logger.info('dismissOpportunityAction', { actor, oppId });
    revalidatePath('/admin/situation');
    return { ok: true };
  } catch (e) {
    logger.error('dismissOpportunityAction failed', e as Error, { oppId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Snooze an opportunity (set aside without a verdict). */
export async function snoozeOpportunityAction(oppId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  try {
    const db = await getAdminDb();
    await db.collection('opportunities').doc(oppId).update({ status: 'snoozed', disposedBy: actor, disposedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    revalidatePath('/admin/situation');
    return { ok: true };
  } catch (e) {
    logger.error('snoozeOpportunityAction failed', e as Error, { oppId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Restore a dismissed/snoozed opportunity back to pending. */
export async function restoreOpportunityAction(oppId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireActor();
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  try {
    const db = await getAdminDb();
    await db.collection('opportunities').doc(oppId).update({ status: 'pending', dismissReason: null, disposedBy: null, disposedAt: null, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath('/admin/situation');
    return { ok: true };
  } catch (e) {
    logger.error('restoreOpportunityAction failed', e as Error, { oppId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/**
 * Approve an opportunity → hand it to the matching arm's DRAFT flow (P5 — the seam that closes the
 * loop). ads/page create a real draft (which keeps its OWN review — nothing goes live here); whatsapp
 * routes to /admin/campaigns to pick recipients (the in-app WhatsApp planner is M6, deferred);
 * price/minstay/los/ota are owner actions → marked 'accepted'. Only a 'pending' opportunity can be
 * approved. Super-admin gated.
 */
export async function approveOpportunityAction(oppId: string): Promise<
  | { ok: true; status: 'approved' | 'accepted'; handoffUrl?: string; note?: string }
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
    const db = await getAdminDb();
    const ref = db.collection('opportunities').doc(oppId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, error: 'not-found' };
    const o = snap.data() as AnalystOpportunity & { propertyId: string; status: string };
    if (o.status !== 'pending') return { ok: false, error: `not-pending:${o.status}` };

    let handoff: { arm: string; ref?: string; url?: string; note?: string };
    let status: 'approved' | 'accepted' = 'approved';

    if (o.action === 'ads') {
      if (!o.window) return { ok: false, error: 'ads opportunity has no window' };
      const res = await generateAdProposalAction({
        propertyId: o.propertyId,
        start: o.window.start,
        end: o.window.end,
        occasion: o.occasion ?? undefined,
        valueAtRisk: o.valueAtRisk ?? undefined,
        audience: o.audience ?? undefined,
      });
      if (!res.ok) return { ok: false, error: `ad draft failed: ${res.error}` };
      if ('declined' in res) return { ok: false, error: `the ad planner declined: ${res.rationale}` };
      handoff = { arm: 'ads', ref: res.adCampaignId, url: `/admin/ads/${res.adCampaignId}` };
    } else if (o.action === 'page') {
      const prompt = o.occasion?.trim()
        ? o.occasion.trim()
        : `A warm post to help fill ${o.window ? `${o.window.start}–${o.window.end}` : 'the upcoming window'}`;
      const res = await generatePagePostAction({ propertyId: o.propertyId, prompt, goal: 'keep the page warm and support the fill', audience: o.audience ?? undefined });
      if (!res.ok) return { ok: false, error: `page draft failed: ${res.error}` };
      handoff = { arm: 'page', ref: res.id, url: '/admin/page-posts' };
    } else if (o.action === 'whatsapp') {
      handoff = { arm: 'whatsapp', url: '/admin/campaigns', note: 'Pick recipients + generate messages in Campaigns (the in-app WhatsApp recipient planner is a later phase).' };
    } else {
      // price / minstay / los / ota — owner actions; nothing to draft.
      status = 'accepted';
      handoff = { arm: 'owner', note: 'Owner action — no draft. Marked accepted for the record.' };
    }

    await ref.update({ status, handoff, approvedBy: actor, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    logger.info('approveOpportunityAction', { actor, oppId, action: o.action, status, handoffRef: handoff.ref });
    revalidatePath('/admin/situation');
    return { ok: true, status, handoffUrl: handoff.url, note: handoff.note };
  } catch (e) {
    logger.error('approveOpportunityAction failed', e as Error, { oppId });
    return { ok: false, error: (e as Error).message || 'internal-error' };
  }
}

/** Fetch the newest report + its opportunities for the console. Null if none/auth failure. */
export async function fetchLatestSituationAction(propertyId: string): Promise<{
  report: { id: string; propertyId: string; asOf: string; createdAt?: string; createdBy?: string; status: string; report: SituationReport; warnings?: string[]; steer?: string | null };
  opportunities: Array<AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string; createdAt?: string; edited?: boolean; dismissReason?: string | null; handoff?: { arm: string; ref?: string; url?: string; note?: string } | null }>;
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
      id: string; propertyId: string; asOf: string; createdAt?: string; createdBy?: string; status: string; report: SituationReport; warnings?: string[]; steer?: string | null;
    };

    const oppSnap = await db.collection('opportunities').where('runId', '==', doc.id).get();
    const opportunities = oppSnap.docs
      .map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as AnalystOpportunity & { id: string; runId: string; propertyId: string; status: string; createdAt?: string; edited?: boolean; dismissReason?: string | null; handoff?: { arm: string; ref?: string; url?: string; note?: string } | null })
      .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));

    return { report, opportunities };
  } catch (e) {
    logger.error('fetchLatestSituationAction failed', e as Error, { propertyId });
    return null;
  }
}
