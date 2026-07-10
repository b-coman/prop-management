/**
 * adExecutionGateway — the activation choke point for Meta ad campaigns
 * (plan §13 Fable H5: the existing `executionGateway.ts` is message-shaped —
 * consent/suppression/messageLog — and has no approval check, spend-cap
 * check, or notion of un-pausing an ad; "routes through the gateway" was
 * fiction for ads, so this is a DEDICATED gateway). Mirrors the shape of
 * `executionGateway.ts` (resolve → gate → act → audit) but the gates are
 * ads-specific and money-shaped:
 *
 *  1. Two-switch dry-run gate (`GROWTH_ADS_ENABLED` + `GROWTH_ADS_MODE=live`)
 *     — a UI click alone can never spend (Fable H5).
 *  2. Operator-approval + spend-cap gate — the `adCampaigns` doc for this
 *     property+campaign must exist, be `status === 'approved'`, and carry a
 *     SNAPSHOTTED `spendCapMinor` — no spend cap, no activation (Fable
 *     H5/M3/M4).
 *  3. Ownership assert — the Meta campaign is fetched and its `account_id`
 *     MUST equal the property's resolved ad account. Under a SHARED agency
 *     token, auth alone does not stop `activate(propA, campaignOfB)` from
 *     succeeding — this is the check that does (Fable H2).
 *  4. **Activate ALL THREE hierarchy levels** (plan REVISIONS B1 — the
 *     critical fix over Phase 1, which only un-paused the campaign). Meta's
 *     `effective_status` is a hierarchy ROLLUP: campaign, ad set(s), and
 *     ad(s) are each independently PAUSED at creation (`createResource`'s
 *     uniform enforcement), and un-pausing only the campaign leaves the
 *     ad set(s)/ad(s) PAUSED underneath it — nothing delivers. So this gate
 *     activates `metaCampaignId` + every id in the trusted `adCampaigns` doc's
 *     `metaAdSetIds[]` + `metaAdIds[]`, top-down, auditing the whole attempt.
 *     If ANY activate call fails partway through, it FAILS CLOSED: best-effort
 *     re-pauses everything already flipped (reverse order) before rejecting —
 *     the chain must never be left half-active. Un-pausing children ids that
 *     don't belong to this property is not a NEW risk beyond what step 3
 *     already covers: they come from the SAME `adCampaigns` doc whose
 *     `metaCampaignId` just passed the ownership assert, and `createCampaignChain`
 *     is the only writer of that doc (never user input).
 *
 * `lifecycle.pauseCampaign` deliberately stays CAMPAIGN-ONLY and is NOT
 * mirrored here with a multi-level pause: pausing an ancestor already gates
 * every descendant (the same rollup, working in the STOP direction) — pausing
 * only the campaign is sufficient to stop spend, so the STOP primitive is kept
 * simple. Only the START direction needs every level flipped.
 *
 * Every activation attempt (dry-run, rejected, or activated) writes an audit
 * doc to `adAuditLog` so the money path has a complete trail regardless of
 * outcome — same discipline as `executionGateway`'s messageLog writes. On full
 * success this gateway ALSO writes `adCampaigns.status='active'` (+
 * `effectiveStatus` from a post-activation read-back) — the gateway, not the
 * console, owns the money-state truth (plan REVISIONS S2, pulled forward into
 * this Build-A gateway since Build B's console doesn't exist yet).
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { AdCampaignStatus } from '@/types';
import { isAdsLiveAllowed } from '@/config/growth-ads';
import { resolveAdContext } from './metaAds/adContext';
import { metaGraph, activateResource, pauseResource } from './metaAds/client';

const logger = loggers.ads;

type AdminDb = Awaited<ReturnType<typeof getAdminDb>>;

export type ActivateStatus = 'dry-run' | 'activated' | 'rejected';

export interface ActivateResult {
  status: ActivateStatus;
  reason?: string;
}

export interface ActivateOptions {
  /** Who/what triggered this activation attempt — recorded on the audit doc. */
  actor?: string;
}

interface AdCampaignDoc {
  propertyId?: string;
  metaCampaignId?: string;
  metaAdSetIds?: string[];
  metaAdIds?: string[];
  status?: AdCampaignStatus;
  spendCapMinor?: number;
}

interface MetaCampaignReadBack {
  id: string;
  account_id?: string;
  effective_status?: string;
}

/** One Meta object to activate/roll-back — `kind` is audit/log context only, Meta doesn't care. */
interface ActivationTarget {
  kind: 'campaign' | 'adSet' | 'ad';
  id: string;
}

/**
 * Meta returns a campaign's `account_id` WITHOUT the `act_` prefix (e.g.
 * "543311232953437"), while our resolved ad-account config carries it WITH
 * the prefix (e.g. "act_543311232953437", the form the Marketing API expects
 * in a path). Normalize both sides before comparing so the ownership assert
 * doesn't false-reject on a prefix mismatch.
 */
function normalizeAccountId(id: string | undefined | null): string | undefined {
  if (!id) return undefined;
  return id.startsWith('act_') ? id.slice(4) : id;
}

async function writeAudit(
  db: AdminDb,
  entry: {
    propertyId: string;
    metaCampaignId: string;
    result: ActivateStatus;
    reason?: string;
    actor?: string;
    /** On an `activated` result, the child ids that were flipped — a complete money trail (Fable "audit each"). */
    adSetIds?: string[];
    adIds?: string[];
  }
): Promise<void> {
  try {
    await db.collection('adAuditLog').add({
      propertyId: entry.propertyId,
      metaCampaignId: entry.metaCampaignId,
      action: 'activate',
      result: entry.result,
      reason: entry.reason ?? null,
      actor: entry.actor ?? null,
      adSetIds: entry.adSetIds ?? null,
      adIds: entry.adIds ?? null,
      at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.warn('adExecutionGateway: audit write failed', {
      propertyId: entry.propertyId,
      metaCampaignId: entry.metaCampaignId,
      result: entry.result,
      error: String(error),
    });
  }
}

/**
 * Best-effort re-pause of everything already activated before a mid-chain
 * failure (B1's fail-closed requirement), in the order given by the caller
 * (most-recently-activated first). Never throws — mirrors
 * `campaignBuilder.rollback()`'s "log and continue" discipline exactly: the
 * ORIGINAL activation failure is what the caller sees, this is best-effort
 * housekeeping on top of it. A rollback pause failure here is NOT silent,
 * though — it means a chain could be left partially active, so it's logged at
 * a level an operator should notice.
 */
async function rollbackActivated(
  propertyId: string,
  token: string,
  targets: ActivationTarget[]
): Promise<number> {
  let failures = 0;
  for (const target of targets) {
    const result = await pauseResource(target.id, token, propertyId);
    if (result.ok) {
      logger.info('activateCampaign: rollback pause succeeded', { propertyId, kind: target.kind, id: target.id });
    } else {
      failures += 1;
      logger.error('activateCampaign: rollback pause FAILED — chain may be left partially active', undefined, {
        propertyId,
        kind: target.kind,
        id: target.id,
        error: result.error,
      });
    }
  }
  return failures;
}

async function reject(
  db: AdminDb,
  propertyId: string,
  metaCampaignId: string,
  reason: string,
  actor?: string
): Promise<ActivateResult> {
  logger.warn('activateCampaign: rejected', { propertyId, metaCampaignId, reason });
  await writeAudit(db, { propertyId, metaCampaignId, result: 'rejected', reason, actor });
  return { status: 'rejected', reason };
}

/**
 * Activate (un-PAUSE) a Meta campaign for a property. The ONLY path in this
 * codebase allowed to call `activateResource` — every check below runs in
 * order and short-circuits to a rejection (with an audit record) on the first
 * failure.
 */
export async function activateCampaign(
  propertyId: string,
  metaCampaignId: string,
  opts?: ActivateOptions
): Promise<ActivateResult> {
  const db = await getAdminDb();
  const actor = opts?.actor;

  // (a) two-switch dry-run gate — a UI click alone can never spend (H5).
  if (!isAdsLiveAllowed()) {
    logger.info('activateCampaign: dry-run mode — no live action taken', { propertyId, metaCampaignId });
    await writeAudit(db, { propertyId, metaCampaignId, result: 'dry-run', actor });
    return { status: 'dry-run' };
  }

  // (b) operator-approval + spend-cap gate (H5/M3/M4).
  const snap = await db
    .collection('adCampaigns')
    .where('propertyId', '==', propertyId)
    .where('metaCampaignId', '==', metaCampaignId)
    .limit(1)
    .get();

  if (snap.empty) {
    return reject(db, propertyId, metaCampaignId, 'no-adCampaigns-doc', actor);
  }
  const campaignDocSnap = snap.docs[0];
  const campaignDoc = campaignDocSnap.data() as AdCampaignDoc;
  if (campaignDoc.status !== 'approved') {
    return reject(db, propertyId, metaCampaignId, `not-approved:${campaignDoc.status ?? 'unknown'}`, actor);
  }
  if (!campaignDoc.spendCapMinor || campaignDoc.spendCapMinor <= 0) {
    return reject(db, propertyId, metaCampaignId, 'no-spend-cap', actor);
  }

  // Doc-integrity guard: a campaign doc with no recorded ad set(s)/ad(s) would
  // activate ONLY the campaign — the exact B1 no-deliver bug, but silent. Refuse
  // to activate something that provably cannot deliver (createCampaignChain
  // always records both on success, so an empty array means a malformed doc).
  const adSetIds = campaignDoc.metaAdSetIds ?? [];
  const adIds = campaignDoc.metaAdIds ?? [];
  if (adSetIds.length === 0 || adIds.length === 0) {
    return reject(db, propertyId, metaCampaignId, 'incomplete-chain:missing-adset-or-ad-ids', actor);
  }

  // Resolve context (needed for both the ownership assert and the token).
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    return reject(db, propertyId, metaCampaignId, 'no-ad-context', actor);
  }

  // (c) ownership assert — the shared-token safety net (H2). Fetch the Meta
  // campaign and confirm it actually belongs to THIS property's resolved ad
  // account before touching it; auth alone does not prove that under a
  // shared agency token (activate(propA, campaignOfB) would otherwise
  // succeed silently).
  const fetched = await metaGraph<MetaCampaignReadBack>(metaCampaignId, {
    method: 'GET',
    params: { fields: 'id,account_id' },
    token: ctx.token,
    propertyId,
  });
  if (!fetched.ok) {
    return reject(db, propertyId, metaCampaignId, `campaign-fetch-failed:${fetched.error}`, actor);
  }
  const fetchedAccountId = normalizeAccountId(fetched.data.account_id);
  const expectedAccountId = normalizeAccountId(ctx.adAccountId);
  if (!fetchedAccountId || fetchedAccountId !== expectedAccountId) {
    logger.error('activateCampaign: OWNERSHIP MISMATCH — refusing to activate', undefined, {
      propertyId,
      metaCampaignId,
      fetchedAccountId,
      expectedAccountId,
    });
    return reject(db, propertyId, metaCampaignId, 'ownership-mismatch', actor);
  }

  // (d) all gates passed — activate ALL THREE hierarchy levels (B1). Top-down:
  // campaign, then every ad set, then every ad. On the FIRST failure, best-
  // effort re-pause everything already flipped (reverse order) and reject —
  // never leave a half-active chain.
  const targets: ActivationTarget[] = [
    { kind: 'campaign', id: metaCampaignId },
    ...adSetIds.map((id): ActivationTarget => ({ kind: 'adSet', id })),
    ...adIds.map((id): ActivationTarget => ({ kind: 'ad', id })),
  ];

  const activated: ActivationTarget[] = [];
  for (const target of targets) {
    const result = await activateResource(target.id, ctx.token, propertyId);
    if (!result.ok) {
      logger.warn('activateCampaign: activation failed mid-chain — rolling back everything flipped so far', {
        propertyId,
        metaCampaignId,
        failedKind: target.kind,
        failedId: target.id,
        error: result.error,
      });
      const rollbackFailures = await rollbackActivated(propertyId, ctx.token, [...activated].reverse());
      // If any re-pause failed, the chain is left partially ACTIVE (spending)
      // while we report a rejection — make that unmistakable in the reason +
      // audit so an operator manually pauses (the account-level spend limit is
      // the backstop until they do).
      const reason =
        rollbackFailures > 0
          ? `activate-failed-ROLLBACK-INCOMPLETE(${rollbackFailures}-still-active):${target.kind}:${target.id}:${result.error}`
          : `activate-failed:${target.kind}:${target.id}:${result.error}`;
      return reject(db, propertyId, metaCampaignId, reason, actor);
    }
    activated.push(target);
  }

  // (e) status truth — the gateway owns it, not just Meta (S2). Best-effort:
  // the Meta-side activation above already fully succeeded, so neither a
  // failed read-back nor a failed Firestore write may flip the outcome back
  // to a rejection — that would misreport a real activation as failed.
  let effectiveStatus: string | undefined;
  const readBack = await metaGraph<MetaCampaignReadBack>(metaCampaignId, {
    method: 'GET',
    params: { fields: 'id,effective_status' },
    token: ctx.token,
    propertyId,
  });
  if (readBack.ok) {
    effectiveStatus = readBack.data.effective_status;
  } else {
    logger.warn('activateCampaign: post-activation effective_status read-back failed (non-fatal)', {
      propertyId,
      metaCampaignId,
      error: readBack.error,
    });
  }

  try {
    await campaignDocSnap.ref.update({
      status: 'active',
      ...(effectiveStatus ? { effectiveStatus } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.warn('activateCampaign: Firestore status update failed (Meta-side activation already succeeded)', {
      propertyId,
      metaCampaignId,
      error: String(error),
    });
  }

  await writeAudit(db, { propertyId, metaCampaignId, result: 'activated', actor, adSetIds, adIds });
  logger.info('activateCampaign: activated all levels', {
    propertyId,
    metaCampaignId,
    adSetIds,
    adIds,
    effectiveStatus,
  });
  return { status: 'activated' };
}
