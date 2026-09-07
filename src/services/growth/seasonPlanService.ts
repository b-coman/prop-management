/**
 * seasonPlanService — the ONE write path for a season plan.
 *
 * Modelled on `campaignService.createProposedCampaign`: a landed plan is a
 * reviewable artifact, never an instruction to spend. Nothing here touches Meta,
 * nothing here activates anything, and the per-window budgets it records are
 * ADVISORY — only the annual envelope is enforced, and that happens later, at
 * `approveAdAction`.
 *
 * Versions are separate documents. Superseding is a TRANSACTION that creates
 * v(N+1) as `active` and flips v(N) to `superseded`, asserting inside the
 * transaction that exactly one plan is active per (property, season). A
 * superseded plan is then immutable evidence of what was decided and why, which
 * is what makes a season reviewable in April — the same instinct that freezes
 * `adOutcomes` rather than mutating them.
 *
 * Server-only (Admin SDK).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { SeasonPlan, SeasonPlanStatus } from '@/lib/growth/contracts';

const logger = loggers.ads;
const COLLECTION = 'seasonPlans';

export interface LandSeasonPlanInput {
  propertyId: string;
  seasonKey: string;
  season: SeasonPlan['season'];
  envelope: SeasonPlan['envelope'];
  slots: SeasonPlan['slots'];
  excluded: SeasonPlan['excluded'];
  narrative: SeasonPlan['narrative'];
  method: string[];
  asOf: string;
  createdBy: string;
  /** `true` makes the new version ACTIVE and supersedes the current one. */
  activate?: boolean;
}

export interface LandSeasonPlanResult {
  id: string;
  version: number;
  status: SeasonPlanStatus;
  supersedes: string | null;
}

/** The plan currently in force for a season, or null. */
export async function getActiveSeasonPlan(
  propertyId: string,
  seasonKey: string
): Promise<SeasonPlan | null> {
  const db = await getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .where('propertyId', '==', propertyId)
    .where('seasonKey', '==', seasonKey)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  return snap.empty ? null : (snap.docs[0].data() as SeasonPlan);
}

/**
 * Land a season plan. Without `activate` it is written as a `draft` and
 * supersedes nothing, so a plan can be reviewed before it takes effect.
 */
export async function landSeasonPlan(input: LandSeasonPlanInput): Promise<LandSeasonPlanResult> {
  const db = await getAdminDb();

  const existing = await db
    .collection(COLLECTION)
    .where('propertyId', '==', input.propertyId)
    .where('seasonKey', '==', input.seasonKey)
    .get();

  const versions = existing.docs.map((d) => (d.data() as SeasonPlan).version ?? 0);
  const version = (versions.length ? Math.max(...versions) : 0) + 1;
  const id = `${input.propertyId}_${input.seasonKey}_v${version}`;
  const status: SeasonPlanStatus = input.activate ? 'active' : 'draft';

  const activeDocs = existing.docs.filter((d) => (d.data() as SeasonPlan).status === 'active');
  const supersedes = input.activate && activeDocs.length ? activeDocs[0].id : null;

  const plan: SeasonPlan = {
    id,
    propertyId: input.propertyId,
    seasonKey: input.seasonKey,
    season: input.season,
    status,
    version,
    supersedes,
    supersededBy: null,
    asOf: input.asOf,
    envelope: input.envelope,
    slots: input.slots,
    excluded: input.excluded,
    narrative: input.narrative,
    method: input.method,
    createdBy: input.createdBy,
  };

  await db.runTransaction(async (tx) => {
    // Re-read inside the transaction: another session may have activated a plan
    // between the query above and this write.
    const liveActive = await tx.get(
      db
        .collection(COLLECTION)
        .where('propertyId', '==', input.propertyId)
        .where('seasonKey', '==', input.seasonKey)
        .where('status', '==', 'active')
    );

    if (input.activate && liveActive.size > 1) {
      throw new Error(
        `invariant broken: ${liveActive.size} active plans already exist for ${input.propertyId}/${input.seasonKey}`
      );
    }

    tx.set(db.collection(COLLECTION).doc(id), {
      ...plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (input.activate) {
      for (const doc of liveActive.docs) {
        tx.update(doc.ref, { status: 'superseded', supersededBy: id, updatedAt: new Date() });
      }
    }
  });

  logger.info('landSeasonPlan: landed', {
    propertyId: input.propertyId,
    seasonKey: input.seasonKey,
    id,
    version,
    status,
    supersedes,
    funded: input.slots.filter((s) => s.funded).length,
    advisoryTotalMinor: input.slots.reduce((s, x) => s + x.advisoryBudgetMinor, 0),
  });

  return { id, version, status, supersedes };
}
