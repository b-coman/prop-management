// src/lib/og-image.ts
// Server-only helper (uses `fs`) — do not import from client components.
//
// Resolves the Open Graph / social-share image for a property, property-agnostically:
//   1. `property.ogImage` — explicit per-property override (Firestore field), if set.
//   2. Convention path `/images/properties/<slug>/og-image.jpg` — used automatically when
//      that file exists in /public. This is how a property gets a dedicated, purpose-cropped
//      1200x630 share image without any Firestore write: commit the asset at that path.
//   3. `fallbackImageUrl` — caller-supplied generic fallback (e.g. the property's featured
//      photo), used when no dedicated OG image exists yet.
//
// Facebook/Instagram/Twitter fetch the image server-side, so the returned `url` is always
// resolved to an absolute `https://...` URL — relative paths (e.g. template default hero
// images under /public) are rewritten against `baseUrl`.

import fs from 'fs';
import path from 'path';
import type { Property } from '@/types';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export interface ResolvedOgImage {
  url: string;
  alt: string;
  /** Only set for images known to already be a purpose-cropped 1200x630 asset. */
  width?: number;
  height?: number;
}

function toAbsoluteUrl(url: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const pathname = url.startsWith('/') ? url : `/${url}`;
  return `${baseUrl}${pathname}`;
}

/**
 * Convention path for a property's dedicated OG image, relative to /public.
 * e.g. "prahova-mountain-chalet" -> "/images/properties/prahova-mountain-chalet/og-image.jpg"
 */
export function getConventionOgImagePath(slug: string): string {
  return `/images/properties/${slug}/og-image.jpg`;
}

/**
 * Checks whether the convention OG image file exists in /public for this property.
 * Safe no-op (returns false) if the filesystem isn't readable for any reason.
 */
function conventionOgImageExists(slug: string): boolean {
  try {
    const filePath = path.join(process.cwd(), 'public', 'images', 'properties', slug, 'og-image.jpg');
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function resolveOgImage(options: {
  property: Property;
  slug: string;
  baseUrl: string;
  propertyName: string;
  /** Generic fallback (e.g. featured photo or template hero image) — may be relative. */
  fallbackImageUrl?: string;
}): ResolvedOgImage | null {
  const { property, slug, baseUrl, propertyName, fallbackImageUrl } = options;

  // 1. Explicit per-property override.
  if (property.ogImage) {
    return {
      url: toAbsoluteUrl(property.ogImage, baseUrl),
      alt: propertyName,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    };
  }

  // 2. Convention path — dedicated asset committed under /public for this property.
  if (conventionOgImageExists(slug)) {
    return {
      url: toAbsoluteUrl(getConventionOgImagePath(slug), baseUrl),
      alt: propertyName,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    };
  }

  // 3. Generic fallback — dimensions unknown, let Facebook/Twitter probe the image.
  if (fallbackImageUrl) {
    return {
      url: toAbsoluteUrl(fallbackImageUrl, baseUrl),
      alt: propertyName,
    };
  }

  return null;
}
