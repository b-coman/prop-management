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
import type { Guest, WhatsAppThread, WhatsAppMessage, WhatsAppThreadImport } from '@/types';
import { mergeMessages, reconcileAuthoritative, type ReconcileResult } from '@/lib/whatsapp/parse-thread';
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
  authoritative?: boolean; // true = this batch is an official phone export — the COMPLETE history as
                           // that device knows it. It supersedes stored duplicates (matched on a
                           // source-independent loose fingerprint, since the scrape only knows the
                           // minute while the export carries real seconds), but anything the vault
                           // holds and the export lacks is RESCUED, not dropped — an export can be
                           // legitimately short (restored phone, disappearing-messages timer) and a
                           // blind overwrite would destroy the only surviving copy.
}): Promise<{ added: number; total: number; reconcile?: ReconcileResult }> {
  const db = await getAdminDb();
  const ref = db.collection('whatsappThreads').doc(input.guestId);
  const snap = await ref.get();
  const existing = snap.exists ? ((snap.data() as WhatsAppThread).messages ?? []) : [];

  const reconcile = input.authoritative ? reconcileAuthoritative(existing, input.messages) : undefined;
  const merged = reconcile ? reconcile.messages : mergeMessages(existing, input.messages);
  const added = merged.length - existing.length;
  const lastMessageTs = merged.length ? merged[merged.length - 1].ts : undefined;
  const now = FieldValue.serverTimestamp();

  await ref.set(
    {
      guestId: input.guestId,
      phone: input.phone,
      messages: merged,
      messageCount: merged.length,
      status: 'ok',
      ...(lastMessageTs ? { lastMessageTs } : {}),
      lastFetchedAt: now,
      ...(snap.exists ? {} : { firstFetchedAt: now }),
    },
    { merge: true }
  );

  logger.info('WhatsApp thread upserted', {
    guestId: input.guestId, added, total: merged.length,
    ...(reconcile ? { rescued: reconcile.rescued.length, superseded: reconcile.supersededCount } : {}),
  });
  return { added, total: merged.length, reconcile };
}

/**
 * Archive a raw import batch, immutably, before it is folded into a thread.
 *
 * The thread doc is a DERIVED view: it is reconciled, deduped and sorted, and reconciliation rules
 * may change. The archive is the source of record — every batch ever collected, exactly as parsed,
 * so a thread can always be rebuilt without going back to the phone. That matters most for chats
 * that no longer exist on any device (disappearing-messages timers, trimmed history), where the
 * vault is the only surviving copy.
 */
export async function archiveImport(input: {
  guestId: string;
  phone: string;
  source: 'export' | 'scrape';
  label: string;               // the export filename / capture label — provenance
  messages: WhatsAppMessage[];
}): Promise<string> {
  const db = await getAdminDb();
  const sorted = [...input.messages].sort((a, b) => a.ts.localeCompare(b.ts));
  const doc: Omit<WhatsAppThreadImport, 'id'> = {
    guestId: input.guestId,
    phone: input.phone,
    source: input.source,
    label: input.label,
    messageCount: sorted.length,
    ...(sorted.length ? { firstTs: sorted[0].ts, lastTs: sorted[sorted.length - 1].ts } : {}),
    messages: sorted,
    importedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('whatsappThreadImports').add(doc);
  logger.info('WhatsApp import archived', { guestId: input.guestId, importId: ref.id, count: sorted.length });
  return ref.id;
}

/**
 * Record a processed guest that has NO retrievable messages — either no WhatsApp
 * chat exists (`no-chat`) or the chat is empty/media-only (`empty`). This is a real
 * signal (no WhatsApp presence / never engaged) AND it makes the backfill resumable
 * (the guest now has a doc, so `getBackfillQueue({onlyMissing})` skips it).
 */
export async function markThread(guestId: string, phone: string, status: 'no-chat' | 'empty'): Promise<void> {
  const db = await getAdminDb();
  const ref = db.collection('whatsappThreads').doc(guestId);
  const snap = await ref.get();
  const now = FieldValue.serverTimestamp();
  await ref.set(
    {
      guestId,
      phone,
      status,
      ...(snap.exists ? {} : { messages: [], messageCount: 0, firstFetchedAt: now }),
      lastFetchedAt: now,
    },
    { merge: true }
  );
  logger.info('WhatsApp thread marked', { guestId, status });
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
  lastFetchedAt?: string;   // when we last CAPTURED it → drives the re-export staleness order
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
  /** Order by capture staleness (oldest `lastFetchedAt` first) — the re-export work-list. */
  byStaleness?: boolean;
}): Promise<BackfillQueueItem[]> {
  const db = await getAdminDb();
  const lang = opts?.language ?? 'ro';

  const [guestSnap, threadSnap] = await Promise.all([
    db.collection('guests').get(),
    db.collection('whatsappThreads').get(),
  ]);

  const threads = new Map<string, { lastMessageTs?: string; lastFetchedAt?: string; messageCount: number }>();
  threadSnap.docs.forEach((d) => {
    const t = d.data() as WhatsAppThread & { lastFetchedAt?: { toDate?: () => Date } };
    threads.set(d.id, {
      lastMessageTs: t.lastMessageTs,
      lastFetchedAt: t.lastFetchedAt?.toDate?.().toISOString().slice(0, 10),
      messageCount: t.messageCount ?? (t.messages?.length ?? 0),
    });
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
      lastFetchedAt: th?.lastFetchedAt,
      messageCount: th?.messageCount ?? 0,
    });
  });

  if (opts?.byStaleness) {
    // Never-captured first, then longest-since-capture. This is the "which chats should I export
    // next" order — without it the export path (unlike the scrape queue) is worked blind.
    items.sort((a, b) => (a.lastFetchedAt ?? '').localeCompare(b.lastFetchedAt ?? '') || a.name.localeCompare(b.name));
  } else {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }
  return items;
}
