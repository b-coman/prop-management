/**
 * growthConfigService — PER-PROPERTY Growth Engine configuration (M1).
 *
 * The automatic reactivation strategy is NOT one-size-fits-all: the mountain
 * chalet wants locals + a seasonal message; a city apartment may want returning
 * foreign travelers + a different template, or no auto-nudge at all. This reads
 * a per-property config doc (`growthConfig/{propertyId}`) with a SAFE default
 * (reactivation OFF until a property is explicitly configured).
 *
 * Plain server module. Cached per process; call clearGrowthConfigCache() in
 * tests/scripts after mutating.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { GrowthPropertyConfig } from '@/types';

const logger = loggers.campaign;

/** Safe default: a property is NOT auto-reactivated until explicitly configured. */
export const DEFAULT_GROWTH_PROPERTY_CONFIG: GrowthPropertyConfig = {
  reactivationEnabled: false,
  reactivationCohort: 'locals', // 'locals' = RO/MD + unknown; 'all' = everyone
  reactivationTemplate: 'seasonal_availability',
};

const cache = new Map<string, GrowthPropertyConfig>();

export async function getGrowthPropertyConfig(propertyId: string): Promise<GrowthPropertyConfig> {
  const cached = cache.get(propertyId);
  if (cached) return cached;

  let config: GrowthPropertyConfig = { ...DEFAULT_GROWTH_PROPERTY_CONFIG };
  try {
    const db = await getAdminDb();
    const doc = await db.collection('growthConfig').doc(propertyId).get();
    if (doc.exists) {
      config = { ...config, ...(doc.data() as Partial<GrowthPropertyConfig>) };
    }
  } catch (error) {
    logger.error('getGrowthPropertyConfig failed; using safe defaults', error as Error, { propertyId });
  }
  cache.set(propertyId, config);
  return config;
}

/** Clear the in-process cache (tests / after writing a config doc). */
export function clearGrowthConfigCache(): void {
  cache.clear();
}
