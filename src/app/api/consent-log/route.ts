/**
 * Consent outcome log — answers "do people reject, or just ignore the banner?"
 *
 * GA4 cannot tell those apart: both end with analytics_storage denied and no session. So the choice
 * is recorded here instead, first-party. `shown` is logged when the banner appears, and one of
 * `accept` / `reject` / `preferences` when the visitor decides. Ignored is then simply
 * shown - (accept + reject + preferences), which is the number that was missing.
 *
 * Deliberately stores NOTHING that identifies a person: no IP, no user agent, no id, no cookie. Just
 * an outcome, a path and a timestamp — an aggregate counter, so it needs no consent of its own (and
 * gating the consent record behind consent would be circular).
 *
 * Public and unauthenticated by necessity: it fires before any decision exists. Rate-limited, and it
 * only ever accepts one of four known outcomes, so the worst case is a skewed counter.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limiter';

const OUTCOMES = ['shown', 'accept', 'reject', 'preferences'] as const;
type Outcome = (typeof OUTCOMES)[number];

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, { maxRequests: 30, windowSeconds: 60, keyPrefix: 'consent-log' });
    if (!rl.allowed) return NextResponse.json({ error: 'rate-limited' }, { status: 429 });

    const body = await req.json().catch(() => null);
    const outcome = body?.outcome as Outcome | undefined;
    if (!outcome || !OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: 'bad-outcome' }, { status: 400 });
    }

    // Path only, query string stripped — utm values are fine but a stray booking reference is not.
    const path = typeof body?.path === 'string' ? body.path.split('?')[0].slice(0, 120) : null;
    // Which campaign the visitor arrived on, when there is one. Lets consent rate be read per flight.
    const campaign = typeof body?.campaign === 'string' ? body.campaign.slice(0, 64) : null;

    const db = await getAdminDb();
    await db.collection('consentEvents').add({
      outcome,
      path,
      campaign,
      analytics: outcome === 'accept' ? true : outcome === 'reject' ? false : (body?.analytics ?? null),
      day: new Date().toISOString().slice(0, 10),
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never let analytics break a page: log it and return success.
    loggers.tracking.warn('consent-log failed', { error: (error as Error).message });
    return NextResponse.json({ ok: true });
  }
}
