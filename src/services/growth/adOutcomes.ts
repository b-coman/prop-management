/**
 * adOutcomes — capture a FROZEN learning record for a finished ad campaign (Fable §1.2-1.4). The
 * campaign doc holds LIVE numbers; `adOutcomes/{id}` holds the outcome frozen at `endTime + settleDays`
 * so learnings are stable. Two numbers are kept strictly separate: Meta's MODELED attribution
 * (`metaReported`, from the pixel insights — view-through + attribution window) and our FIRST-PARTY
 * utm→booking join (`utmAttributed`, a structural undercount / floor). They are never conflated.
 *
 * Server-only (Admin SDK). The utm join needs NO index/schema work — `attribution.{last,first}Touch
 * .campaign` is a nested single field Firestore auto-indexes, and utm_campaign == the adCampaigns id.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { AdOutcome } from '@/types';

const logger = loggers.ads;

/** Default settle window (days after endTime) before an outcome is frozen — lets late bookings land. */
export const DEFAULT_SETTLE_DAYS = 14;

const NON_BOOKING_STATUSES = new Set(['cancelled', 'payment_failed', 'expired']);
const REJECTED_STATUSES = new Set(['REJECTED', 'DISAPPROVED', 'WITH_ISSUES']);

export interface UtmAttribution {
  bookings: number;
  revenue: number;
  bookingIds: string[];
}

/**
 * First-party attribution: bookings whose first- OR last-touch utm_campaign is this campaign id
 * (union — last-touch overwrite means an assisting click survives only in firstTouch; at this volume
 * we count "touched by this campaign at any point"). Cancelled/failed excluded. A structural FLOOR —
 * misses cross-device, cookie-loss, and phone/walk-in bookings.
 */
export async function captureUtmAttribution(adCampaignId: string): Promise<UtmAttribution> {
  const db = await getAdminDb();
  const [lastSnap, firstSnap] = await Promise.all([
    db.collection('bookings').where('attribution.lastTouch.campaign', '==', adCampaignId).get(),
    db.collection('bookings').where('attribution.firstTouch.campaign', '==', adCampaignId).get(),
  ]);
  const byId = new Map<string, Record<string, unknown>>();
  for (const d of [...lastSnap.docs, ...firstSnap.docs]) byId.set(d.id, d.data());

  let bookings = 0;
  let revenue = 0;
  const bookingIds: string[] = [];
  for (const [id, b] of byId) {
    if (NON_BOOKING_STATUSES.has(String((b as { status?: string }).status ?? ''))) continue;
    bookings += 1;
    revenue += Number((b as { pricing?: { total?: number } }).pricing?.total ?? 0);
    bookingIds.push(id);
  }
  return { bookings, revenue: Math.round(revenue), bookingIds };
}

type Verdict = AdOutcome['verdict'];

/** Pure verdict — extracted for unit tests. */
export function computeVerdict(
  status: string | undefined,
  effectiveStatus: string | undefined,
  delivery: { spend: number; impressions: number; clicks: number },
  utm: { bookings: number }
): Verdict {
  if (effectiveStatus && REJECTED_STATUSES.has(effectiveStatus)) return 'rejected';
  if (delivery.impressions === 0 && delivery.spend === 0) return status === 'active' ? 'no-delivery' : 'never-activated';
  if (utm.bookings > 0) return 'converted';
  if (delivery.clicks > 0) return 'clicked-no-booking';
  return 'no-delivery';
}

/** Pure caveat list — the machine-readable honesty a downstream LLM must weight by. */
export function computeCaveats(input: {
  spend: number;
  metaPurchases: number;
  utmBookings: number;
  source: 'opportunity-engine' | 'manual';
}): string[] {
  const c: string[] = [
    'utmAttributed is a first-party FLOOR — it misses cross-device, cookie-loss, and phone/walk-in bookings',
    'metaReported is Meta-MODELED (view-through + attribution window) — a different number; never average it with utmAttributed',
  ];
  if (input.spend < 50) c.push('low-spend:<50RON — the outcome is anecdote, not signal');
  if (input.metaPurchases !== input.utmBookings) c.push('meta-purchases≠utm-bookings (expected — different attribution)');
  if (input.source === 'manual') c.push('manual compose — no goal/audience/angle metadata to learn from');
  return c;
}

interface AdCampaignForOutcome {
  propertyId?: string;
  status?: string;
  effectiveStatus?: string;
  endTime?: string | null;
  dailyBudgetMinor?: number;
  outcomeCapturedAt?: unknown;
  insights?: { spend?: number; impressions?: number; clicks?: number; bookings?: number; purchaseValue?: number; roas?: number };
  proposal?: {
    source?: string;
    occasion?: { name?: string | null; start?: string; end?: string; nights?: number } | null;
    goal?: string | null;
    audience?: string | null;
    creativeBrief?: string;
    rationale?: string;
    copy?: unknown[];
    photos?: Array<{ storagePath: string }>;
    cities?: Array<{ key?: string; name: string; radius: number }>;
  };
}

/**
 * Freeze the outcome for a finished campaign into `adOutcomes/{id}` (idempotent — doc id == campaign
 * id), and stamp `outcomeCapturedAt` on the campaign so the cron won't re-finalize. Returns the
 * outcome, or null if the campaign is missing or has no window/config to finalize.
 */
export async function finalizeAdOutcome(adCampaignId: string, opts?: { settleDays?: number }): Promise<AdOutcome | null> {
  const db = await getAdminDb();
  const ref = db.collection('adCampaigns').doc(adCampaignId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const doc = snap.data() as AdCampaignForOutcome;
  if (!doc.propertyId) return null;

  const ins = doc.insights ?? {};
  const spend = Number(ins.spend) || 0;
  const impressions = Number(ins.impressions) || 0;
  const clicks = Number(ins.clicks) || 0;
  const delivery = {
    spend,
    impressions,
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(3)) : 0,
    cpc: clicks > 0 ? Number((spend / clicks).toFixed(4)) : 0,
  };
  const metaPurchases = Number(ins.bookings) || 0; // NB: reconcile stores Meta's pixel purchases here
  const metaReported = { purchases: metaPurchases, purchaseValue: Number(ins.purchaseValue) || 0, roas: Number(ins.roas) || 0 };

  const utm = await captureUtmAttribution(adCampaignId);
  const source: 'opportunity-engine' | 'manual' = doc.proposal?.source === 'opportunity-engine' ? 'opportunity-engine' : 'manual';
  const p = doc.proposal;
  const occ = p?.occasion;

  const outcome: AdOutcome = {
    id: adCampaignId,
    propertyId: doc.propertyId,
    capturedAt: FieldValue.serverTimestamp() as unknown as AdOutcome['capturedAt'],
    settleDays: opts?.settleDays ?? DEFAULT_SETTLE_DAYS,
    window: occ?.start && occ?.end ? { start: occ.start, end: occ.end, nights: Number(occ.nights) || 0 } : null,
    occasion: occ?.name ?? null,
    goal: p?.goal ?? null,
    audience: p?.audience ?? null,
    creativeBrief: p?.creativeBrief ?? null,
    copyCount: p?.copy?.length ?? 0,
    photos: (p?.photos ?? []).map((ph) => ph.storagePath),
    cities: p?.cities ?? [],
    dailyBudgetMinor: Number(doc.dailyBudgetMinor) || 0,
    endTime: doc.endTime ?? '',
    source,
    finalEffectiveStatus: doc.effectiveStatus ?? 'UNKNOWN',
    delivery,
    metaReported,
    utmAttributed: utm,
    verdict: computeVerdict(doc.status, doc.effectiveStatus, delivery, utm),
    caveats: computeCaveats({ spend, metaPurchases, utmBookings: utm.bookings, source }),
  };

  await db.collection('adOutcomes').doc(adCampaignId).set(outcome);
  await ref.update({ outcomeCapturedAt: FieldValue.serverTimestamp() });
  logger.info('finalizeAdOutcome: outcome frozen', { adCampaignId, verdict: outcome.verdict, spend, utmBookings: utm.bookings });
  return outcome;
}
