/**
 * caption-gallery cron — keep the vision `aiDescription` layer current as the gallery grows. It
 * describes any gallery photo that lacks an aiDescription (i.e. a newly uploaded one), across all
 * properties, so the ad/page photo-selectors always reason over a fully-described catalog without
 * anyone running a script. Bounded per run (cost guard); idempotent (skips already-described).
 *
 * Intended cadence: daily via Cloud Scheduler (GET). Auth: Cloud Scheduler header or a Bearer token.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { captionUndescribedImages } from '@/services/growth/galleryVision';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

/** Cap images described per run so one cron invocation stays bounded (new uploads are few). */
const PER_RUN_LIMIT = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const db = await getAdminDb();
    const props = await db.collection('properties').get();
    let described = 0;
    let remaining = PER_RUN_LIMIT;
    for (const doc of props.docs) {
      if (remaining <= 0) break;
      const res = await captionUndescribedImages(doc.id, { limit: remaining });
      described += res.described;
      remaining -= res.described;
    }
    logger.info('caption-gallery cron ran', { described });
    return NextResponse.json({ ok: true, described });
  } catch (error) {
    logger.error('caption-gallery cron failed', error as Error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
