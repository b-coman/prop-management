/**
 * The anchor settings — the handful of numbers the whole rate sheet is built from.
 *
 * These are the owner's spreadsheet constants, brought inside: the Airbnb weekday and weekend base,
 * the factor for each channel, and how far under the cheapest channel the website should sit.
 * Everything else is derived from them.
 *
 * Admin SDK only. The arithmetic is in `src/lib/pricing/anchorPricing.ts`.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import type { AnchorConfig } from '@/lib/pricing/anchorPricing';

const logger = loggers.pricing;
const COLLECTION = 'pricingAnchors';

export interface StoredAnchorConfig extends AnchorConfig {
  propertyId: string;
  /** False until the owner has saved it once — the UI says so rather than implying these are theirs. */
  saved: boolean;
  updatedAt?: unknown;
  updatedBy?: string;
}

/**
 * The values read off the owner's 2026 sheet. Used only as a starting point for a property that has
 * never been configured, and clearly labelled as unsaved until confirmed.
 */
export function defaultAnchorConfig(propertyId: string): StoredAnchorConfig {
  return {
    propertyId,
    saved: false,
    anchorChannelId: 'airbnb',
    weekdayPrice: 475,
    weekendPrice: 625,
    directDiscountPct: 0.075,
    channels: [
      { channelId: 'airbnb', factor: 1.10, currency: 'RON', rounding: { nearest: 5, mode: 'nearest' }, cleaningFee: 200 },
      { channelId: 'booking.com', factor: 1.33, currency: 'RON', rounding: { nearest: 5, mode: 'nearest' }, cleaningFee: 200 },
      { channelId: 'vrbo', factor: 1.10, currency: 'USD', fxDivisor: 4.5, rounding: { nearest: 5, mode: 'up' }, cleaningFee: 200 },
    ],
    directRounding: { nearest: 5, mode: 'nearest' },
  };
}

export async function getAnchorConfig(propertyId: string): Promise<StoredAnchorConfig> {
  const db = await getAdminDb();
  const doc = await db.collection(COLLECTION).doc(propertyId).get();
  if (!doc.exists) return defaultAnchorConfig(propertyId);
  return { ...(doc.data() as StoredAnchorConfig), propertyId, saved: true };
}

export async function saveAnchorConfig(
  propertyId: string,
  config: AnchorConfig,
  updatedBy: string,
): Promise<void> {
  const db = await getAdminDb();
  await db.collection(COLLECTION).doc(propertyId).set({
    ...config,
    propertyId,
    saved: true,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  }, { merge: true });
  logger.info('Anchor pricing config saved', {
    propertyId, updatedBy,
    weekdayPrice: config.weekdayPrice, weekendPrice: config.weekendPrice,
    directDiscountPct: config.directDiscountPct,
  });
}
