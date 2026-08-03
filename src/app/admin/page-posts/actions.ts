'use server';

/**
 * Page-posts operator surface (promotion-system-architecture.md §4.3). The organic-page arm's
 * console: generate a warm, grounded page post (caption + a real photo), then post it BY HAND (copy
 * the caption, open the photo) — the same ban-safe manual philosophy as the wa.me WhatsApp flow. The
 * server drafts; it never publishes (API auto-publish needs the owner's page-scope grant — deferred).
 *
 * `'use server'` files may only export async functions — return shapes are inline.
 */
import { revalidatePath } from 'next/cache';
import { loggers } from '@/lib/logger';
import { requireSuperAdmin, handleAuthError, AuthorizationError } from '@/lib/authorization';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { convertTimestampsToISOStrings } from '@/lib/utils';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { generatePagePost } from '@/services/growth/pagePostWriter';
import type { PropertyImage } from '@/types';

const logger = loggers.ads;

/** Generate a draft organic page post for review + manual posting. */
export async function generatePagePostAction(input: {
  propertyId: string;
  prompt: string;
  goal?: string;
  audience?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  if (!input.prompt.trim()) return { ok: false, error: 'a prompt is required' };
  try {
    const db = await getAdminDb();
    const propDoc = await db.collection('properties').doc(input.propertyId).get();
    if (!propDoc.exists) return { ok: false, error: 'property-not-found' };
    const images = (propDoc.data()?.images ?? []) as PropertyImage[];
    const ownPrefix = `properties/${input.propertyId}/`;
    const assets = images
      .filter((i): i is PropertyImage & { storagePath: string } => Boolean(i.storagePath?.startsWith(ownPrefix)))
      .map((i) => ({ storagePath: i.storagePath, alt: serverTranslateContent(i.alt, 'en'), tags: i.tags ?? [], aiDescription: i.aiDescription }));
    if (!assets.length) return { ok: false, error: 'no gallery photos for this property' };

    const framing = { goal: input.goal?.trim() || undefined, audience: input.audience?.trim() || undefined };
    const res = await generatePagePost({ propertyId: input.propertyId, prompt: input.prompt.trim(), assets, framing });
    if (!res.ok || !res.post) return { ok: false, error: res.errors.join('; ') || 'generation-failed' };

    const urlByPath = new Map(images.filter((i) => i.storagePath).map((i) => [i.storagePath!, i.url]));
    const ref = db.collection('pagePosts').doc();
    await ref.set({
      propertyId: input.propertyId,
      prompt: input.prompt.trim(),
      goal: framing.goal ?? null,
      audience: framing.audience ?? null,
      message: res.post.message,
      assetPath: res.post.assetPath,
      assetUrl: urlByPath.get(res.post.assetPath) ?? '',
      status: 'draft',
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/admin/page-posts');
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error('generatePagePostAction failed', error as Error, { propertyId: input.propertyId });
    return { ok: false, error: 'internal-error' };
  }
}

/** List a property's page posts (drafts + posted), newest first. */
export async function fetchPagePostsAction(propertyId: string): Promise<
  Array<{ id: string; message: string; assetPath: string; assetUrl: string; status: string; prompt?: string; goal?: string | null; audience?: string | null; createdAt?: string }>
> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return [];
    throw error;
  }
  try {
    const db = await getAdminDb();
    const snap = await db.collection('pagePosts').where('propertyId', '==', propertyId).orderBy('createdAt', 'desc').limit(50).get();
    return snap.docs.map((d) => convertTimestampsToISOStrings({ id: d.id, ...d.data() }) as never);
  } catch (error) {
    logger.error('fetchPagePostsAction failed', error as Error, { propertyId });
    return [];
  }
}

/** Mark a post as posted (the operator posted it by hand). Optionally records the final edited text. */
export async function markPagePostedAction(id: string, finalText?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const db = await getAdminDb();
    await db.collection('pagePosts').doc(id).update({
      status: 'posted',
      postedAt: FieldValue.serverTimestamp(),
      ...(finalText ? { message: finalText } : {}),
    });
    revalidatePath('/admin/page-posts');
    return { ok: true };
  } catch (error) {
    logger.error('markPagePostedAction failed', error as Error, { id });
    return { ok: false, error: 'internal-error' };
  }
}

/** Delete a draft page post. */
export async function discardPagePostAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const db = await getAdminDb();
    await db.collection('pagePosts').doc(id).delete();
    revalidatePath('/admin/page-posts');
    return { ok: true };
  } catch (error) {
    logger.error('discardPagePostAction failed', error as Error, { id });
    return { ok: false, error: 'internal-error' };
  }
}
