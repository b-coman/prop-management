/**
 * Reads and writes `competitorListings/{propertyId}_{listingId}` — the owner-curated comparable set.
 *
 * WHY IT IS CURATED AND NOT DISCOVERED (C1): a comparable is not "a house near Comarnic", it is a
 * listing a guest treats as an alternative. That is a judgement about substitution, and the owner is
 * the only one who holds it. Auto-discovery would have pulled apartments into a set defined by "a
 * nice house with a yard, not an apartment" and nothing downstream could have told.
 *
 * The document id mirrors `channels/{propertyId}_{channelId}`: the set is per property, never global,
 * because every feature here must work for any property (multi-property rule).
 *
 * Admin-SDK only. No maths and no judgement — feasibility lives in `lib/competitive/set.ts`, prices
 * in `channelPriceObservations`, and neither of them here.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { assertListingId, validateListing, type CompetitorListing } from '@/lib/competitive/set';

const logger = loggers.pricing;
const COLLECTION = 'competitorListings';

export function competitorDocId(propertyId: string, listingId: string): string {
  assertListingId(listingId);
  return `${propertyId}_${listingId}`;
}

function toListing(id: string, data: Record<string, unknown>): CompetitorListing | null {
  const l = data as unknown as CompetitorListing;
  if (!l.listingId || !l.propertyId) {
    logger.warn('Skipping malformed competitorListing', { docId: id });
    return null;
  }
  // Firestore hands back `undefined` for absent fields; the pure layer expects arrays and nulls.
  return {
    ...l,
    units: l.units ?? [],
    amenities: l.amenities ?? [],
    heroPhotoUrl: l.heroPhotoUrl ?? null,
    rating: l.rating ?? null,
    reviewCount: l.reviewCount ?? null,
    qualityAsOf: l.qualityAsOf ?? null,
    distanceKm: l.distanceKm ?? null,
    verifiedAt: l.verifiedAt ?? null,
  };
}

export interface CompetitorSet {
  propertyId: string;
  /** Curated and in play, in display order (channel, then name). */
  active: CompetitorListing[];
  /** Retired, with the reason kept — the judgement is the value, not the row. */
  retired: CompetitorListing[];
  all: CompetitorListing[];
}

export async function getCompetitorSet(propertyId: string): Promise<CompetitorSet> {
  const db = await getAdminDb();
  const snap = await db.collection(COLLECTION).where('propertyId', '==', propertyId).get();
  const all = snap.docs
    .map((d) => toListing(d.id, d.data() as Record<string, unknown>))
    .filter((l): l is CompetitorListing => !!l)
    .sort((a, b) => a.channel.localeCompare(b.channel) || a.displayName.localeCompare(b.displayName));
  return {
    propertyId,
    active: all.filter((l) => l.active),
    retired: all.filter((l) => !l.active),
    all,
  };
}

/** The set for one contest. Airbnb and Booking are separate fields and never pooled (C8). */
export async function getCompetitorField(
  propertyId: string,
  channel: string,
): Promise<CompetitorListing[]> {
  const { active } = await getCompetitorSet(propertyId);
  return active.filter((l) => l.channel === channel);
}

export async function getCompetitorListing(
  propertyId: string,
  listingId: string,
): Promise<CompetitorListing | null> {
  const db = await getAdminDb();
  const doc = await db.collection(COLLECTION).doc(competitorDocId(propertyId, listingId)).get();
  return doc.exists ? toListing(doc.id, doc.data() as Record<string, unknown>) : null;
}

/**
 * Create or update one curated entry.
 *
 * Validates through the SAME pure function the admin form uses, so a document cannot reach the store
 * in a shape the UI would have rejected. In particular `substitutionBasis` is mandatory: an entry
 * nobody can explain is exactly the rot C1 exists to prevent, and it is far easier to refuse it here
 * than to work out six months later why a 19 m² guesthouse is dragging a band down.
 */
export async function upsertCompetitorListing(
  input: Omit<CompetitorListing, 'verifiedAt' | 'curatedBy'> & { curatedBy: string },
): Promise<void> {
  // `verifiedAt` is deliberately NOT accepted here. Curation and verification are separate writes
  // (§17.3), and the earlier signature took it as an optional field — which meant re-running the seed
  // with `verifiedAt: null` would have silently un-verified all fourteen verified listings, because
  // null is not undefined and survived the undefined-strip below. A new document simply lacks the
  // field, and `toListing` reads a missing one as null, so an uncurated entry still reads unverified.
  // Only `recordVerification` sets it, which is what makes the field mean anything.

  const problems = validateListing(input);
  if (problems.length) {
    throw new Error(
      `competitorListing ${input.propertyId}/${input.listingId} is not curated enough to store:\n` +
      problems.map((p) => `  - ${p}`).join('\n'),
    );
  }
  const db = await getAdminDb();
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  await db.collection(COLLECTION).doc(competitorDocId(input.propertyId, input.listingId)).set(
    { ...clean, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  logger.info('Competitor listing curated', {
    propertyId: input.propertyId, listingId: input.listingId,
    channel: input.channel, curatedBy: input.curatedBy,
  });
}

/**
 * Record what a verification pass read from the live page.
 *
 * Separate from `upsertCompetitorListing` because it writes a different KIND of fact: curation is the
 * owner's judgement, verification is what the page said. Keeping them apart is what lets `verifiedAt`
 * mean "a human confirmed this recently" rather than "someone touched the row".
 */
export async function recordVerification(
  propertyId: string,
  listingId: string,
  observed: Partial<Pick<CompetitorListing,
    'displayName' | 'city' | 'heroPhotoUrl' | 'photoProvenance' | 'units' |
    'rating' | 'reviewCount' | 'propertyType' | 'amenities' | 'distanceKm'>>,
  verifiedBy: string,
  at = new Date().toISOString(),
): Promise<void> {
  const db = await getAdminDb();
  const clean = Object.fromEntries(Object.entries(observed).filter(([, v]) => v !== undefined));
  await db.collection(COLLECTION).doc(competitorDocId(propertyId, listingId)).set(
    {
      ...clean,
      ...(observed.rating !== undefined || observed.reviewCount !== undefined
        ? { qualityAsOf: at.slice(0, 10) } : {}),
      verifiedAt: at,
      verifiedBy,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info('Competitor listing verified', {
    propertyId, listingId, verifiedBy, fields: Object.keys(clean),
  });
}

/**
 * Retire an entry. Never deletes: the reasoning for an EXCLUSION is as much a part of a curated set as
 * the entries themselves, and it is the part that disappears first. Pensiunea PIRI LAND is retired,
 * not gone, so nobody re-adds it in six months wondering whether anyone considered it.
 */
export async function retireCompetitorListing(
  propertyId: string,
  listingId: string,
  reason: string,
  retiredBy: string,
): Promise<void> {
  if (!reason.trim()) throw new Error('retiring a comparable requires a reason — that IS the record');
  const db = await getAdminDb();
  await db.collection(COLLECTION).doc(competitorDocId(propertyId, listingId)).set(
    { active: false, retiredReason: reason, retiredBy, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  logger.info('Competitor listing retired', { propertyId, listingId, reason, retiredBy });
}

export async function reactivateCompetitorListing(
  propertyId: string,
  listingId: string,
  by: string,
): Promise<void> {
  const db = await getAdminDb();
  await db.collection(COLLECTION).doc(competitorDocId(propertyId, listingId)).set(
    { active: true, retiredReason: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  logger.info('Competitor listing reactivated', { propertyId, listingId, by });
}
