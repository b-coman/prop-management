/**
 * Client-side image processing utilities for upload.
 * Canvas-based resize with WebP preference, JPEG fallback.
 */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface ProcessedImage {
  full: Blob;
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
  quality: number
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

  // Try WebP first, fall back to JPEG
  try {
    const webpBlob = await canvasToBlob(canvas, 'image/webp', quality);
    // Verify browser actually produced WebP (some return PNG silently)
    if (webpBlob.type === 'image/webp') {
      return { blob: webpBlob, mimeType: 'image/webp', extension: 'webp' };
    }
  } catch {
    // WebP not supported, fall through
  }

  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return { blob: jpegBlob, mimeType: 'image/jpeg', extension: 'jpg' };
}

export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  const full = await resizeImage(file, 2048, 0.85);
  const thumbnail = await resizeImage(file, 400, 0.8);

  return {
    full: full.blob,
    thumbnail: thumbnail.blob,
    mimeType: full.mimeType,
    extension: full.extension,
  };
}
