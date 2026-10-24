/**
 * Counts one booking-page search with dates, for the free periods widget's "high demand" badge.
 *
 * Called from the browser after the booking page has loaded (StaySearchBeacon), not from the server
 * render. The server render also runs for crawlers: from 21 Oct 2026 Googlebot followed the widget's
 * own date links several times a day, and nearly every counted "search" was the crawler asking for
 * exactly the dates the widget showed, so the badge was feeding itself. Crawlers don't get here:
 * /api/ is disallowed in robots.txt, and the beacon skips crawler and automated browsers.
 *
 * Public and unauthenticated, like consent-log. Rate-limited, and it only accepts a plausible future
 * stay (recordStaySearch checks), so the worst case is a skewed counter.
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { recordStaySearch } from '@/lib/website/staySearches';

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i;

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { maxRequests: 20, windowSeconds: 60, keyPrefix: 'stay-search' });
  if (!rl.allowed) return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  if (BOT_UA.test(req.headers.get('user-agent') || '')) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => null);
  const { propertyId, checkIn, checkOut } = body ?? {};
  if (typeof propertyId === 'string' && typeof checkIn === 'string' && typeof checkOut === 'string') {
    await recordStaySearch(propertyId.slice(0, 80), checkIn, checkOut);
  }
  return NextResponse.json({ ok: true });
}
