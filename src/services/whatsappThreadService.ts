/**
 * whatsappThreadService — persist the verbatim WhatsApp conversation vault and
 * drive the backfill/top-up queue. This is the durable server half of the fetcher;
 * the browser half extracts rows, this half normalizes-merges-stores them.
 *
 * Storage: `whatsappThreads/{guestId}` — messages inline (a guest thread is tiny
 * vs Firestore's 1MB doc cap; ~5k messages before that matters). Admin-only, locked
 * in firestore.rules (holds full private conversations — the most sensitive PII we
 * keep). See plans/engagement-system.md §7.0/§7.1.
 *
 * Plain server module (NOT 'use server').
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { Guest, WhatsAppThread, WhatsAppMessage } from '@/types';
import { mergeMessages } from '@/lib/whatsapp/parse-thread';
import { resolveGuestLanguage } from '@/lib/growth/language';

const logger = loggers.campaign;

/**
 * Merge a freshly-extracted batch into a guest's thread (append-only, idempotent).
 * Backfill passes `existing = []` implicitly (no doc yet); the incremental top-up
 * passes only the recent tail — either way `mergeMessages` dedupes by fingerprint,
 * so re-running is safe. Returns how many messages were newly added.
 */
export async function upsertThreadMessages(input: {
  guestId: string;
  phone: string;
  messages: WhatsAppMessage[];
}): Promise<{ added: number; total: number }> {
  const db = await getAdminDb();
  const ref = db.collection('whatsappThreads').doc(input.guestId);
  const snap = await ref.get();
  const existing = snap.exists ? ((snap.data() as WhatsAppThread).messages ?? []) : [];

  const merged = mergeMessages(existing, input.messages);
  const added = merged.length - existing.length;
  const lastMessageTs = merged.length ? merged[merged.length - 1].ts : undefined;
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      guestId: input.guestId,
      phone: input.phone,
      messages: merged,
      messageCount: merged.length,
      ...(lastMessageTs ? { lastMessageTs } : {}),
      lastFetchedAt: now,
      ...(snap.exists ? {} : { firstFetchedAt: now }),
    },
    { merge: true }
  );

  logger.info('WhatsApp thread upserted', { guestId: input.guestId, added, total: merged.length });
  return { added, total: merged.length };
}

/** Read a stored thread (timestamps serialized for any caller). */
export async function getThread(guestId: string): Promise<WhatsAppThread | null> {
  const db = await getAdminDb();
  const snap = await db.collection('whatsappThreads').doc(guestId).get();
  if (!snap.exists) return null;
  const { convertTimestampsToISOStrings } = await import('@/lib/utils');
  return convertTimestampsToISOStrings({ id: snap.id, ...snap.data() }) as WhatsAppThread;
}

export interface BackfillQueueItem {
  guestId: string;
  name: string;
  phone: string;            // E.164 — the number to search in WhatsApp
  hasThread: boolean;
  lastMessageTs?: string;   // present when a thread exists → the incremental cutoff
  messageCount: number;
}

/**
 * The work-list for the fetcher. Every guest with a WhatsApp number in the target
 * language, annotated with thread status so the orchestrator knows what to do:
 *   - `hasThread=false` → full backfill
 *   - `hasThread=true`  → incremental top-up (fetch messages after `lastMessageTs`)
 * `onlyMissing` narrows to the first-pass backfill set. Sorted by name (stable).
 */
export async function getBackfillQueue(opts?: {
  language?: 'ro' | 'en' | 'all';
  onlyMissing?: boolean;
}): Promise<BackfillQueueItem[]> {
  const db = await getAdminDb();
  const lang = opts?.language ?? 'ro';

  const [guestSnap, threadSnap] = await Promise.all([
    db.collection('guests').get(),
    db.collection('whatsappThreads').get(),
  ]);

  const threads = new Map<string, { lastMessageTs?: string; messageCount: number }>();
  threadSnap.docs.forEach((d) => {
    const t = d.data() as WhatsAppThread;
    threads.set(d.id, { lastMessageTs: t.lastMessageTs, messageCount: t.messageCount ?? (t.messages?.length ?? 0) });
  });

  const items: BackfillQueueItem[] = [];
  guestSnap.docs.forEach((d) => {
    const g = { id: d.id, ...d.data() } as Guest;
    if (!g.normalizedPhone) return; // need a searchable E.164
    if (lang !== 'all' && resolveGuestLanguage(g) !== lang) return;

    const th = threads.get(d.id);
    if (opts?.onlyMissing && th) return;

    items.push({
      guestId: d.id,
      name: [g.firstName, g.lastName].filter(Boolean).join(' ').trim() || d.id,
      phone: g.normalizedPhone,
      hasThread: !!th,
      lastMessageTs: th?.lastMessageTs,
      messageCount: th?.messageCount ?? 0,
    });
  });

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}
