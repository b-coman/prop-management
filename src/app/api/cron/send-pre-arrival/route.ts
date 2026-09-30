/**
 * Pre-arrival email: the morning before check-in, 08:00 Europe/Bucharest.
 *
 * The rule lives in the guest email schedule (`PRE_ARRIVAL`); this route only says which stage it
 * owns. See `guestEmailSweep.ts` for what makes it safe to miss a run.
 */
import { NextRequest, NextResponse } from 'next/server';
import { rejectIfNotCron, sweepOptionsFrom } from '@/lib/cron-auth';
import { runGuestEmailSweep } from '@/services/guestEmailSweep';
import { PRE_ARRIVAL } from '@/services/guestEmailSchedule';
import { loggers } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const unauthorized = rejectIfNotCron(request, 'send-pre-arrival');
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await runGuestEmailSweep([PRE_ARRIVAL], sweepOptionsFrom(request)));
  } catch (error) {
    loggers.email.error('Pre-arrival cron threw', error as Error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
