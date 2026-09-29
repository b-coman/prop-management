'use server';

import { revalidatePath } from 'next/cache';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { convertTimestampsToISOStrings } from '@/lib/utils';

const logger = loggers.admin;

/**
 * Editing surface for the guest guide (`propertyOverrides/{id}.guestGuide`).
 *
 * Until now this was only editable by running a script, which is why the arrival note, the Wi-Fi
 * password and twenty sections of copy all lived somewhere the owner could not reach. The same
 * block is read by the guide page AND by the guest emails, so a typo in the Wi-Fi password or the
 * gate number reaches an arriving guest through two channels at once.
 */

export interface GuideDraft {
  enabled?: boolean;
  wifi?: { network?: string; password?: string };
  contacts?: Array<{
    displayName?: Record<string, string> | string;
    role?: Record<string, string> | string;
    phone?: string;
    channel?: string;
    speaks?: string[];
    prefill?: Record<string, string>;
  }>;
  arrival?: {
    wazeUrl?: string;
    mapsUrl?: string;
    gateNumber?: string;
    call?: Record<string, string> | string;
    access?: Record<string, string> | string;
  };
  sections?: Array<{
    id?: string;
    title?: Record<string, string> | string;
    body?: Record<string, string> | string;
    tier?: string;
    group?: string;
    image?: { url?: string; alt?: Record<string, string> | string };
  }>;
  /** Carried through untouched so a save cannot drop what this editor does not show. */
  [key: string]: unknown;
}

export async function fetchGuide(propertyId: string): Promise<GuideDraft | null> {
  try {
    await requirePropertyAccess(propertyId);
    const db = await getAdminDb();
    const doc = await db.collection('propertyOverrides').doc(propertyId).get();
    if (!doc.exists) return null;
    const data = convertTimestampsToISOStrings(doc.data()!);
    return (data.guestGuide as GuideDraft) ?? {};
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    logger.error('fetchGuide failed', error as Error, { propertyId });
    return null;
  }
}

/** Every section needs an id: the guide keys off it, and a blank one silently drops the section. */
function validate(guide: GuideDraft): string | null {
  const ids = (guide.sections ?? []).map((s) => (s.id ?? '').trim());
  if (ids.some((id) => !id)) return 'Every section needs an id.';
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) return `Duplicate section id: ${dupes[0]}`;
  for (const c of guide.contacts ?? []) {
    if (c.phone && !/^\+?[\d\s-]{9,}$/.test(c.phone)) return `That phone number looks wrong: ${c.phone}`;
  }
  for (const [label, url] of [['Waze', guide.arrival?.wazeUrl], ['Maps', guide.arrival?.mapsUrl]] as const) {
    if (url && !/^https?:\/\//.test(url)) return `The ${label} link must start with http.`;
  }
  return null;
}

export async function saveGuide(
  propertyId: string,
  guide: GuideDraft
): Promise<{ error?: string }> {
  try {
    await requirePropertyAccess(propertyId);
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message };
    throw error;
  }

  const problem = validate(guide);
  if (problem) return { error: problem };

  try {
    const db = await getAdminDb();
    // The WHOLE guestGuide object goes back, because the editor loaded all of it — including the
    // keys it does not show (routes, shareMessage, mapUrl). `merge: true` then protects every
    // OTHER block on the overrides document: homepage, gallery, footer and the rest. An upload
    // script once rewrote this document wholesale, which is the failure this shape avoids.
    await db.collection('propertyOverrides').doc(propertyId).set(
      { guestGuide: guide, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    logger.info('Guest guide saved', {
      propertyId,
      sections: (guide.sections ?? []).length,
      contacts: (guide.contacts ?? []).length,
    });

    // The guide page is force-dynamic, but revalidate anyway so any cached shell refreshes.
    revalidatePath(`/g/${propertyId}`);
    revalidatePath('/admin/guide');
    return {};
  } catch (error) {
    logger.error('saveGuide failed', error as Error, { propertyId });
    return { error: error instanceof Error ? error.message : 'Could not save the guide.' };
  }
}
