'use server';

/**
 * Contacts — server actions for capturing what happened off-WhatsApp, and for the lead records
 * those conversations belong to.
 *
 * This exists because the capture path decided whether any of it works at all. A note system that
 * only has a CLI never gets filled: after a phone call the owner is holding a phone, not a
 * terminal. Everything here is shaped around the ten seconds right after hanging up — find them (or
 * open a record from just a number), say what happened, done.
 *
 * Super-admin only, matching firestore.rules for `guestNotes` (private conversation content).
 */
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { addGuestNote, listGuestNotes, deleteGuestNote, isTouch } from '@/services/guestNoteService';
import { createLead, updateLead, addRequestedPeriod } from '@/services/leadService';
import type { Guest, GuestNote, GuestNoteKind, NonConversionReason, RequestedPeriod, WhatsAppThread } from '@/types';

const logger = loggers.guest;

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const toDateStr = (v: unknown): string | null => {
  if (!v) return null;
  const o = v as { _seconds?: number; toDate?: () => Date };
  if (typeof v === 'string') return v.slice(0, 10);
  if (o._seconds) return new Date(o._seconds * 1000).toISOString().slice(0, 10);
  if (o.toDate) return o.toDate().toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return null;
};

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  kind: 'guest' | 'lead';
  lastStay: string | null;
  firstContactAt: string | null;
  nonConversionReason: string | null;
  messages: number;
  inbound: number;
  notes: number;
  /** Latest interaction of any kind — the "how warm is this" number. */
  lastContact: string | null;
  unsubscribed: boolean;
}

/** The searchable index: every guest and lead with a phone, annotated with interaction counts. */
export async function fetchContactsAction(): Promise<ContactRow[]> {
  try {
    await requireSuperAdmin();
    const db = await getAdminDb();
    const [gSnap, tSnap, nSnap] = await Promise.all([
      db.collection('guests').get(),
      db.collection('whatsappThreads').get(),
      db.collection('guestNotes').get(),
    ]);

    const threads = new Map(tSnap.docs.map((d) => [d.id, d.data() as WhatsAppThread]));
    const notesByGuest = new Map<string, GuestNote[]>();
    nSnap.docs.forEach((d) => {
      const n = { id: d.id, ...(d.data() as Omit<GuestNote, 'id'>) };
      if (!n.guestId) return;
      if (!notesByGuest.has(n.guestId)) notesByGuest.set(n.guestId, []);
      notesByGuest.get(n.guestId)!.push(n);
    });

    const rows: ContactRow[] = [];
    gSnap.docs.forEach((d) => {
      const g = { id: d.id, ...(d.data() as Omit<Guest, 'id'>) };
      if (!g.normalizedPhone && !g.phone) return;   // unreachable — nothing to capture against
      const th = threads.get(d.id);
      const msgs = th?.messages || [];
      const notes = notesByGuest.get(d.id) || [];
      const lastMsg = msgs.length ? String(msgs[msgs.length - 1].ts).slice(0, 10) : null;
      const lastNote = notes.map((n) => n.occurredAt).sort().pop() || null;
      rows.push({
        id: d.id,
        name: [g.firstName, g.lastName].filter(Boolean).join(' ').trim(),
        phone: g.normalizedPhone || g.phone || '',
        kind: g.kind === 'lead' ? 'lead' : 'guest',
        lastStay: toDateStr(g.lastStayDate) || toDateStr(g.lastBookingDate),
        firstContactAt: g.firstContactAt || null,
        nonConversionReason: g.nonConversionReason || null,
        messages: msgs.length,
        inbound: msgs.filter((m) => m.direction === 'in').length,
        notes: notes.length,
        lastContact: [lastMsg, lastNote].filter(Boolean).sort().pop() || null,
        unsubscribed: !!g.unsubscribed,
      });
    });

    rows.sort((a, b) => (b.lastContact || '').localeCompare(a.lastContact || ''));
    return rows;
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    logger.error('fetchContactsAction failed', error as Error);
    return [];
  }
}

export interface ContactDetail {
  notes: Array<Pick<GuestNote, 'id' | 'occurredAt' | 'kind' | 'text' | 'assertable' | 'expiresAt' | 'initiatedBy'> & { facts: Array<{ key: string; value: string }> }>;
  requestedPeriods: RequestedPeriod[];
  nonConversionReason: string | null;
  /** Last few messages, so the owner can see where the conversation left off before writing. */
  recentMessages: Array<{ ts: string; direction: string; text: string }>;
  messageCount: number;
  inboundCount: number;
  callCount: number;
}

export async function fetchContactDetailAction(guestId: string): Promise<ContactDetail | null> {
  try {
    await requireSuperAdmin();
    const db = await getAdminDb();
    const [gDoc, tDoc, notes] = await Promise.all([
      db.collection('guests').doc(guestId).get(),
      db.collection('whatsappThreads').doc(guestId).get(),
      listGuestNotes(guestId),
    ]);
    if (!gDoc.exists) return null;
    const g = gDoc.data() as Guest;
    const msgs = (tDoc.exists ? (tDoc.data() as WhatsAppThread).messages : []) || [];

    return {
      notes: notes.map((n) => ({
        id: n.id, occurredAt: n.occurredAt, kind: n.kind, text: n.text,
        assertable: n.assertable, expiresAt: n.expiresAt, initiatedBy: n.initiatedBy,
        facts: n.facts || [],
      })),
      requestedPeriods: g.requestedPeriods || [],
      nonConversionReason: g.nonConversionReason || null,
      recentMessages: msgs.slice(-8).map((m) => ({ ts: m.ts, direction: m.direction, text: m.text })),
      messageCount: msgs.length,
      inboundCount: msgs.filter((m) => m.direction === 'in').length,
      callCount: notes.filter((n) => isTouch(n.kind)).length,
    };
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    logger.error('fetchContactDetailAction failed', error as Error, { guestId });
    return null;
  }
}

const noteSchema = z.object({
  guestId: z.string().min(1),
  text: z.string().min(3, 'Write at least a few words'),
  kind: z.enum(['call', 'inperson', 'observation']),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  initiatedBy: z.enum(['owner', 'guest']).optional(),
  assertable: z.boolean(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  factKey: z.string().optional(),
  factValue: z.string().optional(),
});

export async function addNoteAction(input: {
  guestId: string; text: string; kind: GuestNoteKind; occurredAt: string;
  initiatedBy?: 'owner' | 'guest'; assertable: boolean; expiresAt?: string;
  factKey?: string; factValue?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireSuperAdmin();
    const p = noteSchema.parse(input);
    const facts = p.factKey && p.factValue ? [{ key: p.factKey.trim(), value: p.factValue.trim() }] : [];
    await addGuestNote({
      guestId: p.guestId, text: p.text, kind: p.kind, occurredAt: p.occurredAt,
      initiatedBy: p.initiatedBy, assertable: p.assertable, expiresAt: p.expiresAt,
      facts, createdBy: user.email || 'admin',
    });
    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/guests/${p.guestId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    if (error instanceof z.ZodError) return { ok: false, error: error.errors[0]?.message || 'Invalid note' };
    logger.error('addNoteAction failed', error as Error);
    return { ok: false, error: 'Could not save the note' };
  }
}

export async function deleteNoteAction(noteId: string, guestId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    await deleteGuestNote(noteId);
    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/guests/${guestId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    logger.error('deleteNoteAction failed', error as Error, { noteId });
    return { ok: false, error: 'Could not delete the note' };
  }
}

export async function createLeadAction(input: {
  phone: string; name?: string; propertyId?: string; leadSource?: string;
}): Promise<{ ok: boolean; id?: string; created?: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    if (!/^\+?\d[\d\s().-]{6,}$/.test(input.phone.trim())) return { ok: false, error: 'That does not look like a phone number' };
    const res = await createLead({
      phone: input.phone.trim(),
      name: input.name?.trim(),
      nameSource: input.name?.trim() ? 'manual' : undefined,
      leadSource: input.leadSource || 'phone',
      propertyId: input.propertyId,
      firstContactAt: ymd(new Date()),
    });
    revalidatePath('/admin/contacts');
    return { ok: true, id: res.id, created: res.created };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    logger.error('createLeadAction failed', error as Error);
    return { ok: false, error: 'Could not create the lead' };
  }
}

export async function setLeadReasonAction(guestId: string, reason: NonConversionReason): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    await updateLead(guestId, { nonConversionReason: reason });
    revalidatePath('/admin/contacts');
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    logger.error('setLeadReasonAction failed', error as Error, { guestId });
    return { ok: false, error: 'Could not save' };
  }
}

const periodSchema = z.object({
  guestId: z.string().min(1),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outcome: z.enum(['unavailable', 'declined', 'booked', 'unresolved']),
  note: z.string().optional(),
});

export async function addRequestedPeriodAction(input: {
  guestId: string; start: string; end: string; outcome: RequestedPeriod['outcome']; note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    const p = periodSchema.parse(input);
    if (p.end < p.start) return { ok: false, error: 'End date is before the start date' };
    await addRequestedPeriod(p.guestId, {
      start: p.start, end: p.end, askedOn: ymd(new Date()), outcome: p.outcome,
      ...(p.note ? { note: p.note } : {}),
    });
    revalidatePath('/admin/contacts');
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    if (error instanceof z.ZodError) return { ok: false, error: 'Check the dates' };
    logger.error('addRequestedPeriodAction failed', error as Error);
    return { ok: false, error: 'Could not save' };
  }
}
