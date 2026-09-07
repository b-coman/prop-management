/**
 * inFlight — the campaigns that are already buying attention right now.
 *
 * The ad planner could not see this. `buildAdPlannerPack` calls
 * `getAdAccountHealth`, which computes `activeCampaignCount`, and then drops it.
 * So a planner asked for a new Bucharest campaign while two Bucharest campaigns
 * were live would propose a third, consistently with everything it knew.
 *
 * That is not merely redundant. On Meta your own ad sets compete in the same
 * auction: you pay a higher CPM to reach the same person twice, and you split
 * the optimisation events between ad sets so neither reaches the ~50/week Meta
 * wants to leave the learning phase. Two half-learning campaigns cost more and
 * deliver worse than one.
 *
 * It is also the precondition for phased flights. "Add a retargeting burst
 * against the pool the cold campaign built" is unstateable if you cannot see the
 * cold campaign.
 *
 * **Firestore only — no Meta call.** The reconcile cron already mirrors
 * `insights` and `effectiveStatus` onto these docs, so the pack build never fans
 * out API calls (the rule `buildAdLearnings` states explicitly).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import type { AdCampaign, AdCampaignStatus } from '@/types';

/**
 * Statuses that can be spending, or can start spending without us acting.
 *
 * `pushed` is included for the reason `adReconciliation.LIVE_CAPABLE` documents:
 * a campaign pushed PAUSED can be flipped ACTIVE by hand in Ads Manager, and on
 * 2026-08-06 exactly that happened — the doc still read `pushed` while the
 * campaign was live and spending.
 */
export const IN_FLIGHT_STATUSES: AdCampaignStatus[] = ['pushed', 'approved', 'active'];

export interface InFlightCampaign {
  adCampaignId: string;
  metaCampaignId: string | null;
  status: AdCampaignStatus;
  effectiveStatus: string | null;
  /** The STAY window this campaign sells, from `proposal.occasion`. Null on manual composes. */
  window: { start: string; end: string; nights: number } | null;
  occasion: string | null;
  objective: string | null;
  /**
   * City NAMES, normalised. Not keys: `proposal.cities` stores `{name, radius}`
   * without the ad-geolocation key, so a key here would be invented.
   */
  cities: Array<{ name: string; radius: number }>;
  countries: string[];
  audiences: Array<{ id: string; name: string }>;
  landingUrl: string | null;
  /** `proposal.creativeBrief`, truncated — enough to tell two angles apart. */
  angle: string | null;
  dailyBudgetMinor: number | null;
  endTime: string | null;
  daysRemaining: number | null;
  spentToDateMinor: number;
  /** dailyBudget x daysRemaining — the forward commitment the ledger must count. */
  projectedRemainingMinor: number | null;
}

export interface InFlightBlock {
  asOf: string;
  campaigns: InFlightCampaign[];
  totalDailyBudgetMinor: number;
  totalProjectedRemainingMinor: number;
  activeCityNames: string[];
  activeAudienceIds: string[];
  note: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ANGLE_MAX = 200;

const NOTE =
  'These campaigns are already buying attention. Do NOT plan a new campaign whose STAY WINDOW ' +
  'overlaps one of these AND whose cities or audiences intersect activeCityNames / ' +
  'activeAudienceIds — on Meta your own ad sets compete in the same auction, so you pay more to ' +
  'reach the same person and neither ad set gets enough events to leave the learning phase. If a ' +
  'running campaign already covers the window, EXTEND it; a second campaign is not the instrument. ' +
  'spentToDateMinor is mirrored from Meta by the reconcile cron and may lag a few hours.';

/** Normalise a city name for comparison — diacritics and case vary between Meta and our docs. */
export function normaliseCityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** The subset of an `adCampaigns` doc this module reads. */
export type AdCampaignForInFlight = Pick<
  AdCampaign,
  | 'id'
  | 'metaCampaignId'
  | 'status'
  | 'effectiveStatus'
  | 'objective'
  | 'dailyBudgetMinor'
  | 'endTime'
  | 'insights'
  | 'proposal'
>;

/**
 * Build the in-flight block. Pure.
 *
 * `landingByCampaign` maps an `adCampaigns` doc id to its landing-page URL; pass
 * `{}` when unknown rather than guessing one.
 */
export function computeInFlight(
  docs: AdCampaignForInFlight[],
  asOf: string,
  landingByCampaign: Record<string, string> = {}
): InFlightBlock {
  const asOfMs = Date.parse(asOf);
  const campaigns: InFlightCampaign[] = docs.map((d) => {
    const endTime = d.endTime ?? null;
    let daysRemaining: number | null = null;
    if (endTime) {
      const endMs = Date.parse(endTime);
      if (Number.isFinite(endMs) && Number.isFinite(asOfMs)) {
        daysRemaining = Math.max(0, Math.ceil((endMs - asOfMs) / DAY_MS));
      }
    }
    const dailyBudgetMinor = d.dailyBudgetMinor ?? null;
    const projectedRemainingMinor =
      dailyBudgetMinor != null && daysRemaining != null ? dailyBudgetMinor * daysRemaining : null;

    const occ = d.proposal?.occasion ?? null;
    // `insights.spend` is a MAJOR-unit RON figure (see the unit trap in seasonLedger).
    const spentToDateMinor = Math.max(0, Math.round((d.insights?.spend ?? 0) * 100));

    return {
      adCampaignId: d.id,
      metaCampaignId: d.metaCampaignId ?? null,
      status: d.status,
      effectiveStatus: d.effectiveStatus ?? null,
      window: occ ? { start: occ.start, end: occ.end, nights: occ.nights } : null,
      occasion: occ?.name ?? null,
      objective: d.objective ?? null,
      cities: (d.proposal?.cities ?? []).map((c) => ({ name: c.name, radius: c.radius })),
      countries: d.proposal?.countries ?? [],
      audiences: (d.proposal?.audiences ?? []).map((a) => ({ id: a.id, name: a.name })),
      landingUrl: landingByCampaign[d.id] ?? null,
      angle: d.proposal?.creativeBrief ? d.proposal.creativeBrief.slice(0, ANGLE_MAX) : null,
      dailyBudgetMinor,
      endTime,
      daysRemaining,
      spentToDateMinor,
      projectedRemainingMinor,
    };
  });

  const totalDailyBudgetMinor = campaigns.reduce((s, c) => s + (c.dailyBudgetMinor ?? 0), 0);
  const totalProjectedRemainingMinor = campaigns.reduce((s, c) => s + (c.projectedRemainingMinor ?? 0), 0);
  const activeCityNames = [
    ...new Set(campaigns.flatMap((c) => c.cities.map((x) => normaliseCityName(x.name)))),
  ].sort();
  const activeAudienceIds = [...new Set(campaigns.flatMap((c) => c.audiences.map((a) => a.id)))].sort();

  return {
    asOf,
    campaigns,
    totalDailyBudgetMinor,
    totalProjectedRemainingMinor,
    activeCityNames,
    activeAudienceIds,
    note: NOTE,
  };
}

/**
 * Every `metaCampaignId` this system has ever created for a property.
 *
 * This is the set the ledger subtracts to isolate hand-made boosts, and it must
 * be ALL of them — not just the live ones. Passing only the in-flight campaigns
 * reports every paused campaign we created as "unplanned spend": measured
 * 2026-09-07, that turned 5.58 RON of genuine hand-boost into a reported 74.34,
 * because the paused `TpRpz` flight fell outside the in-flight set.
 *
 * Degrades to `[]` on failure, which errs toward reporting spend as unplanned —
 * visible and conservative, rather than silently absorbed.
 */
export async function fetchTrackedMetaCampaignIds(propertyId: string): Promise<string[]> {
  try {
    const db = await getAdminDb();
    const snap = await db.collection('adCampaigns').where('propertyId', '==', propertyId).get();
    return snap.docs
      .map((d) => (d.data() as { metaCampaignId?: string }).metaCampaignId)
      .filter((id): id is string => !!id);
  } catch {
    return [];
  }
}

/**
 * Read the in-flight campaigns for a property. Degrades to an empty block rather
 * than throwing — an in-flight read must never break a pack build.
 */
export async function fetchInFlight(propertyId: string, asOf: string): Promise<InFlightBlock> {
  try {
    const db = await getAdminDb();
    const snap = await db
      .collection('adCampaigns')
      .where('propertyId', '==', propertyId)
      .where('status', 'in', IN_FLIGHT_STATUSES)
      .get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as AdCampaignForInFlight[];

    // Landing pages, so an overlapping campaign can be spotted by destination too.
    const landingByCampaign: Record<string, string> = {};
    try {
      const lps = await db.collection('landingPages').where('propertyId', '==', propertyId).get();
      lps.forEach((l) => {
        const x = l.data() as { campaignRef?: string | null; slug?: string };
        if (x.campaignRef && x.slug) landingByCampaign[x.campaignRef] = `/lp/${x.slug}`;
      });
    } catch {
      /* landing join is decoration — never fail the block for it */
    }

    return computeInFlight(docs, asOf, landingByCampaign);
  } catch {
    return computeInFlight([], asOf, {});
  }
}
