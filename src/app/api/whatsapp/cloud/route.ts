/**
 * WhatsApp Cloud API webhook (Meta), for the property's own number.
 *
 * This is the ONLY way inbound WhatsApp reaches us on the Cloud API. The number
 * `+40 753 980 097` lives on Meta's servers, not on anyone's phone, so a guest
 * reply exists nowhere else: if this endpoint drops it, it is gone permanently.
 * That single fact drives the design below.
 *
 * NOT the same as `/api/whatsapp/inbound`, which is Twilio-shaped (form-encoded,
 * TwiML reply) and cannot parse this payload. Both can run side by side while
 * the provider swap is in progress.
 *
 * ORDER OF OPERATIONS, and why:
 *   1. verify the HMAC signature over the RAW BYTES, before parsing anything
 *   2. persist the raw payload, keyed by its own hash
 *   3. only then interpret it
 * Capture is durable before interpretation, so a bug in step 3 costs us a
 * reprocess, never a lost guest message. Step 2's hash key also makes Meta's
 * retries idempotent for free.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
 */
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual, createHash } from 'crypto';
import { loggers } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { isStopKeyword, handleInboundStop } from '@/services/suppressionService';
import { normalizePhone } from '@/lib/sanitize';
import { formatBucharestDateTime } from '@/lib/dates/property-times';

export const runtime = 'nodejs'; // node:crypto, and we need the raw body
export const dynamic = 'force-dynamic';

const logger = loggers.whatsapp;

/** Meta expects a fast 2xx. Anything slower risks redelivery storms. */
const ok = () => NextResponse.json({ received: true }, { status: 200 });

// ---------------------------------------------------------------------------
// GET — Meta's subscription handshake
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!expected) {
    logger.error('WHATSAPP_WEBHOOK_VERIFY_TOKEN missing; cannot complete webhook handshake');
    return new NextResponse('Not configured', { status: 503 });
  }

  if (mode === 'subscribe' && token && challenge && safeCompare(token, expected)) {
    logger.info('WhatsApp webhook verified by Meta');
    // Must be the bare challenge as text/plain, not JSON.
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  logger.warn('WhatsApp webhook handshake rejected', { mode, hasToken: !!token });
  return new NextResponse('Forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST — events
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Public endpoint: blunt abuse, but stay generous. Meta can legitimately
  // batch several events per second during a burst.
  const rl = checkRateLimit(request, {
    maxRequests: 120,
    windowSeconds: 60,
    keyPrefix: 'whatsapp-cloud',
  });
  if (!rl.allowed) {
    logger.warn('WhatsApp Cloud webhook rate limited');
    return ok(); // 200 so Meta does not retry into the limiter
  }

  // Hash the exact bytes Meta signed. Reading as text and re-encoding risks a
  // mismatch on any input that does not round-trip through UTF-8 identically.
  const raw = Buffer.from(await request.arrayBuffer());

  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    // FAIL CLOSED. An unverified endpoint that writes to the thread vault and
    // sends mail is a forgery vector, so refuse rather than trust.
    logger.error('META_APP_SECRET missing; refusing to process WhatsApp webhook');
    return new NextResponse('Not configured', { status: 503 });
  }

  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'), appSecret)) {
    // 403 (not 200) on purpose: if OUR secret were wrong, Meta's legitimate
    // deliveries would fail loudly here rather than being silently discarded.
    logger.warn('WhatsApp webhook signature invalid');
    return new NextResponse('Invalid signature', { status: 403 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    logger.warn('WhatsApp webhook body was not JSON');
    return ok(); // malformed will never parse; retrying is pointless
  }

  // --- Step 2: durable capture, keyed by the payload's own hash -------------
  const eventId = createHash('sha256').update(raw).digest('hex').slice(0, 40);
  try {
    const db = await getAdminDb();
    await db.collection('whatsappWebhookEvents').doc(eventId).create({
      payload,
      receivedAt: FieldValue.serverTimestamp(),
      processed: false,
    });
  } catch (e: any) {
    if (isAlreadyExists(e)) {
      // A byte-identical redelivery. Already captured; nothing to do.
      logger.info('WhatsApp webhook duplicate delivery ignored', { eventId });
      return ok();
    }
    // Capture failed: do NOT 200. Let Meta retry rather than lose the message.
    logger.error('Failed to persist WhatsApp webhook event', e as Error, { eventId });
    return new NextResponse('Storage error', { status: 500 });
  }

  // --- Step 3: interpretation (best effort; the payload is already safe) ----
  try {
    await processPayload(payload);
    const db = await getAdminDb();
    await db.collection('whatsappWebhookEvents').doc(eventId).update({
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Deliberately still 200: the raw event is stored and replayable, and
    // hammering Meta's retry queue over a downstream bug helps nobody.
    logger.error('Error processing WhatsApp webhook payload', error as Error, { eventId });
  }

  return ok();
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function processPayload(payload: any): Promise<void> {
  if (payload?.object !== 'whatsapp_business_account') {
    logger.warn('Unexpected webhook object', { object: payload?.object });
    return;
  }

  const ourWaba = process.env.WHATSAPP_WABA_ID?.trim();

  for (const entry of payload.entry ?? []) {
    // entry.id is the WABA id. Reject anything not ours: the app may later be
    // subscribed to other accounts, and cross-account writes would corrupt the
    // vault silently.
    if (ourWaba && entry?.id && entry.id !== ourWaba) {
      logger.warn('Webhook entry for a different WABA ignored', { entryId: entry.id });
      continue;
    }

    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue;
      const value = change.value ?? {};

      // Display names arrive alongside, keyed by wa_id.
      const names = new Map<string, string>();
      for (const c of value.contacts ?? []) {
        if (c?.wa_id) names.set(c.wa_id, c?.profile?.name || '');
      }

      for (const msg of value.messages ?? []) {
        await handleInboundMessage(msg, names.get(msg?.from) || '');
      }
      for (const st of value.statuses ?? []) {
        await handleStatus(st);
      }
    }
  }
}

async function handleInboundMessage(msg: any, senderName: string): Promise<void> {
  const messageId: string | undefined = msg?.id;
  const from = normalizePhone(msg?.from);
  if (!messageId || !from) return;

  const db = await getAdminDb();

  // Per-message idempotency, independent of the payload hash: the same message
  // can legitimately arrive inside two differently-shaped batches.
  try {
    await db.collection('whatsappInboundMessages').doc(messageId).create({
      from,
      receivedAt: FieldValue.serverTimestamp(),
    });
  } catch (e: any) {
    if (isAlreadyExists(e)) return;
    throw e;
  }

  const text = extractText(msg);

  logger.info('Inbound WhatsApp message', {
    from: from.slice(0, 6) + '***',
    type: msg?.type,
    isStop: isStopKeyword(text),
  });

  // Opt-out first: it must survive any later failure.
  if (isStopKeyword(text)) {
    await handleInboundStop(from, 'whatsapp-cloud');
  }

  // The vault's invariant is one document per guest, doc id === guestId. Do not
  // break it for unknown senders; park those separately so nothing is lost.
  const { findGuestByPhone } = await import('@/services/guestService');
  const guest = await findGuestByPhone(from);

  const entry = {
    ts: tsToVaultFormat(msg?.timestamp),
    direction: 'in' as const,
    sender: senderName || from,
    text,
    type: msg?.type === 'text' ? 'text' : 'media',
    // New field, additive: lets us trace a vault line back to Meta. The backfill
    // rows simply will not have it.
    wamid: messageId,
  };

  if (!guest) {
    await db.collection('whatsappInboundOrphans').doc(messageId).set({
      phone: from,
      message: entry,
      createdAt: FieldValue.serverTimestamp(),
    });
    logger.info('Inbound WhatsApp from unknown number parked', { from: from.slice(0, 6) + '***' });
    return;
  }

  await db.collection('whatsappThreads').doc(guest.id).set(
    {
      phone: from,
      guestId: guest.id,
      status: 'ok',
      messages: FieldValue.arrayUnion(entry),
      messageCount: FieldValue.increment(1),
      lastMessageTs: entry.ts,
      lastInboundAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Delivery receipts. Best effort: `messageLog.providerId` holds the wamid we got
 * when sending, so a status can be matched back to the row that sent it.
 */
async function handleStatus(st: any): Promise<void> {
  const wamid: string | undefined = st?.id;
  const status: string | undefined = st?.status; // sent | delivered | read | failed
  if (!wamid || !status) return;

  const db = await getAdminDb();
  const snap = await db
    .collection('messageLog')
    .where('providerId', '==', wamid)
    .limit(1)
    .get();

  if (snap.empty) return; // e.g. messages sent outside the campaign path

  await snap.docs[0].ref.update({
    deliveryStatus: status,
    deliveryUpdatedAt: FieldValue.serverTimestamp(),
    ...(st?.errors ? { deliveryError: JSON.stringify(st.errors).slice(0, 500) } : {}),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifySignature(raw: Buffer, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(header.slice('sha256='.length), 'hex');
  } catch {
    return false;
  }
  // timingSafeEqual throws on a length mismatch, so check first.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(expected, provided);
}

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Match the format the WhatsApp backfill wrote: Bucharest wall-clock, no offset
 * (e.g. "2025-01-18T20:52:52"). Mixing formats inside one `messages` array would
 * quietly break anything that sorts or parses it.
 */
function tsToVaultFormat(unixSeconds: unknown): string {
  const n = Number(unixSeconds);
  const d = Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
  return formatBucharestDateTime(d, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * The vault stores non-text as the literal placeholder "<type> omitted" (the
 * backfill wrote "image omitted"), so follow that convention rather than
 * inventing a second one.
 */
function extractText(msg: any): string {
  const type = msg?.type;
  if (type === 'text') return msg?.text?.body ?? '';
  if (type === 'button') return msg?.button?.text ?? 'button';
  if (type === 'interactive') {
    return (
      msg?.interactive?.button_reply?.title ??
      msg?.interactive?.list_reply?.title ??
      'interactive'
    );
  }
  const caption = msg?.[type]?.caption;
  return caption ? `${type} omitted: ${caption}` : `${type} omitted`;
}

function isAlreadyExists(e: any): boolean {
  // Firestore ALREADY_EXISTS
  return e?.code === 6 || /already exists/i.test(e?.message ?? '');
}
