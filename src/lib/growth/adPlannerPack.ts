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
import { getMaxDailyBudgetMinor, campaignSpendEnvelopeMinor } from '@/config/growth-ads';
import { searchCities } from '@/services/growth/metaAds/geo';
import { audienceCandidates, type AudienceCandidate } from '@/services/growth/metaAds/audiences';
import { getAdAccountHealth, getPageHealth } from '@/services/growth/metaAds/brandHealth';
import { buildAdLearnings } from '@/lib/growth/adLearnings';
import { fetchInFlight, type InFlightBlock } from '@/lib/growth/inFlight';
import { getActiveSeasonPlan } from '@/services/growth/seasonPlanService';
import type { AdOpportunity, AdFraming } from '@/lib/growth/contracts';
import type { CityMatch } from '@/services/growth/metaAds/geo';
import type { PropertyImage, AiImageDescription, AdLearnings, BrandVoice } from '@/types';

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
  /** The operator's OUTCOME + AUDIENCE steering — shapes the creativeBrief (and thus copy + photos). */
  framing: { goal: string | null; audience: string | null; note: string };
  constraints: {
    maxDailyBudgetMinor: number;
    /** Spend envelope for this plan, bani = min(revenue-at-risk, absolute cap). Null if value unknown → planner sizes conservatively. */
    maxTotalSpendMinor: number | null;
    /**
     * What the season plan advises for THIS window, if one covers it.
     *
     * ADVISORY, and deliberately not enforced: it is NOT min()'d into
     * `maxTotalSpendMinor` and `validateAdPlan` only WARNS when a plan exceeds it.
     * The operator decides the number at review; this is the context he decides
     * it in. Null when no active season plan covers the window.
     */
    seasonSlot: {
      planId: string;
      seasonKey: string;
      candidateId: string;
      advisoryBudgetMinor: number;
      rank: number;
      of: number;
      phase: 'cold' | 'retarget' | null;
      note: string;
    } | null;
    note: string;
  };
  /**
   * Campaigns already running for this property. Without it the planner proposes
   * a second campaign into a window it is already advertising, and on Meta your
   * own ad sets bid against each other.
   */
  inFlight: InFlightBlock;
  targeting: {
    candidateCities: CityMatch[];
    candidateCityKeys: string[];
    /**
     * The retargeting audiences available on the account, each with Meta's own deliverability
     * verdict. Empty ⇒ this property has no retargeting option and the plan must be prospecting.
     */
    candidateAudiences: AudienceCandidate[];
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
  /** Weak priors from past campaigns (Fable §1.5) — `available:false` until the first outcome exists. */
  learnings: AdLearnings;
  assets: Array<{ storagePath: string; alt: string; tags: string[]; aiDescription?: AiImageDescription }>;
  landing: { baseUrl: string; note: string };
  /** The owner's voice guide for this property, or null if none is configured. */
  voice: BrandVoice | null;
  method: string[];
}

/** Build the ad-planner fact pack for one ads-routed opportunity. `asOf` defaults to now (UTC date). */
export async function buildAdPlannerPack(
  opportunity: AdOpportunity,
  opts?: { asOf?: Date; framing?: AdFraming }
): Promise<AdPlannerPack> {
  const asOf = opts?.asOf ?? new Date();
  const propertyId = opportunity.propertyId;
  // Read-only; returns [] when the account has none, so a missing audience list degrades this pack
  // to a prospecting-only pack rather than failing the planning run.
  const candidateAudiences = await audienceCandidates(propertyId);

  // Health blocks + candidate-city resolution + property doc, in parallel (all read-only, all degrade).
  const [accountRes, pageRes, cityResults, propSnap, learnings] = await Promise.all([
    getAdAccountHealth(propertyId),
    getPageHealth(propertyId),
    Promise.all(RO_FEEDER_CITIES.map((name) => searchCities(propertyId, name, { limit: 3 }))),
    getAdminDb().then((db) => db.collection('properties').doc(propertyId).get()),
    buildAdLearnings(propertyId),
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

  // Spend envelope: never plan to outspend the revenue at risk. The expression now
  // lives in config (`campaignSpendEnvelopeMinor`) because the season allocator and
  // the review screen need the same one, and three copies of a money rule drift.
  const maxTotalSpendMinor = campaignSpendEnvelopeMinor(opportunity.valueAtRisk ?? null);

  // ── the season layer: what this window is advised, and what is already running ──
  const [inFlight, seasonSlot] = await Promise.all([
    fetchInFlight(propertyId, asOf.toISOString()),
    resolveSeasonSlot(propertyId, opportunity),
  ]);

  // Gallery assets owned by this property (for the creative brief — step 4 picks the actual photos).
  const propData = propSnap.exists ? (propSnap.data() as { images?: PropertyImage[]; customDomain?: string | null; brandVoice?: BrandVoice }) : undefined;
  const ownPrefix = `properties/${propertyId}/`;
  // Meta's /adimages accepts JPEG and PNG only — it refuses WebP outright (FileTypeNotSupported,
  // subcode 1487411, verified 2026-08-17). An asset the uploader cannot use is not inventory, and
  // offering it here just means discovering that at push time: it surfaced as
  // "upload-failed:image-too-narrow" on a 2048px photo and blocked a whole campaign. Archived images
  // are excluded for the same reason — they are not on offer.
  const META_UPLOADABLE = /\.(jpe?g|png)$/i;
  const assets = (propData?.images ?? [])
    .filter((img): img is PropertyImage & { storagePath: string } =>
      Boolean(img.storagePath && img.storagePath.startsWith(ownPrefix) && !img.archived && META_UPLOADABLE.test(img.storagePath)))
    .map((img) => ({ storagePath: img.storagePath, alt: serverTranslateContent(img.alt, 'en'), tags: img.tags ?? [], aiDescription: img.aiDescription }));

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
    framing: {
      goal: opts?.framing?.goal?.trim() || null,
      audience: opts?.framing?.audience?.trim() || null,
      note: 'The OUTCOME (goal) + AUDIENCE the operator wants for THIS period. Shape EVERYTHING to these together: the creativeBrief\'s angle, the copy the copywriter will write, AND which asset themes to favor must all serve this goal + this audience. Audience steers the copy angle + photo themes (NOT Meta demographics — Advantage+ owns those). If goal/audience are null, infer sensible ones from the occasion + what the property sells, and say what you assumed.',
    },
    inFlight,
    constraints: {
      maxDailyBudgetMinor: getMaxDailyBudgetMinor(),
      maxTotalSpendMinor,
      seasonSlot,
      note: `Budgets are in BANI (minor units). Keep dailyBudgetMinor ≤ maxDailyBudgetMinor, and dailyBudget × days-to-endTime ≤ maxTotalSpendMinor (the revenue-at-risk envelope). For a first, unproven acquisition test, size CONSERVATIVELY (a small daily budget + a bounded end date) — the point is to learn whether ads convert, not to spend the envelope.`,
    },
    targeting: {
      candidateCities,
      candidateCityKeys: candidateCities.map((c) => c.key),
      candidateAudiences,
      note:
        'Pick a SUBSET of these cities (with a per-city radius in km). For a PROSPECTING plan, Advantage+ Audience owns demographics (§9f) — there is NO age/gender/interest control, and detailed-interest EXCLUSIONS were removed by Meta in 2026; GEO + the copy angle qualify the audience. Favor the feeder markets that fit the occasion and the property (a mountain weekend sells to nearby cities + Bucharest). ' +
        (candidateAudiences.length
          ? 'For a RETARGETING plan, set targeting.customAudiences to a SUBSET of candidateAudiences and prefer country-level geo (targeting.countries) so the audience is not clipped by a city radius — only audiences marked deliverable:true can run, and Advantage+ expansion is turned OFF automatically so delivery stays inside the audience. Retargeting is worth choosing when the pool was built by a recent cold flight and the offer is one those visitors already saw; it multiplies an existing funnel rather than finding new demand.'
          : 'No custom audiences are available on this account, so a retargeting plan is not possible — plan prospecting.'),
    },
    account,
    page,
    learnings,
    assets,
    voice: propData?.brandVoice ?? null,
    landing: {
      baseUrl: getBaseUrl(propData?.customDomain),
      note: 'The direct-booking site — the ROAS-attributed destination. The composer stamps utm_campaign=<adCampaignId> on it (step 4); the planner just confirms the destination is the direct site, never an OTA URL.',
    },
    method: [
      'You PLAN: pick geo (subset of candidateCities + radius), a daily budget + a bounded end time (within the envelope), and write a creativeBrief (the angle + which asset themes to favor + tone). You do NOT write final ad copy or choose exact photos — that is the creative intelligence (step 4).',
      'Ground every choice in the pack: the opportunity (window/nights/occasion), account performance (CTR/CPC to size reach), the candidate cities, the assets available. Do not invent a city key, a budget above the ceiling, or an asset not listed.',
      'If the opportunity is weak (no occasion, tiny value, or the account is blocked), set act:false and say why — a forced ad burns real money, unlike a WhatsApp message.',
      'If learnings.available, treat past campaigns as WEAK PRIORS (read learnings.note): prefer angles/cities with supporting evidence ONLY when they fit this occasion equally — never override the occasion, and one campaign proves nothing.',
    ],
  };
}

/**
 * The season plan's advice for the window this opportunity covers, if any.
 *
 * Matching is by STAY-WINDOW OVERLAP against the active plan's funded slots. When
 * nothing matches we return null and say so, rather than attaching the nearest
 * slot — a campaign outside the season plan is a real signal, and silently
 * borrowing another window's budget advice would hide it.
 *
 * Never throws: a missing or unreadable season plan degrades to "no advice",
 * which is exactly how the ads arm behaved before this layer existed.
 */
async function resolveSeasonSlot(
  propertyId: string,
  opportunity: AdOpportunity
): Promise<AdPlannerPack['constraints']['seasonSlot']> {
  try {
    const w = opportunity.window;
    if (!w?.start || !w?.end) return null;
    const seasonKey = `${w.start.slice(0, 4)}-${w.end.slice(2, 4)}-${seasonNameOf(w.start)}`;
    const plan = (await getActiveSeasonPlan(propertyId, seasonKey)) ?? null;
    if (!plan) return null;

    const funded = plan.slots.filter((s) => s.funded);
    // checkOut is EXCLUSIVE; the opportunity's `end` is the last night, so compare
    // against end+1 to avoid missing a slot that finishes on the same night.
    const endExclusive = new Date(new Date(`${w.end}T00:00:00Z`).getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const hit = funded.find((s) => s.checkIn < endExclusive && w.start < s.checkOut);
    if (!hit) return null;

    return {
      planId: plan.id,
      seasonKey: plan.seasonKey,
      candidateId: hit.candidateId,
      advisoryBudgetMinor: hit.advisoryBudgetMinor,
      rank: hit.rank,
      of: funded.length,
      phase: hit.phases[0]?.kind ?? null,
      note:
        'ADVISORY, not a ceiling. The season plan sized this window against the whole year; the ' +
        'operator approves or changes the number at review. Only the ANNUAL envelope is enforced, ' +
        'and only at approval time. Treat a large departure from this figure as something to justify ' +
        'in your rationale, not as a rule you have broken.',
    };
  } catch {
    return null;
  }
}

/** Northern-hemisphere season of a date, matching `seasonPack`'s key format. */
function seasonNameOf(dateYmd: string): 'winter' | 'spring' | 'summer' | 'autumn' {
  const m = Number(dateYmd.slice(5, 7));
  if (m === 12 || m <= 2) return 'winter';
  if (m <= 5) return 'spring';
  if (m <= 8) return 'summer';
  return 'autumn';
}
