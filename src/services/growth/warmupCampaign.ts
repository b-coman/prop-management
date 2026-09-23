/**
 * warmupCampaign — generate a no-ask "share" warm-up campaign in-app and LAND it as a draft.
 *
 * This is what the cron runs (keep-in-touch, recurring) and what an admin action could call on
 * demand: buildWarmupBrief → copywriter (generateDrafts) → createProposedCampaign (status:'draft').
 * It NEVER sends — the owner reviews at Gate 1 and sends by hand, same as every campaign. Because a
 * draft only matters once he opens it, landing one emails him, and a draft left unopened for
 * STALE_DAYS is replaced instead of blocking every later run.
 *
 * Server-only. Degrades cleanly (returns a reason) if the copywriter is unavailable or nobody qualifies.
 */
import { buildWarmupBrief, type WarmupSegment } from '@/lib/growth/warmupAudience';
import { generateDrafts } from '@/services/growth/copywriter';
import { createProposedCampaign, listCampaigns, deleteCampaign } from '@/services/campaignService';
import { isCopywriterAvailable } from '@/lib/growth/anthropic';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getAppBaseUrl } from '@/lib/app-url';
import { sendCampaignDraftReadyEmail } from '@/services/emailService';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

export interface WarmupRunResult {
  status: 'landed' | 'skipped';
  reason?: string;
  campaignId?: string;
  count?: number;
  errors?: string[];
}

/**
 * An unopened warm-up draft older than this is replaced on the next run. Its text was written for
 * that month, and leaving it in place skipped every later run (1 Aug 2026 draft, found 23 Sep).
 */
const STALE_DAYS = 21;

const NAME: Record<WarmupSegment, string> = {
  keepintouch: 'Keep-in-touch',
  coldreintro: 'Cold re-intro',
  leadfollowup: 'Lead follow-up',
};

/**
 * Generate + land one warm-up campaign. Skips (no-op) if the copywriter is off, nobody qualifies,
 * a previous warm-up draft of this segment is still pending review, or generation fails validation.
 */
export async function generateWarmupCampaign(segment: WarmupSegment, opts?: { propertyId?: string }): Promise<WarmupRunResult> {
  if (!isCopywriterAvailable()) return { status: 'skipped', reason: 'copywriter-unavailable' };
  const propertyId = opts?.propertyId ?? 'prahova-mountain-chalet';

  // Don't pile up: if a recent warm-up draft of this segment is waiting for review, skip this run.
  // A stale one (never opened, written for an earlier month) is replaced rather than left to block.
  const existing = (await listCampaigns(propertyId)).find(
    (c) => c.status === 'draft' && typeof c.name === 'string' && c.name.startsWith(`${NAME[segment]} —`)
  );
  let replaced: string | null = null;
  if (existing) {
    const ageDays = existing.createdAt ? (Date.now() - new Date(String(existing.createdAt)).getTime()) / 86400000 : 0;
    if (ageDays < STALE_DAYS) return { status: 'skipped', reason: 'pending-draft-exists', campaignId: existing.id };
    await deleteCampaign(existing.id!);
    replaced = existing.name ?? existing.id!;
    logger.info('warmup: replaced a stale unreviewed draft', { segment, campaignId: existing.id, ageDays: Math.round(ageDays) });
  }

  const { brief, eligibleCount } = await buildWarmupBrief(segment, { propertyId });
  if (!brief.act || brief.audience.length === 0) {
    logger.info('warmup: nobody eligible', { segment, eligibleCount });
    return { status: 'skipped', reason: 'no-eligible-audience' };
  }

  const res = await generateDrafts(brief);
  if (res.drafts.length === 0) {
    logger.warn('warmup: no draft passed validation, not landed', { segment, errors: res.errors });
    return { status: 'skipped', reason: 'generation-invalid', errors: res.errors };
  }
  // Land the guests whose drafts passed; the rest are left out of this round and logged.
  if (!res.ok) logger.warn('warmup: some drafts failed validation, landing the rest', { segment, errors: res.errors });

  const name = `${NAME[segment]} — ${new Date().toISOString().slice(0, 10)} (${res.drafts.length})`;
  const campaignId = await createProposedCampaign({ name, brief, drafts: res.drafts });
  logger.info('warmup campaign landed', { segment, campaignId, count: res.drafts.length });
  await notifyOwner(propertyId, campaignId, name, res.drafts.length, replaced);
  return { status: 'landed', campaignId, count: res.drafts.length, errors: res.ok ? undefined : res.errors };
}

/** Email the property owner (and the admin alert address) that a draft is waiting. Never throws. */
async function notifyOwner(propertyId: string, campaignId: string, campaignName: string, count: number, replaced: string | null) {
  try {
    const db = await getAdminDb();
    const p = (await db.collection('properties').doc(propertyId).get()).data() as { ownerEmail?: string; name?: string | Record<string, string>; customDomain?: string; useCustomDomain?: boolean } | undefined;
    const base = getAppBaseUrl() || (p?.useCustomDomain && p.customDomain ? `https://${p.customDomain}` : '');
    const reviewUrl = `${base}/admin/campaigns/${campaignId}`;
    const propertyName = typeof p?.name === 'string' ? p.name : p?.name?.en ?? propertyId;
    const note = replaced ? `This replaces "${replaced}", which was never reviewed and had gone out of date.` : undefined;
    const to = [...new Set([p?.ownerEmail, process.env.ADMIN_ALERT_EMAIL].filter(Boolean) as string[])];
    for (const email of to) {
      const r = await sendCampaignDraftReadyEmail(email, { propertyName, campaignName, count, reviewUrl, note });
      logger.info('warmup: owner notified', { campaignId, success: r.success });
    }
  } catch (e) {
    logger.error('warmup: owner notification failed', e as Error, { campaignId });
  }
}
