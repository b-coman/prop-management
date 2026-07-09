/**
 * The STOP side of the ads engine — built and tested BEFORE the start side
 * (plan §9 Phase 0, §13 Fable C1: "The plan defined how spend *starts*, not
 * how it *stops* — and real ad-ops incidents are about failing to stop").
 *
 * `pauseCampaign` pauses one campaign; `pauseAllForProperty` is the panic
 * button — list every non-paused campaign in the property's ad account and
 * pause each one. Both resolve the property's ad context first and no-op
 * (nothing to pause, no context to act through) for an unconfigured property
 * — never a blind "pause everything reachable by this token," which would
 * violate per-property isolation just as much as an uncontrolled activate
 * would (H2).
 */
import { loggers } from '@/lib/logger';
import { resolveAdContext } from './adContext';
import { metaGraph, pauseResource } from './client';

const logger = loggers.ads;

export interface PauseResult {
  success: boolean;
  campaignId: string;
  error?: string;
}

/** Pause a single Meta campaign for a property. No-op if the property has no ad context. */
export async function pauseCampaign(propertyId: string, metaCampaignId: string): Promise<PauseResult> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('pauseCampaign: no ad context for property — no-op', { propertyId, metaCampaignId });
    return { success: false, campaignId: metaCampaignId, error: 'no-ad-context' };
  }

  const result = await pauseResource(metaCampaignId, ctx.token, propertyId);
  if (!result.ok) {
    logger.warn('pauseCampaign failed', { propertyId, metaCampaignId, error: result.error });
    return { success: false, campaignId: metaCampaignId, error: result.error };
  }
  logger.info('pauseCampaign: paused', { propertyId, metaCampaignId });
  return { success: true, campaignId: metaCampaignId };
}

interface MetaCampaignListItem {
  id: string;
  status?: string;
  effective_status?: string;
}

interface MetaCampaignListResponse {
  data: MetaCampaignListItem[];
}

/**
 * The panic button: list every non-paused campaign in the property's ad
 * account and pause each one. No-op (empty list) for an unconfigured
 * property. Best-effort per campaign — one failure doesn't stop the rest from
 * being attempted, since the whole point is to stop as much spend as possible.
 */
export async function pauseAllForProperty(propertyId: string): Promise<PauseResult[]> {
  const ctx = await resolveAdContext(propertyId);
  if (!ctx) {
    logger.warn('pauseAllForProperty: no ad context for property — no-op', { propertyId });
    return [];
  }

  const list = await metaGraph<MetaCampaignListResponse>(`${ctx.adAccountId}/campaigns`, {
    method: 'GET',
    params: { fields: 'id,status,effective_status', limit: 500 },
    token: ctx.token,
    propertyId,
  });

  if (!list.ok) {
    logger.warn('pauseAllForProperty: failed to list campaigns', { propertyId, error: list.error });
    return [];
  }

  const nonPaused = (list.data.data ?? []).filter((c) => c.status !== 'PAUSED');
  const results: PauseResult[] = [];
  for (const campaign of nonPaused) {
    const r = await pauseResource(campaign.id, ctx.token, propertyId);
    results.push(
      r.ok
        ? { success: true, campaignId: campaign.id }
        : { success: false, campaignId: campaign.id, error: r.error }
    );
  }
  logger.info('pauseAllForProperty: done', { propertyId, paused: results.filter((r) => r.success).length, total: results.length });
  return results;
}
