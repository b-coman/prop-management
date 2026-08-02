/**
 * ad-reconcile cron — the ads money-path BACKSTOP (promotion-system-architecture.md §8). Pulls
 * Meta's effective_status + fresh insights for every live-capable adCampaigns doc, updates our
 * records, and FLAGS drift (a campaign delivering that we think is paused, a REJECTED ad, or an
 * ACTIVE campaign in the account we don't track). Read-mostly — never activates/pauses/spends.
 *
 * Intended cadence: hourly-to-daily via Cloud Scheduler (GET). Cheap and idempotent; a slow cadence
 * is safe because the account-level spend limit is the hard backstop.
 *
 * Auth: Cloud Scheduler header (X-Appengine-Cron) or a Bearer token — same gate as the other crons.
 */
import { NextRequest, NextResponse } from 'next/server';
import { reconcileAdCampaigns } from '@/services/growth/adReconciliation';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await reconcileAdCampaigns();
    logger.info('ad-reconcile cron ran', { checked: result.checked, updated: result.updated, escapes: result.escapes, flags: result.flags.length });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('ad-reconcile cron failed', error as Error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
