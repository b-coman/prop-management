/**
 * Authorisation for Cloud Scheduler-triggered routes.
 *
 * The scheduler jobs send `Authorization: Bearer <CRON_SECRET>`, and only that exact value gets in.
 * These routes used to accept ANY Bearer token, or an `X-Appengine-Cron` header, which anyone can
 * set on Cloud Run (only App Engine strips it). Anyone who knew a URL could send guest emails or
 * run the calendar sync. Without CRON_SECRET the routes refuse everything rather than guess.
 */
import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

/** Returns a 401 response when the request is not from the scheduler, or null to proceed. */
export function rejectIfNotCron(request: NextRequest, routeName: string): NextResponse | null {
  const expected = process.env.CRON_SECRET?.trim();
  const got = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '').trim();
  if (expected && got) {
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return null;
  }

  const { loggers } = require('@/lib/logger');
  if (!expected) loggers.authorization.error(`CRON_SECRET is not set; refusing ${routeName} cron`);
  else loggers.authorization.warn(`Unauthorized call to ${routeName} cron`);
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
