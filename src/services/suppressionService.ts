/**
 * suppressionService — manage the hard opt-out list (STOP keywords, bounces,
 * manual). Written via Admin SDK; read by the Execution Gateway before any send.
 * Honoring STOP is what protects the WhatsApp sender number (§13).
 *
 * Plain server module — exports pure helpers + async functions.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { ChannelType } from '@/types';
import { normalizePhone } from '@/lib/sanitize';

const logger = loggers.executionGateway;

// Opt-out keywords (EN + RO). Matched case-insensitively against the whole body.
const STOP_KEYWORDS = new Set([
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'oprire',
  'stop promo',
  'dezabonare',
]);

/** Pure: does an inbound message body signal an opt-out? */
export function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has((body || '').trim().toLowerCase());
}

export interface AddSuppressionInput {
  normalizedPhone?: string;
  email?: string;
  channel?: ChannelType | 'all';
  reason: string; // 'stop-keyword' | 'unsubscribe' | 'bounce' | 'manual'
  source: string;
}

export async function addSuppression(input: AddSuppressionInput): Promise<void> {
  if (!input.normalizedPhone && !input.email) {
    logger.warn('addSuppression called with neither phone nor email');
    return;
  }
  const db = await getAdminDb();
  const email = input.email?.toLowerCase().trim();
  const entry: Record<string, unknown> = {
    channel: input.channel ?? 'all',
    reason: input.reason,
    source: input.source,
    at: FieldValue.serverTimestamp(),
  };
  if (input.normalizedPhone) entry.normalizedPhone = input.normalizedPhone;
  if (email) entry.email = email;
  // Deterministic doc ID keyed on the identity => idempotent: a repeated STOP
  // overwrites the same doc instead of piling up entries (abuse hardening).
  const docId = input.normalizedPhone
    ? `phone_${input.normalizedPhone}`
    : `email_${encodeURIComponent(email!)}`;
  await db.collection('suppressionList').doc(docId).set(entry, { merge: true });
  logger.info('Added suppression', {
    reason: input.reason,
    source: input.source,
    hasPhone: !!input.normalizedPhone,
    hasEmail: !!input.email,
  });
}

/**
 * Handle an inbound STOP from a phone: add to suppressionList AND mark the
 * matching guest unsubscribed. `fromPhone` may include a `whatsapp:` prefix.
 */
export async function handleInboundStop(
  fromPhone: string,
  source = 'whatsapp-inbound'
): Promise<{ suppressed: boolean; normalizedPhone?: string }> {
  const normalized = normalizePhone((fromPhone || '').replace(/^whatsapp:/, ''));
  if (!normalized) {
    logger.warn('handleInboundStop: could not normalize sender phone');
    return { suppressed: false };
  }

  await addSuppression({
    normalizedPhone: normalized,
    channel: 'all',
    reason: 'stop-keyword',
    source,
  });

  // Best-effort: flag the matching guest as unsubscribed too.
  try {
    const { findGuestByPhone } = await import('@/services/guestService');
    const guest = await findGuestByPhone(normalized);
    if (guest) {
      const db = await getAdminDb();
      await db.collection('guests').doc(guest.id).update({
        unsubscribed: true,
        unsubscribedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      logger.info('Marked guest unsubscribed via STOP', { guestId: guest.id });
    }
  } catch (error) {
    logger.error('handleInboundStop: failed to mark guest unsubscribed', error as Error);
  }

  return { suppressed: true, normalizedPhone: normalized };
}
