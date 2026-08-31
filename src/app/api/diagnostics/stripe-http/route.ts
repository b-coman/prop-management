/**
 * TEMPORARY DIAGNOSTIC — which HTTP transport can reach Stripe from this runtime?
 *
 * WHY IT EXISTS. On 31 Aug 2026 the booking flow was found to be dead in production: the pending
 * booking is written, then `checkout.sessions.create` fails with a `StripeConnectionError`
 * ("An error occurred with our connection to Stripe. Request was retried 1 times"). The same call,
 * with the same live key and the same parameters, succeeds from a laptop - so the key, the account,
 * the currency and the parameters are all fine and the difference is the runtime. The Stripe account
 * has never taken a payment: zero charges, zero payment intents, one checkout session ever, and that
 * one was created by this investigation.
 *
 * THE HYPOTHESIS THIS TESTS. Every outbound caller that WORKS in production uses `fetch` - the iCal
 * importer, Meta CAPI, Resend, Anthropic. The only one that fails is the only one that does not:
 * Stripe's Node SDK defaults to Node's `https` module, and the client is constructed bare in
 * `create-checkout-session.ts`. If `fetch` reaches Stripe from here and `https` does not, that is the
 * answer and the fix is `httpClient: Stripe.createFetchHttpClient()`. If BOTH fail, the hypothesis is
 * wrong and the problem is egress-level, which is a different repair entirely.
 *
 * SAFETY. `accounts.retrieve()` only - a read. It creates nothing, charges nothing and cannot affect
 * a booking. Token-guarded like `/api/automation`, and it reports no key material: only which
 * transport worked, how long it took, and the error class when one fails.
 *
 * DELETE THIS once the question is settled. It is a probe, not a feature.
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { loggers } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function probe(label: string, makeClient: (key: string) => Stripe, key: string) {
  const started = Date.now();
  try {
    const account = await makeClient(key).accounts.retrieve();
    return { transport: label, ok: true, ms: Date.now() - started, accountId: account.id };
  } catch (err) {
    const e = err as Error & { type?: string; code?: string };
    return {
      transport: label,
      ok: false,
      ms: Date.now() - started,
      errorName: e?.name ?? null,
      errorType: e?.type ?? null,
      errorCode: e?.code ?? null,
      message: (e?.message ?? String(err)).slice(0, 200),
    };
  }
}

export async function GET(request: NextRequest) {
  const expected = process.env.AUTOMATION_TOKEN;
  const token = request.nextUrl.searchParams.get('token');
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not present in this runtime' }, { status: 500 });
  }

  // Same shape as the app's own client (bare), versus the fetch-based transport.
  const nodeHttps = await probe('default (node https)', (k) => new Stripe(k), key);
  const fetchHttp = await probe('fetch', (k) => new Stripe(k, { httpClient: Stripe.createFetchHttpClient() }), key);

  // A bare fetch to Stripe's API, bypassing the SDK entirely. Separates "the SDK cannot reach Stripe"
  // from "this container cannot reach Stripe at all".
  const rawStarted = Date.now();
  let rawFetch: Record<string, unknown>;
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${key}` },
    });
    rawFetch = { ok: res.ok, status: res.status, ms: Date.now() - rawStarted };
  } catch (err) {
    rawFetch = { ok: false, ms: Date.now() - rawStarted, message: (err as Error).message.slice(0, 200) };
  }

  const result = {
    keyPrefix: key.slice(0, 8),
    keyLength: key.length,
    nodeVersion: process.version,
    probes: { nodeHttps, fetchHttp, rawFetch },
  };
  loggers.stripe.info('Stripe transport diagnostic', result);
  return NextResponse.json(result);
}
