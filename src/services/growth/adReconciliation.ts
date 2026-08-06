/**
 * adReconciliation — the money-path BACKSTOP cron (promotion-system-architecture.md §8, ad plan
 * §13 C2/M2 / §16.6). Our `status` on an `adCampaigns` doc is what WE believe; Meta's
 * `effective_status` is the truth. This job periodically pulls the truth for every live-capable
 * campaign, refreshes its insights, and FLAGS any drift — a campaign delivering that we think is
 * paused, a REJECTED ad, or an ACTIVE campaign in the account that we don't track at all (a
 * shared-token escape). Flags are logged loudly so an operator notices; the account-level spend
 * limit remains the hard backstop that survives even this.
 *
 * Read-mostly: it GETs insights/status and UPDATEs our own docs' `insights`/`effectiveStatus` — it
 * never activates, pauses, or spends. Server-only.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { AdCampaignStatus } from '@/types';
import { getInsights, getEffectiveStatus } from './metaAds/insights';
import { resolveAdContext } from './metaAds/adContext';
import { metaGraph } from './metaAds/client';
import { finalizeAdOutcome, DEFAULT_SETTLE_DAYS } from './adOutcomes';

const logger = loggers.ads;

/** Meta `effective_status` values that mean "not delivering as we'd expect" (won't run, or under review). */
const PROBLEM_STATUSES = new Set(['DISAPPROVED', 'REJECTED', 'WITH_ISSUES', 'PENDING_REVIEW', 'DELETED', 'ARCHIVED']);
/** A campaign-level `effective_status` of ACTIVE means Meta considers it live (spending-capable). */
const DELIVERING = 'ACTIVE';

/**
 * Doc statuses whose Meta chain can plausibly deliver — worth reconciling (drafts/failed have no live
 * chain). `pushed` is included because the Meta objects EXIST from that moment on: the owner can flip
 * them ACTIVE straight in Ads Manager, which our app never sees. Reconciling `pushed` is what turns
 * that invisible activation into a drift flag (and a self-heal, below) instead of silent spend.
 */
export const LIVE_CAPABLE: AdCampaignStatus[] = ['active', 'approved', 'paused', 'pushed'];

/**
 * Pure drift detector — compares OUR believed `status` against Meta's `effectiveStatus`. Extracted so
 * the (integration-heavy) reconcile loop's judgement is exhaustively unit-testable. Returns a list of
 * human-readable drift flags (empty = consistent).
 */
export function detectDrift(status: string | undefined, effectiveStatus: string | undefined): string[] {
  const flags: string[] = [];
  if (!effectiveStatus) return flags;

  if (PROBLEM_STATUSES.has(effectiveStatus)) {
    flags.push(`effective_status=${effectiveStatus} — will not deliver as expected`);
  }
  // Delivering money while our record says it shouldn't be — the dangerous drift.
  if (effectiveStatus === DELIVERING && status !== 'active') {
    flags.push(`effective_status=ACTIVE but our status="${status ?? 'unknown'}" — DELIVERING when it should not be`);
  }
  // We think it's live but Meta shows it paused/stopped — benign, but worth surfacing (nothing's running).
  if (status === 'active' && ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(effectiveStatus)) {
    flags.push(`our status=active but effective_status=${effectiveStatus} — not actually delivering`);
  }
  return flags;
}

export interface ReconcileResult {
  checked: number;
  updated: number;
  escapes: number;
  finalized: number;
  flags: string[];
}

interface AdCampaignReconData {
  propertyId?: string;
  metaCampaignId?: string;
  status?: AdCampaignStatus;
  endTime?: string | null;
  outcomeCapturedAt?: unknown;
}

/**
 * Reconcile every live-capable `adCampaigns` doc against Meta, refresh insights + effective_status,
 * and scan each configured account for ACTIVE campaigns we don't track (escapes). Never throws per
 * doc — one failure doesn't abort the run. Returns counts + the flag list (also logged).
 */
export async function reconcileAdCampaigns(): Promise<ReconcileResult> {
  const db = await getAdminDb();
  const snap = await db.collection('adCampaigns').get();
  const flags: string[] = [];
  let checked = 0;
  let updated = 0;

  // Our tracked Meta campaign ids per property — for the account-level escape scan.
  const trackedByProperty = new Map<string, Set<string>>();
  for (const d of snap.docs) {
    const data = d.data() as AdCampaignReconData;
    if (data.propertyId && data.metaCampaignId) {
      const set = trackedByProperty.get(data.propertyId) ?? new Set<string>();
      set.add(data.metaCampaignId);
      trackedByProperty.set(data.propertyId, set);
    }
  }

  // Per-doc reconcile.
  for (const d of snap.docs) {
    const data = d.data() as AdCampaignReconData;
    if (!data.propertyId || !data.metaCampaignId) continue;
    if (!data.status || !LIVE_CAPABLE.includes(data.status)) continue;
    checked += 1;

    try {
      const [ins, eff] = await Promise.all([
        getInsights(data.propertyId, data.metaCampaignId),
        getEffectiveStatus(data.propertyId, data.metaCampaignId),
      ]);
      const patch: Record<string, unknown> = { lastSyncedAt: FieldValue.serverTimestamp() };
      if (ins.ok) {
        // NB: `bookings` here is Meta's MODELED pixel purchases (kept for the console); the outcome
        // record splits it from the first-party utm join. `purchaseValue` was previously dropped.
        patch.insights = {
          spend: ins.data.spend,
          impressions: ins.data.impressions,
          clicks: ins.data.clicks,
          bookings: ins.data.purchases,
          purchaseValue: ins.data.purchaseValue,
          roas: ins.data.roas,
        };
      }
      const effStatus = eff.ok ? eff.data.effectiveStatus : undefined;
      if (effStatus) patch.effectiveStatus = effStatus;

      // Self-heal: Meta's effective_status is the truth. A campaign activated OUTSIDE the app (in Ads
      // Manager) leaves our doc at `pushed` forever — which would keep it out of the learning loop
      // (`finalizeAdOutcome` only freezes activated campaigns) and show it as "not live" in the console.
      // Record reality. This does not cause spend — it only stops us mis-remembering it.
      if (effStatus === DELIVERING && data.status === 'pushed') {
        patch.status = 'active';
        patch.activatedBy = 'meta-reconcile (activated outside the app)';
        patch.activatedAt = FieldValue.serverTimestamp();
      }

      await d.ref.update(patch);
      updated += 1;

      for (const f of detectDrift(data.status, effStatus)) flags.push(`${d.id} (${data.propertyId}): ${f}`);
    } catch (error) {
      logger.warn('reconcileAdCampaigns: per-doc reconcile failed (continuing)', { adCampaignId: d.id, error: String(error) });
    }
  }

  // Account-level escape scan: any campaign ACTIVE in the account that we don't track.
  let escapes = 0;
  for (const [propertyId, tracked] of trackedByProperty) {
    try {
      const ctx = await resolveAdContext(propertyId);
      if (!ctx) continue;
      const res = await metaGraph<{ data?: Array<{ id: string; name?: string; effective_status?: string }> }>(
        `${ctx.adAccountId}/campaigns`,
        { method: 'GET', params: { fields: 'id,name,effective_status', limit: 200 }, token: ctx.token, propertyId }
      );
      if (!res.ok) continue;
      for (const c of res.data.data ?? []) {
        if (c.effective_status === DELIVERING && !tracked.has(c.id)) {
          escapes += 1;
          flags.push(`ESCAPE (${propertyId}): Meta campaign ${c.id} "${c.name ?? ''}" is ACTIVE but NOT tracked by us`);
        }
      }
    } catch (error) {
      logger.warn('reconcileAdCampaigns: escape scan failed (continuing)', { propertyId, error: String(error) });
    }
  }

  // Finalize outcomes for campaigns that RAN and have ended + settled — freeze the learning record
  // (Fable §1.2/§1.6). Only campaigns that were activated (status active/paused) — a never-run draft
  // has nothing to learn. Idempotent: `outcomeCapturedAt` gates re-finalization.
  let finalized = 0;
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data() as AdCampaignReconData;
    if (data.outcomeCapturedAt || !data.metaCampaignId || !data.endTime) continue;
    if (data.status !== 'active' && data.status !== 'paused') continue;
    const endMs = Date.parse(data.endTime);
    if (Number.isNaN(endMs) || endMs + DEFAULT_SETTLE_DAYS * 86_400_000 > now) continue;
    try {
      if (await finalizeAdOutcome(d.id)) finalized += 1;
    } catch (error) {
      logger.warn('reconcileAdCampaigns: finalize failed (continuing)', { adCampaignId: d.id, error: String(error) });
    }
  }

  if (flags.length) {
    logger.error('reconcileAdCampaigns: DRIFT/ESCAPE detected', undefined, { count: flags.length, flags });
  }
  logger.info('reconcileAdCampaigns: done', { checked, updated, escapes, finalized, flagCount: flags.length });
  return { checked, updated, escapes, finalized, flags };
}
