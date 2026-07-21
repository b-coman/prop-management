'use server';

import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import type { Campaign, SegmentDefinition, MessageVariant, OutboxMessage } from '@/types';
import { PREDEFINED_SEGMENTS, previewAudience } from '@/services/segmentService';
import { listCampaigns, createCampaign, approveCampaign, sendCampaign, createManualCampaign, markCampaignQueued, markCampaignSent, getCampaign } from '@/services/campaignService';
import { buildAudience, type AudienceCandidate } from '@/services/audienceService';
import { renderMessages, queueMessages, type RenderedMessage, type SkippedRender } from '@/services/campaignMessaging';
import { fetchOutboxForCampaign, markOutboxSent } from '@/services/outboxService';

const logger = loggers.campaign;

// Map a UI segment key to a SegmentDefinition. Not exported (this file is
// `'use server'` — only async functions may be exported).
function buildSegmentDefinition(key: string, propertyId: string): SegmentDefinition {
  switch (key) {
    case 'whatsapp_reachable':
      return PREDEFINED_SEGMENTS.whatsappReachable(propertyId);
    case 'repeat':
      return PREDEFINED_SEGMENTS.repeatGuests(propertyId);
    case 'lapsed_12m':
      return PREDEFINED_SEGMENTS.noBookingInMonths(12, propertyId);
    case 'winter_stayers':
      return PREDEFINED_SEGMENTS.lastStayedInSeason('winter', propertyId);
    case 'romanian':
      return PREDEFINED_SEGMENTS.romanian(propertyId);
    case 'foreign':
      return PREDEFINED_SEGMENTS.foreign(propertyId);
    default:
      return { propertyId };
  }
}

export async function fetchCampaigns(propertyId: string): Promise<Campaign[]> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
  try {
    return await listCampaigns(propertyId);
  } catch (error) {
    logger.error('fetchCampaigns failed', error as Error);
    return [];
  }
}

export async function previewSegmentAction(
  segmentKey: string,
  propertyId: string
): Promise<{
  success: boolean;
  count?: number;
  reachable?: number;
  suppressed?: number;
  ro?: number;
  en?: number;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const preview = await previewAudience(buildSegmentDefinition(segmentKey, propertyId));
    return {
      success: true,
      count: preview.count,
      reachable: preview.reachable,
      suppressed: preview.suppressed,
      ro: preview.byLanguage.ro,
      en: preview.byLanguage.en,
    };
  } catch (error) {
    logger.error('previewSegmentAction failed', error as Error);
    return { success: false, error: 'Failed to preview audience' };
  }
}

export async function createCampaignAction(input: {
  name: string;
  propertyId: string;
  segmentKey: string;
  templateName: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  if (!input.name?.trim()) return { success: false, error: 'Campaign name is required' };
  try {
    const id = await createCampaign({
      name: input.name.trim(),
      propertyId: input.propertyId,
      channel: 'whatsapp',
      templateName: input.templateName,
      segmentDefinition: buildSegmentDefinition(input.segmentKey, input.propertyId),
    });
    revalidatePath('/admin/campaigns');
    return { success: true, id };
  } catch (error) {
    logger.error('createCampaignAction failed', error as Error);
    return { success: false, error: 'Failed to create campaign' };
  }
}

export async function approveCampaignAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    await approveCampaign(id, 'super-admin');
    revalidatePath('/admin/campaigns');
    return { success: true };
  } catch (error) {
    logger.error('approveCampaignAction failed', error as Error);
    return { success: false, error: 'Failed to approve campaign' };
  }
}

export async function runCampaignAction(id: string): Promise<{
  success: boolean;
  mode?: 'dry-run' | 'live';
  stats?: { audienceSize: number; attempted: number; dryRun: number; sent: number; suppressed: number; skipped: number; failed: number };
  error?: string;
}> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const result = await sendCampaign(id);
    revalidatePath('/admin/campaigns');
    return { success: true, mode: result.mode, stats: result.stats };
  } catch (error) {
    logger.error('runCampaignAction failed', error as Error);
    return { success: false, error: (error as Error).message };
  }
}

export async function fetchAudienceAction(propertyId: string): Promise<{
  success: boolean;
  candidates?: AudienceCandidate[];
  total?: number;
  eligibleCount?: number;
  perRunCap?: number;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const res = await buildAudience(propertyId);
    return {
      success: true,
      candidates: res.candidates,
      total: res.total,
      eligibleCount: res.eligibleCount,
      perRunCap: res.perRunCap,
    };
  } catch (error) {
    logger.error('fetchAudienceAction failed', error as Error);
    return { success: false, error: 'Failed to load audience' };
  }
}

// --- Message step (manual campaigns): create → compose/preview → approve+queue → send ---

/** Create a draft campaign carrying the hand-picked audience from the picker. */
export async function createManualCampaignAction(input: {
  name: string;
  propertyId: string;
  guestIds: string[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  if (!input.name?.trim()) return { success: false, error: 'Campaign name is required' };
  if (!input.guestIds?.length) return { success: false, error: 'Select at least one guest' };
  try {
    const id = await createManualCampaign({
      name: input.name.trim(),
      propertyId: input.propertyId,
      audienceGuestIds: input.guestIds,
    });
    revalidatePath('/admin/campaigns');
    return { success: true, id };
  } catch (error) {
    logger.error('createManualCampaignAction failed', error as Error);
    return { success: false, error: 'Failed to create campaign' };
  }
}

/** Gate 1 preview: render the owner's variants into per-guest messages (no writes). */
export async function previewCampaignMessagesAction(
  campaignId: string,
  variants: MessageVariant[]
): Promise<{ success: boolean; rendered?: RenderedMessage[]; skipped?: SkippedRender[]; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) return { success: false, error: 'Campaign not found' };
    const { rendered, skipped } = await renderMessages({
      propertyId: campaign.propertyId,
      guestIds: campaign.audienceGuestIds ?? [],
      variants,
    });
    return { success: true, rendered, skipped };
  } catch (error) {
    logger.error('previewCampaignMessagesAction failed', error as Error);
    return { success: false, error: 'Failed to preview messages' };
  }
}

/** Gate 1 approve: queue every rendered message through the gateway → outbox. */
export async function approveAndQueueAction(
  campaignId: string,
  variants: MessageVariant[]
): Promise<{ success: boolean; queued?: number; skipped?: SkippedRender[]; error?: string }> {
  let approver: string;
  try {
    const user = await requireSuperAdmin();
    approver = user.email || user.uid;
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const campaign = await getCampaign(campaignId);
    if (!campaign) return { success: false, error: 'Campaign not found' };
    const res = await queueMessages({
      campaignId,
      propertyId: campaign.propertyId,
      guestIds: campaign.audienceGuestIds ?? [],
      variants,
    });
    await markCampaignQueued(campaignId, { approvedBy: approver, variants });
    revalidatePath(`/admin/campaigns/${campaignId}`);
    return { success: true, queued: res.queued, skipped: res.skipped };
  } catch (error) {
    logger.error('approveAndQueueAction failed', error as Error);
    return { success: false, error: 'Failed to queue messages' };
  }
}

/** Gate 2: the outbox send-list for a campaign. */
export async function fetchCampaignOutboxAction(
  campaignId: string
): Promise<{ success: boolean; rows?: OutboxMessage[]; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const rows = await fetchOutboxForCampaign(campaignId);
    return { success: true, rows };
  } catch (error) {
    logger.error('fetchCampaignOutboxAction failed', error as Error);
    return { success: false, error: 'Failed to load outbox' };
  }
}

/** Gate 2: mark one outbox message sent (records final text, advances frequency cap). */
export async function markSentAction(
  outboxId: string,
  finalText?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    const res = await markOutboxSent(outboxId, { finalText: finalText ?? null });
    if (!res.success) return { success: false, error: res.reason ?? 'Failed to mark sent' };
    return { success: true };
  } catch (error) {
    logger.error('markSentAction failed', error as Error);
    return { success: false, error: 'Failed to mark sent' };
  }
}

/** Gate 2: mark the whole campaign finished once the owner has sent everything. */
export async function markCampaignSentAction(
  campaignId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return handleAuthError(error);
    throw error;
  }
  try {
    await markCampaignSent(campaignId);
    revalidatePath(`/admin/campaigns/${campaignId}`);
    return { success: true };
  } catch (error) {
    logger.error('markCampaignSentAction failed', error as Error);
    return { success: false, error: 'Failed to update campaign' };
  }
}
