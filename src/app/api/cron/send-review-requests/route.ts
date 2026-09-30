/**
 * Review request: two days after checkout, with a third-day catch-up.
 *
 * The rule lives in the guest email schedule (`REVIEW_REQUEST`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron, sweepOptionsFrom } from '@/lib/cron-auth';
import { runGuestEmailSweep } from '@/services/guestEmailSweep';
import { REVIEW_REQUEST } from '@/services/guestEmailSchedule';
import { loggers } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const unauthorized = rejectIfNotCron(request, 'send-review-requests');
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await runGuestEmailSweep([REVIEW_REQUEST], sweepOptionsFrom(request)));
  } catch (error) {
    loggers.email.error('Review request cron threw', error as Error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
