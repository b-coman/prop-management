/**
 * ad-reconcile cron — the ads money-path BACKSTOP (promotion-system-architecture.md §8). Pulls
 * Meta's effective_status + fresh insights for every live-capable adCampaigns doc, updates our
 * records, and FLAGS drift (a campaign delivering that we think is paused, a REJECTED ad, or an
 * ACTIVE campaign in the account we don't track). Read-mostly — never activates/pauses/spends.
 *
 * Intended cadence: hourly-to-daily via Cloud Scheduler (GET). Cheap and idempotent; a slow cadence
 * is safe because the account-level spend limit is the hard backstop.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` from Cloud Scheduler (src/lib/cron-auth.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron } from '@/lib/cron-auth';
import { reconcileAdCampaigns } from '@/services/growth/adReconciliation';
import { loggers } from '@/lib/logger';

const logger = loggers.ads;

export async function GET(request: NextRequest) {
  const unauthorized = rejectIfNotCron(request, 'ad-reconcile');
  if (unauthorized) return unauthorized;
  try {
    const result = await reconcileAdCampaigns();
    logger.info('ad-reconcile cron ran', { checked: result.checked, updated: result.updated, escapes: result.escapes, flags: result.flags.length });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error('ad-reconcile cron failed', error as Error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
