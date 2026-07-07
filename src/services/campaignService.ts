/**
 * campaignService — create, preview, and run past-guest campaigns.
 *
 * A campaign snapshots a SegmentDefinition + a template, and `sendCampaign`
 * drives the resulting audience through the Execution Gateway ONE guest at a
 * time. Because every send routes through `executeSend`, campaigns inherit the
 * dark-launch guarantee for free: by default this records dry-run intent and
 * delivers nothing. Dedup, consent, and suppression are all enforced in the
 * gateway. See plans/growth-engine.md §6.1.
 *
 * Plain server module (NOT `'use server'`) — exports types + helpers.
 */
import { getAdminDb, FieldValue, Timestamp } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Campaign, CampaignStats, CampaignStatus, SegmentDefinition, ChannelType } from '@/types';
import { evaluateSegment, previewAudience, type AudiencePreview } from '@/services/segmentService';
import { executeSend } from '@/services/executionGateway';
import { getSendMode, GROWTH_ENGINE_LIMITS } from '@/config/growth-engine';

const logger = loggers.campaign;

function emptyStats(): CampaignStats {
  return { audienceSize: 0, attempted: 0, sent: 0, dryRun: 0, suppressed: 0, skipped: 0, failed: 0 };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Current hour in property-local time (Europe/Bucharest), 0-23. */
function bucharestHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  );
}

/** Quiet hours wrap midnight: [quietHoursStart, 24) ∪ [0, quietHoursEnd). */
function isQuietHours(now: Date = new Date()): boolean {
  const hour = bucharestHour(now);
  const { quietHoursStart, quietHoursEnd } = GROWTH_ENGINE_LIMITS;
  return hour >= quietHoursStart || hour < quietHoursEnd;
}

export interface CreateCampaignInput {
  name: string;
  propertyId: string;
  channel: ChannelType;
  templateName: string;
  variables?: Record<string, string>;
  segmentDefinition: SegmentDefinition;
  segmentId?: string;
  scheduleAt?: Date | null;
}

export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  const db = await getAdminDb();
  const status: CampaignStatus = input.scheduleAt ? 'scheduled' : 'draft';
  const ref = await db.collection('campaigns').add({
    name: input.name,
    propertyId: input.propertyId,
    channel: input.channel,
    templateName: input.templateName,
    variables: input.variables ?? {},
    segmentDefinition: input.segmentDefinition,
    segmentId: input.segmentId ?? null,
    scheduleAt: input.scheduleAt ? Timestamp.fromDate(input.scheduleAt) : null,
    status,
    stats: emptyStats(),
    approvedBy: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    sentAt: null,
  });
  logger.info('Campaign created', { campaignId: ref.id, name: input.name, status });
  return ref.id;
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const db = await getAdminDb();
  const doc = await db.collection('campaigns').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Campaign;
}

export async function listCampaigns(propertyId?: string): Promise<Campaign[]> {
  const db = await getAdminDb();
  const { convertTimestampsToISOStrings } = await import('@/lib/utils');
  const base = db.collection('campaigns');
  const snap = propertyId ? await base.where('propertyId', '==', propertyId).get() : await base.get();
  return snap.docs.map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as Campaign);
}

/** Live audience count + channel breakdown for a saved campaign's segment. */
export async function previewCampaignAudience(id: string): Promise<AudiencePreview | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;
  return previewAudience(campaign.segmentDefinition);
}

export async function approveCampaign(id: string, approvedBy: string): Promise<void> {
  const db = await getAdminDb();
  await db.collection('campaigns').doc(id).update({
    approvedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info('Campaign approved', { campaignId: id, approvedBy });
}

export interface SendCampaignResult {
  campaignId: string;
  mode: 'dry-run' | 'live';
  stats: CampaignStats;
  capped: boolean;
  deferred?: boolean;
}

/**
 * Run a campaign: evaluate the audience and route each guest through the
 * Execution Gateway. Respects the per-run cap and, in LIVE mode only, quiet
 * hours + throttling (dry-run previews run anytime, unthrottled).
 */
export async function sendCampaign(
  id: string,
  options?: { cap?: number }
): Promise<SendCampaignResult> {
  const db = await getAdminDb();
  const campaign = await getCampaign(id);
  if (!campaign) throw new Error(`Campaign not found: ${id}`);

  const mode = getSendMode();
  const cap = options?.cap ?? GROWTH_ENGINE_LIMITS.perRunCap;

  // In LIVE mode, hold off during quiet hours so we don't message at night.
  if (mode === 'live' && isQuietHours()) {
    logger.warn('sendCampaign deferred — quiet hours', { campaignId: id });
    await db.collection('campaigns').doc(id).update({
      status: 'scheduled',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { campaignId: id, mode, stats: emptyStats(), capped: false, deferred: true };
  }

  logger.info('sendCampaign start', {
    campaignId: id,
    mode,
    channel: campaign.channel,
    template: campaign.templateName,
    cap,
  });

  await db.collection('campaigns').doc(id).update({
    status: 'sending',
    updatedAt: FieldValue.serverTimestamp(),
  });

  const audience = await evaluateSegment(campaign.segmentDefinition);
  const stats = emptyStats();
  stats.audienceSize = audience.length;

  let capped = false;
  for (const guest of audience) {
    if (stats.attempted >= cap) {
      capped = true;
      break;
    }
    stats.attempted++;

    const result = await executeSend({
      guestId: guest.id,
      propertyId: campaign.propertyId,
      channel: campaign.channel,
      templateName: campaign.templateName,
      variables: campaign.variables,
      campaignId: id,
    });

    switch (result.status) {
      case 'sent':
      case 'delivered':
        stats.sent++;
        break;
      case 'dry-run':
        stats.dryRun++;
        break;
      case 'suppressed':
        stats.suppressed++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
      case 'failed':
        stats.failed++;
        break;
    }

    // Throttle only real deliveries — protects the WhatsApp sender number.
    if (mode === 'live' && result.status === 'sent') {
      await sleep(GROWTH_ENGINE_LIMITS.throttleMs);
    }
  }

  const finalStatus: CampaignStatus = capped
    ? 'scheduled' // more to send on the next run
    : stats.failed > 0 && stats.sent === 0 && stats.dryRun === 0
      ? 'failed'
      : 'sent';

  await db.collection('campaigns').doc(id).update({
    status: finalStatus,
    stats,
    sentAt: mode === 'live' && !capped ? FieldValue.serverTimestamp() : (campaign.sentAt ?? null),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('sendCampaign done', { campaignId: id, mode, stats, capped });
  return { campaignId: id, mode, stats, capped };
}
