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
