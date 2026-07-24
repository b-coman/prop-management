/**
 * whatsapp-warmup cron — generates the recurring no-ask "keep-in-touch" campaign and lands it as a
 * DRAFT in /admin/campaigns for the owner to review and send by hand. Never sends anything.
 *
 * Intended cadence: every ~6–8 weeks via Cloud Scheduler (GET). It self-skips if nobody newly
 * qualifies or a previous keep-in-touch draft is still pending review, so a slow cadence is safe.
 * Only the recurring keepintouch segment runs here; coldreintro stays operator-triggered (occasional).
 *
 * Auth: Cloud Scheduler header (X-Appengine-Cron) or a Bearer token — same gate as the other crons.
 */
import { NextRequest, NextResponse } from 'next/server';
import { generateWarmupCampaign } from '@/services/growth/warmupCampaign';
import { loggers } from '@/lib/logger';

const logger = loggers.campaign;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await generateWarmupCampaign('keepintouch');
    logger.info('whatsapp-warmup cron ran', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('whatsapp-warmup cron failed', error as Error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
