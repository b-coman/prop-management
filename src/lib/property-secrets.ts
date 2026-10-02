// src/lib/property-secrets.ts
// Per-property secrets: the calendar share tokens and the iCal export token.
//
// These used to live on the `properties` doc, which Firestore rules make publicly readable and
// which every guest page serializes to the browser. Anyone could read the housekeeping calendar
// token (guest names, party sizes, notes) without logging in. They now live in
// `propertySecrets/{propertyId}`, which the rules close to every client, so only server code
// using the Admin SDK can read or write them.

import 'server-only';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';

export const PROPERTY_SECRETS_COLLECTION = 'propertySecrets';

export interface PropertySecrets {
  /** Housekeeping / co-host calendar link: shows guest names, counts and notes. */
  shareCalendarToken?: string;
  /** Anonymized calendar link for past guests: booked vs free only. */
  guestCalendarToken?: string;
  /** Token in the iCal export URL the OTAs poll. */
  icalExportToken?: string;
}

export type PropertySecretField = keyof PropertySecrets;

export async function getPropertySecrets(propertyId: string): Promise<PropertySecrets> {
  const db = await getAdminDb();
  const doc = await db.collection(PROPERTY_SECRETS_COLLECTION).doc(propertyId).get();
  if (!doc.exists) return {};
  const data = doc.data() || {};
  return {
    shareCalendarToken: data.shareCalendarToken || undefined,
    guestCalendarToken: data.guestCalendarToken || undefined,
    icalExportToken: data.icalExportToken || undefined,
  };
}

export async function setPropertySecret(
  propertyId: string,
  field: PropertySecretField,
  value: string
): Promise<void> {
  const db = await getAdminDb();
  await db.collection(PROPERTY_SECRETS_COLLECTION).doc(propertyId).set(
    { propertyId, [field]: value, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/** The property whose `field` equals `token`, or null. The doc ID is the property ID. */
export async function findPropertyIdBySecret(
  field: PropertySecretField,
  token: string
): Promise<string | null> {
  if (!token) return null;
  const db = await getAdminDb();
  const snap = await db.collection(PROPERTY_SECRETS_COLLECTION).where(field, '==', token).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}
