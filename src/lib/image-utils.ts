/**
 * Client-side image processing utilities for upload.
 * Canvas-based resize with WebP preference, JPEG fallback.
 */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Size tiers. `display` is what guests actually see.
 *
 * Sized off the worst case on the site: the gallery is columns-1 on mobile, so
 * a tile is the full ~390 CSS px viewport. At DPR 2.6, the common mid-range
 * Android, that wants ~1014 device px, so 1000 is the honest number. 1200 only
 * helps DPR 3 flagships and costs ~35% more bytes on a dense photo, and the
 * 400px thumbnail visibly softens at any of these densities.
 */
export const IMAGE_TIERS = {
  full: { maxWidth: 2048, quality: 0.85 },
  display: { maxWidth: 1000, quality: 0.72 },
  thumbnail: { maxWidth: 400, quality: 0.8 },
} as const;

export interface ProcessedImage {
  full: Blob;
  display: Blob;
  thumbnail: Blob;
  mimeType: string;
  extension: string;
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Use JPEG, PNG, or WebP.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`;
  }
  return null;
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      mimeType,
      quality
    );
  });
}

async function resizeImage(
  file: File | Blob,
  maxWidth: number,
  quality: number,
  /** Skip WebP entirely. Set for the full tier, which has to stay uploadable to Meta. */
  forceJpeg = false
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const img = await loadImage(file);

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(img, 0, 0, width, height);

  // Try WebP first, fall back to JPEG — unless the caller demands JPEG (see processImageForUpload).
  if (!forceJpeg) {
    try {
      const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
      // Verify browser actually produced WebP (some return PNG silently)
      if (webpBlob.type === 'image/webp') {
        return { blob: webpBlob, mimeType: 'image/webp', extension: 'webp' };
      }
    } catch {
      // WebP not supported, fall through
    }
  }

  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return { blob: jpegBlob, mimeType: 'image/jpeg', extension: 'jpg' };
}

/**
 * The FULL tier is always JPEG; display and thumbnail stay WebP.
 *
 * WebP is the right choice for the web and unusable for advertising: Meta's /adimages endpoint
 * refuses it outright (FileTypeNotSupported, subcode 1487411, verified against the live account
 * 2026-08-17). Because every tier used to prefer WebP, fifteen photos in the gallery could never be
 * advertised, and the failure surfaced as "image-too-narrow" on a 2048px image.
 *
 * This costs nothing on the site: `displaySrc()` renders `displayUrl` (the 1000px WebP) and only
 * falls back to the full tier when no derivative exists. The full tier is the lightbox and the ad
 * original — the one place a slightly larger, universally accepted file is worth having.
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  const full = await resizeImage(file, IMAGE_TIERS.full.maxWidth, IMAGE_TIERS.full.quality, true);
  const display = await resizeImage(file, IMAGE_TIERS.display.maxWidth, IMAGE_TIERS.display.quality);
  const thumbnail = await resizeImage(file, IMAGE_TIERS.thumbnail.maxWidth, IMAGE_TIERS.thumbnail.quality);

  return {
    full: full.blob,
    display: display.blob,
    thumbnail: thumbnail.blob,
    mimeType: full.mimeType,
    extension: full.extension,
  };
}
