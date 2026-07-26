/**
 * adPlannerPack — the deterministic FACT PACK the ad planner reasons over for one ads-routed
 * opportunity (promotion-system-architecture.md §4.2). The acquisition twin of `copywriterPack` /
 * the WhatsApp `planner-pack`: it assembles CANDIDATES + CONSTRAINTS (never conclusions, plan §2
 * pr.5), and the planner narrows them into an `AdBrief` that `validateAdPlan` then gates.
 *
 * What it provides:
 *   - the `AdOpportunity` (echoed — window, nights, value, occasion);
 *   - `constraints`: the daily-budget ceiling + a spend ENVELOPE derived from the revenue at risk
 *     (the ad-side analog of the WhatsApp offer inequality — never plan to spend more than the
 *     nights at risk are worth);
 *   - `targeting.candidateCities`: RO feeder-market cities resolved to Meta `adgeolocation` keys
 *     (the geo the planner may pick from — narrows-never-widens; `validateAdPlan` enforces it);
 *   - `account`: past-ad performance + health flags (from `brandHealth`) to size budget/expectation;
 *   - `assets`: the property's gallery photos (for the planner's creative BRIEF — step 4 picks the
 *     actual images);
 *   - `landing`: the canonical direct-booking URL (the ROAS-attributed destination).
 *
 * Server-only (Admin SDK + read-only Meta GETs). Never throws on a Meta hiccup — the affected block
 * degrades to `{available:false}` and the pack still builds.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getBaseUrl } from '@/lib/structured-data';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { getMaxDailyBudgetMinor } from '@/config/growth-ads';
import { searchCities } from '@/services/growth/metaAds/geo';
import { getAdAccountHealth, getPageHealth } from '@/services/growth/metaAds/brandHealth';
import type { AdOpportunity } from '@/lib/growth/contracts';
import type { CityMatch } from '@/services/growth/metaAds/geo';
import type { PropertyImage } from '@/types';

/**
 * RO feeder markets for a Prahova-valley chalet — the candidate geo the planner picks from. Names
 * are resolved to Meta keys at build time (cities MUST target by key, §9f). Ordered roughly by
 * historical relevance (Bucharest = the main source; Ploiești/Brașov are the valley's near cities).
 * Multi-property note: this list is Prahova-specific; a future property carries its own feeder set.
 */
const RO_FEEDER_CITIES = [
  // NB: the capital resolves to the WHOLE city only under the English name "Bucharest" (key
  // 1910415, §9f-verified); "Bucuresti"/"București" return only individual sectors.
  'Bucharest', 'Ploiesti', 'Brasov', 'Constanta', 'Pitesti',
  'Targoviste', 'Buzau', 'Galati', 'Braila', 'Ramnicu Valcea',
];

/** Absolute ceiling on a single plan's spend envelope, bani — 500 RON (Meta's campaign spend-cap floor). */
const ABSOLUTE_MAX_TOTAL_MINOR = 50000;

/** Diacritic-insensitive lowercase, so "Bucuresti" matches "București". */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Pick the best city match for a feeder-city query. Prefers the WHOLE city: an exact (diacritic-
 * insensitive) name match first, then any non-sector result, then the top match. Without this, a
 * bare "Bucuresti" search resolves to "București Sectorul 1" — targeting one sector, not the city.
 */
function pickBestCity(query: string, matches: CityMatch[]): CityMatch | undefined {
  if (!matches.length) return undefined;
  const q = norm(query);
  return matches.find((m) => norm(m.name) === q) ?? matches.find((m) => !/sector/i.test(m.name)) ?? matches[0];
}

export interface AdPlannerPack {
  meta: { generatedFor: string; asOf: string; generator: string; opportunityId: string };
  opportunity: AdOpportunity;
  constraints: {
    maxDailyBudgetMinor: number;
    /** Spend envelope for this plan, bani = min(revenue-at-risk, absolute cap). Null if value unknown → planner sizes conservatively. */
    maxTotalSpendMinor: number | null;
    note: string;
  };
  targeting: {
    candidateCities: CityMatch[];
    candidateCityKeys: string[];
    note: string;
  };
  account:
    | {
        available: true;
        hasSpendLimit: boolean;
        hasConversionHistory: boolean;
        lifetime: { spend: number; impressions: number; clicks: number; ctr: number; cpc: number };
        warnings: string[];
        note: string;
      }
    | { available: false; error: string };
  page: { available: true; dormant: boolean; followers: number; warnings: string[] } | { available: false; error: string };
  assets: Array<{ storagePath: string; alt: string; tags: string[] }>;
  landing: { baseUrl: string; note: string };
  method: string[];
}

/** Build the ad-planner fact pack for one ads-routed opportunity. `asOf` defaults to now (UTC date). */
export async function buildAdPlannerPack(
  opportunity: AdOpportunity,
  opts?: { asOf?: Date }
): Promise<AdPlannerPack> {
  const asOf = opts?.asOf ?? new Date();
  const propertyId = opportunity.propertyId;

  // Health blocks + candidate-city resolution + property doc, in parallel (all read-only, all degrade).
  const [accountRes, pageRes, cityResults, propSnap] = await Promise.all([
    getAdAccountHealth(propertyId),
    getPageHealth(propertyId),
    Promise.all(RO_FEEDER_CITIES.map((name) => searchCities(propertyId, name, { limit: 3 }))),
    getAdminDb().then((db) => db.collection('properties').doc(propertyId).get()),
  ]);

  // Candidate cities — the best match per name, deduped by key (a resolution failure just drops that
  // city). "Best" prefers the WHOLE city over a sub-unit: a bare "Bucuresti" search returns
  // "București Sectorul 1" first, which would target one sector instead of the whole city.
  const candidateCities: CityMatch[] = [];
  const seenKeys = new Set<string>();
  for (let i = 0; i < cityResults.length; i++) {
    const r = cityResults[i];
    if (!r.ok) continue;
    const m = pickBestCity(RO_FEEDER_CITIES[i], r.data);
    if (m && !seenKeys.has(m.key)) {
      seenKeys.add(m.key);
      candidateCities.push(m);
    }
  }

  // Spend envelope: never plan to outspend the revenue at risk (valueAtRisk is RON → bani).
  const valueAtRiskMinor =
    opportunity.valueAtRisk != null && opportunity.valueAtRisk > 0 ? Math.round(opportunity.valueAtRisk * 100) : null;
  const maxTotalSpendMinor = valueAtRiskMinor != null ? Math.min(valueAtRiskMinor, ABSOLUTE_MAX_TOTAL_MINOR) : ABSOLUTE_MAX_TOTAL_MINOR;

  // Gallery assets owned by this property (for the creative brief — step 4 picks the actual photos).
  const propData = propSnap.exists ? (propSnap.data() as { images?: PropertyImage[]; customDomain?: string | null }) : undefined;
  const ownPrefix = `properties/${propertyId}/`;
  const assets = (propData?.images ?? [])
    .filter((img): img is PropertyImage & { storagePath: string } => Boolean(img.storagePath && img.storagePath.startsWith(ownPrefix)))
    .map((img) => ({ storagePath: img.storagePath, alt: serverTranslateContent(img.alt, 'en'), tags: img.tags ?? [] }));

  const account: AdPlannerPack['account'] = accountRes.ok
    ? {
        available: true,
        hasSpendLimit: accountRes.data.hasSpendLimit,
        hasConversionHistory: accountRes.data.hasConversionHistory,
        lifetime: {
          spend: accountRes.data.lifetime.spend,
          impressions: accountRes.data.lifetime.impressions,
          clicks: accountRes.data.lifetime.clicks,
          ctr: accountRes.data.lifetime.ctr,
          cpc: accountRes.data.lifetime.cpc,
        },
        warnings: accountRes.data.warnings,
        note: 'Past-ad performance (lifetime). A high CTR/low CPC = the account\'s creative/audience instincts have worked; but hasConversionHistory:false means a conversion (OUTCOME_SALES) campaign starts cold — no pixel-purchase learning yet, so early results are noisy. `no-account-spend-limit` is an owner prerequisite before live spend, NOT a planning input.',
      }
    : { available: false, error: accountRes.error };

  const page: AdPlannerPack['page'] = pageRes.ok
    ? { available: true, dormant: pageRes.data.dormant, followers: pageRes.data.followers, warnings: pageRes.data.warnings }
    : { available: false, error: pageRes.error };

  return {
    meta: { generatedFor: propertyId, asOf: asOf.toISOString().slice(0, 10), generator: 'src/lib/growth/adPlannerPack.ts', opportunityId: opportunity.id },
    opportunity,
    constraints: {
      maxDailyBudgetMinor: getMaxDailyBudgetMinor(),
      maxTotalSpendMinor,
      note: `Budgets are in BANI (minor units). Keep dailyBudgetMinor ≤ maxDailyBudgetMinor, and dailyBudget × days-to-endTime ≤ maxTotalSpendMinor (the revenue-at-risk envelope). For a first, unproven acquisition test, size CONSERVATIVELY (a small daily budget + a bounded end date) — the point is to learn whether ads convert, not to spend the envelope.`,
    },
    targeting: {
      candidateCities,
      candidateCityKeys: candidateCities.map((c) => c.key),
      note: 'Pick a SUBSET of these cities (with a per-city radius in km). Advantage+ Audience owns demographics (§9f) — there is NO age/gender/interest control; GEO + the copy angle qualify the audience. Favor the feeder markets that fit the occasion and the property (a mountain weekend sells to nearby cities + Bucharest).',
    },
    account,
    page,
    assets,
    landing: {
      baseUrl: getBaseUrl(propData?.customDomain),
      note: 'The direct-booking site — the ROAS-attributed destination. The composer stamps utm_campaign=<adCampaignId> on it (step 4); the planner just confirms the destination is the direct site, never an OTA URL.',
    },
    method: [
      'You PLAN: pick geo (subset of candidateCities + radius), a daily budget + a bounded end time (within the envelope), and write a creativeBrief (the angle + which asset themes to favor + tone). You do NOT write final ad copy or choose exact photos — that is the creative intelligence (step 4).',
      'Ground every choice in the pack: the opportunity (window/nights/occasion), account performance (CTR/CPC to size reach), the candidate cities, the assets available. Do not invent a city key, a budget above the ceiling, or an asset not listed.',
      'If the opportunity is weak (no occasion, tiny value, or the account is blocked), set act:false and say why — a forced ad burns real money, unlike a WhatsApp message.',
    ],
  };
}
