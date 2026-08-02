/**
 * adLearnings — assemble the "weak priors" block from past `adOutcomes` for the ad-planner pack
 * (Fable §1.5). At this volume the honest move is: present RAW rows + the statistical METHOD, and
 * NEVER emit conclusions or "winner" labels — that is both the facts+method+constraints discipline
 * the rest of the pack uses AND exactly the right small-n statistics. Reads Firestore ONLY (no Meta
 * calls) so the pack build never fans out API calls. `available:false` until the first outcome exists,
 * so this ships dark and the prompts no-op.
 *
 * Server-only (Admin SDK).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { AdLearnings, AdOutcome } from '@/types';

const MAX_CAMPAIGNS = 12;

/** The statistical contract, shipped verbatim to the LLM so it weights past campaigns correctly. */
const LEARNINGS_NOTE =
  'Past campaigns are WEAK PRIORS, not verdicts. Evidence hierarchy at this volume: CTR/CPC are real ' +
  'signal (thousands of impressions); bookings are ANECDOTE until many campaigns accumulate — 0 vs 1 ' +
  'attributed booking on a small campaign is statistical noise. utmBookings is a first-party FLOOR ' +
  '(undercounts cross-device/cookie-loss/phone); metaPurchases is Meta-modeled and a DIFFERENT number ' +
  '(never average them). Use these only to break ties among options that EQUALLY fit this occasion + ' +
  'framing — never to override the occasion, and never treat one campaign as proof about an angle, ' +
  'city, or audience.';

function round(n: number, d = 2): number {
  return Number(n.toFixed(d));
}

/** Build the learnings block for a property from its finalized `adOutcomes`. */
export async function buildAdLearnings(propertyId: string, opts?: { maxCampaigns?: number }): Promise<AdLearnings> {
  const empty: AdLearnings = {
    available: false,
    campaignsCompleted: 0,
    totals: { spend: 0, impressions: 0, clicks: 0, utmBookings: 0, utmRevenue: 0 },
    campaigns: [],
    note: LEARNINGS_NOTE,
  };

  try {
    const db = await getAdminDb();
    const snap = await db
      .collection('adOutcomes')
      .where('propertyId', '==', propertyId)
      .orderBy('capturedAt', 'desc')
      .limit(opts?.maxCampaigns ?? MAX_CAMPAIGNS)
      .get();

    if (snap.empty) return empty;
    const outcomes = snap.docs.map((d) => d.data() as AdOutcome);

    const totals = outcomes.reduce(
      (t, o) => ({
        spend: t.spend + o.delivery.spend,
        impressions: t.impressions + o.delivery.impressions,
        clicks: t.clicks + o.delivery.clicks,
        utmBookings: t.utmBookings + o.utmAttributed.bookings,
        utmRevenue: t.utmRevenue + o.utmAttributed.revenue,
      }),
      { spend: 0, impressions: 0, clicks: 0, utmBookings: 0, utmRevenue: 0 }
    );

    return {
      available: true,
      campaignsCompleted: outcomes.length,
      totals: {
        spend: round(totals.spend),
        impressions: totals.impressions,
        clicks: totals.clicks,
        utmBookings: totals.utmBookings,
        utmRevenue: round(totals.utmRevenue),
      },
      campaigns: outcomes.map((o) => ({
        occasion: o.occasion,
        goal: o.goal,
        audience: o.audience,
        window: o.window ? `${o.window.start}..${o.window.end} (${o.window.nights}n)` : '—',
        cities: o.cities.map((c) => c.name),
        spend: round(o.delivery.spend),
        impressions: o.delivery.impressions,
        clicks: o.delivery.clicks,
        ctr: o.delivery.ctr,
        cpc: o.delivery.cpc,
        metaPurchases: o.metaReported.purchases,
        utmBookings: o.utmAttributed.bookings,
        utmRevenue: round(o.utmAttributed.revenue),
        verdict: o.verdict,
        angle: (o.creativeBrief ?? '').slice(0, 200),
      })),
      note: LEARNINGS_NOTE,
    };
  } catch {
    // A learnings read must never break a proposal — degrade to "no learnings".
    return empty;
  }
}
