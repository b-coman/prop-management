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

/**
 * How many recent posts' photos are off-limits. Six at two posts a week is three weeks of not
 * repeating yourself — long enough that nobody scrolling the page sees the same photo twice, short
 * enough that a 59-photo library can still sustain it.
 */
const RECENT_POSTS_FOR_ROTATION = 6;

/**
 * How far back the 60/25/15 ratio is measured. Twenty posts at two a week is about ten weeks —
 * long enough that one odd fortnight cannot skew it, short enough to still track the seasons.
 */
const MIX_WINDOW = 20;
import { publishPagePost, fetchPostEngagement } from '@/services/growth/pagePublisher';
import { planFortnight, type PlannedSlot, type Slate } from '@/services/growth/fortnightPlanner';
import { quoteStay } from '@/lib/landing/exampleStays';
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
        // WHAT THE LAST FEW POSTS ALREADY SHOWED.
    // 59 photos and two posts a week: without this the library is exhausted in about seven posts and
    // the page starts repeating itself, which performs worse than a smaller fresh album. Counts
    // scheduled posts too — they are already committed even though nobody has seen them yet.
    const recentSnap = await db
      .collection('pagePosts')
      .where('propertyId', '==', input.propertyId)
      .get();
    const recentlyUsedPaths = recentSnap.docs
      .map((d) => d.data() as { status?: string; assetPaths?: string[]; createdAt?: { toMillis?: () => number } })
      .filter((d) => d.status === 'posted' || d.status === 'scheduled')
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, RECENT_POSTS_FOR_ROTATION)
      .flatMap((d) => d.assetPaths ?? []);

    // If rotation has eaten the library there is nothing left to pick from — better a repeat than no
    // post, so the window is dropped and the operator is told rather than handed a failure.
    const usable = assets.length - new Set(recentlyUsedPaths).size;
    const rotation = usable >= 3 ? recentlyUsedPaths : [];

    const res = await generatePagePost({
      propertyId: input.propertyId, prompt: input.prompt, assets, framing,
      postType: input.postType, recentlyUsedPaths: rotation,
    });
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
  Array<{ id: string; message: string; postType?: string; assetPaths?: string[]; assetUrls?: string[]; assetPath: string; assetUrl: string; status: string; publishedMessage?: string; scheduledFor?: string; postId?: string; reactions?: number; comments?: number; shares?: number; permalink?: string; prompt?: string; goal?: string | null; audience?: string | null; createdAt?: string; plannedFor?: string; plannedWhy?: string }>
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
      postType?: string; offerFacts?: unknown;
    };
    // Scheduled counts too: Meta is already holding that copy, so publishing now would put the same
    // post out twice and orphan the queued one. The console hides the button, but a stale tab still
    // has it — the tab being stale is precisely how this page has already failed once.
    if (data.status === 'posted' || data.status === 'scheduled') {
      return { ok: false, error: `already-${data.status}` };
    }
    if (!data.propertyId) return { ok: false, error: 'draft-incomplete' };

    // What the operator is looking at wins over what the model wrote.
    const message = (finalText ?? data.message ?? '').trim();
    if (!message) return { ok: false, error: 'draft-incomplete' };

    const urls = (data.assetUrls?.length ? data.assetUrls : [data.assetUrl]).filter(Boolean) as string[];
    if (!urls.length) return { ok: false, error: 'no-photo-urls' };

    // A DRAFTED OFFER CAN GO STALE BETWEEN WRITING AND SENDING. Re-check the window and the price
    // against live data at the last possible moment — the whole point of planning ahead is that days
    // pass, and days are exactly when a booking lands on the nights we are about to advertise.
    const of = data.offerFacts as { checkIn: string; checkOut: string; priceRon: number; guests?: number } | undefined;
    if (data.postType === 'offer' && of) {
      const still = await offerStillTrue(data.propertyId, of);
      if (!still.ok) return { ok: false, error: still.error };
    }

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
        // What the page actually SHOWS. An edit made on Facebook after publishing is invisible
        // to us otherwise — the first real post was edited there and our record kept the draft.
        publishedMessage: e.message ?? null,
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
    // COUNTS SCHEDULED AS WELL AS POSTED, and over a long window rather than the current batch.
    // The owner's point: "the post mix should keep their mix over longer periods, not only for the
    // bulk you create for two weeks. It should consider the history too." A fortnight planned in one
    // go would otherwise blow the ratio, and two fortnights would double the error — scheduled posts
    // are already committed even though nobody has seen them.
    const snap = await db
      .collection('pagePosts')
      .where('propertyId', '==', propertyId)
      .get();
    const recent = snap.docs
      .map((d) => d.data() as { status?: string; postType?: string; createdAt?: { toMillis?: () => number } })
      .filter((d) => d.status === 'posted' || d.status === 'scheduled')
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      .slice(0, MIX_WINDOW);
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


/**
 * Schedule a draft instead of publishing it now.
 *
 * Meta holds it and publishes it itself, which is the point: it survives our infrastructure being
 * down, and the pending queue shows in Meta's Publishing Tools so there is a second place to see
 * what is about to go out.
 *
 * A weekend offer has to be seen before the weekend — Meta's own floor is 10 minutes, which is no
 * use as a guard, so the meaningful window is enforced here.
 */
export async function schedulePagePostAction(
  id: string,
  whenIso: string,
  finalText?: string
): Promise<{ ok: true; postId: string; scheduledFor: string } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const when = new Date(whenIso);
    if (Number.isNaN(when.getTime())) return { ok: false, error: 'invalid-date' };
    const minutesAhead = (when.getTime() - Date.now()) / 60000;
    if (minutesAhead < 20) return { ok: false, error: 'schedule at least 20 minutes ahead' };
    if (minutesAhead > 180 * 24 * 60) return { ok: false, error: 'Meta will not schedule more than 6 months ahead' };

    const db = await getAdminDb();
    const ref = db.collection('pagePosts').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: 'post-not-found' };
    const data = doc.data() as {
      propertyId?: string; message?: string; postType?: string;
      assetUrls?: string[]; assetUrl?: string; status?: string; offerFacts?: unknown;
    };
    if (data.status === 'posted' || data.status === 'scheduled') return { ok: false, error: `already-${data.status}` };
    if (!data.propertyId) return { ok: false, error: 'draft-incomplete' };

    const message = (finalText ?? data.message ?? '').trim();
    if (!message) return { ok: false, error: 'draft-incomplete' };
    const urls = (data.assetUrls?.length ? data.assetUrls : [data.assetUrl]).filter(Boolean) as string[];
    if (!urls.length) return { ok: false, error: 'no-photo-urls' };

    // A DRAFTED OFFER CAN GO STALE BETWEEN WRITING AND SENDING. Re-check the window and the price
    // against live data at the last possible moment — the whole point of planning ahead is that days
    // pass, and days are exactly when a booking lands on the nights we are about to advertise.
    const of = data.offerFacts as { checkIn: string; checkOut: string; priceRon: number; guests?: number } | undefined;
    if (data.postType === 'offer' && of) {
      const still = await offerStillTrue(data.propertyId, of);
      if (!still.ok) return { ok: false, error: still.error };
    }

    // An OFFER names dates. Landing it the night before is worthless — nobody plans a weekend on
    // Friday evening. The owner's rule: a weekend offer goes out Tuesday or Wednesday.
    if (data.postType === 'offer') {
      const day = when.getDay(); // 0 Sun … 6 Sat
      if (day === 5 || day === 6 || day === 0) {
        return { ok: false, error: 'an offer scheduled for Fri/Sat/Sun arrives too late — put it on Tue or Wed' };
      }
    }

    const res = await publishPagePost(data.propertyId, {
      message,
      photoUrls: urls,
      scheduledPublishTime: Math.floor(when.getTime() / 1000),
    });
    if (!res.ok || !res.postId) return { ok: false, error: res.error ?? 'schedule-failed' };

    await ref.update({
      message,
      status: 'scheduled',
      postId: res.postId,
      scheduledFor: when.toISOString(),
      publishedVia: 'api-scheduled',
    });
    revalidatePath('/admin/page-posts');
    return { ok: true, postId: res.postId, scheduledFor: when.toISOString() };
  } catch (error) {
    logger.error('schedulePagePostAction failed', error as Error, { id });
    return { ok: false, error: 'internal-error' };
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// The fortnight planner: plan → generate → schedule, with the operator between
// every pair of arrows.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Plan the next fortnight. READ-ONLY: no LLM, no writes, nothing sent. Cheap enough to re-run as
 * many times as the operator likes, and it reads live inventory, so re-planning tomorrow correctly
 * gives a different answer.
 */
export async function planFortnightAction(
  propertyId: string,
  posts?: number
): Promise<{ ok: true; slate: Slate } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const slate = await planFortnight(propertyId, { posts: Math.min(Math.max(posts ?? 4, 1), 6) });
    return { ok: true, slate };
  } catch (error) {
    logger.error('planFortnightAction failed', error as Error, { propertyId });
    return { ok: false, error: 'internal-error' };
  }
}

/**
 * An offer's window and price, re-checked against live data.
 *
 * A page-post offer is drafted days before it goes out; in between, a booking can land or the
 * operator can edit the calendar. Every gate that could put an offer in front of a person runs this
 * — generate, publish, schedule — because the failure is not cosmetic: it is a public price the
 * booking engine will not honour, or an invitation to nights someone else has taken.
 */
async function offerStillTrue(
  propertyId: string,
  f: { checkIn: string; checkOut: string; priceRon: number; guests?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nights = Math.round((Date.parse(`${f.checkOut}T00:00:00Z`) - Date.parse(`${f.checkIn}T00:00:00Z`)) / 86400000);
  if (!(nights > 0)) return { ok: false, error: 'the offer has no valid window' };
  const q = await quoteStay(propertyId, f.checkIn, nights, f.guests);
  if (!q.available) {
    return { ok: false, error: `${f.checkIn} → ${f.checkOut} is no longer free — re-plan the fortnight` };
  }
  if (q.priceRon == null) return { ok: false, error: 'no price calendar covers those nights any more' };
  if (q.priceRon !== f.priceRon) {
    return { ok: false, error: `the price moved: the caption says ${f.priceRon} lei, the booking page now quotes ${q.priceRon} — re-plan the fortnight` };
  }
  return { ok: true };
}

/** Photos the next post must not reuse. Counts committed posts AND planned drafts — a slate written
 *  in one sitting would otherwise let post 2 repeat post 1's album. */
async function rotationFor(propertyId: string, db: FirebaseFirestore.Firestore): Promise<string[]> {
  const snap = await db.collection('pagePosts').where('propertyId', '==', propertyId).get();
  return snap.docs
    .map((d) => d.data() as { status?: string; assetPaths?: string[]; plannedFor?: string; createdAt?: { toMillis?: () => number } })
    .filter((d) => d.status === 'posted' || d.status === 'scheduled' || (d.status === 'draft' && d.plannedFor))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
    .slice(0, RECENT_POSTS_FOR_ROTATION)
    .flatMap((d) => d.assetPaths ?? []);
}

/**
 * Write ONE slot of a planned slate as a draft.
 *
 * Deliberately one slot per call rather than a loop inside a single action: four LLM calls is the
 * better part of a minute, and a client-driven sequence shows progress, survives one slot failing,
 * and lets each call read the rotation the previous one just wrote.
 */
export async function generateSlotAction(
  propertyId: string,
  slot: PlannedSlot
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: handleAuthError(error).error };
    throw error;
  }
  try {
    const db = await getAdminDb();
    const propDoc = await db.collection('properties').doc(propertyId).get();
    if (!propDoc.exists) return { ok: false, error: 'property-not-found' };
    const images = (propDoc.data()?.images ?? []) as PropertyImage[];
    const ownPrefix = `properties/${propertyId}/`;
    const assets = images
      .filter((i): i is PropertyImage & { storagePath: string } => Boolean(i.storagePath?.startsWith(ownPrefix)))
      .map((i) => ({ storagePath: i.storagePath, alt: serverTranslateContent(i.alt, 'en'), tags: i.tags ?? [], aiDescription: i.aiDescription }));
    if (!assets.length) return { ok: false, error: 'no gallery photos for this property' };

    // THE PROSE IS THE OPERATOR'S, THE NUMBERS ARE OURS. He may rewrite any brief before generating;
    // the offer's window and price come from `anchor`, which is re-verified here rather than trusted.
    let offerFacts: { priceRon: number; checkIn: string; checkOut: string } | undefined;
    if (slot.postType === 'offer' && slot.anchor?.kind === 'stay') {
      const a = slot.anchor;
      if (a.priceRon == null) return { ok: false, error: 'that window has no price — re-plan' };
      const still = await offerStillTrue(propertyId, { checkIn: a.start, checkOut: a.end, priceRon: a.priceRon, guests: a.guests });
      if (!still.ok) return { ok: false, error: still.error };
      offerFacts = { priceRon: a.priceRon, checkIn: a.start, checkOut: a.end };
    }

    const recentlyUsedPaths = await rotationFor(propertyId, db);
    const usable = assets.length - new Set(recentlyUsedPaths).size;
    const rotation = usable >= 3 ? recentlyUsedPaths : [];

    const res = await generatePagePost({
      propertyId,
      prompt: slot.brief,
      assets,
      framing: { goal: slot.goal, audience: slot.audience },
      postType: slot.postType,
      recentlyUsedPaths: rotation,
      offerFacts,
    // One more repair than the single-post path: a failed slot in a planned batch costs the operator
    // a re-run of the whole slate, and an offer carries the extra number rules on top of everything
    // else, so it has the most to get right in one go.
    }, { maxRepairs: 2 });
    if (!res.ok || !res.post) return { ok: false, error: res.errors.join('; ') || 'generation-failed' };

    const urlByPath = new Map(images.filter((i) => i.storagePath).map((i) => [i.storagePath!, i.url]));
    const ref = db.collection('pagePosts').doc();
    await ref.set({
      propertyId,
      prompt: slot.brief,
      goal: slot.goal ?? null,
      audience: slot.audience ?? null,
      message: res.post.message,
      postType: res.post.postType,
      assetPaths: res.post.assetPaths,
      assetUrls: res.post.assetPaths.map((a) => urlByPath.get(a) ?? '').filter(Boolean),
      assetPath: res.post.assetPaths[0],
      assetUrl: urlByPath.get(res.post.assetPaths[0]) ?? '',
      status: 'draft',
      // What makes this a PLANNED draft rather than a one-off: the slate's intended time, and the
      // real thing it was built from.
      plannedFor: slot.publishAt,
      plannedWhy: slot.why,
      ...(offerFacts ? { offerFacts: { ...offerFacts, guests: (slot.anchor as { guests?: number }).guests ?? null } } : {}),
      ...(slot.anchor?.kind === 'review' ? { reviewId: slot.anchor.review.id } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    revalidatePath('/admin/page-posts');
    return { ok: true, id: ref.id };
  } catch (error) {
    logger.error('generateSlotAction failed', error as Error, { propertyId, type: slot?.postType });
    return { ok: false, error: 'internal-error' };
  }
}
