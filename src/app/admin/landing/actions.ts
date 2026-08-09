'use server';
/**
 * Admin server actions for the landing-page engine (P3). A 'use server' file may only export async
 * functions — shared shapes are redeclared in the client components. All actions are super-admin gated
 * and return a discriminated union ({ok:true,...} | {ok:false,error}); reads return the data or null.
 * Writes go to `landingPages/{slug}` via the Admin SDK (the collection's rules deny client writes).
 */
import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { buildLandingDraftFromCampaign, suggestLandingSlug } from '@/lib/landing/generateLanding';
import { buildExampleStays } from '@/lib/landing/exampleStays';
import type { LandingConfig, ExampleStay } from '@/lib/landing/contracts';

const logger = loggers.campaign;

async function requireActor(): Promise<string> {
  const user = await requireSuperAdmin();
  return user.email || user.uid;
}

/** Firestore rejects `undefined` — round-trip to drop undefined keys before any write. */
const clean = <T>(o: T): T => JSON.parse(JSON.stringify(o));

// ── reads ──────────────────────────────────────────────────────────────────────────────────────

/** All landing pages for a property (newest first). Returns [] on auth failure (initial-load fetch). */
export async function fetchLandingsAction(propertyId: string) {
  try { await requireActor(); } catch { return []; }
  const db = await getAdminDb();
  const snap = await db.collection('landingPages').where('propertyId', '==', propertyId).get();
  return snap.docs
    .map(d => convertTimestampsToISOStrings({ slug: d.id, ...d.data() }) as Record<string, unknown>)
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')));
}

/** One landing config + the property's images (for the editor's pickers). null if missing / unauthorized. */
export async function fetchLandingAction(slug: string) {
  try { await requireActor(); } catch { return null; }
  const db = await getAdminDb();
  const doc = await db.collection('landingPages').doc(slug).get();
  if (!doc.exists) return null;
  const config = convertTimestampsToISOStrings({ slug: doc.id, ...doc.data() }) as unknown as LandingConfig;
  const propSnap = await db.collection('properties').doc(config.propertyId).get();
  const propertyImages = ((propSnap.data()?.images as unknown[]) ?? []) as Array<Record<string, unknown>>;
  return { config, propertyImages };
}

/** Ad campaigns for a property that can seed a landing (have a proposal), newest first. */
export async function fetchCampaignOptionsAction(propertyId: string) {
  try { await requireActor(); } catch { return []; }
  const db = await getAdminDb();
  const [campaigns, landings] = await Promise.all([
    db.collection('adCampaigns').where('propertyId', '==', propertyId).get(),
    db.collection('landingPages').where('propertyId', '==', propertyId).get(),
  ]);
  const usedCampaignRefs = new Set(landings.docs.map(d => (d.data().campaignRef as string) || '').filter(Boolean));
  return campaigns.docs
    .map(d => {
      const c = d.data();
      const occ = (c.proposal?.occasion ?? {}) as { name?: string; start?: string; end?: string };
      if (!c.proposal) return null;
      return {
        id: d.id,
        status: (c.status as string) ?? 'draft',
        occasionName: occ.name ?? '(no occasion)',
        window: occ.start && occ.end ? `${occ.start} → ${occ.end}` : null,
        suggestedSlug: suggestLandingSlug(occ.name, occ.start),
        hasLanding: usedCampaignRefs.has(d.id),
        createdAt: convertTimestampsToISOStrings({ v: c.createdAt }).v ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

// ── mutations ──────────────────────────────────────────────────────────────────────────────────

type Ok<T = unknown> = { ok: true } & T;
type Err = { ok: false; error: string };

async function guard<R>(fn: (actor: string) => Promise<R>): Promise<R | Err> {
  let actor: string;
  try { actor = await requireActor(); }
  catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: handleAuthError(e).error };
    throw e;
  }
  try { return await fn(actor); }
  catch (e) { logger.error('landing action failed', e as Error); return { ok: false, error: (e as Error).message || 'internal-error' }; }
}

/** Generate a draft landing from an ad campaign at `slug`. Refuses if the slug is taken. */
export async function generateLandingAction(campaignId: string, slug: string): Promise<Ok<{ slug: string }> | Err> {
  return guard(async (actor) => {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!cleanSlug) return { ok: false, error: 'Enter a valid slug (letters, numbers, dashes).' };
    const db = await getAdminDb();
    if ((await db.collection('landingPages').doc(cleanSlug).get()).exists)
      return { ok: false, error: `A landing page "${cleanSlug}" already exists — pick another slug.` };
    const draft = await buildLandingDraftFromCampaign(campaignId, { slug: cleanSlug, createdBy: actor });
    await db.collection('landingPages').doc(cleanSlug).set(clean({
      ...draft, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }));
    logger.info('landing generated from campaign', { campaignId, slug: cleanSlug, actor });
    revalidatePath('/admin/landing');
    return { ok: true, slug: cleanSlug };
  });
}

/** Save the edited config (owner-editable fields only; slug/propertyId/campaignRef are immutable). */
export async function saveLandingAction(slug: string, patch: Partial<LandingConfig>): Promise<Ok | Err> {
  return guard(async () => {
    const db = await getAdminDb();
    const ref = db.collection('landingPages').doc(slug);
    if (!(await ref.get()).exists) return { ok: false, error: 'Landing page not found.' };
    // Only these fields are writable from the editor.
    const writable = clean({
      period: patch.period, hero: patch.hero, story: patch.story, exampleStays: patch.exampleStays,
      gallery: patch.gallery, offer: patch.offer, cta: patch.cta,
      defaultLanguage: patch.defaultLanguage, status: patch.status,
    });
    await ref.set({ ...writable, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    revalidatePath('/admin/landing');
    revalidatePath(`/admin/landing/${slug}`);
    return { ok: true };
  });
}

/** Re-run the P2 reasoner for this landing's period and replace its example stays. */
export async function regenerateStaysAction(slug: string): Promise<Ok<{ stays: ExampleStay[] }> | Err> {
  return guard(async () => {
    const db = await getAdminDb();
    const ref = db.collection('landingPages').doc(slug);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: 'Landing page not found.' };
    const cfg = doc.data() as LandingConfig;
    const stays = await buildExampleStays(cfg.propertyId, {
      kind: cfg.period?.kind ?? 'season', start: cfg.period?.start ?? null, end: cfg.period?.end ?? null,
    });
    await ref.set({ exampleStays: clean(stays), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    revalidatePath(`/admin/landing/${slug}`);
    return { ok: true, stays };
  });
}

/** Publish / unpublish. */
export async function setLandingStatusAction(slug: string, status: 'draft' | 'published'): Promise<Ok | Err> {
  return guard(async () => {
    const db = await getAdminDb();
    await db.collection('landingPages').doc(slug).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    revalidatePath('/admin/landing');
    revalidatePath(`/admin/landing/${slug}`);
    return { ok: true };
  });
}

/** Delete a landing page. */
export async function deleteLandingAction(slug: string): Promise<Ok | Err> {
  return guard(async () => {
    const db = await getAdminDb();
    await db.collection('landingPages').doc(slug).delete();
    revalidatePath('/admin/landing');
    return { ok: true };
  });
}
