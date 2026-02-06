/**
 * Meta Conversions API (CAPI) server-side utility.
 * Sends events to Meta for deduplication with the client-side Pixel.
 */

import { createHash } from 'crypto';
import { loggers } from '@/lib/logger';

const logger = loggers.tracking;

const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const GRAPH_API_VERSION = 'v21.0';

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  fbc?: string; // Meta click ID cookie
  fbp?: string; // Meta browser ID cookie
  clientIpAddress?: string;
  clientUserAgent?: string;
}

interface CustomData {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentType?: string;
  orderId?: string;
}

interface MetaEventParams {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  userData?: UserData;
  customData?: CustomData;
}

/**
 * SHA-256 hash after lowercase + trim (Meta's requirement for PII).
 */
function hashForMeta(value: string): string {
  return createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

function buildUserData(userData?: UserData) {
  if (!userData) return {};

  const result: Record<string, string | undefined> = {};

  if (userData.email) result.em = hashForMeta(userData.email);
  if (userData.phone) result.ph = hashForMeta(userData.phone);
  if (userData.firstName) result.fn = hashForMeta(userData.firstName);
  if (userData.lastName) result.ln = hashForMeta(userData.lastName);
  if (userData.country) result.country = hashForMeta(userData.country);
  // fbc, fbp, IP, UA are sent raw (not hashed)
  if (userData.fbc) result.fbc = userData.fbc;
  if (userData.fbp) result.fbp = userData.fbp;
  if (userData.clientIpAddress) result.client_ip_address = userData.clientIpAddress;
  if (userData.clientUserAgent) result.client_user_agent = userData.clientUserAgent;

  return result;
}

/**
 * Send an event to Meta Conversions API.
 * No-ops gracefully if env vars are not set.
 */
export async function sendMetaEvent(params: MetaEventParams): Promise<void> {
  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    logger.debug('Meta CAPI: skipping (env vars not set)');
    return;
  }

  const { eventName, eventId, eventSourceUrl, userData, customData } = params;

  const eventData: Record<string, unknown> = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: buildUserData(userData),
  };

  if (eventSourceUrl) {
    eventData.event_source_url = eventSourceUrl;
  }

  if (customData) {
    const cd: Record<string, unknown> = {};
    if (customData.value !== undefined) cd.value = customData.value;
    if (customData.currency) cd.currency = customData.currency;
    if (customData.contentIds) cd.content_ids = customData.contentIds;
    if (customData.contentType) cd.content_type = customData.contentType;
    if (customData.orderId) cd.order_id = customData.orderId;
    eventData.custom_data = cd;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
        access_token: META_CAPI_ACCESS_TOKEN,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn('Meta CAPI: non-OK response', { status: response.status, body: text });
    } else {
      logger.debug('Meta CAPI: event sent', { eventName, eventId });
    }
  } catch (error) {
    logger.warn('Meta CAPI: fetch error', { eventName, error: String(error) });
  }
}
