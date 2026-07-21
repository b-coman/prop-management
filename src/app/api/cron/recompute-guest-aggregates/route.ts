/**
 * @fileoverview Cron endpoint: recompute guest `totalBookings` + `totalSpent`
 * from the source of truth (their bookings), counting only NON-cancelled
 * bookings.
 *
 * The running counters are maintained by `FieldValue.increment` across several
 * inconsistent booking paths (create/complete/cancel), so they drift — e.g. a
 * cancellation can re-inflate a guest. Recomputing from bookings makes the CRM
 * self-heal regardless of which path touched it. Writes only guests whose totals
 * actually changed. `?dryRun=1` reports the corrections without writing.
 *
 * Security: cron-only (X-Appengine-Cron header or Bearer token).
 * Frequency: intended weekly via Cloud Scheduler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { recomputeGuestAggregates } from '@/services/guestService';

const logger = loggers.guest;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('X-Appengine-Cron');
  if (!cronHeader && !authHeader?.startsWith('Bearer ')) {
    logger.error('Unauthorized access attempt to recompute-guest-aggregates');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRunParam = request.nextUrl.searchParams.get('dryRun');
  const dryRun = dryRunParam === '1' || dryRunParam === 'true';

  try {
    const db = await getAdminDb();
    const guests = await db.collection('guests').get();
    const nameById = new Map<string, string>();
    guests.docs.forEach((d) => {
      const g = d.data();
      nameById.set(d.id, [g.firstName, g.lastName].filter(Boolean).join(' ') || d.id);
    });
    const ids = guests.docs.map((d) => d.id);

    let changed = 0;
    const changes: Array<{ guestId: string; name: string; before: unknown; after: unknown }> = [];

    // Bounded concurrency so a large guest list doesn't fan out unbounded.
    const CHUNK = 25;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const batch = ids.slice(i, i + CHUNK);
      const results = await Promise.all(
        batch.map(async (id) => ({ id, res: await recomputeGuestAggregates(id, { dryRun }) }))
      );
      for (const { id, res } of results) {
        if (res.changed) {
          changed++;
          if (changes.length < 30) {
            changes.push({ guestId: id, name: nameById.get(id) ?? id, before: res.before, after: res.after });
          }
        }
      }
    }

    logger.info('recompute-guest-aggregates run', { dryRun, scanned: ids.length, changed });
    return NextResponse.json({ success: true, dryRun, scanned: ids.length, changed, changes });
  } catch (error) {
    logger.error('recompute-guest-aggregates failed', error as Error);
    return NextResponse.json(
      { error: 'Failed to recompute guest aggregates', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST for manual testing (protected).
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return GET(request);
}
