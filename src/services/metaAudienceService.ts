/**
 * metaAudienceService — build & refresh Meta Custom Audiences from a segment,
 * using hashed phone/email (reuses hashForMeta from meta-capi). PHASE 2, DARK:
 * fully inert until META_SYSTEM_USER_TOKEN + META_AD_ACCOUNT_ID are provisioned;
 * the payload builder is pure/testable and runs regardless.
 *
 * See plans/growth-engine.md §6.5/§10. NOTE (finalization): verify the exact
 * Meta normalization/hashing rules against current Marketing API docs before
 * going live (their spec moves faster than any cached knowledge).
 */
import { loggers } from '@/lib/logger';
import type { SegmentDefinition } from '@/types';
import { evaluateSegment } from '@/services/segmentService';
import { hashForMeta } from '@/lib/meta-capi';

const logger = loggers.tracking;
const GRAPH_API_VERSION = 'v21.0';
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

export interface CustomAudiencePayload {
  schema: string[]; // e.g. ['PHONE', 'EMAIL']
  data: string[][]; // hashed rows aligned to schema
}

export function isMetaAudienceConfigured(): boolean {
  return !!META_SYSTEM_USER_TOKEN && !!META_AD_ACCOUNT_ID;
}

/** Format a phone for Meta hashing: digits only (E.164 without '+'/spaces). */
export function formatPhoneForMeta(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Build the hashed Custom Audience payload for a segment. Pure transform over
 * the segment's guests — no secrets, no network — so it is unit-testable and
 * safe to run in the dark launch.
 */
export async function buildCustomAudiencePayload(
  def: SegmentDefinition
): Promise<CustomAudiencePayload> {
  const guests = await evaluateSegment(def);
  const schema = ['PHONE', 'EMAIL'];
  const data: string[][] = [];
  for (const g of guests) {
    const phone = g.normalizedPhone || g.phone;
    const phoneHash = phone ? hashForMeta(formatPhoneForMeta(phone)) : '';
    const emailHash = g.email ? hashForMeta(g.email) : '';
    if (phoneHash || emailHash) data.push([phoneHash, emailHash]);
  }
  logger.info('Built Custom Audience payload', { members: data.length });
  return { schema, data };
}

/** Upload/refresh a Meta Custom Audience from a segment. Inert without creds. */
export async function syncCustomAudience(
  audienceId: string,
  def: SegmentDefinition
): Promise<{ success: boolean; uploaded?: number; error?: string }> {
  if (!isMetaAudienceConfigured()) {
    logger.warn('syncCustomAudience skipped — Meta not configured');
    return { success: false, error: 'Meta not configured (missing system-user token / ad account)' };
  }
  const payload = await buildCustomAudiencePayload(def);
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${audienceId}/users`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, access_token: META_SYSTEM_USER_TOKEN }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error('syncCustomAudience failed', new Error(text), { audienceId });
      return { success: false, error: text };
    }
    return { success: true, uploaded: payload.data.length };
  } catch (error) {
    logger.error('syncCustomAudience error', error as Error, { audienceId });
    return { success: false, error: (error as Error).message };
  }
}
