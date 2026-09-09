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
import { getInsights, getEffectiveStatus, getAdSetOptimisation } from './metaAds/insights';
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
  /** Untracked campaigns found in the account that are delivering or have spent. */
  escapes: number;
  /** Of those, how many were newly given a doc so they count against the envelope. */
  adopted: number;
  finalized: number;
  flags: string[];
}

interface AdCampaignReconData {
  propertyId?: string;
  metaCampaignId?: string;
  metaAdSetIds?: string[];
  status?: AdCampaignStatus;
  endTime?: string | null;
  outcomeCapturedAt?: unknown;
  optimizationGoal?: string;
  optimizationEvent?: string;
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
          // A traffic campaign reports zero purchases by design. Without these
          // its outcome record would be indistinguishable from a failed sales
          // campaign, so persist what it actually optimises on.
          landingPageViews: ins.data.landingPageViews,
          linkClicks: ins.data.linkClicks,
        };
      }
      const effStatus = eff.ok ? eff.data.effectiveStatus : undefined;
      if (effStatus) patch.effectiveStatus = effStatus;

      // What the ad set optimises toward is the other half of the contract, and the half that
      // silently changes what the money buys. Status drift was already reconciled; this was not, so
      // a retune done in Ads Manager (or by a script, as on 20 Aug) left our record saying "traffic"
      // while Meta ran conversions. Mirror it, and say so out loud when it moved without us.
      const adSetId = data.metaAdSetIds?.[0];
      if (adSetId) {
        const opt = await getAdSetOptimisation(data.propertyId, adSetId);
        if (opt.ok) {
          patch.optimizationGoal = opt.data.optimizationGoal;
          if (opt.data.optimizationEvent) patch.optimizationEvent = opt.data.optimizationEvent;
          const knownGoal = data.optimizationGoal;
          if (knownGoal && knownGoal !== opt.data.optimizationGoal) {
            flags.push(`${d.id} (${data.propertyId}): optimization_goal changed on Meta — we had ${knownGoal}, Meta has ${opt.data.optimizationGoal}`);
          }
          const knownEvent = data.optimizationEvent;
          if (knownEvent && opt.data.optimizationEvent && knownEvent !== opt.data.optimizationEvent) {
            flags.push(`${d.id} (${data.propertyId}): optimisation event changed on Meta — we had ${knownEvent}, Meta has ${opt.data.optimizationEvent}`);
          }
        }
      }

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

  // Account-level escape scan, and ADOPTION.
  //
  // Flagging an untracked campaign was not enough. The owner works in Ads Manager too — on
  // 2026-09-09 he had duplicated a paused campaign and the copy was live and spending, while a
  // boosted page post had been running since August. Neither existed in `adCampaigns`, so:
  //   - the ledger counted their spend as anonymous "unplanned", against an envelope it could not
  //     attribute;
  //   - the in-flight block could not warn a planner that those cities were already being bought;
  //   - and they could never enter the learning loop, because that only reads our own docs.
  // The system's picture of reality was wrong whenever he acted outside it, which is exactly when
  // he most needs it to be right.
  //
  // So we adopt: create a doc for any untracked campaign that is delivering OR has spent money.
  // Dormant campaigns with no spend are left alone — this account carries eleven from 2023 and
  // adopting them would be noise. An adopted doc is marked `origin: 'adopted'` and carries no
  // `proposal`: we know what it DID, never what it was for, and must not pretend otherwise.
  //
  // Read-only against Meta. Writes only our own Firestore.
  let escapes = 0;
  let adopted = 0;
  for (const [propertyId, tracked] of trackedByProperty) {
    try {
      const ctx = await resolveAdContext(propertyId);
      if (!ctx) continue;
      const res = await metaGraph<{
        data?: Array<{
          id: string; name?: string; effective_status?: string; stop_time?: string;
          daily_budget?: string; insights?: { data?: Array<{ spend?: string }> };
        }>;
      }>(
        `${ctx.adAccountId}/campaigns`,
        {
          method: 'GET',
          params: { fields: 'id,name,effective_status,stop_time,daily_budget,insights{spend}', limit: 200 },
          token: ctx.token,
          propertyId,
        }
      );
      if (!res.ok) continue;
      for (const c of res.data.data ?? []) {
        if (tracked.has(c.id)) continue;
        const delivering = c.effective_status === DELIVERING;
        const spend = Number(c.insights?.data?.[0]?.spend ?? 0) || 0;
        if (!delivering && spend <= 0) continue;   // dormant and never spent — not ours to care about

        escapes += 1;
        flags.push(
          `ESCAPE (${propertyId}): Meta campaign ${c.id} "${c.name ?? ''}" is ${c.effective_status} ` +
          `with ${spend.toFixed(2)} spent and was NOT tracked by us`
        );

        // Keyed by the Meta id, so re-running adopts nothing twice and the doc is obviously not one
        // this system composed.
        const ref = db.collection('adCampaigns').doc(`meta_${c.id}`);
        if ((await ref.get()).exists) continue;
        await ref.set({
          propertyId,
          metaCampaignId: c.id,
          name: c.name ?? null,
          status: delivering ? 'active' : 'paused',
          effectiveStatus: c.effective_status ?? null,
          endTime: c.stop_time ?? null,
          dailyBudgetMinor: c.daily_budget ? Number(c.daily_budget) : null,
          insights: { spend },
          origin: 'adopted',
          adoptedAt: FieldValue.serverTimestamp(),
          adoptedBy: 'meta-reconcile escape scan',
          note:
            'Created in Ads Manager, not by this system. Adopted so its spend counts against the ' +
            'envelope and it appears in the in-flight check. It has no proposal because we know ' +
            'what it did, not what it was for.',
          createdAt: FieldValue.serverTimestamp(),
          lastSyncedAt: FieldValue.serverTimestamp(),
        });
        adopted += 1;
        logger.info('reconcileAdCampaigns: adopted an untracked Meta campaign', {
          propertyId, metaCampaignId: c.id, name: c.name, spend, effectiveStatus: c.effective_status,
        });
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
  logger.info('reconcileAdCampaigns: done', { checked, updated, escapes, adopted, finalized, flagCount: flags.length });
  return { checked, updated, escapes, adopted, finalized, flags };
}
