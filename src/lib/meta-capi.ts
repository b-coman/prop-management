/**
 * Meta Conversions API (CAPI) server-side utility.
 * Sends events to Meta for deduplication with the client-side Pixel.
 */

import { createHash } from 'crypto';
import { loggers } from '@/lib/logger';
import { getPixelIdForProperty } from '@/lib/meta-pixels';

const logger = loggers.tracking;

const GRAPH_API_VERSION = 'v21.0';

/**
 * Per-property CAPI access tokens, from the META_CAPI_TOKENS secret — a JSON map
 * { "<property-slug>": "<token>" }. Parsed once. A property with no token here
 * sends no server events (multi-property isolation).
 */
let capiTokens: Record<string, string> | null = null;
function getCapiToken(slug: string): string | undefined {
  if (capiTokens === null) {
    try {
      capiTokens = process.env.META_CAPI_TOKENS ? JSON.parse(process.env.META_CAPI_TOKENS) : {};
    } catch {
      logger.warn('Meta CAPI: META_CAPI_TOKENS is not valid JSON');
      capiTokens = {};
    }
  }
  return (capiTokens ?? {})[slug];
}

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
  /** REQUIRED: the property this event belongs to — selects the pixel + token. */
  propertyId: string;
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  userData?: UserData;
  customData?: CustomData;
}

/**
 * SHA-256 hash after lowercase + trim (Meta's requirement for PII).
 * Exported for reuse by the Growth Engine Custom Audience builder (§6.5).
 */
export function hashForMeta(value: string): string {
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
  const { propertyId, eventName, eventId, eventSourceUrl, userData, customData } = params;

  // Resolve the pixel + token FOR THIS PROPERTY. If either is missing, this
  // property isn't configured for Meta tracking — skip (never fire to another
  // property's pixel).
  const pixelId = await getPixelIdForProperty(propertyId);
  const accessToken = propertyId ? getCapiToken(propertyId) : undefined;
  if (!pixelId || !accessToken) {
    logger.debug('Meta CAPI: skipping (no pixel/token for property)', { propertyId, eventName });
    return;
  }

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

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [eventData],
        access_token: accessToken,
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
