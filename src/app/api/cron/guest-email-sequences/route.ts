/**
 * The post-stay marketing stages: day 14 return incentive, day 90 seasonal reminder.
 *
 * The rules live in the guest email schedule (`RETURN_INCENTIVE`, `SEASONAL_REMINDER`). This
 * route also carries the Growth Engine's channel-aware reactivation, which is a different thing
 * on the same timer: it reaches phone-only and OTA guests that the email schedule deliberately
 * will not write to.
 */
import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron, sweepOptionsFrom } from '@/lib/cron-auth';
import { runGuestEmailSweep } from '@/services/guestEmailSweep';
import { RETURN_INCENTIVE, SEASONAL_REMINDER } from '@/services/guestEmailSchedule';
import { isGrowthEngineEnabled } from '@/config/growth-engine';
import { runChannelAwareReactivation } from '@/services/guestLifecycleService';
import { loggers } from '@/lib/logger';

const logger = loggers.guest;

export async function GET(request: NextRequest) {
  const unauthorized = rejectIfNotCron(request, 'guest-email-sequences');
  if (unauthorized) return unauthorized;

  try {
    const opts = sweepOptionsFrom(request);
    const sweep = await runGuestEmailSweep([RETURN_INCENTIVE, SEASONAL_REMINDER], opts);

    // Dark unless GROWTH_ENGINE_ENABLED; any send routes through the Execution Gateway, which is
    // dry-run by default. Non-blocking: a failure here must not cost the email stages above.
    let channelAware: Awaited<ReturnType<typeof runChannelAwareReactivation>> | null = null;
    if (isGrowthEngineEnabled() && !opts.dryRun) {
      try {
        channelAware = await runChannelAwareReactivation(opts.now ?? new Date());
      } catch (error) {
        logger.error('Channel-aware reactivation failed (non-blocking)', error as Error);
      }
    }

    return NextResponse.json({ ...sweep, channelAware });
  } catch (error) {
    logger.error('Guest email sequences cron threw', error as Error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
