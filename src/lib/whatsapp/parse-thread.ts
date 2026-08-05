/**
 * parse-thread — turn raw WhatsApp Web DOM rows into canonical WhatsAppMessage[].
 *
 * The browser extractor (see the WhatsApp fetcher procedure) reads every message
 * bubble's `data-pre-plain-text` attribute — WhatsApp's stable, copy-paste anchor,
 * shaped `"[HH:MM, M/D/YYYY] Sender: "` — plus the bubble's visible text. This
 * module is the PURE half: no DOM, no Firestore, fully unit-testable. It:
 *   - parses the timestamp (owner-locale) into a sortable Bucharest wall-clock string,
 *   - derives direction from the sender (owner name → 'out', anyone else → 'in'),
 *   - dedupes within a batch,
 * and `mergeMessages` folds a freshly-parsed batch into a stored thread for the
 * incremental top-up (append only what's new).
 *
 * Plain module — no side effects.
 */
import type { WhatsAppMessage, WhatsAppDirection } from '@/types';

/** One extracted DOM row: the raw `data-pre-plain-text` value + the bubble's text. */
export interface RawRow {
  ppt: string | null; // "[HH:MM, M/D/YYYY] Sender: "  (null for media/system without the attr)
  text: string;
}

/**
 * WhatsApp SYSTEM notices — chat events rendered as if they were messages. They MUST be dropped
 * before they reach a thread, because they carry a sender (so they parse as inbound) and a
 * timestamp that is often LATER than the real conversation (WhatsApp stamps them when the chat
 * metadata was written). Left in, a single notice becomes the thread's newest "inbound message",
 * which corrupts `lastMessageTs`, `relationship.state` and every pacing floor derived from it.
 *
 * Observed live: a lead whose only inbound "message" was the disappearing-messages notice read as
 * `state: 'active'` ("replied today") when he had in fact never written at all.
 *
 * Deliberately NOT here: "Missed voice call" — a missed call is a real interaction signal and is
 * kept as a `media` message.
 */
export const SYSTEM_NOTICE_RE = new RegExp([
  'end-to-end encrypted',
  'default timer for disappearing messages',
  'turned (on|off) disappearing messages',
  'messages will disappear',
  'changed to a new number',
  'changed their phone number',
  'created (this )?group',
  'added you',
  'security code',
  'message was deleted',
].join('|'), 'i');

/** True for a chat event that must never be stored as a message. */
export function isSystemNotice(text: string): boolean {
  return SYSTEM_NOTICE_RE.test(text || '');
}

export interface ParseOptions {
  ownerName: string;              // the owner's WhatsApp display name → classifies 'out'
  dateFormat?: 'MDY' | 'DMY';     // owner-locale date order (Bogdan's WhatsApp = MDY); default 'MDY'
}

// "[HH:MM(:SS)? (AM|PM)?, M/D/YYYY] Sender: "
const PPT_RE = /^\[(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?,\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.*?):\s*$/i;

const pad = (v: string | number) => String(v).padStart(2, '0');

/** Trim + collapse internal whitespace; strip zero-width/RTL marks. */
function cleanText(t: string): string {
  return (t || '')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(m: Pick<WhatsAppMessage, 'ts' | 'direction' | 'text'>): string {
  return `${m.ts}|${m.direction}|${m.text}`;
}

/**
 * Parse a batch of raw rows into canonical, de-duplicated, chronologically-sorted
 * messages. Rows without a parseable `data-pre-plain-text` (media/system) are skipped
 * in v1 — the text corpus is the value; media can be added later as type 'media'.
 */
export function parseWhatsAppRows(rows: RawRow[], opts: ParseOptions): WhatsAppMessage[] {
  const fmt = opts.dateFormat ?? 'MDY';
  const owner = opts.ownerName.trim();
  const out: WhatsAppMessage[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row?.ppt) continue;
    const m = row.ppt.match(PPT_RE);
    if (!m) continue;

    const [, hh, mm, ss, ap, p1, p2, yyyy, senderRaw] = m;
    let hour = parseInt(hh, 10);
    if (ap) {
      const up = ap.toUpperCase();
      if (up === 'PM' && hour !== 12) hour += 12;
      if (up === 'AM' && hour === 12) hour = 0;
    }
    const month = fmt === 'MDY' ? p1 : p2;
    const day = fmt === 'MDY' ? p2 : p1;
    const ts = `${yyyy}-${pad(month)}-${pad(day)}T${pad(hour)}:${mm}:${ss ?? '00'}`;

    const sender = senderRaw.trim();
    const direction: WhatsAppDirection = sender === owner ? 'out' : 'in';
    const text = cleanText(row.text);
    if (!text) continue;
    if (isSystemNotice(text)) continue;   // a chat event, not a message (see SYSTEM_NOTICE_RE)

    const msg: WhatsAppMessage = { ts, direction, sender, text, type: 'text' };
    const fp = fingerprint(msg);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(msg);
  }

  out.sort((a, b) => a.ts.localeCompare(b.ts));
  return out;
}

/**
 * Fold a freshly-parsed batch into a stored thread. Union by fingerprint (idempotent
 * re-fetch is a no-op), sorted chronologically. Used by both backfill (existing = [])
 * and the incremental top-up.
 */
export function mergeMessages(existing: WhatsAppMessage[], incoming: WhatsAppMessage[]): WhatsAppMessage[] {
  const seen = new Set(existing.map(fingerprint));
  const merged = [...existing];
  for (const m of incoming) {
    const fp = fingerprint(m);
    if (seen.has(fp)) continue;
    seen.add(fp);
    merged.push(m);
  }
  merged.sort((a, b) => a.ts.localeCompare(b.ts));
  return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-source reconciliation (official phone export vs. the older browser scrape)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text normalized hard enough that the SAME message captured by two different collectors matches.
 * The scrape collapses newlines to spaces and occasionally prefixes a file-size artifact ("42 kB ");
 * the export preserves line breaks. Diacritics are stripped too, so an encoding difference between
 * sources cannot masquerade as a distinct message.
 */
const looseText = (t: string): string => (t || '')
  .replace(/^\d+\s*kB\s+/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Source-independent identity for a message: MINUTE + direction + normalized text.
 *
 * The exact `fingerprint` (full second + raw text) can never match across sources — the scrape only
 * ever knows the minute (seconds forced to `:00`) while the export carries real seconds. That
 * mismatch is why importing an export used to require a destructive whole-thread overwrite.
 */
export function looseFingerprint(m: Pick<WhatsAppMessage, 'ts' | 'direction' | 'text'>): string {
  return `${String(m.ts).slice(0, 16)}|${m.direction}|${looseText(m.text)}`;
}

export interface ReconcileResult {
  messages: WhatsAppMessage[];
  /** Stored messages the authoritative batch does NOT contain — carried over rather than dropped. */
  rescued: WhatsAppMessage[];
  /** Stored messages the batch supersedes (same message, richer capture). */
  supersededCount: number;
  existingCount: number;
  incomingCount: number;
  /** The batch is smaller than what is stored — usually a truncated export. Informational. */
  shrinks: boolean;
  /** The batch's history starts later than the stored history — the tell of a trimmed device. */
  startsLater: boolean;
  existingEarliest?: string;
  incomingEarliest?: string;
}

/**
 * Fold an AUTHORITATIVE batch (an official "Export chat" file) into a stored thread.
 *
 * The batch wins wherever the two describe the same message — it is the richer capture (real
 * seconds, preserved line breaks, media markers). But anything the vault holds and the batch does
 * NOT contain is RESCUED, never dropped. That matters because an export reflects one device at one
 * moment: a phone restored from backup, a chat with a disappearing-messages timer, or a trimmed
 * history all produce a legitimately shorter file. A blind overwrite would silently destroy the
 * only surviving copy; this keeps both without double-storing anything.
 */
export function reconcileAuthoritative(existing: WhatsAppMessage[], incoming: WhatsAppMessage[]): ReconcileResult {
  const seen = new Set<string>();
  const batch = incoming.filter((m) => {
    const fp = fingerprint(m);
    if (seen.has(fp)) return false;
    seen.add(fp);
    return true;
  });

  const batchKeys = new Set(batch.map(looseFingerprint));
  const rescued = existing.filter((m) => !batchKeys.has(looseFingerprint(m)));
  const messages = [...batch, ...rescued].sort((a, b) => a.ts.localeCompare(b.ts));

  const earliest = (arr: WhatsAppMessage[]) => (arr.length ? arr.reduce((min, m) => (m.ts < min ? m.ts : min), arr[0].ts) : undefined);
  const existingEarliest = earliest(existing);
  const incomingEarliest = earliest(batch);

  return {
    messages,
    rescued,
    supersededCount: existing.length - rescued.length,
    existingCount: existing.length,
    incomingCount: batch.length,
    shrinks: batch.length < existing.length,
    startsLater: !!existingEarliest && !!incomingEarliest && incomingEarliest > existingEarliest,
    existingEarliest,
    incomingEarliest,
  };
}
