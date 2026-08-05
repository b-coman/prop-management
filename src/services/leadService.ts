/**
 * leadService — people who contacted us directly but never stayed.
 *
 * A lead is a `guests` doc with `kind: 'lead'`, NOT a parallel collection. Everything downstream —
 * the WhatsApp thread vault (keyed by guestId), notes, consent, suppression, frequency caps and
 * executionGateway — already works off a guest doc; a second collection would mean a second code
 * path through all of it. Keeping one doc also means a lead who eventually books keeps its id, and
 * with it the entire conversation that convinced them.
 *
 * What a lead has instead of a stay is a REQUEST and a reason it went unfilled. Those two fields
 * carry the weight the booking history carries for a guest: they are what the next message can
 * honestly be built on, and `requestedPeriods` doubles as demand telemetry for dates we could not
 * serve — evidence that never becomes a booking record.
 *
 * Plain server module (NOT 'use server').
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { normalizePhone } from '@/lib/sanitize';
import type { Guest, NonConversionReason, RequestedPeriod } from '@/types';

const logger = loggers.campaign;

const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');

/**
 * A WhatsApp push-name is not a verified name: it can be a nickname, ALL CAPS, or carry emoji
 * ("~JOHN 🎩"). Strip the decoration for storage but keep the provenance in `nameSource` so the
 * copywriter can decide whether it is safe to greet someone by it.
 */
export function cleanPushName(raw: string | undefined | null): string {
  return (raw || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/^~/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the display name is really just the phone number WhatsApp fell back to. */
export function isPhoneAsName(name: string, phone: string): boolean {
  const n = digits(name);
  return n.length >= 6 && n === digits(phone).slice(-n.length);
}

/** Find any guest OR lead by phone (last 9 digits — tolerant of formatting differences). */
export async function findByPhone(phone: string): Promise<Guest | null> {
  const p9 = digits(phone).slice(-9);
  if (p9.length < 9) return null;
  const db = await getAdminDb();
  const snap = await db.collection('guests').get();
  const hit = snap.docs.find((d) => {
    const g = d.data() as Guest;
    return digits(g.normalizedPhone || g.phone || '').slice(-9) === p9;
  });
  return hit ? ({ id: hit.id, ...hit.data() } as Guest) : null;
}

/**
 * Create a lead, or return the existing record if this phone is already known (a lead we have
 * already met, or a real past guest — never shadow one with a duplicate).
 */
export async function createLead(input: {
  phone: string;
  name?: string;
  nameSource?: Guest['nameSource'];
  leadSource?: string;
  propertyId?: string;
  firstContactAt?: string;
  language?: Guest['language'];
}): Promise<{ id: string; created: boolean; existing?: Guest }> {
  const existing = await findByPhone(input.phone);
  if (existing) return { id: existing.id, created: false, existing };

  const db = await getAdminDb();
  const normalized = normalizePhone(input.phone) || input.phone;
  const rawName = cleanPushName(input.name);
  const name = isPhoneAsName(rawName, normalized) ? '' : rawName;
  const now = FieldValue.serverTimestamp();

  const doc = {
    kind: 'lead' as const,
    firstName: name,
    nameSource: name ? (input.nameSource || 'pushname') : ('unknown' as const),
    phone: input.phone,
    normalizedPhone: normalized,
    language: input.language || 'ro',
    leadSource: input.leadSource || 'whatsapp',
    firstContactAt: input.firstContactAt || new Date().toISOString().slice(0, 10),
    propertyIds: input.propertyId ? [input.propertyId] : [],
    bookingIds: [] as string[],
    totalBookings: 0,
    totalSpent: 0,
    currency: 'RON' as const,
    tags: [] as string[],
    reviewSubmitted: false,
    unsubscribed: false,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await db.collection('guests').add(doc);
  logger.info('Lead created', { leadId: ref.id, phone: normalized, named: !!name });
  return { id: ref.id, created: true };
}

/** Patch lead-specific fields (name, why it did not convert, source, property). */
export async function updateLead(guestId: string, patch: {
  firstName?: string;
  nameSource?: Guest['nameSource'];
  leadSource?: string;
  nonConversionReason?: NonConversionReason;
  propertyId?: string;
  language?: Guest['language'];
}): Promise<void> {
  const db = await getAdminDb();
  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (patch.firstName !== undefined) update.firstName = patch.firstName;
  if (patch.nameSource) update.nameSource = patch.nameSource;
  if (patch.leadSource) update.leadSource = patch.leadSource;
  if (patch.nonConversionReason) update.nonConversionReason = patch.nonConversionReason;
  if (patch.language) update.language = patch.language;
  if (patch.propertyId) update.propertyIds = FieldValue.arrayUnion(patch.propertyId);
  await db.collection('guests').doc(guestId).set(update, { merge: true });
  logger.info('Lead updated', { guestId, fields: Object.keys(update) });
}

/** Append a requested period. Idempotent on (start, end, askedOn). */
export async function addRequestedPeriod(guestId: string, period: RequestedPeriod): Promise<void> {
  const db = await getAdminDb();
  const ref = db.collection('guests').doc(guestId);
  const snap = await ref.get();
  const current = ((snap.data() as Guest | undefined)?.requestedPeriods || []) as RequestedPeriod[];
  const key = (p: RequestedPeriod) => `${p.start}|${p.end}|${p.askedOn}`;
  const next = [...current.filter((p) => key(p) !== key(period)), period]
    .sort((a, b) => a.askedOn.localeCompare(b.askedOn));
  await ref.set({ requestedPeriods: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logger.info('Requested period recorded', { guestId, start: period.start, end: period.end, outcome: period.outcome });
}

export async function listLeads(): Promise<Guest[]> {
  const db = await getAdminDb();
  const snap = await db.collection('guests').where('kind', '==', 'lead').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Guest)
    .sort((a, b) => String(b.firstContactAt || '').localeCompare(String(a.firstContactAt || '')));
}
