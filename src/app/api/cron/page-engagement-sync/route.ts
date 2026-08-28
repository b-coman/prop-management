/**
 * page-engagement-sync — refresh reactions/comments/shares on every page post we published.
 *
 * WHY A CRON AND NOT A BUTTON. Engagement arrives over days, not seconds: a post read an hour after
 * publishing shows almost nothing, and nobody remembers to come back a week later. Without this the
 * strategy's loop stops at step two — the ads find the creative, the page reuses it, and then we
 * never learn which posts actually earned anything.
 *
 * That gap is not hypothetical. Read on 28 Aug 2026, the page's six-year record contains exactly ONE
 * comment, and it landed on the single caption that spoke to a person rather than describing a
 * property. That is the most useful fact anyone has had about this page, and it sat unreadable until
 * the token gained `pages_read_user_content`.
 *
 * Runs across every property with a configured page, so it needs no per-property scheduling. Never
 * fatal: a property whose page cannot be read is logged and skipped, and the rest still sync.
 *
 * Suggested schedule: daily. Engagement on a small page is effectively settled after a week, so
 * hourly would be spend without information.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { fetchPostEngagement } from '@/services/growth/pagePublisher';

const logger = loggers.ads;

/** Posts older than this stop changing in any way worth a Graph call. */
const STALE_AFTER_DAYS = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to page-engagement-sync');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getAdminDb();
    const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86400000);

    const snap = await db.collection('pagePosts').where('status', '==', 'posted').limit(500).get();

    // Group by property: one Graph batch per page rather than one call per post.
    const byProperty = new Map<string, Map<string, string>>();
    let skippedStale = 0;
    snap.docs.forEach((d) => {
      const data = d.data() as { propertyId?: string; postId?: string; publishedAt?: { toDate?: () => Date } };
      if (!data.propertyId || !data.postId) return;
      const published = data.publishedAt?.toDate?.();
      if (published && published < cutoff) { skippedStale += 1; return; }
      if (!byProperty.has(data.propertyId)) byProperty.set(data.propertyId, new Map());
      byProperty.get(data.propertyId)!.set(data.postId, d.id);
    });

    let updated = 0;
    const failures: string[] = [];
    for (const [propertyId, byPostId] of byProperty) {
      const res = await fetchPostEngagement(propertyId, [...byPostId.keys()]);
      if (!res.ok || !res.data) {
        failures.push(`${propertyId}: ${res.error ?? 'unknown'}`);
        continue;
      }
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
        updated += 1;
      }
      await batch.commit();
    }

    logger.info('page-engagement-sync complete', {
      properties: byProperty.size,
      updated,
      skippedStale,
      failures: failures.length,
    });
    return NextResponse.json({ ok: true, properties: byProperty.size, updated, skippedStale, failures });
  } catch (error) {
    logger.error('page-engagement-sync failed', error as Error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
