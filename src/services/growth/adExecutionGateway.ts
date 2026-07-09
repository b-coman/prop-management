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
 *
 * Every activation attempt (dry-run, rejected, or activated) writes an audit
 * doc to `adAuditLog` so the money path has a complete trail regardless of
 * outcome — same discipline as `executionGateway`'s messageLog writes.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { AdCampaignStatus } from '@/types';
import { isAdsLiveAllowed } from '@/config/growth-ads';
import { resolveAdContext } from './metaAds/adContext';
import { metaGraph, activateResource } from './metaAds/client';

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
  status?: AdCampaignStatus;
  spendCapMinor?: number;
}

interface MetaCampaignReadBack {
  id: string;
  account_id?: string;
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
  const campaignDoc = snap.docs[0].data() as AdCampaignDoc;
  if (campaignDoc.status !== 'approved') {
    return reject(db, propertyId, metaCampaignId, `not-approved:${campaignDoc.status ?? 'unknown'}`, actor);
  }
  if (!campaignDoc.spendCapMinor || campaignDoc.spendCapMinor <= 0) {
    return reject(db, propertyId, metaCampaignId, 'no-spend-cap', actor);
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

  // All gates passed — activate (un-PAUSE).
  const activated = await activateResource(metaCampaignId, ctx.token, propertyId);
  if (!activated.ok) {
    return reject(db, propertyId, metaCampaignId, `activate-failed:${activated.error}`, actor);
  }

  await writeAudit(db, { propertyId, metaCampaignId, result: 'activated', actor });
  logger.info('activateCampaign: activated', { propertyId, metaCampaignId });
  return { status: 'activated' };
}
