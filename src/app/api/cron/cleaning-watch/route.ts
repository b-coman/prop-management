/**
 * The cleaning watch: every 30 minutes 07:00-21:30 (Cloud Scheduler), and right after a booking
 * change, check each watched property's cleanings and tell the owner on WhatsApp when one needs him. See src/services/cleaningWatchService.ts.
 *
 * Auth: `Authorization: Bearer <AUTOMATION_TOKEN>`, compared exactly (the token the owner's
 * shortcuts already use, so dry runs can be made with it).
 *
 * Testing: `?dryRun=1` plans without sending or writing anything, `&now=<ISO>` pretends it is
 * another moment (dry runs only), `&propertyId=` limits the run to one property (and lets a dry
 * run look at a property that is not switched on yet).
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { loggers } from '@/lib/logger';
import { runCleaningWatch } from '@/services/cleaningWatchService';

export const dynamic = 'force-dynamic';

const logger = loggers.housekeeping;

function authorized(request: NextRequest): boolean {
  const expected = process.env.AUTOMATION_TOKEN?.trim();
  const got = request.headers.get('Authorization')?.replace(/^Bearer\s+/, '').trim();
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    logger.warn('Unauthorized call to the cleaning-watch cron');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const dryRun = params.get('dryRun') === '1';
  const rawNow = params.get('now');
  // A real run never believes a fake date: it could re-send or skip a message.
  const now = dryRun && rawNow && !isNaN(Date.parse(rawNow)) ? new Date(rawNow) : new Date();

  try {
    const reports = await runCleaningWatch({ now, dryRun, propertyId: params.get('propertyId') || undefined });
    const sent = reports.flatMap(r => r.messages ?? []).filter(m => m.sent).length;
    logger.info('Cleaning watch run', { dryRun, properties: reports.length, sent });
    return NextResponse.json({ now: now.toISOString(), dryRun, reports });
  } catch (error) {
    logger.error('Cleaning watch run failed', error as Error);
    return NextResponse.json({ error: 'Cleaning watch failed' }, { status: 500 });
  }
}
