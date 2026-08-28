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
import { generatePagePost, POST_TYPES, type PagePostType } from '@/services/growth/pagePostWriter';
import { publishPagePost, fetchPostEngagement } from '@/services/growth/pagePublisher';
import type { PropertyImage } from '@/types';

const logger = loggers.ads;

/** Generate a draft organic page post for review + manual posting. */
export async function generatePagePostAction(input: {
  propertyId: string;
  prompt: string;
  postType?: PagePostType;
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
        const res = await generatePagePost({ propertyId: input.propertyId, prompt: input.prompt, assets, framing, postType: input.postType });
    if (!res.ok || !res.post) return { ok: false, error: res.errors.join('; ') || 'generation-failed' };

    const urlByPath = new Map(images.filter((i) => i.storagePath).map((i) => [i.storagePath!, i.url]));
    const ref = db.collection('pagePosts').doc();
    await ref.set({
      propertyId: input.propertyId,
      prompt: input.prompt.trim(),
      goal: framing.goal ?? null,
      audience: framing.audience ?? null,
      message: res.post.message,
      postType: res.post.postType,
      assetPaths: res.post.assetPaths,
      assetUrls: res.post.assetPaths.map((a) => urlByPath.get(a) ?? '').filter(Boolean),
      // Kept so older drafts and any UI still reading the singular fields do not break.
      assetPath: res.post.assetPaths[0],
      assetUrl: urlByPath.get(res.post.assetPaths[0]) ?? '',
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
  Array<{ id: string; message: string; postType?: string; assetPaths?: string[]; assetUrls?: string[]; assetPath: string; assetUrl: string; status: string; postId?: string; reactions?: number; comments?: number; shares?: number; permalink?: string; prompt?: string; goal?: string | null; audience?: string | null; createdAt?: string }>
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


/**
 * Publish a draft to the page, for real.
 *
 * The step that has always been manual — and the page's failure mode has never been bad posts, it
 * has been NO posts: 17 in six years, silence since 27 June 2024. Requires the page scopes the owner
 * granted on 28 Aug 2026.
 *
 * The draft's status only moves to 'posted' if Meta returns a post id, so a failed publish leaves it
 * a draft that can be retried rather than a phantom marked done.
 */
export async function publishPagePostAction(
  id: string,
  /**
   * The caption AS EDITED in the console. Publishing shipped without this and read `message`
   * straight from Firestore, so the operator's edits were silently discarded and the toast still
   * said "Published" — the first real post went out in the draft's words, not his. `markPagePosted`
   * had always taken the edited text; the new path simply forgot to.
   */
  finalText?: string
): Promise<{ ok: true; postId: string; permalink?: string } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const db = await getAdminDb();
    const ref = db.collection('pagePosts').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: 'post-not-found' };
    const data = doc.data() as {
      propertyId?: string; message?: string; assetUrls?: string[]; assetUrl?: string; status?: string;
    };
    if (data.status === 'posted') return { ok: false, error: 'already-posted' };
    if (!data.propertyId) return { ok: false, error: 'draft-incomplete' };

    // What the operator is looking at wins over what the model wrote.
    const message = (finalText ?? data.message ?? '').trim();
    if (!message) return { ok: false, error: 'draft-incomplete' };

    const urls = (data.assetUrls?.length ? data.assetUrls : [data.assetUrl]).filter(Boolean) as string[];
    if (!urls.length) return { ok: false, error: 'no-photo-urls' };

    const res = await publishPagePost(data.propertyId, { message, photoUrls: urls });
    if (!res.ok || !res.postId) return { ok: false, error: res.error ?? 'publish-failed' };

    await ref.update({
      // Store what was ACTUALLY published, so the record matches the page rather than the draft.
      message,
      status: 'posted',
      postId: res.postId,
      publishedAt: FieldValue.serverTimestamp(),
      publishedVia: 'api',
    });
    revalidatePath('/admin/page-posts');
    return { ok: true, postId: res.postId };
  } catch (error) {
    logger.error('publishPagePostAction failed', error as Error, { id });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * Refresh reactions/comments/shares for everything we published.
 *
 * This is what turns the mix from a rule into a feedback loop: with six years and ONE comment on
 * record, "did anyone reply?" is the question the whole strategy hangs on, and until the token could
 * read the page nobody could answer it.
 */
export async function syncPageEngagementAction(
  propertyId: string
): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, updated: 0, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const db = await getAdminDb();
    const snap = await db
      .collection('pagePosts')
      .where('propertyId', '==', propertyId)
      .where('status', '==', 'posted')
      .limit(100)
      .get();
    const byPostId = new Map<string, string>();
    snap.docs.forEach((d) => {
      const pid = (d.data() as { postId?: string }).postId;
      if (pid) byPostId.set(pid, d.id);
    });
    if (!byPostId.size) return { ok: true, updated: 0 };

    const res = await fetchPostEngagement(propertyId, [...byPostId.keys()]);
    if (!res.ok || !res.data) return { ok: false, updated: 0, error: res.error };

    const batch = db.batch();
    for (const e of res.data) {
      const docId = byPostId.get(e.postId);
      if (!docId) continue;
      batch.update(db.collection('pagePosts').doc(docId), {
        reactions: e.reactions,
        comments: e.comments,
        shares: e.shares,
        permalink: e.permalink ?? null,
        engagementSyncedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    revalidatePath('/admin/page-posts');
    return { ok: true, updated: res.data.length };
  } catch (error) {
    logger.error('syncPageEngagementAction failed', error as Error, { propertyId });
    return { ok: false, updated: 0, error: 'internal-error' };
  }
}

/**
 * The 60/25/15 mix over the last 10 posts, so the ratio is visible instead of remembered.
 *
 * `suggestion` is the type most behind its target — the answer to "what should I post next?" without
 * anyone having to count. A page that managed 17 posts in six years does not need another thing to
 * keep track of.
 */
export async function fetchMixAction(
  propertyId: string
): Promise<{ counts: Record<string, number>; targets: Record<string, number>; total: number; suggestion: PagePostType }> {
  const targets: Record<string, number> = { place: 0.6, proof: 0.25, offer: 0.15 };
  try {
    await requireSuperAdmin();
  } catch {
    return { counts: {}, targets, total: 0, suggestion: 'place' };
  }
  try {
    const db = await getAdminDb();
    // NO orderBy IN THE QUERY. `where + where + orderBy` needs a composite Firestore index, and
    // without it this throws FAILED_PRECONDITION — which the catch below would swallow into an empty
    // mix, leaving the meter silently blank rather than visibly broken. Verified against live
    // Firestore before shipping. Two equality filters need no index, so the sort happens in memory;
    // one property's page posts are counted in dozens, not thousands.
    const snap = await db
      .collection('pagePosts')
      .where('propertyId', '==', propertyId)
      .where('status', '==', 'posted')
      .get();
    const recent = snap.docs
      .map((d) => d.data() as { postType?: string; createdAt?: { toMillis?: () => number } })
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, 10);
    const counts: Record<string, number> = { place: 0, proof: 0, offer: 0 };
    recent.forEach((d) => {
      const t = d.postType ?? 'place';
      if (t in counts) counts[t] += 1;
    });
    const total = recent.length;
    // Furthest below target wins. With nothing posted yet every gap is equal, and `place` — the type
    // that earns reach — is the right way to restart a page nobody has seen in fourteen months.
    let suggestion: PagePostType = 'place';
    let worst = Infinity;
    for (const t of POST_TYPES) {
      const share = total ? counts[t] / total : 0;
      const gap = share - targets[t];
      if (gap < worst) { worst = gap; suggestion = t; }
    }
    return { counts, targets, total, suggestion };
  } catch (error) {
    logger.error('fetchMixAction failed', error as Error, { propertyId });
    return { counts: {}, targets, total: 0, suggestion: 'place' };
  }
}
