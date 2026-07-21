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
import { getSendMode, GROWTH_ENGINE_LIMITS } from '@/config/growth-engine';
import { getGuestById } from '@/services/guestService';
import { normalizePhone } from '@/lib/sanitize';
import { resolveGuestLanguage } from '@/lib/growth/language';
import { parseFirestoreDate } from '@/lib/growth/date-utils';

const logger = loggers.executionGateway;

type AdminDb = Awaited<ReturnType<typeof getAdminDb>>;

export interface SendRequest {
  guestId: string;
  propertyId?: string; // which property this send is for (recorded on messageLog)
  channel: ChannelType;
  templateName: string;
  variables?: Record<string, string>;
  campaignId?: string;
  body?: string;                              // pre-rendered text (required for manual_queue)
  deliveryMode?: 'provider' | 'manual_queue'; // default 'provider' (Twilio); manual_queue → outbox
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

// resolveGuestLanguage lives in @/lib/growth/language (shared with the audience
// preview); re-exported here for existing callers/tests. (H2)
export { resolveGuestLanguage };

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
 * Deterministic messageLog doc id for a campaign send, so the idempotency claim
 * and the dedup check key on the SAME document (create-if-not-exists) instead of
 * a query over random-id rows. Non-campaign (lifecycle) sends have no id and are
 * never deduped.
 */
function campaignLogId(req: SendRequest): string | null {
  if (!req.campaignId) return null;
  // Firestore doc ids cannot contain '/'; campaign/guest ids and snake_case
  // template names are already safe, but guard anyway.
  const safe = (s: string) => s.replace(/\//g, '_');
  return `${safe(req.campaignId)}__${safe(req.guestId)}__${safe(req.templateName)}`;
}

/**
 * Within a campaign, has this guest already been REALLY delivered this template?
 * Reads the single deterministic doc (no query). Only real deliveries
 * ('sent'/'delivered') block a resend — dry-runs never persist here, and a
 * 'failed'/'sending' state is handled by the atomic claim at delivery time (M1).
 */
async function alreadyDelivered(db: AdminDb, req: SendRequest): Promise<boolean> {
  const id = campaignLogId(req);
  if (!id) return false; // dedup only makes sense inside a campaign
  const snap = await db.collection('messageLog').doc(id).get();
  if (!snap.exists) return false;
  const s = (snap.data() as { status?: string }).status;
  return s === 'sent' || s === 'delivered' || s === 'queued';
}

/**
 * #159 — the cardinal-sin guard: never message a guest who has a live upcoming
 * (or in-progress) stay. Discounting to someone who already paid full rate for
 * near dates turns a happy guest into a refund argument.
 *
 * Uses the guest's canonical `bookingIds` link (reliable; avoids fragile phone
 * matching) and blocks on any NON-cancelled booking whose stay has not yet ended
 * (checkout today or later — UTC, matching this project's date-math lesson).
 * Scoped to `propertyId` when provided, so an upcoming stay at another property
 * does not block a cross-property message.
 */
async function hasActiveFutureBooking(
  db: AdminDb,
  guest: Guest,
  propertyId?: string
): Promise<boolean> {
  const ids = guest.bookingIds ?? [];
  if (ids.length === 0) return false;

  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const snaps = await Promise.all(ids.map((id) => db.collection('bookings').doc(id).get()));
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const b = snap.data() as
      | { propertyId?: string; status?: string; checkInDate?: unknown; checkOutDate?: unknown }
      | undefined;
    if (!b) continue;
    if (propertyId && b.propertyId !== propertyId) continue;
    if (b.status === 'cancelled') continue;
    // Active if the stay hasn't ended yet; fall back to check-in if no checkout.
    const end = parseFirestoreDate(b.checkOutDate) ?? parseFirestoreDate(b.checkInDate);
    if (end && end.getTime() >= startOfTodayUtc) return true;
  }
  return false;
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

interface PropertyContext {
  name: string;        // brand name for the {{property}} slot (H1)
  link?: string;       // the {{link}} slot — guest availability calendar
}

/**
 * Resolve a property's brand name + guest booking link for message branding (H1).
 *
 * The link is the ANONYMIZED guest availability calendar
 * `{domain}/calendar/{guestCalendarToken}` — the same link the admin
 * re-engagement export builds (admin/guests/actions.ts) and the owner sends by
 * hand — on the property's custom domain, falling back to the property site
 * when no guest token exists yet. Name prefers `propertyMeta.name` (the clean
 * brand name) over the OTA listing title on the property doc.
 *
 * Cached per process; every path falls back gracefully so a lookup miss never
 * blocks a send.
 */
const propertyContextCache = new Map<string, PropertyContext>();
async function getPropertyContext(db: AdminDb, propertyId: string): Promise<PropertyContext> {
  const cached = propertyContextCache.get(propertyId);
  if (cached) return cached;

  let name = propertyId;
  let link: string | undefined;
  try {
    const prop = await db.collection('properties').doc(propertyId).get();
    const p = prop.data();
    if (p) {
      name = (p.name as string) || name;
      const base =
        p.useCustomDomain && p.customDomain
          ? `https://${p.customDomain}`
          : process.env.NEXT_PUBLIC_MAIN_APP_HOST
            ? `https://${process.env.NEXT_PUBLIC_MAIN_APP_HOST}`
            : undefined;
      const token = p.guestCalendarToken as string | undefined;
      if (base) link = token ? `${base}/calendar/${token}` : base;
    }
    // Prefer the clean brand name when present (properties.name can be an OTA title).
    const ov = await db.collection('propertyOverrides').doc(propertyId).get();
    const brand = ov.data()?.propertyMeta?.name as string | undefined;
    if (brand) name = brand;
  } catch {
    logger.warn('getPropertyContext failed; using id', { propertyId });
  }

  const ctx: PropertyContext = { name, link };
  propertyContextCache.set(propertyId, ctx);
  return ctx;
}

/** Clear the per-process property-context cache (tests / after a property edit). */
export function clearPropertyContextCache(): void {
  propertyContextCache.clear();
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

  // 2.6) frequency cap — don't message a guest more than once per window across
  // ALL campaigns + reactivation (H4). Only real deliveries set lastCampaignAt,
  // so dry-run previews never trip this and can be re-run freely.
  const lastCampaignAt = parseFirestoreDate(guest.lastCampaignAt);
  if (lastCampaignAt) {
    const daysSince = (new Date().getTime() - lastCampaignAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < GROWTH_ENGINE_LIMITS.frequencyCapDays) {
      const id = await writeMessageLog(db, {
        ...base,
        status: 'skipped',
        reason: 'frequency-cap',
        to: null,
        providerId: null,
      });
      return { status: 'skipped', reason: 'frequency-cap', messageLogId: id, mode };
    }
  }

  // 2.7) active future booking — never send a reactivation/discount message to a
  // guest who already has a live upcoming (or in-progress) stay (#159). Runs in
  // dry-run too, so a campaign preview reflects who would really be excluded.
  if (await hasActiveFutureBooking(db, guest, req.propertyId)) {
    const id = await writeMessageLog(db, {
      ...base,
      status: 'skipped',
      reason: 'active-future-booking',
      to: null,
      providerId: null,
    });
    return { status: 'skipped', reason: 'active-future-booking', messageLogId: id, mode };
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

  // 5) LIVE delivery (only when both flags are flipped).
  //
  // IDEMPOTENT CLAIM (campaign sends): before delivering, atomically claim the
  // deterministic messageLog doc ({campaignId}__{guestId}__{templateName}) in a
  // transaction. Two concurrent executeSend calls for the same triple can never
  // both deliver — the loser sees the claim and is deduped. Because the claim is
  // written BEFORE delivery, even a post-delivery log-write failure leaves a
  // 'sending' row that still blocks a re-send, so a Firestore hiccup can never
  // cause a double delivery (M2). Non-campaign (lifecycle) sends have no id and
  // keep the simple append-only log.
  const claimId = campaignLogId(req);
  const claimRef = claimId ? db.collection('messageLog').doc(claimId) : null;

  if (claimRef) {
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(claimRef);
      if (snap.exists) {
        const st = (snap.data() as { status?: string }).status;
        // Already delivered/queued, or another worker is mid-send → do not proceed.
        if (st === 'sent' || st === 'delivered' || st === 'sending' || st === 'queued') return false;
        // A prior 'failed' claim is retryable — fall through and re-claim.
      }
      tx.set(claimRef, {
        ...base,
        status: 'sending',
        reason: null,
        to: null,
        providerId: null,
        at: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!claimed) {
      logger.info('Send skipped: already claimed/delivered (idempotent)', {
        guestId: req.guestId,
        campaignId: req.campaignId,
        template: req.templateName,
      });
      return { status: 'skipped', reason: 'dedup', messageLogId: claimId!, mode: 'live' };
    }
  }

  // MANUAL QUEUE driver: hand the rendered message to the owner's phone outbox
  // for a one-tap wa.me send — no provider call. The body is already rendered
  // (property-branded + opt-out line) upstream, so we do not resolve a template.
  // lastCampaignAt is set at ACTUAL send time by the outbox_sent callback, not
  // here, so the frequency cap counts real sends, not queued-but-unsent rows.
  if (req.deliveryMode === 'manual_queue') {
    const outboxRef = db.collection('outbox').doc();
    await outboxRef.set({
      campaignId: req.campaignId ?? null,
      guestId: req.guestId,
      propertyId: req.propertyId ?? null,
      phone: contact,
      body: req.body ?? '',
      language: resolveGuestLanguage(guest),
      status: 'approved_pending_send',
      messageLogId: claimId ?? null,
      claimedAt: null,
      sentAt: null,
      finalText: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Finalize the claim as 'queued' so a re-run cannot re-queue this guest.
    const queuedEntry: MessageLogInput = {
      ...base,
      status: 'queued',
      reason: null,
      to: maskContact(contact),
      providerId: outboxRef.id, // the outbox row id, for traceability
    };
    if (claimRef) await claimRef.set({ ...queuedEntry, at: FieldValue.serverTimestamp() });
    else await writeMessageLog(db, queuedEntry);

    logger.info('Message queued to outbox for manual send', {
      guestId: req.guestId,
      campaignId: req.campaignId,
      outboxId: outboxRef.id,
      to: maskContact(contact),
    });
    return { status: 'queued', providerId: outboxRef.id, messageLogId: claimId ?? outboxRef.id, mode: 'live' };
  }

  // Property-brand the message: inject `property` (name) and `link` (guest
  // availability calendar) template variables so the guest knows which property
  // is reaching out and where to check dates (H1). The approved marketing
  // template references {{property}} and {{link}}.
  const ctx = req.propertyId ? await getPropertyContext(db, req.propertyId) : undefined;
  const liveVars = ctx
    ? { ...(req.variables || {}), property: ctx.name, ...(ctx.link ? { link: ctx.link } : {}) }
    : req.variables || {};

  let delivery: { success: boolean; providerId?: string; error?: string };
  try {
    delivery = await deliverLive(req.channel, contact, req.templateName, liveVars, resolveGuestLanguage(guest));
  } catch (error) {
    logger.error('Live send threw', error as Error, {
      guestId: req.guestId,
      channel: req.channel,
    });
    delivery = { success: false, error: (error as Error).message };
  }

  const status: MessageLogStatus = delivery.success ? 'sent' : 'failed';
  const finalEntry: MessageLogInput = {
    ...base,
    status,
    reason: delivery.error ?? null,
    to: maskContact(contact),
    providerId: delivery.providerId ?? null,
  };

  // Finalize on the SAME doc we claimed (campaign send), else append (lifecycle).
  let id: string;
  if (claimRef) {
    await claimRef.set({ ...finalEntry, at: FieldValue.serverTimestamp() });
    id = claimId!;
  } else {
    id = await writeMessageLog(db, finalEntry);
  }

  // Record the touch on the GUEST (not just the booking) so the frequency cap
  // and cross-campaign dedup work across properties (H4). Best-effort.
  if (delivery.success) {
    try {
      await db.collection('guests').doc(req.guestId).update({
        lastCampaignAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.warn('Failed to update lastCampaignAt', { guestId: req.guestId });
    }
  }

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
