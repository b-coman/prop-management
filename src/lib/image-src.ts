/**
 * Which stored derivative to render for a property image.
 *
 * Uploads produce three tiers (see `image-utils.ts` IMAGE_TIERS):
 *   url          2048px  the original, only worth shipping into a lightbox
 *   displayUrl   1200px  what every guest-facing card, grid and hero should use
 *   thumbnailUrl  400px  admin pickers only, too soft for a full-width mobile tile
 *
 * Both derivatives are optional on purpose. Images uploaded before a tier
 * existed, and images added by pasting a raw URL rather than uploading a file,
 * have neither. Every helper here falls back to `url`, so a missing derivative
 * costs bandwidth but never renders a broken image.
 *
 * Always route guest-facing reads through these instead of touching `.url`
 * directly, so the rule lives in one place and the call sites stay greppable.
 */

interface ImageLike {
  url?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
}

// All three return '' rather than undefined for a missing image: SafeImage
// treats a falsy src as "unavailable" and renders its own fallback, and '' also
// satisfies next/image's `src` type without pushing null-checks to every caller.

/** 1200px derivative for cards, grids and heroes. Falls back to the original. */
export function displaySrc(image: ImageLike | null | undefined): string {
  return image?.displayUrl || image?.url || '';
}

/** Full 2048px original. Use only where the user asked to see it big. */
export function fullSrc(image: ImageLike | null | undefined): string {
  return image?.url || '';
}

/** 400px derivative for dense admin pickers. Falls back up the chain. */
export function thumbSrc(image: ImageLike | null | undefined): string {
  return image?.thumbnailUrl || image?.displayUrl || image?.url || '';
}

/**
 * Build a full-size-URL -> display-URL lookup from a property's image list.
 *
 * Most homepage blocks (hero background, host photo, attraction and room
 * images, testimonial avatars) store a bare URL string in propertyOverrides
 * rather than a PropertyImage object, so there is no `displayUrl` field to
 * read. Storage download tokens are per object, so the derivative URL cannot
 * be derived from the original by string surgery either. Matching on the exact
 * URL is what is left, and it holds: every override image is picked from the
 * property's own library through the admin image picker.
 */
export function buildDisplayUrlMap(images: ImageLike[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const img of images || []) {
    if (img?.url && img.displayUrl) map.set(img.url, img.displayUrl);
  }
  return map;
}

/**
 * Recursively swap any string that is exactly a known full-size image URL for
 * its 1200px derivative. Only exact matches against the property's own images
 * are touched, so this can only ever replace a photo with a smaller version of
 * the same photo. Applied once at the block boundary, which means new blocks
 * get the benefit without needing to know about image tiers.
 */
export function withDisplayVariants<T>(content: T, displayMap: Map<string, string>): T {
  if (displayMap.size === 0 || content == null) return content;

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return displayMap.get(node) ?? node;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      // Leave class instances (Date, Timestamp, ...) alone.
      if (Object.getPrototypeOf(node) !== Object.prototype) return node;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v);
      return out;
    }
    return node;
  };

  return walk(content) as T;
}
