/**
 * guestNoteService — the record of interactions that never touched WhatsApp.
 *
 * Most of a lead relationship happens on the phone. The message vault cannot see it, so without
 * notes the engagement layer reads the WhatsApp residue and draws the opposite conclusion: three
 * unanswered outbound messages look like "silent — messaged, never replied" for someone who was
 * warm and enthusiastic on a call. Notes restore the missing half of the timeline.
 *
 * Two duties, deliberately separate:
 *   1. TOUCH  — a call/in-person note is a real contact and counts against pacing floors, so the
 *               system cannot follow a phone call with a "we haven't spoken in a while" message.
 *   2. FACT   — an `assertable` note (optionally narrowed to specific `facts`) is admitted to the
 *               copywriter's groundedFacts whitelist. Everything else is context: it may shape
 *               tone, never a claim.
 *
 * Storage: `guestNotes/{noteId}` — append-only, admin-locked (private conversation content, same
 * sensitivity as the thread vault).
 *
 * Plain server module (NOT 'use server').
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { GuestNote, GuestNoteFact, GuestNoteKind } from '@/types';

const logger = loggers.campaign;

/** Kinds that represent a real two-way exchange (an observation is not one). */
export function isTouch(kind: GuestNoteKind): boolean {
  return kind === 'call' || kind === 'inperson';
}

/** True if the note is still relevant as of `asOf` (unexpired). */
export function isLive(note: Pick<GuestNote, 'expiresAt'>, asOf: string): boolean {
  return !note.expiresAt || note.expiresAt >= asOf;
}

export async function addGuestNote(input: {
  guestId: string;
  text: string;
  kind?: GuestNoteKind;
  occurredAt?: string;          // defaults to today
  initiatedBy?: 'owner' | 'guest';
  assertable?: boolean;
  facts?: GuestNoteFact[];
  expiresAt?: string;
  createdBy?: string;
}): Promise<string> {
  const db = await getAdminDb();
  const doc: Omit<GuestNote, 'id'> = {
    guestId: input.guestId,
    occurredAt: input.occurredAt || new Date().toISOString().slice(0, 10),
    kind: input.kind || 'call',
    text: input.text.trim(),
    assertable: input.assertable ?? false,
    ...(input.initiatedBy ? { initiatedBy: input.initiatedBy } : {}),
    ...(input.facts?.length ? { facts: input.facts } : {}),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
    createdAt: FieldValue.serverTimestamp() as unknown as GuestNote['createdAt'],
  };
  const ref = await db.collection('guestNotes').add(doc);
  logger.info('Guest note added', { guestId: input.guestId, noteId: ref.id, kind: doc.kind, assertable: doc.assertable });
  return ref.id;
}

/** All notes for one guest, oldest first. */
export async function listGuestNotes(guestId: string): Promise<GuestNote[]> {
  const db = await getAdminDb();
  const snap = await db.collection('guestNotes').where('guestId', '==', guestId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<GuestNote, 'id'>) }))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

/**
 * Every note, grouped by guest — the pack-building read. One collection scan, mirroring how the
 * packs already load guests/bookings/threads.
 */
export async function getNotesByGuest(): Promise<Map<string, GuestNote[]>> {
  const db = await getAdminDb();
  const snap = await db.collection('guestNotes').get();
  const byGuest = new Map<string, GuestNote[]>();
  snap.docs.forEach((d) => {
    const n = { id: d.id, ...(d.data() as Omit<GuestNote, 'id'>) };
    if (!n.guestId) return;
    if (!byGuest.has(n.guestId)) byGuest.set(n.guestId, []);
    byGuest.get(n.guestId)!.push(n);
  });
  byGuest.forEach((arr) => arr.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)));
  return byGuest;
}

export async function deleteGuestNote(noteId: string): Promise<void> {
  const db = await getAdminDb();
  await db.collection('guestNotes').doc(noteId).delete();
  logger.info('Guest note deleted', { noteId });
}
