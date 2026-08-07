/**
 * Firestore I/O for `pricingPeriods`, and the compile step that writes back into the collections the
 * guest-facing engine already reads.
 *
 * THE SAFETY PROPERTY: the compiler owns only rows it stamped `provenance.source === 'period-compiler'`.
 * Anything else — hand-made seasons, approved brain proposals, the two disabled legacy fossils — is
 * left exactly where it is. So compiling can never silently delete a rule a human wrote, and a row's
 * origin is always answerable from the row itself.
 *
 * Admin-SDK only. All pricing MATHS lives in `src/lib/pricing/periods.ts`, which is pure; this file
 * only reads, writes and deletes.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import {
  compilePeriods, DEFAULT_TIER_MULTIPLIERS,
  type PricingPeriod, type CompileResult, type TierMultipliers,
} from '@/lib/pricing/periods';

const logger = loggers.pricing;
const PERIODS = 'pricingPeriods';
const SEASONS = 'seasonalPricing';
const OVERRIDES = 'dateOverrides';

export async function getPeriods(propertyId: string): Promise<PricingPeriod[]> {
  const db = await getAdminDb();
  const snap = await db.collection(PERIODS).where('propertyId', '==', propertyId).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as PricingPeriod), id: d.id }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.slug.localeCompare(b.slug));
}

export async function upsertPeriods(periods: PricingPeriod[], updatedBy: string): Promise<void> {
  if (!periods.length) return;
  const db = await getAdminDb();
  const batch = db.batch();
  for (const p of periods) {
    const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));
    batch.set(db.collection(PERIODS).doc(p.id), { ...clean, updatedAt: FieldValue.serverTimestamp(), updatedBy }, { merge: true });
  }
  await batch.commit();
  logger.info('Pricing periods written', { count: periods.length, propertyId: periods[0]?.propertyId, updatedBy });
}

export interface CompileWriteResult extends CompileResult {
  seasonsWritten: number;
  overridesWritten: number;
  /** Compiler-owned rows that no period produces any more, so they were removed. */
  seasonsDeleted: string[];
  overridesDeleted: string[];
  /** Rows left untouched because a human or a proposal owns them. */
  seasonsPreserved: string[];
  overridesPreserved: string[];
  dryRun: boolean;
}

/**
 * Compile a property's periods and reconcile the engine's collections against the result.
 *
 * Deletion is the delicate part: a period that shrinks must remove the rows it no longer covers, or
 * yesterday's prices linger forever. The rule is narrow on purpose — delete only rows this compiler
 * previously created (`provenance.source === 'period-compiler'`) that the current compile did not
 * re-emit. A row with any other provenance is never touched, no matter what it prices.
 */
export async function compileAndWrite(
  propertyId: string,
  opts: {
    tierMultipliers?: TierMultipliers;
    defaultMinimumStay?: number;
    dryRun?: boolean;
    compiledAt?: string;
  } = {},
): Promise<CompileWriteResult> {
  const { dryRun = true } = opts;
  const db = await getAdminDb();
  const periods = await getPeriods(propertyId);

  const result = compilePeriods(periods, {
    tierMultipliers: opts.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS,
    defaultMinimumStay: opts.defaultMinimumStay,
    compiledAt: opts.compiledAt ?? new Date().toISOString(),
  });

  const [seasonSnap, overrideSnap] = await Promise.all([
    db.collection(SEASONS).where('propertyId', '==', propertyId).get(),
    db.collection(OVERRIDES).where('propertyId', '==', propertyId).get(),
  ]);

  const ownedBy = (d: FirebaseFirestore.QueryDocumentSnapshot) =>
    (d.data() as { provenance?: { source?: string } }).provenance?.source === 'period-compiler';

  const emittedSeasonIds = new Set(result.seasons.map((s) => s.id));
  const emittedOverrideIds = new Set(result.overrides.map((o) => o.id));

  const seasonsDeleted = seasonSnap.docs.filter((d) => ownedBy(d) && !emittedSeasonIds.has(d.id)).map((d) => d.id);
  const overridesDeleted = overrideSnap.docs.filter((d) => ownedBy(d) && !emittedOverrideIds.has(d.id)).map((d) => d.id);
  const seasonsPreserved = seasonSnap.docs.filter((d) => !ownedBy(d) && !emittedSeasonIds.has(d.id)).map((d) => d.id);
  const overridesPreserved = overrideSnap.docs.filter((d) => !ownedBy(d) && !emittedOverrideIds.has(d.id)).map((d) => d.id);

  if (!dryRun) {
    const batch = db.batch();
    for (const s of result.seasons) batch.set(db.collection(SEASONS).doc(s.id), s, { merge: true });
    for (const o of result.overrides) batch.set(db.collection(OVERRIDES).doc(o.id), o, { merge: true });
    for (const id of seasonsDeleted) batch.delete(db.collection(SEASONS).doc(id));
    for (const id of overridesDeleted) batch.delete(db.collection(OVERRIDES).doc(id));
    await batch.commit();
    logger.info('Periods compiled to engine collections', {
      propertyId,
      seasons: result.seasons.length,
      overrides: result.overrides.length,
      seasonsDeleted: seasonsDeleted.length,
      overridesDeleted: overridesDeleted.length,
      warnings: result.warnings.length,
    });
  }

  return {
    ...result,
    seasonsWritten: result.seasons.length,
    overridesWritten: result.overrides.length,
    seasonsDeleted, overridesDeleted, seasonsPreserved, overridesPreserved,
    dryRun,
  };
}

/**
 * The horizon a property must be priced to: the furthest active period, floored at 12 months out.
 * Replaces the hardcoded rolling 12 months that nothing ever advanced — which is the whole reason
 * 2027 has no prices.
 */
export function horizonFor(periods: PricingPeriod[], from: Date = new Date()): string {
  const floor = new Date(from.getFullYear(), from.getMonth() + 12, 1);
  const floorYmd = `${floor.getFullYear()}-${String(floor.getMonth() + 1).padStart(2, '0')}-01`;
  const furthest = periods
    .filter((p) => p.status === 'active')
    .reduce((max, p) => (p.endDate > max ? p.endDate : max), '');
  return furthest > floorYmd ? furthest : floorYmd;
}
