/**
 * warmupCampaign — generate a no-ask "share" warm-up campaign in-app and LAND it as a draft.
 *
 * This is what the cron runs (keep-in-touch, recurring) and what an admin action could call on
 * demand: buildWarmupBrief → copywriter (generateDrafts) → createProposedCampaign (status:'draft').
 * It NEVER sends — the owner reviews at Gate 1 and sends by hand, same as every campaign.
 *
 * Server-only. Degrades cleanly (returns a reason) if the copywriter is unavailable or nobody qualifies.
 */
import { buildWarmupBrief, type WarmupSegment } from '@/lib/growth/warmupAudience';
import { generateDrafts } from '@/services/growth/copywriter';
import { createProposedCampaign, listCampaigns } from '@/services/campaignService';
import { isCopywriterAvailable } from '@/lib/growth/anthropic';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

export interface WarmupRunResult {
  status: 'landed' | 'skipped';
  reason?: string;
  campaignId?: string;
  count?: number;
  errors?: string[];
}

const NAME: Record<WarmupSegment, string> = {
  keepintouch: 'Keep-in-touch',
  coldreintro: 'Cold re-intro',
};

/**
 * Generate + land one warm-up campaign. Skips (no-op) if the copywriter is off, nobody qualifies,
 * a previous warm-up draft of this segment is still pending review, or generation fails validation.
 */
export async function generateWarmupCampaign(segment: WarmupSegment, opts?: { propertyId?: string }): Promise<WarmupRunResult> {
  if (!isCopywriterAvailable()) return { status: 'skipped', reason: 'copywriter-unavailable' };
  const propertyId = opts?.propertyId ?? 'prahova-mountain-chalet';

  // Don't pile up: if a warm-up draft of this segment is already waiting for review, skip this run.
  const existing = (await listCampaigns(propertyId)).find(
    (c) => c.status === 'draft' && typeof c.name === 'string' && c.name.startsWith(`${NAME[segment]} —`)
  );
  if (existing) return { status: 'skipped', reason: 'pending-draft-exists', campaignId: existing.id };

  const { brief, eligibleCount } = await buildWarmupBrief(segment, { propertyId });
  if (!brief.act || brief.audience.length === 0) {
    logger.info('warmup: nobody eligible', { segment, eligibleCount });
    return { status: 'skipped', reason: 'no-eligible-audience' };
  }

  const res = await generateDrafts(brief);
  if (!res.ok) {
    logger.warn('warmup: generation failed validation — not landed', { segment, errors: res.errors });
    return { status: 'skipped', reason: 'generation-invalid', errors: res.errors };
  }

  const name = `${NAME[segment]} — ${new Date().toISOString().slice(0, 10)} (${res.drafts.length})`;
  const campaignId = await createProposedCampaign({ name, brief, drafts: res.drafts });
  logger.info('warmup campaign landed', { segment, campaignId, count: res.drafts.length });
  return { status: 'landed', campaignId, count: res.drafts.length };
}
