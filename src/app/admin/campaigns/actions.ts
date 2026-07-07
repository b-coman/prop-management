'use server';

import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import type { Campaign, SegmentDefinition } from '@/types';
import { PREDEFINED_SEGMENTS, previewAudience } from '@/services/segmentService';
import { listCampaigns, createCampaign, approveCampaign, sendCampaign } from '@/services/campaignService';

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
