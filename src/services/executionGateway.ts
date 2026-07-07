/**
 * executionGateway — the single choke point through which every outbound
 * message flows. It enforces consent + suppression, resolves the contact,
 * writes an auditable `messageLog` entry, and delivers ONLY when the engine is
 * live. By default (dark launch) it records a `dry-run` entry describing what
 * *would* have been sent, and delivers nothing.
 *
 * This is the portable "action seam" from plans/growth-engine.md §3/§6.9: v1
 * runs in-app on Core (secrets are here); a later VM implementation can satisfy
 * the same interface without changing callers.
 *
 * Plain server module (NOT `'use server'`) — exports types + pure helpers.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Guest, ChannelType, ConsentState, MessageLogStatus, LanguageCode } from '@/types';
import { getSendMode } from '@/config/growth-engine';
import { getGuestById } from '@/services/guestService';
import { normalizePhone } from '@/lib/sanitize';

const logger = loggers.executionGateway;

type AdminDb = Awaited<ReturnType<typeof getAdminDb>>;

export interface SendRequest {
  guestId: string;
  propertyId?: string; // which property this send is for (recorded on messageLog)
  channel: ChannelType;
  templateName: string;
  variables?: Record<string, string>;
  campaignId?: string;
}

export interface SendResult {
  status: MessageLogStatus;
  reason?: string;
  providerId?: string;
  messageLogId?: string;
  mode: 'dry-run' | 'live';
}

/**
 * Pure: is this channel blocked for the guest by explicit signal?
 * `unsubscribed` or an explicit `opted_out` block; `unknown`/`opted_in` are
 * allowed — the owner's call (§0.2.1) that known past guests are in scope.
 */
export function isConsentBlocked(
  guest: Pick<Guest, 'channelConsent' | 'unsubscribed'>,
  channel: ChannelType
): boolean {
  if (guest.unsubscribed) return true;
  const state: ConsentState | undefined = guest.channelConsent?.[channel];
  return state === 'opted_out';
}

/** Mask a phone/email for logging (never store full contact in messageLog). */
export function maskContact(contact: string): string {
  if (!contact) return '';
  return contact.length <= 6 ? `${contact[0]}***` : `${contact.slice(0, 6)}***`;
}

function resolveContact(guest: Guest, channel: ChannelType): string | null {
  if (channel === 'whatsapp' || channel === 'sms') {
    // Only ever return a properly normalized number — the SAME identity the
    // suppression check keys on. A phone that fails normalization is treated as
    // unreachable (no raw fallback), so it cannot slip past suppression (M5).
    return guest.normalizedPhone || (guest.phone ? normalizePhone(guest.phone) || null : null);
  }
  if (channel === 'email') return guest.email || null;
  return null;
}

/** Hard opt-outs recorded in the suppressionList collection (phone/email). */
async function isSuppressed(db: AdminDb, guest: Guest): Promise<boolean> {
  const phone =
    guest.normalizedPhone || (guest.phone ? normalizePhone(guest.phone) : undefined);
  const checks: Promise<boolean>[] = [];
  if (phone) {
    checks.push(
      db
        .collection('suppressionList')
        .where('normalizedPhone', '==', phone)
        .limit(1)
        .get()
        .then((s) => !s.empty)
    );
  }
  if (guest.email) {
    checks.push(
      db
        .collection('suppressionList')
        .where('email', '==', guest.email.toLowerCase().trim())
        .limit(1)
        .get()
        .then((s) => !s.empty)
    );
  }
  if (checks.length === 0) return false;
  return (await Promise.all(checks)).some(Boolean);
}

/**
 * Within a campaign, has this guest already been REALLY delivered this template?
 * Only real deliveries ('sent'/'delivered') block a resend — dry-run previews
 * never do, so a campaign can be previewed repeatedly (M1).
 */
async function alreadyDelivered(db: AdminDb, req: SendRequest): Promise<boolean> {
  if (!req.campaignId) return false; // dedup only makes sense inside a campaign
  const snap = await db
    .collection('messageLog')
    .where('guestId', '==', req.guestId)
    .where('campaignId', '==', req.campaignId)
    .where('templateName', '==', req.templateName)
    .get();
  return snap.docs.some((d) => {
    const s = (d.data() as { status?: string }).status;
    return s === 'sent' || s === 'delivered';
  });
}

interface MessageLogInput {
  guestId: string;
  propertyId: string | null;
  channel: ChannelType;
  campaignId: string | null;
  templateName: string | null;
  variables: Record<string, string> | null;
  status: MessageLogStatus;
  reason: string | null;
  to: string | null;
  providerId: string | null;
}

async function writeMessageLog(db: AdminDb, entry: MessageLogInput): Promise<string> {
  const ref = await db.collection('messageLog').add({
    ...entry,
    at: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Execute (or dry-run) a single outbound message. Every path writes exactly one
 * messageLog entry so the audit trail is complete regardless of outcome.
 */
export async function executeSend(req: SendRequest): Promise<SendResult> {
  const db = await getAdminDb();
  const mode = getSendMode();
  const guest = await getGuestById(req.guestId);

  const base = {
    guestId: req.guestId,
    propertyId: req.propertyId ?? null,
    channel: req.channel,
    campaignId: req.campaignId ?? null,
    templateName: req.templateName ?? null,
    variables: req.variables ?? null,
  };

  if (!guest) {
    logger.warn('executeSend: guest not found', { guestId: req.guestId });
    const id = await writeMessageLog(db, {
      ...base,
      status: 'skipped',
      reason: 'guest-not-found',
      to: null,
      providerId: null,
    });
    return { status: 'skipped', reason: 'guest-not-found', messageLogId: id, mode };
  }

  // 1) consent / unsubscribe
  if (isConsentBlocked(guest, req.channel)) {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'suppressed',
      reason: 'consent-or-unsubscribed',
      to: null,
      providerId: null,
    });
    return { status: 'suppressed', reason: 'consent-or-unsubscribed', messageLogId: id, mode };
  }

  // 2) hard suppression list
  if (await isSuppressed(db, guest)) {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'suppressed',
      reason: 'suppression-list',
      to: null,
      providerId: null,
    });
    return { status: 'suppressed', reason: 'suppression-list', messageLogId: id, mode };
  }

  // 2.5) dedup — never re-deliver the same campaign template to the same guest
  if (await alreadyDelivered(db, req)) {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'skipped',
      reason: 'dedup',
      to: null,
      providerId: null,
    });
    return { status: 'skipped', reason: 'dedup', messageLogId: id, mode };
  }

  // 3) resolve a contact for the channel
  const contact = resolveContact(guest, req.channel);
  if (!contact) {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'skipped',
      reason: 'no-contact-for-channel',
      to: null,
      providerId: null,
    });
    return { status: 'skipped', reason: 'no-contact-for-channel', messageLogId: id, mode };
  }

  // 4) DARK LAUNCH: default dry-run — record intent, deliver nothing.
  if (mode !== 'live') {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'dry-run',
      reason: null,
      to: maskContact(contact),
      providerId: null,
    });
    logger.info('Dry-run send recorded (no delivery)', {
      guestId: req.guestId,
      channel: req.channel,
      template: req.templateName,
      to: maskContact(contact),
    });
    return { status: 'dry-run', messageLogId: id, mode: 'dry-run' };
  }

  // 5) LIVE delivery (only when both flags are flipped). Delivery and the log
  // write are deliberately separated so a Firestore log-write failure can never
  // mislabel an already-delivered message as 'failed' and cause a re-send (M2).
  let delivery: { success: boolean; providerId?: string; error?: string };
  try {
    delivery = await deliverLive(req.channel, contact, req.templateName, req.variables || {}, guest.language || 'en');
  } catch (error) {
    logger.error('Live send threw', error as Error, {
      guestId: req.guestId,
      channel: req.channel,
    });
    delivery = { success: false, error: (error as Error).message };
  }

  const status: MessageLogStatus = delivery.success ? 'sent' : 'failed';
  const id = await writeMessageLog(db, {
    ...base,
    status,
    reason: delivery.error ?? null,
    to: maskContact(contact),
    providerId: delivery.providerId ?? null,
  });
  return {
    status,
    reason: delivery.error,
    providerId: delivery.providerId,
    messageLogId: id,
    mode: 'live',
  };
}

/**
 * Deliver a real message. Only reachable in live mode. WhatsApp is fully wired
 * to the existing Twilio service; email/SMS campaign delivery is wired in a
 * later increment (today's emailService is booking-specific).
 */
async function deliverLive(
  channel: ChannelType,
  contact: string,
  templateName: string,
  variables: Record<string, string>,
  language: LanguageCode
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  if (channel === 'whatsapp') {
    const { resolveWhatsAppTemplateSid, sendWhatsAppTemplateBySid } = await import(
      '@/services/whatsappService'
    );
    const sid = resolveWhatsAppTemplateSid(templateName, language);
    if (!sid) {
      // Unknown name, or a marketing template whose SID isn't approved/set yet.
      return {
        success: false,
        error: `WhatsApp template not registered or not yet approved: ${templateName}`,
      };
    }
    const r = await sendWhatsAppTemplateBySid(contact, sid, variables);
    return { success: r.success, providerId: r.sid, error: r.error };
  }
  if (channel === 'email') {
    return { success: false, error: 'email channel not yet wired for campaigns' };
  }
  if (channel === 'sms') {
    return { success: false, error: 'sms channel not yet wired for campaigns' };
  }
  return { success: false, error: `unsupported channel: ${channel}` };
}
