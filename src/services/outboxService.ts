/**
 * outboxService — the manual-send queue's shared operations, used by BOTH the
 * `/api/automation` endpoint (iPhone/Mac Shortcut path) and the admin Gate-2
 * send screen, so "mark sent" behaves identically everywhere.
 *
 * Plain server module (NOT 'use server').
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { OutboxMessage } from '@/types';

const logger = loggers.campaign;

export interface MarkSentResult {
  success: boolean;
  reason?: 'not-found' | 'wrong-property';
}

/**
 * Mark a queued outbox message as sent: record the final (possibly edited) text,
 * flip the linked gateway claim `queued → sent`, and set the guest's
 * `lastCampaignAt` — so the frequency cap counts the REAL send, not the queue.
 * Idempotent (a second call on an already-sent row is a no-op success).
 *
 * `expectedPropertyId` (optional) scopes the operation — the API path passes it
 * so a token for one property can't mark another property's message.
 */
export async function markOutboxSent(
  outboxId: string,
  opts?: { finalText?: string | null; expectedPropertyId?: string }
): Promise<MarkSentResult> {
  const db = await getAdminDb();
  const ref = db.collection('outbox').doc(outboxId);
  const doc = await ref.get();
  if (!doc.exists) return { success: false, reason: 'not-found' };

  const row = doc.data() as {
    propertyId?: string;
    guestId?: string;
    body?: string;
    status?: string;
    messageLogId?: string | null;
  };
  if (opts?.expectedPropertyId && row.propertyId && row.propertyId !== opts.expectedPropertyId) {
    return { success: false, reason: 'wrong-property' };
  }
  if (row.status === 'sent') return { success: true }; // idempotent

  const sentText = opts?.finalText ?? row.body ?? null;
  await ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp(), finalText: sentText });

  if (row.messageLogId) {
    try {
      await db.collection('messageLog').doc(row.messageLogId).update({
        status: 'sent',
        finalText: sentText,
        at: FieldValue.serverTimestamp(),
      });
    } catch {
      logger.warn('markOutboxSent: messageLog update failed (non-blocking)', { outboxId, messageLogId: row.messageLogId });
    }
  }
  if (row.guestId) {
    try {
      await db.collection('guests').doc(row.guestId).update({ lastCampaignAt: FieldValue.serverTimestamp() });
    } catch {
      logger.warn('markOutboxSent: lastCampaignAt update failed (non-blocking)', { guestId: row.guestId });
    }
  }
  return { success: true };
}

/** All outbox rows for a campaign, oldest first, timestamps serialized for the client. */
export async function fetchOutboxForCampaign(campaignId: string): Promise<OutboxMessage[]> {
  const db = await getAdminDb();
  const snap = await db.collection('outbox').where('campaignId', '==', campaignId).get();
  const { convertTimestampsToISOStrings } = await import('@/lib/utils');
  const rows = snap.docs.map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as OutboxMessage);
  rows.sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
  return rows;
}
