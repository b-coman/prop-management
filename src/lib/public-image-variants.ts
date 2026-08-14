/**
 * Responsive variants for the hand-placed photos under public/images.
 *
 * Those files are referenced from Firestore as bare path strings, so they never
 * went through the upload pipeline and have no display/thumbnail derivatives.
 * `scripts/generate-public-image-variants.ts` writes WebP variants beside each
 * original plus the manifest this reads, leaving the originals untouched so
 * every existing reference keeps working.
 *
 * The original stays in the srcset as the widest candidate. That matters: for
 * a dense photo, WebP at the top width can encode LARGER than an already
 * well-compressed source JPEG, and the generator drops those. So the largest
 * thing a desktop can pick is the original file at its native resolution,
 * exactly what it gets today. Small screens gain, nothing else loses.
 *
 * Returns null for any path with no manifest entry, which is the signal to
 * render however the caller rendered before.
 */
import variantData from '@/data/image-variants.json';

interface VariantEntry {
  widths: number[];
  pattern: string;
  originalWidth: number;
  blurDataURL?: string;
}

const manifest = variantData as unknown as Record<string, VariantEntry>;

export interface PublicImageVariants {
  /** Widest-last srcset, ending with the untouched original. */
  srcSet: string;
  /** The original path, still the `src` so non-srcset clients are unaffected. */
  src: string;
  blurDataURL?: string;
}

export function getPublicImageVariants(src: string | null | undefined): PublicImageVariants | null {
  if (!src || !src.startsWith('/images/')) return null;
  const entry = manifest[src];
  if (!entry || entry.widths.length === 0) return null;

  const parts = entry.widths.map((w) => `${entry.pattern.replace('{w}', String(w))} ${w}w`);
  // The original is the top candidate, at its true width.
  parts.push(`${src} ${entry.originalWidth}w`);

  return { srcSet: parts.join(', '), src, blurDataURL: entry.blurDataURL };
}
