/**
 * validateAdCreative — the deterministic gate between the ad copywriter (an LLM) and
 * `composeAndCreateAd`. The creative-stage twin of `validateDrafts`: where that guards a per-guest
 * WhatsApp message's grounding + voice, this guards an ad's COPY + PHOTO selection before it can
 * become a PAUSED Meta ad. Its duties (promotion-system-architecture.md §4.2):
 *
 *   1. Photo grounding (narrows-never-widens) — every chosen photo must be one of the pack's
 *      available assets AND owned by this property. This is the ad-side truth anchor: you cannot
 *      show a pool/sauna that does not exist because you can only pick REAL gallery photos.
 *   2. Meta shape — 1..MAX_COPY_VARIANTS copy variants, 1..MAX_IMAGES photos, a valid CTA, and copy
 *      lengths inside Meta's limits (hard errors) / recommendations (warnings, §10).
 *   3. No duplicates — Meta rejects DUPLICATE values within an `asset_feed_spec` array (err 100/
 *      1815809, §9f addendum): two copy variants sharing a headline, or the same photo twice, are
 *      rejected at create time — so reject them here, before the Meta call.
 *
 * Pure — no Firestore, no network, no Meta — exhaustively unit-testable and importable by both the
 * in-app copywriter and any CLI harness. A failure feeds back to the copywriter (bounded repair).
 */
import type { CopyVariant } from '@/types';

/** Meta's `asset_feed_spec` ceilings (docs/meta-ads-infrastructure-2026.md §10). */
const MAX_IMAGES = 10;
const MAX_COPY_VARIANTS = 5;

/** Copy-length bounds. Hard errors bracket what Meta will accept; soft warnings mirror its "shorter performs better" guidance (§10). */
const PRIMARY_MIN = 20;
const PRIMARY_MAX = 500;
const PRIMARY_SOFT = 150; // primary text past ~150 chars risks the "…See more" cut-off (FB feed)
const HEADLINE_MAX = 40;
const HEADLINE_SOFT = 27; // Meta's recommended headline length

const VALID_CTAS = new Set<CopyVariant['cta']>(['learn_more', 'book_now', 'contact_us']);

export interface AdCreativePackForValidation {
  propertyId: string;
  /** The gallery storagePaths the copywriter may choose from (from `adPlannerPack.assets`). */
  assetPaths: string[];
}

export interface AdCreativeForValidation {
  copy: CopyVariant[];
  /** The chosen photo storagePaths — a SUBSET of the pack's assetPaths. */
  assetPaths: string[];
}

export interface AdCreativeValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAdCreative(
  pack: AdCreativePackForValidation,
  creative: AdCreativeForValidation
): AdCreativeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── copy ────────────────────────────────────────────────────────────────
  const copy = creative.copy ?? [];
  if (copy.length < 1) errors.push('no copy variant — an ad needs at least one primary text');
  if (copy.length > MAX_COPY_VARIANTS) errors.push(`too many copy variants (${copy.length} > ${MAX_COPY_VARIANTS})`);

  const primaries: string[] = [];
  const headlines: string[] = [];
  copy.forEach((c, i) => {
    const p = (c.primary ?? '').trim();
    if (!p) {
      errors.push(`variant ${i}: empty primary text`);
    } else {
      if (p.length < PRIMARY_MIN) errors.push(`variant ${i}: primary too short (${p.length} < ${PRIMARY_MIN})`);
      else if (p.length > PRIMARY_MAX) errors.push(`variant ${i}: primary too long (${p.length} > ${PRIMARY_MAX})`);
      else if (p.length > PRIMARY_SOFT) warnings.push(`variant ${i}: primary ${p.length} chars — past ~${PRIMARY_SOFT} risks a "See more" cut-off`);
      primaries.push(p);
    }
    if (c.headline != null && c.headline.trim()) {
      const h = c.headline.trim();
      if (h.length > HEADLINE_MAX) errors.push(`variant ${i}: headline too long (${h.length} > ${HEADLINE_MAX})`);
      else if (h.length > HEADLINE_SOFT) warnings.push(`variant ${i}: headline ${h.length} chars — over Meta's recommended ${HEADLINE_SOFT}`);
      headlines.push(h);
    }
    if (!VALID_CTAS.has(c.cta)) errors.push(`variant ${i}: unknown cta "${c.cta}"`);
  });

  // Meta rejects duplicate values within an asset_feed_spec array (§9f addendum).
  const dupPrimary = [...new Set(primaries.filter((p, i) => primaries.indexOf(p) !== i))];
  if (dupPrimary.length) errors.push(`duplicate primary text — Meta rejects duplicate asset_feed_spec values; make each unique`);
  const dupHeadline = [...new Set(headlines.filter((h, i) => headlines.indexOf(h) !== i))];
  if (dupHeadline.length) errors.push(`duplicate headline — Meta rejects duplicate asset_feed_spec values; make each unique (or share ONE headline across all variants)`);

  // ── photos ──────────────────────────────────────────────────────────────
  const chosen = creative.assetPaths ?? [];
  if (chosen.length < 1) errors.push('no photo selected — an ad needs at least one image');
  if (chosen.length > MAX_IMAGES) errors.push(`too many photos (${chosen.length} > ${MAX_IMAGES})`);

  const available = new Set(pack.assetPaths);
  const offList = chosen.filter((p) => !available.has(p));
  if (offList.length) errors.push(`selected ${offList.length} photo(s) not in the available gallery assets: ${offList.join(', ')}`);

  const ownPrefix = `properties/${pack.propertyId}/`;
  const foreign = chosen.filter((p) => !p.startsWith(ownPrefix));
  if (foreign.length) errors.push(`selected ${foreign.length} photo(s) not owned by ${pack.propertyId}`);

  const dupPhoto = [...new Set(chosen.filter((p, i) => chosen.indexOf(p) !== i))];
  if (dupPhoto.length) errors.push(`the same photo selected more than once — Meta rejects duplicate images in asset_feed_spec`);

  return { ok: errors.length === 0, errors, warnings };
}
