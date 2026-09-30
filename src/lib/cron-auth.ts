/**
 * Authorisation for Cloud Scheduler-triggered routes.
 *
 * Cloud Scheduler is configured to send a Bearer token; App Engine-style cron sends
 * `X-Appengine-Cron` instead. Accepting either was copied into every cron route by hand.
 */
import { NextResponse, type NextRequest } from 'next/server';

/** Returns a 401 response when the request is not from the scheduler, or null to proceed. */
export function rejectIfNotCron(request: NextRequest, routeName: string): NextResponse | null {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (cronHeader || authHeader?.startsWith('Bearer ')) return null;

  const { loggers } = require('@/lib/logger');
  loggers.email.error(`Unauthorized access attempt to ${routeName} cron`);
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** The knobs every sweep route accepts: `?dryRun=1`, `?bookingId=`, `?now=`. */
export function sweepOptionsFrom(request: NextRequest) {
  const url = new URL(request.url);
  const rawNow = url.searchParams.get('now');
  const parsedNow = rawNow ? new Date(rawNow) : undefined;
  return {
    dryRun: url.searchParams.get('dryRun') === '1',
    onlyBooking: url.searchParams.get('bookingId') || undefined,
    // `now` only applies to a dry run. Being able to ask "what would go out on 6 October" is the
    // only way to check a schedule whose windows no live booking happens to sit in today, but
    // letting a real send believe in a fake date could re-send or skip a guest.
    now: parsedNow && !isNaN(parsedNow.getTime()) && url.searchParams.get('dryRun') === '1'
      ? parsedNow
      : undefined,
  };
}
